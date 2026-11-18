-- =============================================================================
-- FUTPLAY LITE — SCRIPT 015: REGRA DEFINITIVA DOS TRÊS NÍVEIS DE ACESSO
-- Arquivo: supabase/migrations/015_admin_promote_and_member_role_rpc.sql
-- =============================================================================
-- DEFINIÇÃO OFICIAL DE PERMISSÕES DO PRODUTO (FUTPLAY LITE V6):
-- Exatamente TRÊS níveis de acesso:
-- 1. ADMINISTRADOR ('admin'):
--    - Acesso global e irrestrito às funcionalidades administrativas.
--    - Administra todas as equipes, caixas, mensalidades, relatórios, permissões.
--    - Não fica limitado a uma equipe específica.
--    - Somente o administrador pode promover ou rebaixar membros.
-- 2. TREINADOR ('coach'):
--    - Controle completo e exclusivo da equipe à qual está vinculado.
--    - Administra súmulas, partidas, atletas, caixa, receitas, despesas,
--      mensalidades, pagamentos, relatórios e agendamento de treinos do próprio time.
--    - Não acessa o financeiro, súmulas ou mensalidades de outros times.
--    - Não pode promover a própria conta nem alterar permissões administrativas.
-- 3. ATLETA ('player' / 'athlete'):
--    - Acesso restrito a funcionalidades de jogador (perfil, estatísticas,
--      rankings, cartão, participação em partidas, avaliações).
--    - Não administra caixa, mensalidades, relatórios ou permissões.
--    - Não pode alterar o próprio cargo.
-- =============================================================================

BEGIN;

-- 1. Restrição canônica de papéis na tabela users
-- Aceita 'player', 'athlete', 'coach' e 'admin'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('player', 'athlete', 'coach', 'admin'));

-- 2. Coluna role na tabela player_profiles e permissão de leitura em users
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';
GRANT SELECT ON public.users TO authenticated;

-- 3. Função de verificação de Administrador da Plataforma (backend-enforced)
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
                AND u.must_reset_password = false
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

-- 4. Função de verificação de permissão esportiva de equipe
-- Administrador tem acesso global; Treinador tem acesso à sua equipe ativa; Atleta não tem acesso administrativo
CREATE OR REPLACE FUNCTION private.has_team_sport_permission(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT true
            WHERE private.is_platform_admin()
        ),
        (
            SELECT EXISTS (
                SELECT 1
                FROM public.team_memberships tm
                JOIN public.teams t ON t.id = tm.team_id
                JOIN public.users u ON u.id = tm.user_id
                WHERE tm.user_id = auth.uid()
                  AND auth.uid() IS NOT NULL
                  AND tm.team_id = p_team_id
                  AND p_team_id IS NOT NULL
                  AND tm.status = 'active'
                  AND (u.role = 'coach' OR tm.can_manage_sport = true OR tm.is_owner = true)
                  AND t.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

REVOKE ALL ON FUNCTION private.has_team_sport_permission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_team_sport_permission(UUID) TO authenticated, service_role;

-- 5. Função de verificação de permissão financeira de equipe
-- Administrador tem acesso global; Treinador tem acesso à sua equipe ativa; Atleta não tem acesso administrativo
CREATE OR REPLACE FUNCTION private.has_team_finance_permission(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT true
            WHERE private.is_platform_admin()
        ),
        (
            SELECT EXISTS (
                SELECT 1
                FROM public.team_memberships tm
                JOIN public.teams t ON t.id = tm.team_id
                JOIN public.users u ON u.id = tm.user_id
                WHERE tm.user_id = auth.uid()
                  AND auth.uid() IS NOT NULL
                  AND tm.team_id = p_team_id
                  AND p_team_id IS NOT NULL
                  AND tm.status = 'active'
                  AND (u.role = 'coach' OR tm.can_manage_finance = true OR tm.is_owner = true)
                  AND t.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

REVOKE ALL ON FUNCTION private.has_team_finance_permission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_team_finance_permission(UUID) TO authenticated, service_role;

-- 6. Função de verificação de liderança / controle de equipe
CREATE OR REPLACE FUNCTION private.is_team_owner(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT true
            WHERE private.is_platform_admin()
        ),
        (
            SELECT EXISTS (
                SELECT 1
                FROM public.team_memberships tm
                JOIN public.teams t ON t.id = tm.team_id
                JOIN public.users u ON u.id = tm.user_id
                WHERE tm.user_id = auth.uid()
                  AND auth.uid() IS NOT NULL
                  AND tm.team_id = p_team_id
                  AND p_team_id IS NOT NULL
                  AND tm.status = 'active'
                  AND (
                      u.role = 'coach'
                      OR tm.is_owner = true
                      OR tm.can_manage_sport = true
                      OR tm.can_manage_finance = true
                  )
                  AND t.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

REVOKE ALL ON FUNCTION private.is_team_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_team_owner(UUID) TO authenticated, service_role;

-- 7. View canônica de permissões do ator autenticado (public.current_actor_team_memberships_v)
CREATE OR REPLACE VIEW public.current_actor_team_memberships_v
WITH (security_invoker = false)
AS
SELECT
    tm.team_id,
    tm.user_id,
    tm.player_id,
    (u.role = 'coach' OR tm.is_owner) AS is_owner,
    (u.role = 'coach' OR tm.can_manage_sport OR tm.is_owner) AS has_sport_permission,
    (u.role = 'coach' OR tm.can_manage_finance OR tm.is_owner) AS has_finance_permission
FROM public.team_memberships tm
JOIN public.teams t ON t.id = tm.team_id
JOIN public.users u ON u.id = tm.user_id
WHERE tm.user_id = auth.uid()
  AND auth.uid() IS NOT NULL
  AND tm.status = 'active'
  AND t.status = 'active'
  AND u.status = 'ativa'
  AND u.must_reset_password = false;

REVOKE ALL ON public.current_actor_team_memberships_v FROM PUBLIC, anon;
GRANT SELECT ON public.current_actor_team_memberships_v TO authenticated, service_role;

-- 8. Permissões DDL e RLS nas tabelas public.teams e public.team_memberships
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_memberships TO authenticated;

DROP POLICY IF EXISTS teams_insert_admin ON public.teams;
CREATE POLICY teams_insert_admin ON public.teams
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin));

DROP POLICY IF EXISTS teams_update_admin_or_coach ON public.teams;
CREATE POLICY teams_update_admin_or_coach ON public.teams
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        OR EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = teams.id AND m.has_sport_permission)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        OR EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = teams.id AND m.has_sport_permission)
    );

DROP POLICY IF EXISTS teams_delete_admin ON public.teams;
CREATE POLICY teams_delete_admin ON public.teams
    FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin));

DROP POLICY IF EXISTS memberships_insert_admin_or_coach ON public.team_memberships;
CREATE POLICY memberships_insert_admin_or_coach ON public.team_memberships
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        OR EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_memberships.team_id AND m.has_sport_permission)
    );

DROP POLICY IF EXISTS memberships_update_admin_or_coach ON public.team_memberships;
CREATE POLICY memberships_update_admin_or_coach ON public.team_memberships
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        OR EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_memberships.team_id AND m.has_sport_permission)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        OR EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_memberships.team_id AND m.has_sport_permission)
    );

DROP POLICY IF EXISTS memberships_delete_admin_or_coach ON public.team_memberships;
CREATE POLICY memberships_delete_admin_or_coach ON public.team_memberships
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        OR EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_memberships.team_id AND m.has_sport_permission)
    );

-- 9. RPC Oficial: public.admin_set_player_role_authenticated
-- Somente administradores da plataforma podem promover ou rebaixar membros
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
    v_target_user RECORD;
    v_target_profile RECORD;
    v_real_user_id UUID;
    v_membership RECORD;
    v_norm_role TEXT;
    v_is_coach BOOLEAN;
    v_is_admin BOOLEAN;
    v_manage_sport BOOLEAN;
    v_manage_finance BOOLEAN;
    v_team_id UUID;
    v_team_name TEXT;
    v_reason TEXT;
    v_txid BIGINT := pg_catalog.txid_current();
BEGIN
    -- 9.1. Verificação de Autenticação
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado.';
    END IF;

    -- 9.2. EXCLUSIVIDADE: Somente administradores da plataforma podem alterar cargos
    IF NOT private.is_platform_admin() THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Somente administradores da plataforma podem alterar cargos de membros.';
    END IF;

    -- 9.3. Normalização e validação dos 3 níveis de acesso
    v_norm_role := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_new_role, '')));
    IF v_norm_role = 'athlete' THEN
        v_norm_role := 'player';
    END IF;

    IF v_norm_role NOT IN ('player', 'coach', 'admin') THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Cargo inválido (%). Opções oficiais: player (ou athlete), coach, admin.', p_new_role;
    END IF;

    -- 9.4. Resolução do alvo (por user_id ou player_id)
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

    -- 9.5. Configura permissões canônicas conforme o nível de acesso
    v_is_coach := (v_norm_role = 'coach');
    v_is_admin := (v_norm_role = 'admin');

    IF v_is_coach THEN
        v_manage_sport := true;
        v_manage_finance := true;
    ELSIF v_norm_role = 'player' THEN
        v_manage_sport := false;
        v_manage_finance := false;
    ELSE
        v_manage_sport := false;
        v_manage_finance := false;
    END IF;

    -- Sobrescreve se explicitamente informado pelo admin
    IF p_can_manage_sport IS NOT NULL THEN
        v_manage_sport := p_can_manage_sport;
    END IF;
    IF p_can_manage_finance IS NOT NULL THEN
        v_manage_finance := p_can_manage_finance;
    END IF;

    v_reason := COALESCE(NULLIF(pg_catalog.btrim(p_reason), ''), 'Alteração de cargo para ' || v_norm_role || ' realizada por administrador.');

    -- 9.6. Busca vínculo do membro na tabela team_memberships
    SELECT * INTO v_membership
    FROM public.team_memberships
    WHERE user_id = v_real_user_id AND status = 'active'
    FOR UPDATE;

    -- 9.7. Adquire locks transacionais nas tabelas protegidas
    INSERT INTO private.trusted_rpc_locks (txid, operation, target_id, actor_id)
    VALUES (v_txid, 'admin_manage_user', v_real_user_id::text, v_caller_id)
    ON CONFLICT (txid, operation, target_id) DO NOTHING;

    IF v_target_profile.id IS NOT NULL THEN
        INSERT INTO private.trusted_rpc_locks (txid, operation, target_id, actor_id)
        VALUES (v_txid, 'admin_manage_profile', v_target_profile.id::text, v_caller_id)
        ON CONFLICT (txid, operation, target_id) DO NOTHING;
    END IF;

    -- 9.8. Atualiza public.users
    UPDATE public.users
    SET role = v_norm_role,
        is_team_owner = v_is_coach,
        updated_at = pg_catalog.now()
    WHERE id = v_real_user_id;

    -- 9.9. Atualiza public.player_profiles
    IF v_target_profile.id IS NOT NULL THEN
        UPDATE public.player_profiles
        SET role = v_norm_role,
            is_team_owner = v_is_coach,
            updated_at = pg_catalog.now()
        WHERE id = v_target_profile.id;
    END IF;

    -- 9.10. Atualiza permissões em public.team_memberships
    -- Se rebaixado a atleta, remove privilégios administrativos e titularidade
    -- Se promovido a treinador, concede can_manage_sport e can_manage_finance
    IF v_membership.id IS NOT NULL THEN
        UPDATE public.team_memberships
        SET can_manage_sport = v_manage_sport,
            can_manage_finance = v_manage_finance,
            is_owner = CASE WHEN v_norm_role = 'player' THEN false ELSE is_owner END,
            updated_at = pg_catalog.now()
        WHERE id = v_membership.id;
    ELSE
        -- Vincula à equipe existente se ainda não tinha linha em team_memberships
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
                    is_owner = CASE WHEN v_norm_role = 'player' THEN false ELSE team_memberships.is_owner END,
                    status = 'active',
                    updated_at = pg_catalog.now();
            END IF;
        END IF;
    END IF;

    -- 9.11. Libera locks transacionais
    DELETE FROM private.trusted_rpc_locks
    WHERE txid = v_txid
      AND actor_id = v_caller_id
      AND operation IN ('admin_manage_user', 'admin_manage_profile');

    -- 9.12. Registra auditoria oficial imutável
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
        'new_role', v_norm_role,
        'is_coach', v_is_coach,
        'is_team_owner', v_is_coach,
        'can_manage_sport', v_manage_sport,
        'can_manage_finance', v_manage_finance,
        'message', 'Cargo atualizado com sucesso no FutPlay Lite.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_player_role_authenticated(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_player_role_authenticated(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;

COMMIT;
