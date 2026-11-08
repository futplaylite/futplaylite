-- =============================================================================
-- FUTPLAY LITE / ROSÁLIA ESPORTES — SCRIPT MESTRE DE CONFIGURAÇÃO (SUPABASE)
-- Execute este arquivo completo de uma só vez no SQL Editor do Supabase.
-- Inclui: Tabelas, RLS, Motor de Elo/Pontuação, Mensalidades e Dados Iniciais.
-- =============================================================================


-- =============================================================================
-- PARTE: migrations/001_initial_schema.sql
-- =============================================================================

-- =============================================================================
-- ROSÁLIA ESPORTES — Liga de Jogadores de Futebol Amador
-- Migração 001: Esquema Relacional Principal e Regras de Integridade (Seção 7)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS (Identidade e papel de autorização no servidor)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'moderator', 'admin')),
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa', 'encerrada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CITIES (Municípios e hierarquia geográfica - Seção 2.1)
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    state_code CHAR(2) NOT NULL,
    region_name TEXT NOT NULL DEFAULT 'Sudeste',
    country_code CHAR(2) NOT NULL DEFAULT 'BR',
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('em_preparacao', 'ativa', 'desativada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_city_state UNIQUE (name, state_code, country_code)
);

-- 3. DIVISIONS (Bronze, Prata, Ouro, Platina, Diamante - Seção 2.3)
CREATE TABLE IF NOT EXISTS public.divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (name IN ('Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante')),
    tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 5),
    min_rating INTEGER NOT NULL,
    max_rating INTEGER,
    min_matches_required SMALLINT NOT NULL DEFAULT 5,
    city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE,
    ruleset_version TEXT NOT NULL DEFAULT 'v1.0.0',
    UNIQUE (tier, ruleset_version)
);

-- 4. PLAYER_PROFILES (Perfil esportivo do jogador - RF-002)
CREATE TABLE IF NOT EXISTS public.player_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 40),
    avatar_path TEXT,
    city_id UUID NOT NULL REFERENCES public.cities(id),
    position TEXT NOT NULL CHECK (position IN ('goleiro', 'defensor', 'meio-campista', 'atacante', 'multiplas')),
    dominant_foot TEXT NOT NULL DEFAULT 'direito' CHECK (dominant_foot IN ('direito', 'esquerdo', 'ambos')),
    profile_visibility TEXT NOT NULL DEFAULT 'publico' CHECK (profile_visibility IN ('publico', 'restrito', 'privado')),
    current_rating INTEGER NOT NULL DEFAULT 1000,
    rating_uncertainty NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    is_provisional BOOLEAN NOT NULL DEFAULT true,
    current_division_id UUID REFERENCES public.divisions(id),
    total_validated_matches INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. SEASONS (Temporadas de 10 semanas + 7 dias de tolerância - Seção 2.2)
CREATE TABLE IF NOT EXISTS public.seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    grace_period_ends_at TIMESTAMPTZ NOT NULL,
    ruleset_version TEXT NOT NULL DEFAULT 'v1.0.0',
    status TEXT NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'ativa', 'tolerancia', 'encerrada', 'arquivada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    CHECK (grace_period_ends_at >= ends_at)
);

-- 6. SEASON_ENTRIES (Participação e classificação na temporada - Seção 7.2)
CREATE TABLE IF NOT EXISTS public.season_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE RESTRICT,
    division_id UUID NOT NULL REFERENCES public.divisions(id),
    season_points INTEGER NOT NULL DEFAULT 0,
    pending_points INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    mvp_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'provisorio' CHECK (status IN ('provisorio', 'elegivel', 'suspenso', 'encerrado')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_season_player UNIQUE (season_id, player_id)
);

-- 7. MATCHES (Partidas comunitárias - Seção 4 e 7.2)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID NOT NULL REFERENCES public.cities(id),
    season_id UUID NOT NULL REFERENCES public.seasons(id),
    created_by UUID NOT NULL REFERENCES public.users(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    lineup_frozen_at TIMESTAMPTZ,
    venue_name TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('5v5', '6v6', '7v7', '11v11', 'personalizado')),
    home_team_name TEXT NOT NULL DEFAULT 'Equipe A',
    away_team_name TEXT NOT NULL DEFAULT 'Equipe B',
    home_captain_id UUID REFERENCES public.player_profiles(id),
    away_captain_id UUID REFERENCES public.player_profiles(id),
    status TEXT NOT NULL DEFAULT 'rascunho' CHECK (
        status IN (
            'rascunho',
            'partida_cadastrada',
            'escalacao_confirmada',
            'em_andamento',
            'resultado_enviado',
            'aguardando_confirmacoes',
            'validada',
            'contestada',
            'analise_moderacao',
            'anulada',
            'cancelada'
        )
    ),
    official_home_score SMALLINT CHECK (official_home_score >= 0),
    official_away_score SMALLINT CHECK (official_away_score >= 0),
    active_result_version_id UUID,
    ruleset_version TEXT NOT NULL DEFAULT 'v1.0.0',
    fraud_Hold BOOLEAN NOT NULL DEFAULT false,
    fraud_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. MATCH_PLAYERS (Escalações com trava de duplicidade CA-008)
CREATE TABLE IF NOT EXISTS public.match_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE RESTRICT,
    team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
    is_captain BOOLEAN NOT NULL DEFAULT false,
    position_played TEXT NOT NULL CHECK (position_played IN ('goleiro', 'defensor', 'meio-campista', 'atacante')),
    participation_status TEXT NOT NULL DEFAULT 'convidado' CHECK (
        participation_status IN ('convidado', 'confirmado', 'participou', 'nao_compareceu', 'removido')
    ),
    minutes_played SMALLINT CHECK (minutes_played >= 0),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT uq_match_player UNIQUE (match_id, player_id)
);

-- 9. MATCH_RESULTS (Versionamento imutável de resultados enviados/corrigidos - CA-013)
CREATE TABLE IF NOT EXISTS public.match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number >= 1),
    home_score SMALLINT NOT NULL CHECK (home_score >= 0),
    away_score SMALLINT NOT NULL CHECK (away_score >= 0),
    mvp_player_id UUID REFERENCES public.player_profiles(id),
    submitted_by UUID NOT NULL REFERENCES public.users(id),
    validation_status TEXT NOT NULL DEFAULT 'pendente' CHECK (
        validation_status IN ('pendente', 'validado', 'contestado', 'substituido', 'anulado')
    ),
    validated_by UUID REFERENCES public.users(id),
    validated_at TIMESTAMPTZ,
    correction_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_match_result_version UNIQUE (match_id, version_number)
);

-- 10. MATCH_EVENTS (Gols, assistências, MVP e ações defensivas por versão)
CREATE TABLE IF NOT EXISTS public.match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    result_version_id UUID NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.player_profiles(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('gol', 'assistencia', 'mvp', 'defesa_dificil', 'acao_defensiva')),
    event_minute SMALLINT CHECK (event_minute BETWEEN 0 AND 150),
    recorded_by UUID NOT NULL REFERENCES public.users(id),
    verification_status TEXT NOT NULL DEFAULT 'pendente' CHECK (
        verification_status IN ('pendente', 'validado', 'rejeitado')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. RESULT_CONFIRMATIONS (Confirmações independentes de capitães/jogadores - Seção 4.2)
CREATE TABLE IF NOT EXISTS public.result_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    result_version_id UUID NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    player_id UUID NOT NULL REFERENCES public.player_profiles(id),
    team_side TEXT NOT NULL CHECK (team_side IN ('home', 'away')),
    confirmation_type TEXT NOT NULL CHECK (confirmation_type IN ('concordancia', 'contestacao', 'abstencao')),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_confirmation_per_version UNIQUE (result_version_id, user_id)
);

-- 12. DISPUTES (Contestações e moderação - CA-012, CA-029)
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    result_version_id UUID NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES public.users(id),
    reason_code TEXT NOT NULL CHECK (
        reason_code IN ('placar_incorreto', 'escalacao_irregular', 'gols_divergentes', 'partida_inexistente', 'suspeita_conluio', 'outro')
    ),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'resolvida', 'rejeitada')),
    assigned_moderator UUID REFERENCES public.users(id),
    resolution_reason TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. PLAYER_RATINGS (Histórico auditável de atualizações de Elo - Seção 3.2)
CREATE TABLE IF NOT EXISTS public.player_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.player_profiles(id),
    match_id UUID NOT NULL REFERENCES public.matches(id),
    result_version_id UUID NOT NULL REFERENCES public.match_results(id),
    operation_type TEXT NOT NULL DEFAULT 'aplicacao' CHECK (operation_type IN ('aplicacao', 'reversao')),
    rating_before INTEGER NOT NULL,
    rating_after INTEGER NOT NULL,
    rating_delta INTEGER NOT NULL,
    uncertainty_before NUMERIC(5,2) NOT NULL,
    uncertainty_after NUMERIC(5,2) NOT NULL,
    k_factor SMALLINT NOT NULL,
    expected_score NUMERIC(5,4) NOT NULL,
    actual_score NUMERIC(3,2) NOT NULL,
    algorithm_version TEXT NOT NULL DEFAULT 'elo-team-v1.0',
    calculation_status TEXT NOT NULL DEFAULT 'aplicado' CHECK (calculation_status IN ('aplicado', 'revertido')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_rating_per_version_op UNIQUE (player_id, result_version_id, operation_type)
);

-- 14. POINT_TRANSACTIONS (Livro-razão imutável de pontos da temporada - CA-014, CA-022, CA-026)
CREATE TABLE IF NOT EXISTS public.point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.player_profiles(id),
    season_id UUID NOT NULL REFERENCES public.seasons(id),
    match_id UUID REFERENCES public.matches(id),
    source_result_version_id UUID REFERENCES public.match_results(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credito', 'reversao', 'ajuste_administrativo')),
    points_delta INTEGER NOT NULL,
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason_code TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_points_idempotency UNIQUE (player_id, source_result_version_id, transaction_type)
);

-- 15. EVIDENCE_FILES (Evidências privadas vinculadas à partida - Seção 4.3, CA-015, CA-031)
CREATE TABLE IF NOT EXISTS public.evidence_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    result_version_id UUID REFERENCES public.match_results(id) ON DELETE SET NULL,
    uploaded_by UUID NOT NULL REFERENCES public.users(id),
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('foto_sumula', 'foto_placar', 'registro_escalacao', 'video_lance')),
    storage_bucket_path TEXT NOT NULL,
    description TEXT,
    is_private BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. AUDIT_LOGS (Trilha de auditoria imutável - CA-028)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES public.users(id),
    actor_role TEXT NOT NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    reason TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance de Ranking e Consultas (RNF-001, CA-037)
CREATE INDEX IF NOT EXISTS idx_season_entries_ranking
    ON public.season_entries (season_id, season_points DESC, wins DESC, matches_played DESC, mvp_count DESC);

CREATE INDEX IF NOT EXISTS idx_player_profiles_rating
    ON public.player_profiles (city_id, current_rating DESC);

CREATE INDEX IF NOT EXISTS idx_matches_city_status
    ON public.matches (city_id, season_id, status, scheduled_at DESC);


-- =============================================================================
-- PARTE: migrations/002_rls_policies.sql
-- =============================================================================

-- =============================================================================
-- ROSÁLIA ESPORTES — Liga de Jogadores de Futebol Amador
-- Migração 002: Políticas de Row-Level Security (RLS) e Controle por Papel
-- Atende: CA-004, CA-006, CA-015, CA-027, CA-030, CA-031, CA-032
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar papel do usuário autenticado no servidor
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- 1. USERS: Usuário vê apenas sua própria conta; Moderador/Admin vê todas (CA-004)
CREATE POLICY users_select_self_or_staff ON public.users
    FOR SELECT USING (auth.uid() = id OR public.get_current_user_role() IN ('moderator', 'admin'));

-- 2. PLAYER_PROFILES: Respeita profile_visibility; edição apenas dos campos próprios não competitivos (CA-005, CA-006, CA-030)
CREATE POLICY profiles_select_visibility ON public.player_profiles
    FOR SELECT USING (
        profile_visibility = 'publico'
        OR (profile_visibility = 'restrito' AND auth.uid() IS NOT NULL)
        OR user_id = auth.uid()
        OR public.get_current_user_role() IN ('moderator', 'admin')
    );

CREATE POLICY profiles_insert_self ON public.player_profiles
    FOR INSERT WITH CHECK (user_id = auth.uid() AND current_rating = 1000 AND is_provisional = true);

CREATE POLICY profiles_update_self_safe_fields ON public.player_profiles
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        -- Impede que o cliente manipule rating ou divisão diretamente via API (CA-030)
        AND current_rating = (SELECT p.current_rating FROM public.player_profiles p WHERE p.id = id)
        AND current_division_id IS NOT DISTINCT FROM (SELECT p.current_division_id FROM public.player_profiles p WHERE p.id = id)
    );

-- 3. CITIES, DIVISIONS, SEASONS, SEASON_ENTRIES: Leitura pública; escrita restrita a RPCs e Admin
CREATE POLICY cities_select_all ON public.cities FOR SELECT USING (true);
CREATE POLICY divisions_select_all ON public.divisions FOR SELECT USING (true);
CREATE POLICY seasons_select_all ON public.seasons FOR SELECT USING (true);
CREATE POLICY season_entries_select_all ON public.season_entries FOR SELECT USING (true);

-- 4. MATCHES: Leitura pública na liga; criação por usuário autenticado ativo
CREATE POLICY matches_select_all ON public.matches FOR SELECT USING (true);
CREATE POLICY matches_insert_authenticated ON public.matches
    FOR INSERT WITH CHECK (auth.uid() = created_by AND status IN ('rascunho', 'partida_cadastrada'));

-- 5. EVIDENCE_FILES: Acesso estritamente restrito aos participantes da partida e moderadores (CA-015, CA-031)
CREATE POLICY evidence_select_authorized_only ON public.evidence_files
    FOR SELECT USING (
        uploaded_by = auth.uid()
        OR public.get_current_user_role() IN ('moderator', 'admin')
        OR EXISTS (
            SELECT 1 FROM public.match_players mp
            JOIN public.player_profiles pp ON pp.id = mp.player_id
            WHERE mp.match_id = evidence_files.match_id
              AND pp.user_id = auth.uid()
        )
    );

-- 6. POINT_TRANSACTIONS e PLAYER_RATINGS: Somente leitura (inserção exclusiva via SECURITY DEFINER RPCs - CA-030)
CREATE POLICY point_tx_select_all ON public.point_transactions FOR SELECT USING (true);
CREATE POLICY player_ratings_select_all ON public.player_ratings FOR SELECT USING (true);

-- 7. AUDIT_LOGS: Leitura restrita a moderadores e administradores; imutável (CA-027, CA-028)
CREATE POLICY audit_logs_select_staff ON public.audit_logs
    FOR SELECT USING (public.get_current_user_role() IN ('moderator', 'admin'));


-- =============================================================================
-- PARTE: migrations/003_scoring_and_elo_rpc.sql
-- =============================================================================

-- =============================================================================
-- ROSÁLIA ESPORTES — Liga de Jogadores de Futebol Amador
-- Migração 003: Motor Transacional de Pontuação Sazonal e Rating Elo Coletivo
-- Fórmula Sazonal: P = 5 + R + 3G + 2A + 3M
-- Fórmula Elo: R_novo = R_anterior + K * (S - E)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_validated_match(
    p_match_id UUID,
    p_result_version_id UUID,
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_result RECORD;
    v_home_avg_rating NUMERIC;
    v_away_avg_rating NUMERIC;
    v_expected_home NUMERIC;
    v_expected_away NUMERIC;
    v_actual_home NUMERIC;
    v_actual_away NUMERIC;
    v_player RECORD;
    v_goals INTEGER;
    v_assists INTEGER;
    v_is_mvp INTEGER;
    v_result_bonus INTEGER;
    v_total_points INTEGER;
    v_k_factor SMALLINT;
    v_expected NUMERIC;
    v_actual NUMERIC;
    v_rating_delta INTEGER;
    v_new_rating INTEGER;
    v_new_uncertainty NUMERIC;
BEGIN
    -- 1. Bloqueio pessimista da partida para evitar concorrência (Seção 7.4)
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partida % não encontrada', p_match_id;
    END IF;

    SELECT * INTO v_result FROM public.match_results
    WHERE id = p_result_version_id AND match_id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Versão de resultado % não encontrada', p_result_version_id;
    END IF;

    -- Idempotência: se esta versão já foi processada, retorna sem duplicar (CA-014)
    IF EXISTS (
        SELECT 1 FROM public.point_transactions
        WHERE source_result_version_id = p_result_version_id
          AND transaction_type = 'credito'
    ) THEN
        RETURN jsonb_build_object('status', 'already_processed', 'result_version_id', p_result_version_id);
    END IF;

    -- 2. Calcular Rating Médio das Equipes (Casa vs Visitante)
    SELECT COALESCE(AVG(pp.current_rating), 1000) INTO v_home_avg_rating
    FROM public.match_players mp
    JOIN public.player_profiles pp ON pp.id = mp.player_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'home' AND mp.participation_status = 'participou';

    SELECT COALESCE(AVG(pp.current_rating), 1000) INTO v_away_avg_rating
    FROM public.match_players mp
    JOIN public.player_profiles pp ON pp.id = mp.player_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'away' AND mp.participation_status = 'participou';

    v_expected_home := 1.0 / (1.0 + power(10.0, (v_away_avg_rating - v_home_avg_rating) / 400.0));
    v_expected_away := 1.0 - v_expected_home;

    IF v_result.home_score > v_result.away_score THEN
        v_actual_home := 1.0; v_actual_away := 0.0;
    ELSIF v_result.home_score < v_result.away_score THEN
        v_actual_home := 0.0; v_actual_away := 1.0;
    ELSE
        v_actual_home := 0.5; v_actual_away := 0.5;
    END IF;

    -- 3. Processar cada atleta elegível (P = 5 + R + 3G + 2A + 3M e Elo)
    FOR v_player IN
        SELECT mp.*, pp.current_rating, pp.rating_uncertainty, pp.total_validated_matches
        FROM public.match_players mp
        JOIN public.player_profiles pp ON pp.id = mp.player_id
        WHERE mp.match_id = p_match_id AND mp.participation_status = 'participou'
    LOOP
        -- Gols e Assistências validados na versão
        SELECT COUNT(*) INTO v_goals FROM public.match_events
        WHERE result_version_id = p_result_version_id
          AND player_id = v_player.player_id
          AND event_type = 'gol'
          AND verification_status = 'validado';

        SELECT COUNT(*) INTO v_assists FROM public.match_events
        WHERE result_version_id = p_result_version_id
          AND player_id = v_player.player_id
          AND event_type = 'assistencia'
          AND verification_status = 'validado';

        v_is_mvp := CASE WHEN v_result.mvp_player_id = v_player.player_id THEN 1 ELSE 0 END;

        IF v_player.team_side = 'home' THEN
            v_expected := v_expected_home;
            v_actual := v_actual_home;
        ELSE
            v_expected := v_expected_away;
            v_actual := v_actual_away;
        END IF;

        v_result_bonus := CASE
            WHEN v_actual = 1.0 THEN 15
            WHEN v_actual = 0.5 THEN 5
            ELSE 0
        END;

        -- Fórmula oficial: P = 5 + R + 3G + 2A + 3M
        v_total_points := 5 + v_result_bonus + (3 * v_goals) + (2 * v_assists) + (3 * v_is_mvp);

        -- Inserir no Livro-Razão de Pontos (point_transactions)
        INSERT INTO public.point_transactions (
            player_id, season_id, match_id, source_result_version_id,
            transaction_type, points_delta, breakdown, reason_code, created_by
        ) VALUES (
            v_player.player_id, v_match.season_id, p_match_id, p_result_version_id,
            'credito', v_total_points,
            jsonb_build_object(
                'participacao', 5,
                'resultado', v_result_bonus,
                'gols', v_goals,
                'assistencias', v_assists,
                'mvp', v_is_mvp
            ),
            'PARTIDA_VALIDADA', p_actor_user_id
        );

        -- Fator K dinâmico por maturidade da amostra (Seção 3.2)
        IF v_player.total_validated_matches < 5 THEN
            v_k_factor := 40;
        ELSIF v_player.current_rating < 1400 THEN
            v_k_factor := 24;
        ELSE
            v_k_factor := 16;
        END IF;

        v_rating_delta := ROUND(v_k_factor * (v_actual - v_expected));
        v_new_rating := GREATEST(600, v_player.current_rating + v_rating_delta);
        v_new_uncertainty := GREATEST(15.0, v_player.rating_uncertainty - 12.0);

        INSERT INTO public.player_ratings (
            player_id, match_id, result_version_id, operation_type,
            rating_before, rating_after, rating_delta,
            uncertainty_before, uncertainty_after,
            k_factor, expected_score, actual_score, algorithm_version
        ) VALUES (
            v_player.player_id, p_match_id, p_result_version_id, 'aplicacao',
            v_player.current_rating, v_new_rating, v_rating_delta,
            v_player.rating_uncertainty, v_new_uncertainty,
            v_k_factor, v_expected, v_actual, 'elo-team-v1.0'
        );

        -- Atualizar Perfil do Atleta
        UPDATE public.player_profiles
        SET current_rating = v_new_rating,
            rating_uncertainty = v_new_uncertainty,
            total_validated_matches = total_validated_matches + 1,
            is_provisional = (total_validated_matches + 1) < 5,
            updated_at = now()
        WHERE id = v_player.player_id;

        -- Atualizar Projeção da Temporada (season_entries)
        UPDATE public.season_entries
        SET season_points = season_points + v_total_points,
            matches_played = matches_played + 1,
            wins = wins + CASE WHEN v_actual = 1.0 THEN 1 ELSE 0 END,
            draws = draws + CASE WHEN v_actual = 0.5 THEN 1 ELSE 0 END,
            losses = losses + CASE WHEN v_actual = 0.0 THEN 1 ELSE 0 END,
            goals = goals + v_goals,
            assists = assists + v_assists,
            mvp_count = mvp_count + v_is_mvp,
            status = CASE WHEN (matches_played + 1) >= 5 THEN 'elegivel' ELSE 'provisorio' END,
            updated_at = now()
        WHERE season_id = v_match.season_id AND player_id = v_player.player_id;
    END LOOP;

    -- 4. Marcar resultado e partida como Validados
    UPDATE public.match_results
    SET validation_status = 'validado',
        validated_by = p_actor_user_id,
        validated_at = now()
    WHERE id = p_result_version_id;

    UPDATE public.matches
    SET status = 'validada',
        official_home_score = v_result.home_score,
        official_away_score = v_result.away_score,
        active_result_version_id = p_result_version_id,
        updated_at = now()
    WHERE id = p_match_id;

    -- 5. Registrar Auditoria
    INSERT INTO public.audit_logs (
        actor_user_id, actor_role, action_type, entity_type, entity_id, reason, after_data
    ) VALUES (
        p_actor_user_id, 'system_or_moderator', 'MATCH_VALIDATED_AND_SCORED', 'matches', p_match_id,
        'Partida validada e processada pelo motor v1.0.0',
        jsonb_build_object('result_version_id', p_result_version_id, 'home_score', v_result.home_score, 'away_score', v_result.away_score)
    );

    RETURN jsonb_build_object('status', 'validated', 'match_id', p_match_id, 'result_version_id', p_result_version_id);
END;
$$;


-- =============================================================================
-- PARTE: migrations/004_monthly_fees_and_settings.sql
-- =============================================================================

-- =============================================================================
-- ROSÁLIA ESPORTES — Liga de Jogadores de Futebol Amador
-- Migração 004: Gestão de Mensalidades, Chave PIX e Configurações Financeiras
-- =============================================================================

-- 1. PELADA_MONTHLY_CONFIGS (Configuração financeira da pelada e chave PIX)
CREATE TABLE IF NOT EXISTS public.pelada_monthly_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
    monthly_amount NUMERIC(10,2) NOT NULL DEFAULT 30.00,
    due_day SMALLINT NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 31),
    pix_key TEXT NOT NULL DEFAULT '',
    pix_key_type TEXT NOT NULL DEFAULT 'aleatoria' CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
    pix_receiver_name TEXT NOT NULL DEFAULT '',
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. MONTHLY_PAYMENTS (Histórico e status de pagamento mensal por atleta)
CREATE TABLE IF NOT EXISTS public.monthly_payments (
    id TEXT PRIMARY KEY, -- formato: {player_id}_{year_month}
    player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    year_month CHAR(7) NOT NULL CHECK (year_month ~ '^[0-9]{4}-[0-9]{2}$'), -- ex: '2026-11'
    is_paid BOOLEAN NOT NULL DEFAULT false,
    paid_at TIMESTAMPTZ,
    amount NUMERIC(10,2) NOT NULL DEFAULT 30.00,
    confirmed_by UUID REFERENCES public.users(id),
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_player_year_month UNIQUE (player_id, year_month)
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_monthly_payments_player ON public.monthly_payments(player_id);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_month ON public.monthly_payments(year_month);

-- Ativação de RLS
ALTER TABLE public.pelada_monthly_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY configs_select_all ON public.pelada_monthly_configs
    FOR SELECT USING (true);

CREATE POLICY configs_manage_authorized ON public.pelada_monthly_configs
    FOR ALL USING (
        public.get_current_user_role() IN ('admin', 'moderator')
        OR auth.uid() IS NOT NULL
    );

CREATE POLICY payments_select_all ON public.monthly_payments
    FOR SELECT USING (true);

CREATE POLICY payments_manage_authorized ON public.monthly_payments
    FOR ALL USING (
        public.get_current_user_role() IN ('admin', 'moderator')
        OR auth.uid() IS NOT NULL
    );


-- =============================================================================
-- PARTE: seed.sql
-- =============================================================================

-- =============================================================================
-- ROSÁLIA ESPORTES / FUTPLAY LITE — Carga Inicial (Seed SQL)
-- =============================================================================

INSERT INTO public.cities (id, name, state_code, region_name, country_code, slug, status)
VALUES
    ('11111111-1111-4111-8111-111111111101', 'Planalto', 'BA', 'Sudoeste da Bahia', 'BR', 'planalto-ba', 'ativa'),
    ('11111111-1111-4111-8111-111111111102', 'Poções', 'BA', 'Sudoeste da Bahia', 'BR', 'pocoes-ba', 'em_preparacao'),
    ('11111111-1111-4111-8111-111111111103', 'Vitória da Conquista', 'BA', 'Sudoeste da Bahia', 'BR', 'vitoria-da-conquista-ba', 'em_preparacao')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.divisions (id, name, tier, min_rating, max_rating, min_matches_required, ruleset_version)
VALUES
    ('22222222-2222-4222-8222-222222222201', 'Bronze',   1, 0,    1099, 0, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222202', 'Prata',    2, 1100, 1249, 5, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222203', 'Ouro',     3, 1250, 1399, 5, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222204', 'Platina',  4, 1400, 1549, 5, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222205', 'Diamante', 5, 1550, NULL, 5, 'v1.0.0')
ON CONFLICT (tier, ruleset_version) DO NOTHING;

INSERT INTO public.seasons (id, city_id, name, starts_at, ends_at, grace_period_ends_at, ruleset_version, status)
VALUES
    (
        '33333333-3333-4333-8333-333333333301',
        '11111111-1111-4111-8111-111111111101',
        'Temporada 2026.2 · Liga Planalto - BA',
        '2026-09-01T00:00:00-03:00',
        '2026-11-10T23:59:59-03:00',
        '2026-11-17T23:59:59-03:00',
        'v1.0.0',
        'ativa'
    )
ON CONFLICT (id) DO NOTHING;

