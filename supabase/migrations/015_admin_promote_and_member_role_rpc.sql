-- =============================================================================
-- FUTPLAY LITE — SCRIPT 015: RPC DE GESTÃO DE CARGOS E PROMOÇÃO DE TREINADORES
-- Arquivo: supabase/migrations/015_admin_promote_and_member_role_rpc.sql
-- =============================================================================
-- OBJETIVO:
-- 1. Permitir que Administradores da Liga e Donos de Equipe promovam atletas a Treinadores
--    (ou rebaixem a Atletas) de forma atômica, auditada e sincronizada.
-- 2. Atualizar em uma única transação:
--    a) public.users (role = 'coach' / 'player', is_team_owner)
--    b) public.player_profiles (role, is_team_owner)
--    c) public.team_memberships (can_manage_sport = true, can_manage_finance = true)
-- 3. Utilizar o mecanismo canônico de locks transacionais em private.trusted_rpc_locks
--    ('admin_manage_user', 'admin_manage_profile') para satisfazer os triggers de segurança.
-- 4. Registrar cada alteração no ledger imutável public.audit_logs.
-- =============================================================================

BEGIN;

-- 1. Permite 'coach' na restrição de verificação de role na tabela users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('player', 'coach', 'moderator', 'admin'));

-- 2. Adiciona coluna role na tabela player_profiles se não existir
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';

-- 3. Função aprimorada para identificação de Administrador da Plataforma
CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT (
                (u.role = 'admin' OR LOWER(COALESCE(u.email, '')) = 'futplaylite@gmail.com' OR u.id = 'a0000000-0000-4000-8000-000000000001'::uuid)
                AND u.status = 'ativa'
            )
            FROM public.users u
            WHERE u.id = auth.uid()
              AND auth.uid() IS NOT NULL
        ),
        false
    );
$$;

REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO authenticated, service_role;

-- 4. RPC Oficial: public.admin_set_player_role_authenticated
CREATE OR REPLACE FUNCTION public.admin_set_player_role_authenticated(
    p_target_user_id UUID,
    p_new_role TEXT,
    p_can_manage_sport BOOLEAN DEFAULT NULL,
    p_can_manage_finance BOOLEAN DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_admin BOOLEAN := false;
    v_is_team_owner BOOLEAN := false;
    v_target_user RECORD;
    v_target_profile RECORD;
    v_real_user_id UUID;
    v_membership RECORD;
    v_is_coach BOOLEAN;
    v_manage_sport BOOLEAN;
    v_manage_finance BOOLEAN;
    v_team_id UUID;
    v_team_name TEXT;
    v_reason TEXT;
    v_txid BIGINT := pg_catalog.txid_current();
BEGIN
    -- 4.1. Verificação de Autenticação
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado.';
    END IF;

    -- 4.2. Validação do novo cargo
    IF p_new_role NOT IN ('player', 'coach', 'admin') THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Cargo inválido (%). Opções válidas: player, coach, admin.', p_new_role;
    END IF;

    -- 4.3. Identificação do usuário e atleta alvo (suporta passagem de user_id ou player_id)
    SELECT * INTO v_target_user FROM public.users WHERE id = p_target_user_id FOR UPDATE;
    IF FOUND THEN
        v_real_user_id := v_target_user.id;
        SELECT * INTO v_target_profile FROM public.player_profiles WHERE user_id = v_real_user_id FOR UPDATE;
    ELSE
        SELECT * INTO v_target_profile FROM public.player_profiles WHERE id = p_target_user_id FOR UPDATE;
        IF FOUND THEN
            v_real_user_id := v_target_profile.user_id;
            SELECT * INTO v_target_user FROM public.users WHERE id = v_real_user_id FOR UPDATE;
        ELSE
            RAISE EXCEPTION 'NAO_ENCONTRADO: Usuário ou atleta % não encontrado.', p_target_user_id;
        END IF;
    END IF;

    -- 4.4. Verificação de Autorização: Administrador da Plataforma OU Dono da Equipe
    v_is_admin := private.is_platform_admin();

    IF NOT v_is_admin THEN
        -- Verifica se o chamador é o proprietário da equipe à qual o alvo pertence
        SELECT tm_owner.is_owner INTO v_is_team_owner
        FROM public.team_memberships tm_target
        JOIN public.team_memberships tm_owner ON tm_owner.team_id = tm_target.team_id
        WHERE tm_target.user_id = v_real_user_id
          AND tm_owner.user_id = v_caller_id
          AND tm_owner.is_owner = true
          AND tm_owner.status = 'active';

        IF NOT COALESCE(v_is_team_owner, false) THEN
            RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas administradores da liga ou proprietários da equipe podem alterar o cargo deste membro.';
        END IF;

        IF p_new_role = 'admin' THEN
            RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas administradores da plataforma podem conceder o cargo admin.';
        END IF;
    END IF;

    -- Proteção contra demolição de administradores por não-admins
    IF v_target_user.role = 'admin' AND p_new_role <> 'admin' AND NOT v_is_admin THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Não é permitido rebaixar um administrador da plataforma.';
    END IF;

    -- 4.5. Configura permissões esportivas e financeiras canônicas
    v_is_coach := (p_new_role = 'coach');
    v_manage_sport := COALESCE(p_can_manage_sport, v_is_coach);
    v_manage_finance := COALESCE(p_can_manage_finance, v_is_coach);
    v_reason := COALESCE(NULLIF(pg_catalog.btrim(p_reason), ''), 'Alteração de cargo para ' || p_new_role || ' realizada por administrador.');

    -- 4.6. Busca vínculo do membro na tabela canônica team_memberships
    SELECT * INTO v_membership
    FROM public.team_memberships
    WHERE user_id = v_real_user_id AND status = 'active'
    FOR UPDATE;

    -- Impede rebaixar para atleta comum se o usuário for o proprietário ativo da equipe
    IF FOUND AND v_membership.is_owner = true AND p_new_role = 'player' THEN
        RAISE EXCEPTION 'OPERACAO_INVALIDA: O membro é o proprietário ativo da equipe. Transfira a titularidade antes de torná-lo atleta comum.';
    END IF;

    -- 4.7. Adquire locks transacionais nas tabelas protegidas
    INSERT INTO private.trusted_rpc_locks (txid, operation, target_id, actor_id)
    VALUES (v_txid, 'admin_manage_user', v_real_user_id::text, v_caller_id)
    ON CONFLICT (txid, operation, target_id) DO NOTHING;

    IF v_target_profile.id IS NOT NULL THEN
        INSERT INTO private.trusted_rpc_locks (txid, operation, target_id, actor_id)
        VALUES (v_txid, 'admin_manage_profile', v_target_profile.id::text, v_caller_id)
        ON CONFLICT (txid, operation, target_id) DO NOTHING;
    END IF;

    -- 4.8. Atualiza public.users
    UPDATE public.users
    SET role = p_new_role,
        is_team_owner = CASE WHEN v_is_coach THEN true ELSE (is_team_owner AND p_new_role <> 'player') END,
        updated_at = pg_catalog.now()
    WHERE id = v_real_user_id;

    -- 4.9. Atualiza public.player_profiles
    IF v_target_profile.id IS NOT NULL THEN
        UPDATE public.player_profiles
        SET role = p_new_role,
            is_team_owner = CASE WHEN v_is_coach THEN true ELSE (is_team_owner AND p_new_role <> 'player') END,
            updated_at = pg_catalog.now()
        WHERE id = v_target_profile.id;
    END IF;

    -- 4.10. Atualiza ou vincula em public.team_memberships
    IF v_membership.id IS NOT NULL THEN
        UPDATE public.team_memberships
        SET can_manage_sport = CASE WHEN v_membership.is_owner THEN true ELSE v_manage_sport END,
            can_manage_finance = CASE WHEN v_membership.is_owner THEN true ELSE v_manage_finance END,
            updated_at = pg_catalog.now()
        WHERE id = v_membership.id;
    ELSE
        -- Se não tinha linha em team_memberships, resolve o time pelo perfil ou usuário
        v_team_name := COALESCE(v_target_profile.team_name, v_target_user.team_name);
        IF v_team_name IS NOT NULL AND v_team_name NOT IN ('', 'Sem Time', 'Meu Time') THEN
            SELECT id INTO v_team_id
            FROM public.teams
            WHERE slug = private.normalize_slug(v_team_name) OR name = pg_catalog.btrim(v_team_name)
            LIMIT 1;

            IF v_team_id IS NOT NULL AND v_target_profile.id IS NOT NULL THEN
                INSERT INTO public.team_memberships (
                    team_id, user_id, player_id, is_owner, can_manage_sport, can_manage_finance, status
                ) VALUES (
                    v_team_id, v_real_user_id, v_target_profile.id, false, v_manage_sport, v_manage_finance, 'active'
                )
                ON CONFLICT (team_id, user_id) DO UPDATE
                SET can_manage_sport = EXCLUDED.can_manage_sport,
                    can_manage_finance = EXCLUDED.can_manage_finance,
                    status = 'active',
                    updated_at = pg_catalog.now();
            END IF;
        END IF;
    END IF;

    -- 4.11. Libera locks transacionais
    DELETE FROM private.trusted_rpc_locks
    WHERE txid = v_txid
      AND actor_id = v_caller_id
      AND operation IN ('admin_manage_user', 'admin_manage_profile');

    -- 4.12. Registra auditoria oficial imutável
    PERFORM private.append_official_audit_log(
        'ALTERACAO_CARGO_MEMBRO',
        'users',
        v_real_user_id::text,
        v_reason
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'user_id', v_real_user_id,
        'player_id', v_target_profile.id,
        'new_role', p_new_role,
        'is_coach', v_is_coach,
        'can_manage_sport', v_manage_sport,
        'can_manage_finance', v_manage_finance,
        'message', 'Cargo e permissões atualizados com sucesso no Supabase.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_player_role_authenticated(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_player_role_authenticated(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;

COMMIT;
