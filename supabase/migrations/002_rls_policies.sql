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
