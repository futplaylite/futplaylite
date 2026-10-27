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
