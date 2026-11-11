-- =============================================================================
-- FUTPLAY LITE / ROSÁLIA ESPORTES — Migração 008: Caixa & Transações Financeiras
-- Sincroniza todas as despesas e receitas do time em tempo real no Supabase
-- para que todos os atletas acompanhem o extrato em qualquer aparelho.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.team_financial_transactions (
    id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
    category TEXT NOT NULL DEFAULT 'outro',
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    date TEXT NOT NULL,
    notes TEXT,
    created_by_name TEXT,
    created_by_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_financial_tx_team ON public.team_financial_transactions(team_name);
CREATE INDEX IF NOT EXISTS idx_team_financial_tx_date ON public.team_financial_transactions(date DESC);

ALTER TABLE public.team_financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_financial_select_all ON public.team_financial_transactions;
CREATE POLICY team_financial_select_all ON public.team_financial_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS team_financial_insert_all ON public.team_financial_transactions;
CREATE POLICY team_financial_insert_all ON public.team_financial_transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS team_financial_update_all ON public.team_financial_transactions;
CREATE POLICY team_financial_update_all ON public.team_financial_transactions FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS team_financial_delete_all ON public.team_financial_transactions;
CREATE POLICY team_financial_delete_all ON public.team_financial_transactions FOR DELETE USING (true);
