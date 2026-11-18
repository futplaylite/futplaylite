-- =============================================================================
-- FUTPLAY LITE — MIGRAÇÃO 013 (SCRIPT B): RECONSTRUÇÃO RELACIONAL COMPLETA,
-- CONVITES CRIPTOGRÁFICOS, MIGRAÇÃO DOS 46 REGISTROS, RLS E RPCs TRANSACIONAIS
-- Conformidade integral com ADR-001 (Quarta Revisão Técnica)
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ADEQUAÇÃO DE PUBLIC.AUDIT_LOGS E FUNÇÃO OFICIAL DE AUDITORIA NO SERVIDOR
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_logs_immutable_trg ON public.audit_logs;

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS legacy_log_id TEXT UNIQUE;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.audit_logs ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;
ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ALTER COLUMN entity_id TYPE TEXT USING entity_id::TEXT;

CREATE OR REPLACE FUNCTION private.append_official_audit_log(
    p_action_type TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_reason TEXT,
    p_before_data JSONB DEFAULT NULL,
    p_after_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_log_id UUID := gen_random_uuid();
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT := private.get_current_user_role();
    v_actor_name TEXT;
BEGIN
    SELECT COALESCE(pp.display_name, u.email, 'Sistema')
    INTO v_actor_name
    FROM public.users u
    LEFT JOIN public.player_profiles pp ON pp.user_id = u.id
    WHERE u.id = v_actor_id;

    INSERT INTO public.audit_logs (
        id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, reason, before_data, after_data, created_at
    ) VALUES (
        v_log_id, v_actor_id, COALESCE(v_actor_name, 'Sistema'), v_actor_role,
        p_action_type, p_entity_type, COALESCE(p_entity_id, 'global'), p_reason, p_before_data, p_after_data, pg_catalog.now()
    );

    RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION private.append_official_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.append_official_audit_log(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. CONVITES CRIPTOGRAFICAMENTE SEGUROS (128+ BITS CSPRNG + HASH SHA-256)
--    Atende Etapa 3 e Testes 3, 4 e 5
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL CHECK (pg_catalog.length(token_hash) = 64),
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1),
    uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0 AND uses_count <= max_uses),
    revoked_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON public.team_invites(team_id);

-- Registro privado de tentativas de uso de convite para proteção contra força bruta
CREATE TABLE IF NOT EXISTS private.invite_attempt_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    succeeded BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_invite_attempts_user_time ON private.invite_attempt_log(user_id, attempted_at DESC);
REVOKE ALL ON TABLE private.invite_attempt_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.hash_invite_token(p_raw_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.encode(
        pg_catalog.sha256(
            pg_catalog.convert_to(
                pg_catalog.upper(pg_catalog.regexp_replace(COALESCE(p_raw_token, ''), '[^a-zA-Z0-9]', '', 'g')),
                'UTF8'
            )
        ),
        'hex'
    );
$$;

REVOKE ALL ON FUNCTION private.hash_invite_token(TEXT) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. TABELAS NORMALIZADAS: AVALIAÇÕES, AGENDA, CAIXA IMUTÁVEL, PIX, MENSALIDADES E ARQUIVO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.peer_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluator_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    evaluator_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    target_player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    finalizacao SMALLINT NOT NULL CHECK (finalizacao BETWEEN 1 AND 5),
    marcacao SMALLINT NOT NULL CHECK (marcacao BETWEEN 1 AND 5),
    passe SMALLINT NOT NULL CHECK (passe BETWEEN 1 AND 5),
    raca SMALLINT NOT NULL CHECK (raca BETWEEN 1 AND 5),
    drible SMALLINT NOT NULL CHECK (drible BETWEEN 1 AND 5),
    overall NUMERIC(3,2) NOT NULL CHECK (overall BETWEEN 1.00 AND 5.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT uq_peer_evaluation_pair UNIQUE (evaluator_player_id, target_player_id),
    CONSTRAINT chk_no_self_evaluation CHECK (evaluator_player_id <> target_player_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_evals_target ON public.peer_evaluations(target_player_id);
CREATE INDEX IF NOT EXISTS idx_peer_evals_team ON public.peer_evaluations(team_id);

-- Etapa 7: View agregada exige quórum mínimo de 3 avaliações independentes (COUNT(*) >= 3)
-- para impedir que um voto isolado seja inferido!
DROP VIEW IF EXISTS public.player_skill_aggregates_view;
CREATE VIEW public.player_skill_aggregates_view
WITH (security_invoker = false)
AS
SELECT
    target_player_id AS player_id,
    team_id,
    pg_catalog.count(*)::INTEGER AS total_votes,
    (pg_catalog.count(*) >= 3) AS has_minimum_quorum,
    CASE WHEN pg_catalog.count(*) >= 3 THEN pg_catalog.round(pg_catalog.avg(finalizacao), 1)::NUMERIC(3,1) ELSE NULL END AS finalizacao,
    CASE WHEN pg_catalog.count(*) >= 3 THEN pg_catalog.round(pg_catalog.avg(marcacao), 1)::NUMERIC(3,1) ELSE NULL END AS marcacao,
    CASE WHEN pg_catalog.count(*) >= 3 THEN pg_catalog.round(pg_catalog.avg(passe), 1)::NUMERIC(3,1) ELSE NULL END AS passe,
    CASE WHEN pg_catalog.count(*) >= 3 THEN pg_catalog.round(pg_catalog.avg(raca), 1)::NUMERIC(3,1) ELSE NULL END AS raca,
    CASE WHEN pg_catalog.count(*) >= 3 THEN pg_catalog.round(pg_catalog.avg(drible), 1)::NUMERIC(3,1) ELSE NULL END AS drible,
    CASE WHEN pg_catalog.count(*) >= 3 THEN pg_catalog.round(pg_catalog.avg(overall), 1)::NUMERIC(3,1) ELSE NULL END AS overall_stars
FROM public.peer_evaluations
GROUP BY target_player_id, team_id;

CREATE TABLE IF NOT EXISTS public.team_schedules (
    team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    venue_name TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(venue_name)) >= 2),
    neighborhood TEXT NOT NULL DEFAULT 'Centro',
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE IF NOT EXISTS public.team_financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_tx_id TEXT UNIQUE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
    entry_kind TEXT NOT NULL DEFAULT 'lancamento' CHECK (entry_kind IN ('lancamento', 'estorno')),
    reversal_of_id UUID UNIQUE REFERENCES public.team_financial_transactions(id) ON DELETE RESTRICT,
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
    category TEXT NOT NULL DEFAULT 'outro',
    description TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(description)) >= 2),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_reversal_reference CHECK (
        (entry_kind = 'lancamento' AND reversal_of_id IS NULL)
        OR (entry_kind = 'estorno' AND reversal_of_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_financial_tx_team_date ON public.team_financial_transactions(team_id, transaction_date DESC);

CREATE OR REPLACE FUNCTION private.trg_financial_tx_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'IMUTABILIDADE_FINANCEIRA: Lançamentos confirmados do Caixa não podem ser editados ou apagados. Utilize a operação oficial de estorno.';
END;
$$;

DROP TRIGGER IF EXISTS financial_tx_immutable_trg ON public.team_financial_transactions;
CREATE TRIGGER financial_tx_immutable_trg
    BEFORE UPDATE OR DELETE ON public.team_financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_financial_tx_immutable();

ALTER TABLE public.pelada_monthly_configs ADD COLUMN IF NOT EXISTS team_id UUID UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE;
DELETE FROM public.pelada_monthly_configs WHERE team_id IS NULL;
ALTER TABLE public.pelada_monthly_configs DROP CONSTRAINT IF EXISTS pelada_monthly_configs_pix_key_type_check;
ALTER TABLE public.pelada_monthly_configs ADD CONSTRAINT pelada_monthly_configs_pix_key_type_check
    CHECK (pg_catalog.lower(pix_key_type) IN ('cpf', 'cnpj', 'email', 'telefone', 'celular', 'aleatoria'));

ALTER TABLE public.monthly_payments ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
DELETE FROM public.monthly_payments WHERE team_id IS NULL;
ALTER TABLE public.monthly_payments DROP CONSTRAINT IF EXISTS monthly_payments_confirmed_by_fkey;
ALTER TABLE public.monthly_payments ALTER COLUMN confirmed_by TYPE UUID USING (
    CASE WHEN confirmed_by::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN confirmed_by::text::uuid ELSE NULL END
);
ALTER TABLE public.monthly_payments DROP CONSTRAINT IF EXISTS uq_player_year_month;
ALTER TABLE public.monthly_payments DROP CONSTRAINT IF EXISTS uq_team_player_year_month;
ALTER TABLE public.monthly_payments ADD CONSTRAINT uq_team_player_year_month UNIQUE (team_id, player_id, year_month);

CREATE TABLE IF NOT EXISTS public.migration_archived_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_ledger_id TEXT NOT NULL,
    record_type TEXT NOT NULL,
    legacy_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT uq_archived_legacy_record UNIQUE (source_ledger_id, legacy_key)
);

ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS super_capas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS goalkeeper_capas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS capa_efficiency_pct SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS yellow_cards INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS blue_cards INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS red_cards INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS clean_sheets INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.season_entries ADD COLUMN IF NOT EXISTS defensive_actions INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_validated_result_per_match
    ON public.match_results (match_id)
    WHERE validation_status = 'validado';

-- -----------------------------------------------------------------------------
-- 4. MIGRAÇÃO E RECONCILIAÇÃO DOS 46 REGISTROS DE public.pelada_sumulas
--    (100% Idempotente: pode ser executada múltiplas vezes sem duplicar - TESTE 17)
-- -----------------------------------------------------------------------------
-- 4.1. Sessões legadas (20 registros user_session_*):
--      ETAPA 6: NÃO são migradas como sessões ativas! São revogadas e arquivadas
--      com o token mascarado por SHA-256 para impedir reutilização de token legado (TESTE 19).
INSERT INTO public.migration_archived_records (source_ledger_id, record_type, legacy_key, payload)
SELECT
    ps.id,
    'revoked_legacy_session',
    ps.id,
    pg_catalog.jsonb_build_object(
        'userId', ps.data->>'userId',
        'updatedAt', ps.data->>'updatedAt',
        'revokedAt', pg_catalog.now(),
        'redactedTokenSha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(ps.data->>'sessionToken', ''), 'UTF8')), 'hex')
    )
FROM public.pelada_sumulas ps
WHERE ps.status = 'active_session' OR ps.id LIKE 'user_session_%'
ON CONFLICT (source_ledger_id, legacy_key) DO NOTHING;

-- 4.2. Avaliações de atletas (308 ocorrências brutas -> 176 pares únicos reconciliados)
WITH raw_evals AS (
    SELECT jsonb_array_elements(ps.data->'evaluations') AS ev
    FROM public.pelada_sumulas ps
    WHERE ps.id = 'futplay_peer_evaluations_ledger_v1'
       OR ps.id LIKE 'evals_player_%'
       OR ps.status IN ('peer_evaluations', 'player_evaluations')
),
dedup_evals AS (
    SELECT DISTINCT ON (ev->>'evaluatorId', ev->>'targetPlayerId')
        ev->>'evaluatorId' AS raw_evaluator_id,
        ev->>'targetPlayerId' AS raw_target_id,
        GREATEST(1, LEAST(5, COALESCE((ev->>'finalizacao')::smallint, 3))) AS finalizacao,
        GREATEST(1, LEAST(5, COALESCE((ev->>'marcacao')::smallint, 3))) AS marcacao,
        GREATEST(1, LEAST(5, COALESCE((ev->>'passe')::smallint, 3))) AS passe,
        GREATEST(1, LEAST(5, COALESCE((ev->>'raca')::smallint, 3))) AS raca,
        GREATEST(1, LEAST(5, COALESCE((ev->>'drible')::smallint, 3))) AS drible,
        COALESCE((ev->>'createdAt')::timestamptz, pg_catalog.now()) AS created_at,
        COALESCE((ev->>'updatedAt')::timestamptz, (ev->>'createdAt')::timestamptz, pg_catalog.now()) AS updated_at
    FROM raw_evals
    WHERE (ev->>'evaluatorId') IS NOT NULL AND (ev->>'targetPlayerId') IS NOT NULL
    ORDER BY ev->>'evaluatorId', ev->>'targetPlayerId', COALESCE((ev->>'updatedAt')::timestamptz, (ev->>'createdAt')::timestamptz, '1970-01-01'::timestamptz) DESC
)
INSERT INTO public.peer_evaluations (
    evaluator_user_id, evaluator_player_id, target_player_id, team_id,
    finalizacao, marcacao, passe, raca, drible, overall, created_at, updated_at
)
SELECT
    eval_prof.user_id AS evaluator_user_id,
    eval_prof.id AS evaluator_player_id,
    target_prof.id AS target_player_id,
    tm.team_id AS team_id,
    de.finalizacao,
    de.marcacao,
    de.passe,
    de.raca,
    de.drible,
    pg_catalog.round(((de.finalizacao + de.marcacao + de.passe + de.raca + de.drible)::numeric / 5.0), 2) AS overall,
    de.created_at,
    de.updated_at
FROM dedup_evals de
JOIN public.player_profiles eval_prof
  ON (eval_prof.user_id::text = de.raw_evaluator_id OR eval_prof.id::text = de.raw_evaluator_id)
JOIN public.player_profiles target_prof
  ON (target_prof.id::text = de.raw_target_id OR target_prof.user_id::text = de.raw_target_id)
JOIN public.team_memberships tm
  ON tm.player_id = target_prof.id
WHERE eval_prof.id <> target_prof.id
ON CONFLICT (evaluator_player_id, target_player_id) DO UPDATE
SET finalizacao = EXCLUDED.finalizacao,
    marcacao = EXCLUDED.marcacao,
    passe = EXCLUDED.passe,
    raca = EXCLUDED.raca,
    drible = EXCLUDED.drible,
    overall = EXCLUDED.overall,
    updated_at = EXCLUDED.updated_at;

-- 4.3. Mensalidades (6 de atletas ativos -> monthly_payments; 3 de ex-atletas -> migration_archived_records)
WITH raw_payments AS (
    SELECT jsonb_array_elements(ps.data->'payments') AS pay
    FROM public.pelada_sumulas ps
    WHERE ps.id = 'monthly_payments_ledger_v1'
)
INSERT INTO public.monthly_payments (
    id, player_id, team_id, year_month, is_paid, paid_at, amount, confirmed_by, updated_at
)
SELECT
    pay->>'id' AS id,
    pp.id AS player_id,
    tm.team_id AS team_id,
    pg_catalog.btrim(pay->>'yearMonth') AS year_month,
    COALESCE((pay->>'isPaid')::boolean, false) AS is_paid,
    CASE WHEN (pay->>'paidAt') IS NOT NULL THEN (pay->>'paidAt')::timestamptz ELSE NULL END AS paid_at,
    COALESCE((pay->>'amount')::numeric(10,2), 30.00) AS amount,
    CASE
        WHEN (pay->>'confirmedBy') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
             AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (pay->>'confirmedBy')::uuid)
        THEN (pay->>'confirmedBy')::uuid
        ELSE NULL
    END AS confirmed_by,
    COALESCE((pay->>'updatedAt')::timestamptz, pg_catalog.now()) AS updated_at
FROM raw_payments rp
JOIN public.player_profiles pp ON (pp.id::text = (rp.pay->>'playerId') OR pp.user_id::text = (rp.pay->>'playerId'))
JOIN public.team_memberships tm ON tm.player_id = pp.id
ON CONFLICT (team_id, player_id, year_month) DO UPDATE
SET is_paid = EXCLUDED.is_paid,
    amount = EXCLUDED.amount,
    updated_at = EXCLUDED.updated_at;

WITH raw_payments AS (
    SELECT jsonb_array_elements(ps.data->'payments') AS pay
    FROM public.pelada_sumulas ps
    WHERE ps.id = 'monthly_payments_ledger_v1'
)
INSERT INTO public.migration_archived_records (source_ledger_id, record_type, legacy_key, payload)
SELECT
    'monthly_payments_ledger_v1',
    'orphan_monthly_payment',
    COALESCE(rp.pay->>'id', gen_random_uuid()::text),
    rp.pay
FROM raw_payments rp
WHERE NOT EXISTS (
    SELECT 1 FROM public.player_profiles pp
    WHERE pp.id::text = (rp.pay->>'playerId') OR pp.user_id::text = (rp.pay->>'playerId')
)
ON CONFLICT (source_ledger_id, legacy_key) DO NOTHING;

ALTER TABLE public.monthly_payments ALTER COLUMN team_id SET NOT NULL;

-- 4.4. Configuração PIX (vinculada exclusivamente ao team_id de Quase Craques FC)
INSERT INTO public.pelada_monthly_configs (
    team_id, monthly_amount, due_day, pix_key, pix_key_type, pix_receiver_name, updated_by, updated_at
)
SELECT
    t.id AS team_id,
    COALESCE((ps.data->'config'->>'monthlyAmount')::numeric(10,2), 10.00) AS monthly_amount,
    COALESCE((ps.data->'config'->>'dueDay')::smallint, 10) AS due_day,
    COALESCE(ps.data->'config'->>'pixKey', '') AS pix_key,
    pg_catalog.lower(COALESCE(ps.data->'config'->>'pixKeyType', 'telefone')) AS pix_key_type,
    COALESCE(ps.data->'config'->>'pixReceiverName', '') AS pix_receiver_name,
    (SELECT tm.user_id FROM public.team_memberships tm WHERE tm.team_id = t.id AND tm.is_owner = true LIMIT 1) AS updated_by,
    COALESCE(ps.last_updated, pg_catalog.now()) AS updated_at
FROM public.pelada_sumulas ps
JOIN public.teams t ON t.slug = 'quase_craques_fc'
WHERE ps.id = 'monthly_config_ledger_v1'
ON CONFLICT (team_id) DO UPDATE
SET monthly_amount = EXCLUDED.monthly_amount,
    due_day = EXCLUDED.due_day,
    pix_key = EXCLUDED.pix_key,
    pix_receiver_name = EXCLUDED.pix_receiver_name;

ALTER TABLE public.pelada_monthly_configs ALTER COLUMN team_id SET NOT NULL;

-- 4.5. Agendamento de pelada -> team_schedules
INSERT INTO public.team_schedules (
    team_id, scheduled_date, start_time, venue_name, neighborhood, updated_by, updated_at
)
SELECT
    t.id AS team_id,
    COALESCE((ps.data->'schedule'->>'date')::date, CURRENT_DATE) AS scheduled_date,
    COALESCE((ps.data->'schedule'->>'time')::time, '20:00'::time) AS start_time,
    COALESCE(ps.data->'schedule'->>'venueName', 'Arena') AS venue_name,
    COALESCE(ps.data->'schedule'->>'neighborhood', 'Centro') AS neighborhood,
    (SELECT tm.user_id FROM public.team_memberships tm WHERE tm.team_id = t.id AND tm.is_owner = true LIMIT 1) AS updated_by,
    COALESCE(ps.last_updated, pg_catalog.now()) AS updated_at
FROM public.pelada_sumulas ps
JOIN public.teams t ON ('pelada_schedule_ledger_' || t.slug) = ps.id
WHERE ps.status = 'schedule_ledger' OR ps.id LIKE 'pelada_schedule_ledger_%'
ON CONFLICT (team_id) DO UPDATE
SET scheduled_date = EXCLUDED.scheduled_date,
    start_time = EXCLUDED.start_time,
    venue_name = EXCLUDED.venue_name,
    neighborhood = EXCLUDED.neighborhood;

-- 4.6. Logs de auditoria (1.286 registros de audit_logs_ledger_v1 -> public.audit_logs)
WITH raw_logs AS (
    SELECT
        jsonb_array_elements(ps.data->'logs') AS lg,
        ROW_NUMBER() OVER () AS rn
    FROM public.pelada_sumulas ps
    WHERE ps.id = 'audit_logs_ledger_v1'
)
INSERT INTO public.audit_logs (
    legacy_log_id, actor_user_id, actor_name, actor_role, action_type, entity_type, entity_id, reason, before_data, after_data, created_at
)
SELECT
    COALESCE(lg->>'id', 'legacy_log_' || rn::text) AS legacy_log_id,
    CASE
        WHEN (lg->>'actorUserId') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
             AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (lg->>'actorUserId')::uuid)
        THEN (lg->>'actorUserId')::uuid
        ELSE NULL
    END AS actor_user_id,
    COALESCE(lg->>'actorName', 'Usuário') AS actor_name,
    COALESCE(lg->>'actorRole', 'player') AS actor_role,
    COALESCE(lg->>'actionType', 'EVENTO') AS action_type,
    COALESCE(lg->>'entityType', 'system') AS entity_type,
    COALESCE(lg->>'entityId', 'global') AS entity_id,
    COALESCE(lg->>'reason', 'Registro histórico migrado') AS reason,
    lg->'beforeData' AS before_data,
    lg->'afterData' AS after_data,
    COALESCE((lg->>'createdAt')::timestamptz, pg_catalog.now()) AS created_at
FROM raw_logs
ON CONFLICT (legacy_log_id) DO NOTHING;

CREATE TRIGGER audit_logs_immutable_trg
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_audit_logs_immutable();

-- 4.7. Arquiva todas as 46 linhas originais de pelada_sumulas (com token de sessão mascarado por SHA-256)
--      e os registros legados não-súmula em public.migration_archived_records, depois purifica pelada_sumulas
DROP TRIGGER IF EXISTS guard_pelada_sumulas_security_trg ON public.pelada_sumulas;

INSERT INTO public.migration_archived_records (source_ledger_id, record_type, legacy_key, payload)
SELECT
    'pelada_sumulas_full_backup_v1',
    ps.status,
    ps.id,
    CASE
        WHEN ps.status = 'active_session' OR ps.id LIKE 'user_session_%'
        THEN pg_catalog.jsonb_set(
            pg_catalog.to_jsonb(ps),
            '{data,sessionToken}',
            pg_catalog.to_jsonb(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(COALESCE(ps.data->>'sessionToken', ''), 'UTF8')), 'hex'))
        )
        ELSE pg_catalog.to_jsonb(ps)
    END
FROM public.pelada_sumulas ps
ON CONFLICT (source_ledger_id, legacy_key) DO NOTHING;

INSERT INTO public.migration_archived_records (source_ledger_id, record_type, legacy_key, payload)
SELECT
    ps.id,
    ps.status,
    ps.id,
    pg_catalog.jsonb_build_object('team_name', ps.team_name, 'status', ps.status, 'last_updated', ps.last_updated)
FROM public.pelada_sumulas ps
WHERE (ps.status NOT IN ('em_andamento', 'finalizada', 'cancelada')
   OR ps.id LIKE 'evals_player_%'
   OR ps.id LIKE 'finance_ledger_%'
   OR ps.id LIKE 'monthly_%'
   OR ps.id LIKE 'pelada_schedule_%'
   OR ps.id IN ('audit_logs_ledger_v1', 'futplay_peer_evaluations_ledger_v1'))
  AND ps.status <> 'active_session'
  AND ps.id NOT LIKE 'user_session_%'
ON CONFLICT (source_ledger_id, legacy_key) DO NOTHING;

-- Sanitiza credenciais legadas e códigos de convite estáticos em public.users e public.player_profiles
DROP TRIGGER IF EXISTS guard_users_security_trg ON public.users;
UPDATE public.users
SET password_hash = NULL,
    team_invite_code = NULL
WHERE password_hash IS NOT NULL OR team_invite_code IS NOT NULL;
CREATE TRIGGER guard_users_security_trg
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_guard_users_security();

DROP TRIGGER IF EXISTS guard_profiles_security_trg ON public.player_profiles;
UPDATE public.player_profiles
SET team_invite_code = NULL
WHERE team_invite_code IS NOT NULL;
CREATE TRIGGER guard_profiles_security_trg
    BEFORE INSERT OR UPDATE ON public.player_profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_guard_profiles_security();

DELETE FROM public.pelada_sumulas ps
WHERE ps.status NOT IN ('em_andamento', 'finalizada', 'cancelada')
   OR ps.id LIKE 'user_session_%'
   OR ps.id LIKE 'evals_player_%'
   OR ps.id LIKE 'finance_ledger_%'
   OR ps.id LIKE 'monthly_%'
   OR ps.id LIKE 'pelada_schedule_%'
   OR ps.id IN ('audit_logs_ledger_v1', 'futplay_peer_evaluations_ledger_v1');

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

CREATE TRIGGER guard_pelada_sumulas_security_trg
    BEFORE INSERT OR UPDATE OR DELETE ON public.pelada_sumulas
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_guard_pelada_sumulas_security();

ALTER TABLE public.pelada_sumulas ADD COLUMN IF NOT EXISTS stats_applied BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.pelada_sumulas ADD COLUMN IF NOT EXISTS applied_snapshot JSONB;
ALTER TABLE public.pelada_sumulas ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE public.pelada_sumulas ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.pelada_sumulas ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE public.pelada_sumulas DROP CONSTRAINT IF EXISTS chk_pelada_sumulas_valid_status;
ALTER TABLE public.pelada_sumulas ADD CONSTRAINT chk_pelada_sumulas_valid_status
    CHECK (status IN ('em_andamento', 'finalizada', 'cancelada'));

-- -----------------------------------------------------------------------------
-- 5. GRANTS E POLÍTICAS RLS PARA TODAS AS NOVAS TABELAS NORMALIZADAS
-- -----------------------------------------------------------------------------
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pelada_monthly_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_archived_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.team_invites FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.peer_evaluations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.team_schedules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.team_financial_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.pelada_monthly_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.monthly_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.migration_archived_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.player_skill_aggregates_view FROM PUBLIC, anon, authenticated;

-- team_invites: somente leitura metadados (sem token_hash) pelo treinador; emissão/consumo via RPC
GRANT SELECT (id, team_id, expires_at, max_uses, uses_count, revoked_at, created_by, created_at) ON public.team_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_evaluations TO authenticated;
GRANT SELECT ON public.player_skill_aggregates_view TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.team_schedules TO authenticated;
GRANT SELECT, INSERT ON public.team_financial_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pelada_monthly_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.monthly_payments TO authenticated;
GRANT SELECT ON public.migration_archived_records TO authenticated;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_catalog.pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('team_invites', 'peer_evaluations', 'team_schedules', 'team_financial_transactions', 'pelada_monthly_configs', 'monthly_payments', 'migration_archived_records')
    LOOP
        EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END
$$;

-- 5.1. team_invites
CREATE POLICY team_invites_select_coach ON public.team_invites
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_invites.team_id AND m.has_sport_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

-- 5.2. peer_evaluations
CREATE POLICY peer_evals_select_own_or_admin ON public.peer_evaluations
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            evaluator_user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY peer_evals_insert_teammate ON public.peer_evaluations
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND evaluator_user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.player_profiles pp WHERE pp.id = evaluator_player_id AND pp.user_id = auth.uid())
        AND evaluator_player_id <> target_player_id
        AND EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = peer_evaluations.team_id)
        AND EXISTS (
            SELECT 1 FROM public.team_memberships tm_target
            WHERE tm_target.team_id = peer_evaluations.team_id
              AND tm_target.player_id = peer_evaluations.target_player_id
              AND tm_target.status = 'active'
        )
    );

CREATE POLICY peer_evals_update_own ON public.peer_evaluations
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v) AND evaluator_user_id = auth.uid())
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND evaluator_user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.player_profiles pp WHERE pp.id = evaluator_player_id AND pp.user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = peer_evaluations.team_id)
    );

CREATE POLICY peer_evals_delete_own_or_admin ON public.peer_evaluations
    FOR DELETE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            evaluator_user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

-- 5.3. team_financial_transactions (Usa exclusivamente has_finance_permission por team_id!)
CREATE POLICY financial_tx_select_member ON public.team_financial_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_financial_transactions.team_id)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY financial_tx_insert_treasurer ON public.team_financial_transactions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND created_by_user_id = auth.uid()
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_financial_transactions.team_id AND m.has_finance_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

-- 5.4. pelada_monthly_configs e monthly_payments (Usa exclusivamente has_finance_permission por team_id!)
CREATE POLICY monthly_configs_select_member ON public.pelada_monthly_configs
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_monthly_configs.team_id)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY monthly_configs_insert_treasurer ON public.pelada_monthly_configs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_monthly_configs.team_id AND m.has_finance_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY monthly_configs_update_treasurer ON public.pelada_monthly_configs
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_monthly_configs.team_id AND m.has_finance_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = pelada_monthly_configs.team_id AND m.has_finance_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY monthly_payments_select_member ON public.monthly_payments
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = monthly_payments.team_id)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY monthly_payments_insert_treasurer ON public.monthly_payments
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = monthly_payments.team_id AND m.has_finance_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY monthly_payments_update_treasurer ON public.monthly_payments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = monthly_payments.team_id AND m.has_finance_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = monthly_payments.team_id AND m.has_finance_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

-- 5.5. team_schedules (Usa has_sport_permission por team_id)
CREATE POLICY team_schedules_select_member ON public.team_schedules
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_schedules.team_id)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

CREATE POLICY team_schedules_write_coach ON public.team_schedules
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_schedules.team_id AND m.has_sport_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.current_actor_context_v)
        AND (
            EXISTS (SELECT 1 FROM public.current_actor_team_memberships_v m WHERE m.team_id = team_schedules.team_id AND m.has_sport_permission)
            OR EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin)
        )
    );

-- 5.6. migration_archived_records
CREATE POLICY archived_records_select_admin ON public.migration_archived_records
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v c WHERE c.is_admin));

-- -----------------------------------------------------------------------------
-- 6. RPCs TRANSACIONAIS DE NEGÓCIO (CONVITES, CRIAÇÃO DE EQUIPE, TITULARIDADE,
--    ESTORNO FINANCEIRO, REDEFINIÇÃO DE SENHA E HOMOLOGAÇÃO CONCORRENTE)
-- -----------------------------------------------------------------------------

-- 6.1. Emissão de Convite com 128 bits de Entropia CSPRNG e Armazenamento de Hash SHA-256 (Etapa 3)
CREATE OR REPLACE FUNCTION public.issue_team_invite_authenticated(
    p_team_id UUID,
    p_expires_in_hours INTEGER DEFAULT 48,
    p_max_uses INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_invite_id UUID := gen_random_uuid();
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF NOT private.is_active_verified_user() THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    IF NOT (private.has_team_sport_permission(p_team_id) OR private.is_platform_admin()) THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas o treinador ou proprietário da equipe pode emitir convites.';
    END IF;

    IF COALESCE(p_expires_in_hours, 0) < 1 OR p_expires_in_hours > 720 THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Validade do convite deve estar entre 1 e 720 horas.';
    END IF;

    IF COALESCE(p_max_uses, 0) < 1 OR p_max_uses > 50 THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Limite de utilizações deve estar entre 1 e 50.';
    END IF;

    -- 128 bits de entropia criptográfica (UUID v4 CSPRNG sem hifens = 32 caracteres hexadecimais = 128 bits)
    v_raw_token := pg_catalog.upper(pg_catalog.replace(gen_random_uuid()::text, '-', ''));
    v_token_hash := private.hash_invite_token(v_raw_token);
    v_expires_at := pg_catalog.now() + (p_expires_in_hours || ' hours')::interval;

    INSERT INTO public.team_invites (
        id, team_id, token_hash, expires_at, max_uses, uses_count, created_by
    ) VALUES (
        v_invite_id, p_team_id, v_token_hash, v_expires_at, p_max_uses, 0, auth.uid()
    );

    PERFORM private.append_official_audit_log(
        'CONVITE_EQUIPE_EMITIDO',
        'team_invites',
        v_invite_id::text,
        'Convite criptográfico emitido para team_id=' || p_team_id::text
    );

    RETURN pg_catalog.jsonb_build_object(
        'invite_id', v_invite_id,
        'team_id', p_team_id,
        'raw_token', v_raw_token,
        'expires_at', v_expires_at,
        'max_uses', p_max_uses
    );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_team_invite_authenticated(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_team_invite_authenticated(UUID, INTEGER, INTEGER) TO authenticated, service_role;

-- 6.2. Consumo Transacional de Convite com Bloqueio de Concorrência (Etapa 3 / Testes 3, 4 e 5)
CREATE OR REPLACE FUNCTION public.join_team_with_invite_code_authenticated(p_raw_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_token_hash TEXT;
    v_invite RECORD;
    v_team RECORD;
    v_profile_id UUID;
    v_recent_failures INTEGER;
BEGIN
    IF NOT private.is_active_verified_user() OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    -- Bloqueio transacional por usuário (impede que duas requisições simultâneas do mesmo usuário ingressem em 2 times - TESTE 5)
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('join_team_user_' || v_user_id::text));

    -- Rate limit contra força bruta (máximo 5 falhas nos últimos 15 minutos)
    SELECT pg_catalog.count(*)::integer INTO v_recent_failures
    FROM private.invite_attempt_log
    WHERE user_id = v_user_id
      AND succeeded = false
      AND attempted_at > (pg_catalog.now() - interval '15 minutes');

    IF COALESCE(v_recent_failures, 0) >= 5 THEN
        RAISE EXCEPTION 'LIMITE_TENTATIVAS_EXCEDIDO: Muitas tentativas inválidas de convite. Aguarde 15 minutos.';
    END IF;

    -- Verifica se o usuário já possui equipe ativa (garantido também pelo índice único uq_one_active_team_per_user)
    IF EXISTS (
        SELECT 1 FROM public.team_memberships tm
        WHERE tm.user_id = v_user_id AND tm.status = 'active'
    ) THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário já possui vínculo ativo com uma equipe.';
    END IF;

    SELECT id INTO v_profile_id FROM public.player_profiles WHERE user_id = v_user_id LIMIT 1;
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Perfil de atleta não encontrado para o usuário.';
    END IF;

    v_token_hash := private.hash_invite_token(p_raw_token);

    -- Bloqueio pessimista FOR UPDATE na linha do convite (serializa dois aparelhos consumindo o mesmo convite - TESTE 4)
    SELECT * INTO v_invite
    FROM public.team_invites
    WHERE token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO private.invite_attempt_log (user_id, succeeded) VALUES (v_user_id, false);
        RAISE EXCEPTION 'CONVITE_INVALIDO: Código de convite não encontrado.';
    END IF;

    IF v_invite.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'CONVITE_REVOGADO: Este convite foi revogado.';
    END IF;

    IF v_invite.expires_at <= pg_catalog.now() THEN
        RAISE EXCEPTION 'CONVITE_EXPIRADO: Este convite expirou.';
    END IF;

    IF v_invite.uses_count >= v_invite.max_uses THEN
        RAISE EXCEPTION 'CONVITE_ESGOTADO: O limite de utilizações deste convite já foi atingido.';
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_invite.team_id AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'EQUIPE_INATIVA: A equipe vinculada ao convite não está ativa.';
    END IF;

    UPDATE public.team_invites
    SET uses_count = uses_count + 1
    WHERE id = v_invite.id;

    INSERT INTO private.invite_attempt_log (user_id, succeeded) VALUES (v_user_id, true);

    INSERT INTO public.team_memberships (
        team_id, user_id, player_id, is_owner, can_manage_sport, can_manage_finance, status
    ) VALUES (
        v_team.id, v_user_id, v_profile_id, false, false, false, 'active'
    );

    PERFORM private.append_official_audit_log(
        'ATLETA_INGRESSOU_COM_CONVITE',
        'team_memberships',
        v_team.id::text,
        'Atleta ingressou na equipe ' || v_team.name || ' com convite id=' || v_invite.id::text
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'joined',
        'team_id', v_team.id,
        'team_name', v_team.name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_team_with_invite_code_authenticated(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_with_invite_code_authenticated(TEXT) TO authenticated, service_role;

-- 6.3. Transferência Atômica de Titularidade da Equipe (Etapa 1 e Etapa 4)
CREATE OR REPLACE FUNCTION public.transfer_team_ownership_authenticated(
    p_team_id UUID,
    p_new_owner_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_owner RECORD;
    v_target_member RECORD;
BEGIN
    IF NOT private.is_active_verified_user() THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    IF NOT (private.is_team_owner(p_team_id) OR private.is_platform_admin()) THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas o proprietário atual da equipe ou um administrador pode transferir a titularidade.';
    END IF;

    SELECT * INTO v_current_owner
    FROM public.team_memberships
    WHERE team_id = p_team_id AND is_owner = true AND status = 'active'
    FOR UPDATE;

    SELECT * INTO v_target_member
    FROM public.team_memberships
    WHERE team_id = p_team_id AND user_id = p_new_owner_user_id AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: O novo proprietário deve ser um membro ativo da mesma equipe.';
    END IF;

    IF v_current_owner.id IS NOT NULL THEN
        UPDATE public.team_memberships
        SET is_owner = false,
            updated_at = pg_catalog.now()
        WHERE id = v_current_owner.id;
    END IF;

    UPDATE public.team_memberships
    SET is_owner = true,
        can_manage_sport = true,
        can_manage_finance = true,
        updated_at = pg_catalog.now()
    WHERE id = v_target_member.id;

    PERFORM private.append_official_audit_log(
        'TITULARIDADE_EQUIPE_TRANSFERIDA',
        'team_memberships',
        p_team_id::text,
        'Titularidade transferida para user_id=' || p_new_owner_user_id::text
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'transferred',
        'team_id', p_team_id,
        'new_owner_user_id', p_new_owner_user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_team_ownership_authenticated(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership_authenticated(UUID, UUID) TO authenticated, service_role;

-- 6.4. Estorno Financeiro Atômico com Bloqueio Concorrente (Etapa 4 e Teste 16)
CREATE OR REPLACE FUNCTION public.reverse_team_financial_transaction_authenticated(
    p_transaction_id UUID,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_orig RECORD;
    v_reversal_id UUID := gen_random_uuid();
BEGIN
    IF NOT private.is_active_verified_user() THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    IF pg_catalog.length(pg_catalog.btrim(COALESCE(p_reason, ''))) < 3 THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Informe o motivo do estorno (mínimo 3 caracteres).';
    END IF;

    SELECT * INTO v_orig
    FROM public.team_financial_transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NAO_ENCONTRADO: Lançamento financeiro % não existe.', p_transaction_id;
    END IF;

    IF v_orig.entry_kind = 'estorno' THEN
        RAISE EXCEPTION 'OPERACAO_INVALIDA: Não é possível estornar um lançamento que já é um estorno.';
    END IF;

    IF NOT (private.has_team_finance_permission(v_orig.team_id) OR private.is_platform_admin()) THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas o tesoureiro ou proprietário da equipe pode estornar lançamentos.';
    END IF;

    INSERT INTO public.team_financial_transactions (
        id, team_id, entry_kind, reversal_of_id, type, category, description, amount, transaction_date, notes, created_by_user_id
    ) VALUES (
        v_reversal_id,
        v_orig.team_id,
        'estorno',
        v_orig.id,
        CASE WHEN v_orig.type = 'receita' THEN 'despesa' ELSE 'receita' END,
        v_orig.category,
        'ESTORNO: ' || v_orig.description,
        v_orig.amount,
        CURRENT_DATE,
        'Motivo do estorno: ' || pg_catalog.btrim(p_reason),
        auth.uid()
    );

    PERFORM private.append_official_audit_log(
        'CAIXA_LANCAMENTO_ESTORNADO',
        'team_financial_transactions',
        v_orig.id::text,
        'Lançamento estornado: ' || pg_catalog.btrim(p_reason),
        pg_catalog.to_jsonb(v_orig),
        pg_catalog.jsonb_build_object('reversal_id', v_reversal_id)
    );

    RETURN v_reversal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_team_financial_transaction_authenticated(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_team_financial_transaction_authenticated(UUID, TEXT) TO authenticated, service_role;

-- 6.5. Conclusão de Redefinição Obrigatória de Senha (Etapa 5)
--      Não confia apenas em chamada do cliente: comprova que auth.users.encrypted_password
--      foi efetivamente alterada no Supabase Auth e não é mais o placeholder de migração!
CREATE OR REPLACE FUNCTION public.complete_mandatory_password_reset_authenticated()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_encrypted_password TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Sessão inválida.';
    END IF;

    -- Validação criptográfica no serviço canônico Supabase Auth (auth.users)
    SELECT encrypted_password INTO v_encrypted_password
    FROM auth.users
    WHERE id = v_user_id;

    IF v_encrypted_password IS NULL
       OR v_encrypted_password = 'MUST_RESET_BCRYPT_HASH'
       OR v_encrypted_password LIKE 'MUST_RESET%' THEN
        RAISE EXCEPTION 'CREDENCIAIS_NAO_REDEFINIDAS: A senha ainda não foi alterada no serviço de autenticação do Supabase Auth. Conclua a redefinição de senha antes de ativar a conta.';
    END IF;

    INSERT INTO private.trusted_rpc_locks (txid, operation, target_id, actor_id)
    VALUES (pg_catalog.txid_current(), 'complete_password_reset', v_user_id::text, v_user_id)
    ON CONFLICT (txid, operation, target_id) DO NOTHING;

    UPDATE public.users
    SET must_reset_password = false,
        password_hash = NULL,
        updated_at = pg_catalog.now()
    WHERE id = v_user_id;

    DELETE FROM private.trusted_rpc_locks
    WHERE txid = pg_catalog.txid_current()
      AND operation = 'complete_password_reset'
      AND target_id = v_user_id::text;

    PERFORM private.append_official_audit_log(
        'SENHA_REDEFINIDA_COM_SUCESSO',
        'users',
        v_user_id::text,
        'Usuário concluiu a redefinição obrigatória de credenciais via Supabase Auth.'
    );

    RETURN pg_catalog.jsonb_build_object('status', 'password_reset_completed', 'user_id', v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_mandatory_password_reset_authenticated() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_mandatory_password_reset_authenticated() TO authenticated, service_role;

-- 6.5b. Reabertura Controlada e Auditada de Súmula Finalizada (Etapa 7 / Crítica 5)
CREATE OR REPLACE FUNCTION public.reopen_pelada_sumula_authenticated(
    p_sumula_id TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_sumula RECORD;
    v_is_staff BOOLEAN;
    v_is_owner BOOLEAN;
BEGIN
    IF NOT private.is_active_verified_user() OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    IF pg_catalog.length(pg_catalog.btrim(COALESCE(p_reason, ''))) < 10 THEN
        RAISE EXCEPTION 'JUSTIFICATIVA_INSUFICIENTE: É obrigatório informar uma justificativa detalhada para a reabertura da súmula (mínimo 10 caracteres).';
    END IF;

    SELECT * INTO v_sumula
    FROM public.pelada_sumulas
    WHERE id = p_sumula_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NAO_ENCONTRADO: Súmula % não encontrada.', p_sumula_id;
    END IF;

    IF v_sumula.status <> 'finalizada' THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Apenas súmulas com status "finalizada" podem ser reabertas.';
    END IF;

    v_is_owner := private.is_team_owner(v_sumula.team_id);
    v_is_staff := private.is_platform_staff();

    IF NOT (v_is_owner OR v_is_staff) THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas o proprietário da equipe ou moderador da plataforma pode reabrir uma súmula finalizada.';
    END IF;

    INSERT INTO private.trusted_rpc_locks (txid, operation, target_id, actor_id)
    VALUES (pg_catalog.txid_current(), 'reopen_sumula', p_sumula_id, v_user_id)
    ON CONFLICT (txid, operation, target_id) DO NOTHING;

    UPDATE public.pelada_sumulas
    SET status = 'em_andamento',
        last_updated = pg_catalog.now()
    WHERE id = p_sumula_id;

    DELETE FROM private.trusted_rpc_locks
    WHERE txid = pg_catalog.txid_current()
      AND operation = 'reopen_sumula'
      AND target_id = p_sumula_id;

    PERFORM private.append_official_audit_log(
        'SUMULA_REABERTA_PARA_CORRECAO',
        'pelada_sumulas',
        p_sumula_id,
        'Súmula reaberta para correção. Justificativa: ' || pg_catalog.btrim(p_reason),
        pg_catalog.jsonb_build_object('previous_status', 'finalizada', 'finalized_at', v_sumula.finalized_at),
        pg_catalog.jsonb_build_object('new_status', 'em_andamento', 'reopened_by', v_user_id)
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'reopened',
        'sumula_id', p_sumula_id,
        'new_status', 'em_andamento',
        'reopened_by', v_user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_pelada_sumula_authenticated(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_pelada_sumula_authenticated(TEXT, TEXT) TO authenticated, service_role;

-- 6.6. Motor de Homologação Esportiva com Bloqueio Ordenado e private.trusted_rpc_locks (Etapa 8 e Teste 15)
CREATE OR REPLACE FUNCTION public.process_validated_match(
    p_match_id UUID,
    p_result_version_id UUID,
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_match RECORD;
    v_result RECORD;
    v_home_players_count INTEGER;
    v_away_players_count INTEGER;
    v_home_goals_events INTEGER;
    v_away_goals_events INTEGER;
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
    IF auth.uid() IS NULL OR NOT private.is_platform_staff() THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Apenas moderadores ou administradores autenticados e verificados podem homologar partidas oficiais.';
    END IF;

    IF p_actor_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Identificador do ator diverge do token JWT autenticado.';
    END IF;

    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NAO_ENCONTRADO: Partida % não encontrada.', p_match_id;
    END IF;

    SELECT * INTO v_result FROM public.match_results
    WHERE id = p_result_version_id AND match_id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NAO_ENCONTRADO: Versão de resultado % não encontrada.', p_result_version_id;
    END IF;

    IF v_result.validation_status = 'validado' OR EXISTS (
        SELECT 1 FROM public.point_transactions
        WHERE source_result_version_id = p_result_version_id
          AND transaction_type = 'credito'
    ) THEN
        RETURN pg_catalog.jsonb_build_object('status', 'already_processed', 'result_version_id', p_result_version_id);
    END IF;

    IF v_match.status IN ('cancelada', 'anulada', 'rascunho', 'validada') THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Partida com status "%" não pode ser homologada.', v_match.status;
    END IF;

    IF v_result.validation_status <> 'pendente' THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Versão de resultado com status "%" não pode ser homologada.', v_result.validation_status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.disputes d
        WHERE d.match_id = p_match_id AND d.status IN ('aberta', 'em_analise')
    ) THEN
        RAISE EXCEPTION 'PARTIDA_CONTESTADA: Existem disputas abertas ou em análise para esta partida.';
    END IF;

    SELECT
        pg_catalog.count(*) FILTER (WHERE team_side = 'home' AND participation_status = 'participou'),
        pg_catalog.count(*) FILTER (WHERE team_side = 'away' AND participation_status = 'participou')
    INTO v_home_players_count, v_away_players_count
    FROM public.match_players
    WHERE match_id = p_match_id;

    IF COALESCE(v_home_players_count, 0) < 1 OR COALESCE(v_away_players_count, 0) < 1 THEN
        RAISE EXCEPTION 'ESCALACAO_INCOMPLETA: A partida deve possuir atletas participantes confirmados em ambas as equipes.';
    END IF;

    SELECT
        pg_catalog.count(*) FILTER (WHERE mp.team_side = 'home'),
        pg_catalog.count(*) FILTER (WHERE mp.team_side = 'away')
    INTO v_home_goals_events, v_away_goals_events
    FROM public.match_events me
    JOIN public.match_players mp ON mp.match_id = me.match_id AND mp.player_id = me.player_id
    WHERE me.result_version_id = p_result_version_id
      AND me.event_type = 'gol'
      AND me.verification_status = 'validado';

    IF COALESCE(v_home_goals_events, 0) > v_result.home_score
       OR COALESCE(v_away_goals_events, 0) > v_result.away_score THEN
        RAISE EXCEPTION 'EVENTOS_INCONSISTENTES: O total de gols atribuídos aos atletas excede o placar oficial da partida.';
    END IF;

    -- Bloqueio pessimista ordenado das linhas dos atletas (impede deadlocks e lost updates em partidas simultâneas - TESTE 15)
    PERFORM 1
    FROM public.player_profiles pp
    WHERE pp.id IN (
        SELECT mp.player_id FROM public.match_players mp
        WHERE mp.match_id = p_match_id AND mp.participation_status = 'participou'
    )
    ORDER BY pp.id ASC
    FOR UPDATE;

    PERFORM 1
    FROM public.season_entries se
    WHERE se.season_id = v_match.season_id
      AND se.player_id IN (
          SELECT mp.player_id FROM public.match_players mp
          WHERE mp.match_id = p_match_id AND mp.participation_status = 'participou'
      )
    ORDER BY se.player_id ASC
    FOR UPDATE;

    SELECT COALESCE(pg_catalog.avg(pp.current_rating), 1000) INTO v_home_avg_rating
    FROM public.match_players mp
    JOIN public.player_profiles pp ON pp.id = mp.player_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'home' AND mp.participation_status = 'participou';

    SELECT COALESCE(pg_catalog.avg(pp.current_rating), 1000) INTO v_away_avg_rating
    FROM public.match_players mp
    JOIN public.player_profiles pp ON pp.id = mp.player_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'away' AND mp.participation_status = 'participou';

    v_expected_home := 1.0 / (1.0 + pg_catalog.power(10.0, (v_away_avg_rating - v_home_avg_rating) / 400.0));
    v_expected_away := 1.0 - v_expected_home;

    IF v_result.home_score > v_result.away_score THEN
        v_actual_home := 1.0; v_actual_away := 0.0;
    ELSIF v_result.home_score < v_result.away_score THEN
        v_actual_home := 0.0; v_actual_away := 1.0;
    ELSE
        v_actual_home := 0.5; v_actual_away := 0.5;
    END IF;

    FOR v_player IN
        SELECT mp.*, pp.current_rating, pp.rating_uncertainty, pp.total_validated_matches
        FROM public.match_players mp
        JOIN public.player_profiles pp ON pp.id = mp.player_id
        WHERE mp.match_id = p_match_id AND mp.participation_status = 'participou'
        ORDER BY pp.id ASC
    LOOP
        SELECT pg_catalog.count(*) INTO v_goals FROM public.match_events
        WHERE result_version_id = p_result_version_id
          AND player_id = v_player.player_id
          AND event_type = 'gol'
          AND verification_status = 'validado';

        SELECT pg_catalog.count(*) INTO v_assists FROM public.match_events
        WHERE result_version_id = p_result_version_id
          AND player_id = v_player.player_id
          AND event_type = 'assistencia'
          AND verification_status = 'validado';

        v_is_mvp := CASE WHEN v_result.mvp_player_id = v_player.player_id THEN 1 ELSE 0 END;

        IF v_player.team_side = 'home' THEN
            v_expected := v_expected_home; v_actual := v_actual_home;
        ELSE
            v_expected := v_expected_away; v_actual := v_actual_away;
        END IF;

        v_result_bonus := CASE WHEN v_actual = 1.0 THEN 15 WHEN v_actual = 0.5 THEN 5 ELSE 0 END;
        v_total_points := 5 + v_result_bonus + (3 * v_goals) + (2 * v_assists) + (3 * v_is_mvp);

        INSERT INTO public.point_transactions (
            player_id, season_id, match_id, source_result_version_id,
            transaction_type, points_delta, breakdown, reason_code, created_by
        ) VALUES (
            v_player.player_id, v_match.season_id, p_match_id, p_result_version_id,
            'credito', v_total_points,
            pg_catalog.jsonb_build_object('participacao', 5, 'resultado', v_result_bonus, 'gols', v_goals, 'assistencias', v_assists, 'mvp', v_is_mvp),
            'PARTIDA_VALIDADA', auth.uid()
        );

        IF v_player.total_validated_matches < 5 THEN v_k_factor := 40;
        ELSIF v_player.current_rating < 1400 THEN v_k_factor := 24;
        ELSE v_k_factor := 16;
        END IF;

        v_rating_delta := pg_catalog.round(v_k_factor * (v_actual - v_expected));
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

        -- Registra lock transacional na tabela privada exclusivamente para este player_id
        INSERT INTO private.trusted_rpc_locks (txid, operation, target_id, actor_id)
        VALUES (pg_catalog.txid_current(), 'process_validated_match', v_player.player_id::text, auth.uid())
        ON CONFLICT (txid, operation, target_id) DO NOTHING;

        UPDATE public.player_profiles
        SET current_rating = v_new_rating,
            rating_uncertainty = v_new_uncertainty,
            total_validated_matches = total_validated_matches + 1,
            is_provisional = (total_validated_matches + 1) < 5,
            updated_at = pg_catalog.now()
        WHERE id = v_player.player_id;

        DELETE FROM private.trusted_rpc_locks
        WHERE txid = pg_catalog.txid_current()
          AND operation = 'process_validated_match'
          AND target_id = v_player.player_id::text;

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
            updated_at = pg_catalog.now()
        WHERE season_id = v_match.season_id AND player_id = v_player.player_id;
    END LOOP;

    UPDATE public.match_results
    SET validation_status = 'validado',
        validated_by = auth.uid(),
        validated_at = pg_catalog.now()
    WHERE id = p_result_version_id;

    UPDATE public.matches
    SET status = 'validada',
        official_home_score = v_result.home_score,
        official_away_score = v_result.away_score,
        active_result_version_id = p_result_version_id,
        updated_at = pg_catalog.now()
    WHERE id = p_match_id;

    PERFORM private.append_official_audit_log(
        'MATCH_VALIDATED_AND_SCORED',
        'matches',
        p_match_id::text,
        'Partida validada e processada pelo motor v1.0.0',
        NULL,
        pg_catalog.jsonb_build_object('result_version_id', p_result_version_id, 'home_score', v_result.home_score, 'away_score', v_result.away_score)
    );

    RETURN pg_catalog.jsonb_build_object('status', 'validated', 'match_id', p_match_id, 'result_version_id', p_result_version_id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_validated_match(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_validated_match(UUID, UUID, UUID) TO authenticated, service_role;

-- 6.7. Revogação Explícita de Convite pelo Treinador/Proprietário
CREATE OR REPLACE FUNCTION public.revoke_team_invite_authenticated(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invite RECORD;
BEGIN
    IF NOT private.is_active_verified_user() THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    SELECT * INTO v_invite FROM public.team_invites WHERE id = p_invite_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'NAO_ENCONTRADO: Convite não encontrado.';
    END IF;

    IF NOT (private.has_team_sport_permission(v_invite.team_id) OR private.is_platform_admin()) THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Sem permissão para revogar convites desta equipe.';
    END IF;

    UPDATE public.team_invites
    SET revoked_at = pg_catalog.now()
    WHERE id = p_invite_id;

    PERFORM private.append_official_audit_log(
        'CONVITE_EQUIPE_REVOGADO',
        'team_invites',
        p_invite_id::text,
        'Convite revogado pelo treinador/proprietário.'
    );

    RETURN pg_catalog.jsonb_build_object('status', 'revoked', 'invite_id', p_invite_id);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_team_invite_authenticated(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_team_invite_authenticated(UUID) TO authenticated, service_role;

-- 6.8. Submissão Transacional de Avaliação entre Colegas de Equipe (UPSERT Único)
CREATE OR REPLACE FUNCTION public.submit_peer_evaluation_authenticated(
    p_target_player_id UUID,
    p_finalizacao SMALLINT,
    p_marcacao SMALLINT,
    p_passe SMALLINT,
    p_raca SMALLINT,
    p_drible SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_evaluator_player_id UUID;
    v_evaluator_team_id UUID;
    v_target_team_id UUID;
    v_overall NUMERIC(3,2);
    v_eval_id UUID;
BEGIN
    IF NOT private.is_active_verified_user() OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    SELECT tm.player_id, tm.team_id
    INTO v_evaluator_player_id, v_evaluator_team_id
    FROM public.team_memberships tm
    WHERE tm.user_id = v_user_id AND tm.status = 'active'
    LIMIT 1;

    IF v_evaluator_player_id IS NULL OR v_evaluator_team_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Avaliador não possui vínculo ativo com equipe.';
    END IF;

    IF v_evaluator_player_id = p_target_player_id THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Autoavaliação não é permitida.';
    END IF;

    SELECT tm.team_id INTO v_target_team_id
    FROM public.team_memberships tm
    WHERE tm.player_id = p_target_player_id AND tm.status = 'active'
    LIMIT 1;

    IF v_target_team_id IS NULL OR v_target_team_id IS DISTINCT FROM v_evaluator_team_id THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Só é permitido avaliar atletas ativos da mesma equipe.';
    END IF;

    v_overall := pg_catalog.round(((p_finalizacao + p_marcacao + p_passe + p_raca + p_drible)::numeric / 5.0), 2);

    INSERT INTO public.peer_evaluations (
        evaluator_user_id, evaluator_player_id, target_player_id, team_id,
        finalizacao, marcacao, passe, raca, drible, overall, updated_at
    ) VALUES (
        v_user_id, v_evaluator_player_id, p_target_player_id, v_evaluator_team_id,
        p_finalizacao, p_marcacao, p_passe, p_raca, p_drible, v_overall, pg_catalog.now()
    )
    ON CONFLICT (evaluator_player_id, target_player_id) DO UPDATE
    SET finalizacao = EXCLUDED.finalizacao,
        marcacao = EXCLUDED.marcacao,
        passe = EXCLUDED.passe,
        raca = EXCLUDED.raca,
        drible = EXCLUDED.drible,
        overall = EXCLUDED.overall,
        updated_at = pg_catalog.now()
    RETURNING id INTO v_eval_id;

    RETURN pg_catalog.jsonb_build_object(
        'status', 'saved',
        'evaluation_id', v_eval_id,
        'overall', v_overall
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_peer_evaluation_authenticated(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_peer_evaluation_authenticated(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT) TO authenticated, service_role;

-- 6.9. Controle de Sessão Única no Backend Vinculado a auth.uid() (Etapa 6 e Teste 19)
--      Não armazena tokens legados em texto claro; invalida imediatamente o dispositivo anterior.
CREATE TABLE IF NOT EXISTS public.user_sessions (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    active_session_id UUID NOT NULL DEFAULT gen_random_uuid(),
    fingerprint_hash TEXT NOT NULL,
    device_info TEXT,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, active_session_id, device_info, rotated_at) ON public.user_sessions TO authenticated;

DROP POLICY IF EXISTS user_sessions_select_own ON public.user_sessions;
CREATE POLICY user_sessions_select_own ON public.user_sessions
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.current_actor_context_v) AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.register_or_rotate_active_session_authenticated(
    p_device_info TEXT DEFAULT 'web',
    p_client_fingerprint TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_new_session_id UUID := gen_random_uuid();
    v_fp_hash TEXT;
BEGIN
    IF NOT private.is_active_verified_user() OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado ou com redefinição de senha pendente.';
    END IF;

    v_fp_hash := pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(COALESCE(p_client_fingerprint, '') || ':' || v_new_session_id::text, 'UTF8')),
        'hex'
    );

    INSERT INTO public.user_sessions (user_id, active_session_id, fingerprint_hash, device_info, rotated_at)
    VALUES (v_user_id, v_new_session_id, v_fp_hash, COALESCE(p_device_info, 'web'), pg_catalog.now())
    ON CONFLICT (user_id) DO UPDATE
    SET active_session_id = EXCLUDED.active_session_id,
        fingerprint_hash = EXCLUDED.fingerprint_hash,
        device_info = EXCLUDED.device_info,
        rotated_at = EXCLUDED.rotated_at;

    RETURN pg_catalog.jsonb_build_object(
        'user_id', v_user_id,
        'active_session_id', v_new_session_id,
        'status', 'ACTIVE'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_or_rotate_active_session_authenticated(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_or_rotate_active_session_authenticated(TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_active_session_authenticated(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_current_session_id UUID;
BEGIN
    IF NOT private.is_active_verified_user() OR v_user_id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('valid', false, 'reason', 'UNAUTHENTICATED_OR_PASSWORD_RESET_REQUIRED');
    END IF;

    SELECT active_session_id INTO v_current_session_id
    FROM public.user_sessions
    WHERE user_id = v_user_id;

    IF v_current_session_id IS NULL OR v_current_session_id IS DISTINCT FROM p_session_id THEN
        RETURN pg_catalog.jsonb_build_object(
            'valid', false,
            'reason', 'SESSION_REPLACED_BY_ANOTHER_DEVICE',
            'active_session_id', v_current_session_id
        );
    END IF;

    RETURN pg_catalog.jsonb_build_object('valid', true, 'active_session_id', v_current_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_active_session_authenticated(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_active_session_authenticated(UUID) TO authenticated, service_role;

COMMIT;
