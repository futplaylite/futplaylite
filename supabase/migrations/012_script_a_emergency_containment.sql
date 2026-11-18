-- =============================================================================
-- FUTPLAY LITE — MIGRAÇÃO 012 (SCRIPT A): CONTENÇÃO EMERGENCIAL ESTRITA
-- Conformidade integral com ADR-001 (Quarta Revisão Técnica)
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SCHEMA PRIVADO NÃO EXPOSTO E TABELA DE LOCKS TRANSACIONAIS DE RPC
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Substitui qualquer uso de set_config/current_setting (GUC) por tabela privada
-- inacessível a anon e authenticated (impede exploração de trusted_rpc_context - TESTE 13)
CREATE TABLE IF NOT EXISTS private.trusted_rpc_locks (
    txid BIGINT NOT NULL DEFAULT pg_catalog.txid_current(),
    operation TEXT NOT NULL,
    target_id TEXT NOT NULL,
    actor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    PRIMARY KEY (txid, operation, target_id)
);

REVOKE ALL ON TABLE private.trusted_rpc_locks FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.normalize_slug(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(COALESCE(p_text, ''))), '[^a-z0-9]+', '_', 'g'),
        '^_+|_+$', '', 'g'
    );
$$;

-- -----------------------------------------------------------------------------
-- 2. IDENTIDADE, FLAG must_reset_password E MODELO CANÔNICO DE EQUIPES
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT true;

-- ADR-001 Seção 2.2: public.teams NÃO possui owner_user_id nem invite_code em texto claro
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL CHECK (pg_catalog.length(slug) >= 2),
    name TEXT UNIQUE NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(name)) BETWEEN 2 AND 60),
    city_id UUID REFERENCES public.cities(id),
    city_name TEXT NOT NULL DEFAULT 'Planalto - BA',
    modality TEXT NOT NULL DEFAULT 'society' CHECK (modality IN ('society', 'futsal', 'futebol_areia', 'futebol_campo')),
    crest_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- ADR-001 Seção 2.2: public.team_memberships é a ÚNICA fonte de titularidade e permissões
CREATE TABLE IF NOT EXISTS public.team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    is_owner BOOLEAN NOT NULL DEFAULT false,
    can_manage_sport BOOLEAN NOT NULL DEFAULT false,
    can_manage_finance BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT uq_team_user_membership UNIQUE (team_id, user_id),
    CONSTRAINT uq_team_player_membership UNIQUE (team_id, player_id),
    CONSTRAINT chk_owner_full_permissions CHECK (
        NOT is_owner OR (can_manage_sport = true AND can_manage_finance = true)
    )
);

-- Restrições canônicas: 1 único proprietário ativo por equipe e 1 única equipe ativa por usuário
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_owner_per_team
    ON public.team_memberships (team_id)
    WHERE is_owner = true AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_team_per_user
    ON public.team_memberships (user_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_team_memberships_team_active
    ON public.team_memberships (team_id, status);

-- Popula teams e team_memberships a partir dos 22 perfis existentes de forma idempotente
INSERT INTO public.teams (slug, name, city_id, city_name, modality, crest_url)
SELECT DISTINCT ON (private.normalize_slug(COALESCE(p.team_name, u.team_name)))
    private.normalize_slug(COALESCE(p.team_name, u.team_name)) AS slug,
    pg_catalog.btrim(COALESCE(p.team_name, u.team_name)) AS name,
    p.city_id,
    COALESCE(p.team_city, u.team_city, 'Planalto - BA') AS city_name,
    CASE
        WHEN COALESCE(p.team_modality, u.team_modality) IN ('society', 'futsal', 'futebol_areia', 'futebol_campo')
        THEN COALESCE(p.team_modality, u.team_modality)
        ELSE 'society'
    END AS modality,
    COALESCE(p.team_crest_url, u.team_crest_url) AS crest_url
FROM public.player_profiles p
JOIN public.users u ON u.id = p.user_id
WHERE COALESCE(p.team_name, u.team_name) IS NOT NULL
  AND private.normalize_slug(COALESCE(p.team_name, u.team_name)) NOT IN ('', 'meu_time', 'sem_time')
ORDER BY
    private.normalize_slug(COALESCE(p.team_name, u.team_name)),
    COALESCE(p.is_team_owner, u.is_team_owner, false) DESC,
    p.updated_at DESC
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.team_memberships (
    team_id, user_id, player_id, is_owner, can_manage_sport, can_manage_finance, status
)
SELECT
    t.id AS team_id,
    u.id AS user_id,
    p.id AS player_id,
    COALESCE(p.is_team_owner, u.is_team_owner, false) AS is_owner,
    (COALESCE(p.is_team_owner, u.is_team_owner, false) OR u.role = 'coach') AS can_manage_sport,
    (COALESCE(p.is_team_owner, u.is_team_owner, false) OR u.role = 'coach') AS can_manage_finance,
    'active' AS status
FROM public.player_profiles p
JOIN public.users u ON u.id = p.user_id
JOIN public.teams t ON t.slug = private.normalize_slug(COALESCE(p.team_name, u.team_name))
WHERE u.role <> 'admin'
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Adiciona team_id UUID em pelada_sumulas e preenche para registros vinculados a equipes existentes
ALTER TABLE public.pelada_sumulas ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

UPDATE public.pelada_sumulas ps
SET team_id = t.id
FROM public.teams t
WHERE ps.team_id IS NULL
  AND (
      t.slug = private.normalize_slug(ps.team_name)
      OR ps.id = ('finance_ledger_' || t.slug)
      OR ps.id = ('monthly_config_ledger_' || t.slug)
      OR ps.id = ('pelada_schedule_ledger_' || t.slug)
  );

-- -----------------------------------------------------------------------------
-- 3. FUNÇÕES DE AUTORIZAÇÃO NO SCHEMA PRIVATE (ZERO AUTORIZAÇÃO POR NOME!)
--    Todas exigem must_reset_password = false (Etapa 5 / Teste 9)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_active_verified_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT (u.status = 'ativa' AND u.must_reset_password = false)
            FROM public.users u
            WHERE u.id = auth.uid()
              AND auth.uid() IS NOT NULL
        ),
        false
    );
$$;

CREATE OR REPLACE FUNCTION private.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT u.role
            FROM public.users u
            WHERE u.id = auth.uid()
              AND auth.uid() IS NOT NULL
              AND u.status = 'ativa'
              AND u.must_reset_password = false
        ),
        'anonymous'
    );
$$;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT (u.role = 'admin' AND u.status = 'ativa' AND u.must_reset_password = false)
            FROM public.users u
            WHERE u.id = auth.uid()
              AND auth.uid() IS NOT NULL
        ),
        false
    );
$$;

CREATE OR REPLACE FUNCTION private.is_platform_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT (u.role IN ('admin', 'moderator') AND u.status = 'ativa' AND u.must_reset_password = false)
            FROM public.users u
            WHERE u.id = auth.uid()
              AND auth.uid() IS NOT NULL
        ),
        false
    );
$$;

CREATE OR REPLACE FUNCTION private.is_active_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
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
                  AND t.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

CREATE OR REPLACE FUNCTION private.has_team_sport_permission(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
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
                  AND (tm.can_manage_sport = true OR tm.is_owner = true)
                  AND t.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

CREATE OR REPLACE FUNCTION private.has_team_finance_permission(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
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
                  AND (tm.can_manage_finance = true OR tm.is_owner = true)
                  AND t.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

CREATE OR REPLACE FUNCTION private.is_team_owner(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
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
                  AND tm.is_owner = true
                  AND t.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

-- Verifica se o usuário autenticado compartilha a mesma equipe ativa com um perfil alvo (para profile_visibility = 'restrito')
CREATE OR REPLACE FUNCTION private.shares_active_team_with_profile(p_target_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (
            SELECT EXISTS (
                SELECT 1
                FROM public.team_memberships tm_self
                JOIN public.team_memberships tm_target ON tm_target.team_id = tm_self.team_id
                JOIN public.users u ON u.id = tm_self.user_id
                WHERE tm_self.user_id = auth.uid()
                  AND auth.uid() IS NOT NULL
                  AND tm_target.player_id = p_target_profile_id
                  AND tm_self.status = 'active'
                  AND tm_target.status = 'active'
                  AND u.status = 'ativa'
                  AND u.must_reset_password = false
            )
        ),
        false
    );
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO service_role;

-- Views de contexto seguro do próprio ator autenticado (security_invoker = false, avaliadas pelo owner postgres)
-- Permitem que políticas RLS consultem o vínculo do próprio auth.uid() sem recursão e sem conceder USAGE no schema private a authenticated
CREATE OR REPLACE VIEW public.current_actor_context_v
WITH (security_invoker = false)
AS
SELECT
    u.id AS user_id,
    u.role AS user_role,
    (u.role = 'admin') AS is_admin,
    (u.role IN ('admin', 'moderator')) AS is_staff
FROM public.users u
WHERE u.id = auth.uid()
  AND auth.uid() IS NOT NULL
  AND u.status = 'ativa'
  AND u.must_reset_password = false;

REVOKE ALL ON public.current_actor_context_v FROM PUBLIC, anon;
GRANT SELECT ON public.current_actor_context_v TO authenticated, service_role;

CREATE OR REPLACE VIEW public.current_actor_team_memberships_v
WITH (security_invoker = false)
AS
SELECT
    tm.team_id,
    tm.user_id,
    tm.player_id,
    tm.is_owner,
    (tm.can_manage_sport OR tm.is_owner) AS has_sport_permission,
    (tm.can_manage_finance OR tm.is_owner) AS has_finance_permission
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

CREATE OR REPLACE VIEW public.current_actor_teammate_profiles_v
WITH (security_invoker = false)
AS
SELECT DISTINCT
    tm_target.player_id
FROM public.team_memberships tm_self
JOIN public.team_memberships tm_target ON tm_target.team_id = tm_self.team_id
JOIN public.teams t ON t.id = tm_self.team_id
JOIN public.users u ON u.id = tm_self.user_id
WHERE tm_self.user_id = auth.uid()
  AND auth.uid() IS NOT NULL
  AND tm_self.status = 'active'
  AND tm_target.status = 'active'
  AND t.status = 'active'
  AND u.status = 'ativa'
  AND u.must_reset_password = false;

REVOKE ALL ON public.current_actor_teammate_profiles_v FROM PUBLIC, anon;
GRANT SELECT ON public.current_actor_teammate_profiles_v TO authenticated, service_role;

-- Remove public.get_current_user_role() do schema público para não expor RPC desnecessária
DROP FUNCTION IF EXISTS public.get_current_user_role() CASCADE;

-- -----------------------------------------------------------------------------
-- 4. REVOGAÇÃO DE PRIVILÉGIOS SQL E BLOQUEIO ANÔNIMO / CLIENTE
-- -----------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_memberships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pelada_sumulas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.season_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.monthly_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pelada_monthly_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.teams FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.team_memberships FROM PUBLIC, anon, authenticated;

-- public.users: ZERO INSERT/UPDATE/DELETE pelo cliente! Somente leitura da própria linha (sem password_hash e sem team_invite_code)
GRANT SELECT (id, email, whatsapp_number, role, status, must_reset_password, created_at, updated_at) ON public.users TO authenticated;

-- public.player_profiles: cliente só pode atualizar display_name, avatar_path, position, dominant_foot, profile_visibility
GRANT SELECT (
    id, user_id, display_name, avatar_path, city_id, position, dominant_foot,
    profile_visibility, current_rating, rating_uncertainty, is_provisional,
    current_division_id, total_validated_matches, created_at, updated_at
) ON public.player_profiles TO authenticated;

GRANT UPDATE (
    display_name, avatar_path, position, dominant_foot, profile_visibility, updated_at
) ON public.player_profiles TO authenticated;

CREATE OR REPLACE VIEW public.public_player_cards_view
WITH (security_invoker = true)
AS
SELECT
    pp.id,
    pp.display_name,
    pp.avatar_path,
    pp.city_id,
    pp.position,
    pp.dominant_foot,
    pp.current_rating,
    pp.is_provisional,
    pp.current_division_id,
    pp.total_validated_matches,
    tm.team_id,
    t.name AS team_name,
    t.crest_url AS team_crest_url,
    t.city_name AS team_city,
    t.modality AS team_modality
FROM public.player_profiles pp
LEFT JOIN public.team_memberships tm ON tm.player_id = pp.id AND tm.status = 'active'
LEFT JOIN public.teams t ON t.id = tm.team_id
WHERE pp.profile_visibility = 'publico';

REVOKE ALL ON public.public_player_cards_view FROM PUBLIC, anon;
GRANT SELECT ON public.public_player_cards_view TO authenticated, service_role;

GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.team_memberships TO authenticated;
GRANT SELECT ON public.season_entries TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pelada_sumulas TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. POLÍTICAS RLS DE CONTENÇÃO (100% BASEADAS EM team_id E must_reset_password = false)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('users', 'player_profiles', 'teams', 'team_memberships', 'season_entries', 'audit_logs', 'pelada_sumulas', 'monthly_payments', 'pelada_monthly_configs')
    LOOP
        EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END
$$;

-- 5.1. users: o próprio usuário pode ler sua linha (mesmo se must_reset_password = true, para saber que precisa redefinir); Admin vê todas
CREATE POLICY users_select_self_or_admin ON public.users
    FOR SELECT TO authenticated
    USING (
        auth.uid() IS NOT NULL
        AND (
            id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

-- 5.2. player_profiles: separa estritamente 'publico', 'restrito' (apenas mesmo time!) e 'privado' (Etapa 7 / Teste 10)
CREATE POLICY profiles_select_visibility_strict ON public.player_profiles
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_staff)
            OR profile_visibility = 'publico'
            OR (
                profile_visibility = 'restrito'
                AND EXISTS (SELECT 1 FROM public.current_actor_teammate_profiles_v tp WHERE tp.player_id = player_profiles.id)
            )
        )
    );

CREATE POLICY profiles_update_self_verified ON public.player_profiles
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v) AND user_id = auth.uid())
    WITH CHECK (EXISTS (SELECT 1 FROM public.current_actor_context_v) AND user_id = auth.uid());

-- 5.3. teams e team_memberships
CREATE POLICY teams_select_verified ON public.teams
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v));

CREATE POLICY memberships_select_team_or_staff ON public.team_memberships
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_memberships.team_id)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_staff)
        )
    );

-- 5.4. season_entries e audit_logs
CREATE POLICY season_entries_select_verified ON public.season_entries
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v));

CREATE POLICY audit_logs_select_staff_only ON public.audit_logs
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_staff));

-- 5.5. pelada_sumulas: autoriza exclusivamente por team_id UUID e status de súmula real!
CREATE POLICY pelada_sumulas_select_by_team_id ON public.pelada_sumulas
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
            OR (
                team_id IS NOT NULL
                AND status IN ('em_andamento', 'finalizada', 'cancelada')
                AND EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_sumulas.team_id)
            )
        )
    );

CREATE POLICY pelada_sumulas_insert_by_team_id ON public.pelada_sumulas
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND team_id IS NOT NULL
        AND status = 'em_andamento'
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_sumulas.team_id AND m.has_sport_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY pelada_sumulas_update_by_team_id ON public.pelada_sumulas
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND team_id IS NOT NULL
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
            OR (
                status = 'em_andamento'
                AND EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_sumulas.team_id AND m.has_sport_permission)
            )
        )
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND team_id IS NOT NULL
        AND status IN ('em_andamento', 'finalizada', 'cancelada')
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_sumulas.team_id AND m.has_sport_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY pelada_sumulas_delete_by_team_id ON public.pelada_sumulas
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND team_id IS NOT NULL
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
            OR (
                status = 'em_andamento'
                AND EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_sumulas.team_id AND m.has_sport_permission)
            )
        )
    );

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS DE BLINDAGEM BASEADOS EM private.trusted_rpc_locks (ZERO GUC BYPASS!)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.trg_guard_users_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_db_role TEXT := current_user;
    v_jwt_role TEXT := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF v_db_role IN ('postgres', 'supabase_admin', 'service_role') AND v_jwt_role NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Identificador canônico do usuário (id) é imutável.';
    END IF;

    -- Verifica se a operação específica foi autorizada na tabela privada private.trusted_rpc_locks
    IF EXISTS (
        SELECT 1 FROM private.trusted_rpc_locks l
        WHERE l.txid = pg_catalog.txid_current()
          AND l.target_id = NEW.id::text
          AND l.actor_id = auth.uid()
          AND l.operation IN ('create_user_profile', 'complete_password_reset', 'sync_team_metadata', 'admin_manage_user')
    ) THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Alterações diretas na tabela public.users são proibidas.';
END;
$$;

DROP TRIGGER IF EXISTS guard_users_security_trg ON public.users;
CREATE TRIGGER guard_users_security_trg
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_guard_users_security();

CREATE OR REPLACE FUNCTION private.trg_guard_profiles_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_db_role TEXT := current_user;
    v_jwt_role TEXT := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF v_db_role IN ('postgres', 'supabase_admin', 'service_role') AND v_jwt_role NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Identificadores do perfil são imutáveis.';
    END IF;

    -- Verifica lock transacional específico em private.trusted_rpc_locks
    IF EXISTS (
        SELECT 1 FROM private.trusted_rpc_locks l
        WHERE l.txid = pg_catalog.txid_current()
          AND l.target_id = NEW.id::text
          AND l.actor_id = auth.uid()
          AND l.operation IN ('process_validated_match', 'create_user_profile', 'sync_team_metadata', 'admin_manage_profile')
    ) THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Criação de perfil deve ocorrer via fluxo oficial de registro.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NOT private.is_active_verified_user() OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Conta pendente de redefinição de senha ou sem permissão.';
        END IF;

        IF NEW.current_rating IS DISTINCT FROM OLD.current_rating
           OR NEW.rating_uncertainty IS DISTINCT FROM OLD.rating_uncertainty
           OR NEW.is_provisional IS DISTINCT FROM OLD.is_provisional
           OR NEW.current_division_id IS DISTINCT FROM OLD.current_division_id
           OR NEW.total_validated_matches IS DISTINCT FROM OLD.total_validated_matches
           OR COALESCE(NEW.is_team_owner, false) IS DISTINCT FROM COALESCE(OLD.is_team_owner, false)
           OR NEW.team_name IS DISTINCT FROM OLD.team_name
           OR NEW.team_invite_code IS DISTINCT FROM OLD.team_invite_code
           OR NEW.team_crest_url IS DISTINCT FROM OLD.team_crest_url
           OR NEW.team_city IS DISTINCT FROM OLD.team_city
           OR NEW.team_modality IS DISTINCT FROM OLD.team_modality THEN
            RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Campos competitivos e de vínculo de equipe não podem ser alterados pelo perfil.';
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profiles_security_trg ON public.player_profiles;
CREATE TRIGGER guard_profiles_security_trg
    BEFORE INSERT OR UPDATE ON public.player_profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_guard_profiles_security();

CREATE OR REPLACE FUNCTION private.trg_audit_logs_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'IMUTABILIDADE_VIOLADA: Registros de auditoria são estritamente append-only e não podem ser alterados ou excluídos.';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_immutable_trg ON public.audit_logs;
CREATE TRIGGER audit_logs_immutable_trg
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_audit_logs_immutable();

CREATE OR REPLACE FUNCTION private.trg_guard_pelada_sumulas_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_db_role TEXT := current_user;
    v_jwt_role TEXT := COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF v_db_role IN ('postgres', 'supabase_admin', 'service_role') AND v_jwt_role NOT IN ('anon', 'authenticated') THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.team_id IS NULL OR NEW.status NOT IN ('em_andamento', 'finalizada', 'cancelada')
           OR NEW.id LIKE 'evals_player_%' OR NEW.id LIKE 'user_session_%'
           OR NEW.id LIKE 'finance_ledger_%' OR NEW.id LIKE 'monthly_%'
           OR NEW.id LIKE 'audit_logs_%' OR NEW.id LIKE 'futplay_peer_%'
           OR NEW.id LIKE 'pelada_schedule_%' THEN
            RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: A tabela pelada_sumulas aceita exclusivamente súmulas reais vinculadas a um team_id.';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status NOT IN ('em_andamento', 'finalizada', 'cancelada') THEN
            RAISE EXCEPTION 'IMUTABILIDADE_VIOLADA: Registros legados em pelada_sumulas estão congelados para migração.';
        END IF;
        IF OLD.status = 'finalizada' AND NOT private.is_platform_admin() THEN
            IF EXISTS (
                SELECT 1 FROM private.trusted_rpc_locks l
                WHERE l.txid = pg_catalog.txid_current()
                  AND l.target_id = NEW.id
                  AND l.actor_id = auth.uid()
                  AND l.operation = 'reopen_sumula'
            ) THEN
                -- Permite a reabertura auditada exclusivamente quando iniciada pela RPC oficial
                NULL;
            ELSE
                RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Súmula finalizada é imutável. Utilize a operação oficial de reabertura auditada.';
            END IF;
        END IF;
        IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
            RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Não é permitido transferir uma súmula para outra equipe.';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status NOT IN ('em_andamento') AND NOT private.is_platform_admin() THEN
            RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas súmulas em andamento podem ser excluídas.';
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_pelada_sumulas_security_trg ON public.pelada_sumulas;
CREATE TRIGGER guard_pelada_sumulas_security_trg
    BEFORE INSERT OR UPDATE OR DELETE ON public.pelada_sumulas
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_guard_pelada_sumulas_security();

COMMIT;
