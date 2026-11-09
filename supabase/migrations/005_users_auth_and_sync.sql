-- =============================================================================
-- FUTPLAY LITE / ROSÁLIA ESPORTES — Migração 005: Sincronização e Autenticação
-- =============================================================================

-- 1. Garante as colunas para login e identificação por celular
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Permissões de Leitura e Escrita RLS para USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_all ON public.users;
DROP POLICY IF EXISTS users_insert_all ON public.users;
DROP POLICY IF EXISTS users_update_all ON public.users;
DROP POLICY IF EXISTS users_delete_all ON public.users;

CREATE POLICY users_select_all ON public.users FOR SELECT USING (true);
CREATE POLICY users_insert_all ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY users_update_all ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY users_delete_all ON public.users FOR DELETE USING (true);

-- 3. Permissões de Leitura e Escrita RLS para PLAYER_PROFILES
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_all ON public.player_profiles;
DROP POLICY IF EXISTS profiles_insert_all ON public.player_profiles;
DROP POLICY IF EXISTS profiles_update_all ON public.player_profiles;
DROP POLICY IF EXISTS profiles_delete_all ON public.player_profiles;

CREATE POLICY profiles_select_all ON public.player_profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert_all ON public.player_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY profiles_update_all ON public.player_profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY profiles_delete_all ON public.player_profiles FOR DELETE USING (true);

-- 4. Permissões de Leitura e Escrita RLS para SEASON_ENTRIES
ALTER TABLE public.season_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seasons_entries_select_all ON public.season_entries;
DROP POLICY IF EXISTS seasons_entries_insert_all ON public.season_entries;
DROP POLICY IF EXISTS seasons_entries_delete_all ON public.season_entries;

CREATE POLICY seasons_entries_select_all ON public.season_entries FOR SELECT USING (true);
CREATE POLICY seasons_entries_insert_all ON public.season_entries FOR INSERT WITH CHECK (true);
CREATE POLICY seasons_entries_delete_all ON public.season_entries FOR DELETE USING (true);
