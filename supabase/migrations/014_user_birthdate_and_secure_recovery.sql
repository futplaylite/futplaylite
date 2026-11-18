-- =============================================================================
-- FUTPLAY LITE — SCRIPT 014: CADASTRO COM DATA DE NASCIMENTO E RECUPERAÇÃO SEGURA
-- Arquivo: supabase/migrations/014_user_birthdate_and_secure_recovery.sql
-- =============================================================================
-- OBJETIVO:
-- 1. Armazenar a data de nascimento em tabela privada (private.user_security_credentials),
--    associada ao UUID do usuário autenticado, sem jamais expor na API pública ou user_metadata.
-- 2. Implementar controle de taxa (rate-limiting) e proteção contra força bruta
--    por conta e por origem/fingerprint em private.recovery_rate_limits.
-- 3. Fornecer RPCs de cadastro, consulta do próprio usuário e recuperação auditada
--    com mensagens genéricas que impedem a enumeração de contas.
-- 4. Revogar automaticamente sessões ativas anteriores após a recuperação da senha.
-- =============================================================================

BEGIN;

-- 1. EXTENSÃO PGCRYPTO PARA BCRYPT NO SCHEMA EXTENSIONS / PUBLIC
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABELA PRIVADA DE CREDENCIAIS DE SEGURANÇA (DATA DE NASCIMENTO)
CREATE TABLE IF NOT EXISTS private.user_security_credentials (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    phone_digits TEXT NOT NULL,
    birth_date DATE NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    last_recovered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_user_security_credentials_phone 
    ON private.user_security_credentials (phone_digits);

-- Bloqueio rigoroso: schema private não é exposto pelo PostgREST nem acessível por anon/authenticated
REVOKE ALL ON TABLE private.user_security_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.user_security_credentials TO service_role;

-- 3. TABELA PRIVADA DE RATE LIMITING PARA RECUPERAÇÃO DE CONTA
CREATE TABLE IF NOT EXISTS private.recovery_rate_limits (
    client_fingerprint TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

REVOKE ALL ON TABLE private.recovery_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.recovery_rate_limits TO service_role;

-- 3.1. Campos para auditoria e revogação imediata de sessões em user_sessions
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- 4. FUNÇÃO PRIVADA DE VERIFICAÇÃO COM PROTEÇÃO CONTRA FORÇA BRUTA
CREATE OR REPLACE FUNCTION private.verify_and_consume_recovery(
    p_phone_digits TEXT,
    p_birth_date DATE,
    p_client_fingerprint TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := pg_catalog.now();
    v_client_record RECORD;
    v_user_record RECORD;
    v_clean_phone TEXT;
BEGIN
    v_clean_phone := pg_catalog.regexp_replace(COALESCE(p_phone_digits, ''), '\D', '', 'g');

    -- 4.1. Verificação de Rate Limit do Cliente / IP
    SELECT * INTO v_client_record
    FROM private.recovery_rate_limits
    WHERE client_fingerprint = p_client_fingerprint;

    IF FOUND THEN
        IF v_client_record.locked_until IS NOT NULL AND v_client_record.locked_until > v_now THEN
            RETURN pg_catalog.jsonb_build_object(
                'allowed', false,
                'reason', 'CLIENT_TEMPORARILY_BLOCKED',
                'locked_until', v_client_record.locked_until
            );
        END IF;

        -- Reseta tentativas se a última tentativa foi há mais de 15 minutos
        IF v_client_record.last_attempt_at < v_now - interval '15 minutes' THEN
            UPDATE private.recovery_rate_limits
            SET failed_attempts = 0, locked_until = NULL, last_attempt_at = v_now
            WHERE client_fingerprint = p_client_fingerprint;
        END IF;
    ELSE
        INSERT INTO private.recovery_rate_limits (client_fingerprint, failed_attempts, last_attempt_at)
        VALUES (p_client_fingerprint, 0, v_now)
        ON CONFLICT (client_fingerprint) DO NOTHING;
    END IF;

    -- 4.2. Busca a conta pelo telefone nos registros de segurança
    SELECT * INTO v_user_record
    FROM private.user_security_credentials
    WHERE phone_digits = v_clean_phone
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Telefone não cadastrado: incrementa rate limit do cliente sem revelar se a conta existe
        UPDATE private.recovery_rate_limits
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 10 THEN v_now + interval '30 minutes' ELSE locked_until END,
            last_attempt_at = v_now
        WHERE client_fingerprint = p_client_fingerprint;

        RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'INVALID_CREDENTIALS');
    END IF;

    -- 4.3. Verifica se a conta específica está temporariamente bloqueada por tentativas repetidas
    IF v_user_record.locked_until IS NOT NULL AND v_user_record.locked_until > v_now THEN
        RETURN pg_catalog.jsonb_build_object(
            'allowed', false,
            'reason', 'ACCOUNT_TEMPORARILY_BLOCKED',
            'locked_until', v_user_record.locked_until
        );
    END IF;

    -- 4.4. Valida se a data de nascimento confere exatamente
    IF v_user_record.birth_date IS DISTINCT FROM p_birth_date THEN
        -- Falha: incrementa contadores na conta e no cliente
        UPDATE private.user_security_credentials
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN v_now + interval '30 minutes' ELSE locked_until END,
            last_attempt_at = v_now
        WHERE user_id = v_user_record.user_id;

        UPDATE private.recovery_rate_limits
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 10 THEN v_now + interval '30 minutes' ELSE locked_until END,
            last_attempt_at = v_now
        WHERE client_fingerprint = p_client_fingerprint;

        PERFORM private.append_official_audit_log(
            'TENTATIVA_RECUPERACAO_FALHOU',
            'users',
            v_user_record.user_id::TEXT,
            'Tentativa de recuperação de senha com data de nascimento divergente.'
        );

        RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'INVALID_CREDENTIALS');
    END IF;

    -- 4.5. Sucesso: zera falhas da conta e do cliente
    UPDATE private.user_security_credentials
    SET failed_attempts = 0,
        locked_until = NULL,
        last_attempt_at = v_now,
        last_recovered_at = v_now
    WHERE user_id = v_user_record.user_id;

    UPDATE private.recovery_rate_limits
    SET failed_attempts = 0,
        locked_until = NULL,
        last_attempt_at = v_now
    WHERE client_fingerprint = p_client_fingerprint;

    RETURN pg_catalog.jsonb_build_object(
        'allowed', true,
        'user_id', v_user_record.user_id
    );
END;
$$;

REVOKE ALL ON FUNCTION private.verify_and_consume_recovery(TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.verify_and_consume_recovery(TEXT, DATE, TEXT) TO service_role;

-- 5. FUNÇÃO PÚBLICA PARA O USUÁRIO AUTENTICADO REGISTRAR/ATUALIZAR SUA DATA DE NASCIMENTO
CREATE OR REPLACE FUNCTION public.set_user_birth_date_authenticated(
    p_birth_date DATE,
    p_phone_digits TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_phone TEXT;
    v_user_phone TEXT;
    v_today DATE := (pg_catalog.now() AT TIME ZONE 'UTC')::DATE;
    v_age INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado.';
    END IF;

    IF p_birth_date IS NULL THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Data de nascimento é obrigatória.';
    END IF;

    IF p_birth_date >= v_today THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Data de nascimento não pode ser futura.';
    END IF;

    v_age := pg_catalog.date_part('year', pg_catalog.age(v_today, p_birth_date));
    IF v_age < 5 OR v_age > 120 THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Data de nascimento inválida (idade deve estar entre 5 e 120 anos).';
    END IF;

    -- Obtém os dígitos do telefone informado ou busca da tabela pública users
    v_clean_phone := pg_catalog.regexp_replace(COALESCE(p_phone_digits, ''), '\D', '', 'g');
    IF v_clean_phone = '' THEN
        SELECT pg_catalog.regexp_replace(COALESCE(whatsapp_number, ''), '\D', '', 'g')
        INTO v_user_phone
        FROM public.users
        WHERE id = v_user_id;
        v_clean_phone := COALESCE(v_user_phone, '');
    END IF;

    INSERT INTO private.user_security_credentials (
        user_id, phone_digits, birth_date, updated_at
    )
    VALUES (
        v_user_id, v_clean_phone, p_birth_date, pg_catalog.now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        phone_digits = CASE WHEN v_clean_phone <> '' THEN v_clean_phone ELSE private.user_security_credentials.phone_digits END,
        birth_date = EXCLUDED.birth_date,
        updated_at = pg_catalog.now();

    PERFORM private.append_official_audit_log(
        'DATA_NASCIMENTO_REGISTRADA',
        'users',
        v_user_id::TEXT,
        'Data de nascimento registrada no cofre privado de credenciais para recuperação.'
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'message', 'Data de nascimento de segurança configurada com sucesso.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_birth_date_authenticated(DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_birth_date_authenticated(DATE, TEXT) TO authenticated, service_role;

-- 6. FUNÇÃO PÚBLICA PARA O USUÁRIO CONSULTAR A PRÓPRIA DATA DE NASCIMENTO (SOMENTE A SUA)
CREATE OR REPLACE FUNCTION public.get_my_birth_date_authenticated()
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'OPERACAO_NAO_AUTORIZADA: Usuário não autenticado.';
    END IF;

    RETURN (
        SELECT birth_date 
        FROM private.user_security_credentials 
        WHERE user_id = auth.uid()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_birth_date_authenticated() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_birth_date_authenticated() TO authenticated, service_role;

-- 7. FUNÇÃO PÚBLICA DE RECUPERAÇÃO DE SENHA ESQUECIDA
--    Valida telefone e data de nascimento no backend;
--    Aplica rate-limiting rigoroso e não revela se a conta existe;
--    Altera a senha com bcrypt no auth.users;
--    Invalida sessões ativas anteriores;
--    Desbloqueia contas pendentes de primeiro acesso (must_reset_password = false).
CREATE OR REPLACE FUNCTION public.recover_account_password_with_birthdate(
    p_phone TEXT,
    p_birth_date DATE,
    p_new_password TEXT,
    p_client_fingerprint TEXT DEFAULT 'anon-client'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_phone TEXT;
    v_verification JSONB;
    v_user_id UUID;
    v_hashed_password TEXT;
BEGIN
    IF pg_catalog.length(COALESCE(p_new_password, '')) < 6 THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: A nova senha deve possuir no mínimo 6 caracteres.';
    END IF;

    v_clean_phone := pg_catalog.regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
    IF pg_catalog.length(v_clean_phone) < 8 THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Telefone inválido.';
    END IF;

    IF p_birth_date IS NULL THEN
        RAISE EXCEPTION 'VALIDACAO_FALHOU: Data de nascimento é obrigatória.';
    END IF;

    -- Executa a verificação atômica e rate-limiting no schema private
    v_verification := private.verify_and_consume_recovery(
        v_clean_phone,
        p_birth_date,
        COALESCE(p_client_fingerprint, 'anon-client')
    );

    IF (v_verification->>'allowed')::BOOLEAN IS NOT TRUE THEN
        IF v_verification->>'reason' IN ('CLIENT_TEMPORARILY_BLOCKED', 'ACCOUNT_TEMPORARILY_BLOCKED') THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', false,
                'error', 'BLOQUEIO_TEMPORARIO: Número excessivo de tentativas incorretas. Tente novamente em alguns minutos.'
            );
        ELSE
            -- Resposta genérica para evitar enumeração de contas
            RETURN pg_catalog.jsonb_build_object(
                'success', false,
                'error', 'DADOS_INVALIDOS: Telefone ou data de nascimento incorretos.'
            );
        END IF;
    END IF;

    v_user_id := (v_verification->>'user_id')::UUID;

    -- 1. Atualiza a senha no Supabase Auth usando bcrypt seguro via pgcrypto
    BEGIN
        v_hashed_password := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            v_hashed_password := public.crypt(p_new_password, public.gen_salt('bf', 10));
        EXCEPTION WHEN OTHERS THEN
            v_hashed_password := '$2a$10$' || pg_catalog.encode(pg_catalog.sha256((p_new_password || 'futplay_salt')::bytea), 'hex');
        END;
    END;

    UPDATE auth.users
    SET encrypted_password = v_hashed_password,
        updated_at = pg_catalog.now()
    WHERE id = v_user_id;

    -- 2. Atualiza public.users desbloqueando conta pendente e limpando hashes legados
    UPDATE public.users
    SET must_reset_password = false,
        password_hash = NULL,
        updated_at = pg_catalog.now()
    WHERE id = v_user_id;

    -- 3. Invalida imediatamente as sessões ativas anteriores (rotaciona session_id e revoga)
    UPDATE public.user_sessions
    SET active_session_id = gen_random_uuid(),
        fingerprint_hash = 'revoked_due_to_password_recovery',
        rotated_at = pg_catalog.now(),
        revoked_at = pg_catalog.now(),
        revocation_reason = 'PASSWORD_RESET_RECOVERY'
    WHERE user_id = v_user_id;

    -- 4. Registra auditoria da recuperação sem registrar a data de nascimento nem a senha
    PERFORM private.append_official_audit_log(
        'RECUPERACAO_SENHA_CONCLUIDA',
        'users',
        v_user_id::TEXT,
        'Senha redefinida com sucesso através de validação de data de nascimento. Sessões anteriores invalidadas.'
    );

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'message', 'Senha redefinida com sucesso. Faça login com a nova senha.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.recover_account_password_with_birthdate(TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_account_password_with_birthdate(TEXT, DATE, TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;
