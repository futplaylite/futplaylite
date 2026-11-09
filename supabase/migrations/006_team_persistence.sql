-- =============================================================================
-- FUTPLAY LITE / ROSÁLIA ESPORTES — Migração 006: Persistência do Time e Escudo
-- Permite que o nome do time, escudo, cidade e modalidade sejam salvos no Supabase
-- e nunca sumam ao relogar ou ao acessar em outros aparelhos/celulares.
-- =============================================================================

-- 1. Colunas de Time na tabela USERS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_crest_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_city TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_modality TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS team_invite_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_team_owner BOOLEAN DEFAULT false;

-- 2. Colunas de Time na tabela PLAYER_PROFILES
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS team_crest_url TEXT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS team_city TEXT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS team_modality TEXT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS team_invite_code TEXT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS is_team_owner BOOLEAN DEFAULT false;
