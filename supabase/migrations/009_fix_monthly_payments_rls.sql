-- =============================================================================
-- FUTPLAY LITE / ROSÁLIA ESPORTES — Migração 009: Correção de RLS em Mensalidades
-- Libera leitura e escrita via cliente anônimo (autenticação própria do app)
-- e remove restrições que bloqueavam a sincronização do Treinador -> Jogador.
-- =============================================================================

-- 1. Ajustes na tabela MONTHLY_PAYMENTS
ALTER TABLE public.monthly_payments DROP CONSTRAINT IF EXISTS monthly_payments_confirmed_by_fkey;
ALTER TABLE public.monthly_payments ALTER COLUMN confirmed_by TYPE TEXT USING confirmed_by::TEXT;

ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_all ON public.monthly_payments;
DROP POLICY IF EXISTS payments_manage_authorized ON public.monthly_payments;
DROP POLICY IF EXISTS payments_insert_all ON public.monthly_payments;
DROP POLICY IF EXISTS payments_update_all ON public.monthly_payments;
DROP POLICY IF EXISTS payments_delete_all ON public.monthly_payments;

CREATE POLICY payments_select_all ON public.monthly_payments FOR SELECT USING (true);
CREATE POLICY payments_insert_all ON public.monthly_payments FOR INSERT WITH CHECK (true);
CREATE POLICY payments_update_all ON public.monthly_payments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY payments_delete_all ON public.monthly_payments FOR DELETE USING (true);

-- 2. Ajustes na tabela PELADA_MONTHLY_CONFIGS
ALTER TABLE public.pelada_monthly_configs DROP CONSTRAINT IF EXISTS pelada_monthly_configs_pix_key_type_check;
ALTER TABLE public.pelada_monthly_configs DROP CONSTRAINT IF EXISTS pelada_monthly_configs_updated_by_fkey;
ALTER TABLE public.pelada_monthly_configs ALTER COLUMN updated_by TYPE TEXT USING updated_by::TEXT;

ALTER TABLE public.pelada_monthly_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configs_select_all ON public.pelada_monthly_configs;
DROP POLICY IF EXISTS configs_manage_authorized ON public.pelada_monthly_configs;
DROP POLICY IF EXISTS configs_insert_all ON public.pelada_monthly_configs;
DROP POLICY IF EXISTS configs_update_all ON public.pelada_monthly_configs;
DROP POLICY IF EXISTS configs_delete_all ON public.pelada_monthly_configs;

CREATE POLICY configs_select_all ON public.pelada_monthly_configs FOR SELECT USING (true);
CREATE POLICY configs_insert_all ON public.pelada_monthly_configs FOR INSERT WITH CHECK (true);
CREATE POLICY configs_update_all ON public.pelada_monthly_configs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY configs_delete_all ON public.pelada_monthly_configs FOR DELETE USING (true);
