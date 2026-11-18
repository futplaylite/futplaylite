-- =============================================================================
-- FUTPLAY LITE V6 — MIGRAÇÃO 016: ÍNDICES DE PERFORMANCE E OTIMIZAÇÃO GERAL
-- =============================================================================
-- Objetivo: Otimizar consultas frequentes do sistema (login por telefone,
-- resolução de perfil de atleta, súmulas ativas, logs de auditoria, avaliações
-- e mensalidades por time/mês), eliminando scans sequenciais desnecessários.
-- =============================================================================

-- 1. Índice para busca de usuários por telefone (Login e Recuperação)
CREATE INDEX IF NOT EXISTS idx_users_whatsapp
ON public.users(whatsapp_number)
WHERE whatsapp_number IS NOT NULL;

-- 2. Índices para resolução rápida de perfis de jogadores por usuário e equipe
CREATE INDEX IF NOT EXISTS idx_player_profiles_user_id
ON public.player_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_player_profiles_team
ON public.player_profiles(team_name)
WHERE team_name IS NOT NULL;

-- 3. Índice composto para listagem de súmulas esportivas ordenadas por atualização
CREATE INDEX IF NOT EXISTS idx_pelada_sumulas_status_updated
ON public.pelada_sumulas(status, last_updated DESC);

-- 4. Índice para auditoria imutável ordenada cronologicamente (Painel Administrativo)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
ON public.audit_logs(created_at DESC);

-- 5. Índice para verificação de avaliações de pares realizadas pelo usuário logado
CREATE INDEX IF NOT EXISTS idx_peer_evals_evaluator_user
ON public.peer_evaluations(evaluator_user_id);

-- 6. Índice composto para pagamentos de mensalidade filtrados por time e competência
CREATE INDEX IF NOT EXISTS idx_monthly_payments_team_month
ON public.monthly_payments(team_id, year_month);

COMMENT ON INDEX idx_users_whatsapp IS 'Acelera autenticação e busca por telefone no login.';
COMMENT ON INDEX idx_player_profiles_user_id IS 'Acelera vinculação entre o usuário autenticado e seu perfil esportivo.';
COMMENT ON INDEX idx_pelada_sumulas_status_updated IS 'Otimiza consultas de súmulas ativas e finalizadas sem sort em memória.';
COMMENT ON INDEX idx_audit_logs_created IS 'Acelera a visualização da trilha de auditoria administrativa.';
