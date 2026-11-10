-- =============================================================================
-- FUTPLAY LITE / ROSÁLIA ESPORTES — Migração 007: Súmulas da Pelada em Tempo Real
-- Salva e sincroniza 100% online no Supabase a cada toque na súmula.
-- Se o celular descarregar, outro aparelho continua a súmula sem perda de dados.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pelada_sumulas (
    id TEXT PRIMARY KEY,
    team_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'em_andamento',
    match_date TEXT,
    start_time TEXT,
    created_by_user_id TEXT,
    created_by_name TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas ultra-rápidas
CREATE INDEX IF NOT EXISTS idx_pelada_sumulas_team ON public.pelada_sumulas(team_name);
CREATE INDEX IF NOT EXISTS idx_pelada_sumulas_status ON public.pelada_sumulas(status);
CREATE INDEX IF NOT EXISTS idx_pelada_sumulas_updated ON public.pelada_sumulas(last_updated DESC);

-- Ativação de RLS
ALTER TABLE public.pelada_sumulas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso irrestrito para sincronização multi-dispositivo (Anon / Public)
DROP POLICY IF EXISTS pelada_sumulas_select_all ON public.pelada_sumulas;
CREATE POLICY pelada_sumulas_select_all ON public.pelada_sumulas FOR SELECT USING (true);

DROP POLICY IF EXISTS pelada_sumulas_insert_all ON public.pelada_sumulas;
CREATE POLICY pelada_sumulas_insert_all ON public.pelada_sumulas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS pelada_sumulas_update_all ON public.pelada_sumulas;
CREATE POLICY pelada_sumulas_update_all ON public.pelada_sumulas FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pelada_sumulas_delete_all ON public.pelada_sumulas;
CREATE POLICY pelada_sumulas_delete_all ON public.pelada_sumulas FOR DELETE USING (true);
