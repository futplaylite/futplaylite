-- =============================================================================
-- FUTPLAY LITE / ROSÁLIA ESPORTES — Migração 010: Sincronização de Logs de Auditoria
-- Permite leitura e gravação transparente de registros de auditoria e ações dos usuários
-- entre múltiplos aparelhos (celulares dos atletas e painel do administrador).
-- =============================================================================

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_all ON public.audit_logs;
CREATE POLICY audit_logs_select_all ON public.audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS audit_logs_insert_all ON public.audit_logs;
CREATE POLICY audit_logs_insert_all ON public.audit_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_update_all ON public.audit_logs;
CREATE POLICY audit_logs_update_all ON public.audit_logs FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_delete_all ON public.audit_logs;
CREATE POLICY audit_logs_delete_all ON public.audit_logs FOR DELETE USING (true);
