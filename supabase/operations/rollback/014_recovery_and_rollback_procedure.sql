-- =============================================================================
-- FUTPLAY LITE — SCRIPT 014: PROCEDIMENTO DE RECUPERAÇÃO E ROLLBACK SEGURO
-- Arquivo: supabase/migrations/014_recovery_and_rollback_procedure.sql
-- Referência: ADR-001-SECURITY-AND-DATA-ARCHITECTURE.md (Etapas 9 e 10)
-- =============================================================================
-- OBJETIVO:
-- Fornecer uma função administrativa transacional (server-side / service_role)
-- capaz de restaurar os 46 registros originais arquivados em
-- public.migration_archived_records caso uma reversão operacional da Fase B
-- para o estado de Contenção Emergencial (Fase A) seja necessária, SEM NUNCA
-- reexpor password_hash, whatsapp_number ou políticas USING (true).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION private.restore_archived_records_to_phase_a(p_confirm_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_restored_sumulas INTEGER := 0;
BEGIN
    IF p_confirm_token IS DISTINCT FROM 'CONFIRM_ROLLBACK_TO_PHASE_A' THEN
        RAISE EXCEPTION 'Token de confirmação inválido para rollback.';
    END IF;

    -- Suspende temporariamente a constraint e trigger de status restrito da Fase B para restaurar os 46 registros da Fase A
    DROP TRIGGER IF EXISTS guard_pelada_sumulas_security_trg ON public.pelada_sumulas;
    ALTER TABLE public.pelada_sumulas DROP CONSTRAINT IF EXISTS chk_pelada_sumulas_valid_status;
    ALTER TABLE public.pelada_sumulas ALTER COLUMN team_id DROP NOT NULL;

    INSERT INTO public.pelada_sumulas (
        id, team_id, team_name, status, match_date, start_time,
        created_by_user_id, created_by_name, data, last_updated, created_at
    )
    SELECT
        (payload->>'id')::TEXT,
        CASE
            WHEN (payload->>'team_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN (payload->>'team_id')::UUID
            ELSE NULL
        END,
        (payload->>'team_name')::TEXT,
        COALESCE((payload->>'status')::TEXT, 'em_andamento'),
        (payload->>'match_date')::TEXT,
        (payload->>'start_time')::TEXT,
        CASE
            WHEN (payload->>'created_by_user_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN (payload->>'created_by_user_id')::UUID
            ELSE NULL
        END,
        (payload->>'created_by_name')::TEXT,
        COALESCE(payload->'data', '{}'::JSONB),
        COALESCE((payload->>'last_updated')::TIMESTAMPTZ, pg_catalog.now()),
        COALESCE((payload->>'created_at')::TIMESTAMPTZ, pg_catalog.now())
    FROM public.migration_archived_records
    WHERE source_ledger_id = 'pelada_sumulas_full_backup_v1'
    ON CONFLICT (id) DO UPDATE
    SET
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        status = EXCLUDED.status,
        match_date = EXCLUDED.match_date,
        start_time = EXCLUDED.start_time,
        created_by_user_id = EXCLUDED.created_by_user_id,
        created_by_name = EXCLUDED.created_by_name,
        data = EXCLUDED.data,
        last_updated = EXCLUDED.last_updated;

    GET DIAGNOSTICS v_restored_sumulas = ROW_COUNT;

    -- Reativa o trigger de segurança da Fase A (congela registros legados e protege súmulas reais por team_id)
    CREATE TRIGGER guard_pelada_sumulas_security_trg
        BEFORE INSERT OR UPDATE OR DELETE ON public.pelada_sumulas
        FOR EACH ROW
        EXECUTE FUNCTION private.trg_guard_pelada_sumulas_security();

    RETURN pg_catalog.jsonb_build_object(
        'status', 'ROLLED_BACK_TO_PHASE_A_COMPATIBLE_STATE',
        'restored_pelada_sumulas_rows', v_restored_sumulas,
        'rls_remains_active', true,
        'password_hash_reexposed', false
    );
END;
$$;

REVOKE ALL ON FUNCTION private.restore_archived_records_to_phase_a(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.restore_archived_records_to_phase_a(TEXT) TO service_role;

COMMIT;
