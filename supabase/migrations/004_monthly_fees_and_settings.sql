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
