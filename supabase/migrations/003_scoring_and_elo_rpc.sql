-- =============================================================================
-- ROSÁLIA ESPORTES — Liga de Jogadores de Futebol Amador
-- Migração 003: Motor Transacional de Pontuação Sazonal e Rating Elo Coletivo
-- Fórmula Sazonal: P = 5 + R + 3G + 2A + 3M
-- Fórmula Elo: R_novo = R_anterior + K * (S - E)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_validated_match(
    p_match_id UUID,
    p_result_version_id UUID,
    p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_result RECORD;
    v_home_avg_rating NUMERIC;
    v_away_avg_rating NUMERIC;
    v_expected_home NUMERIC;
    v_expected_away NUMERIC;
    v_actual_home NUMERIC;
    v_actual_away NUMERIC;
    v_player RECORD;
    v_goals INTEGER;
    v_assists INTEGER;
    v_is_mvp INTEGER;
    v_result_bonus INTEGER;
    v_total_points INTEGER;
    v_k_factor SMALLINT;
    v_expected NUMERIC;
    v_actual NUMERIC;
    v_rating_delta INTEGER;
    v_new_rating INTEGER;
    v_new_uncertainty NUMERIC;
BEGIN
    -- 1. Bloqueio pessimista da partida para evitar concorrência (Seção 7.4)
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partida % não encontrada', p_match_id;
    END IF;

    SELECT * INTO v_result FROM public.match_results
    WHERE id = p_result_version_id AND match_id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Versão de resultado % não encontrada', p_result_version_id;
    END IF;

    -- Idempotência: se esta versão já foi processada, retorna sem duplicar (CA-014)
    IF EXISTS (
        SELECT 1 FROM public.point_transactions
        WHERE source_result_version_id = p_result_version_id
          AND transaction_type = 'credito'
    ) THEN
        RETURN jsonb_build_object('status', 'already_processed', 'result_version_id', p_result_version_id);
    END IF;

    -- 2. Calcular Rating Médio das Equipes (Casa vs Visitante)
    SELECT COALESCE(AVG(pp.current_rating), 1000) INTO v_home_avg_rating
    FROM public.match_players mp
    JOIN public.player_profiles pp ON pp.id = mp.player_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'home' AND mp.participation_status = 'participou';

    SELECT COALESCE(AVG(pp.current_rating), 1000) INTO v_away_avg_rating
    FROM public.match_players mp
    JOIN public.player_profiles pp ON pp.id = mp.player_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'away' AND mp.participation_status = 'participou';

    v_expected_home := 1.0 / (1.0 + power(10.0, (v_away_avg_rating - v_home_avg_rating) / 400.0));
    v_expected_away := 1.0 - v_expected_home;

    IF v_result.home_score > v_result.away_score THEN
        v_actual_home := 1.0; v_actual_away := 0.0;
    ELSIF v_result.home_score < v_result.away_score THEN
        v_actual_home := 0.0; v_actual_away := 1.0;
    ELSE
        v_actual_home := 0.5; v_actual_away := 0.5;
    END IF;

    -- 3. Processar cada atleta elegível (P = 5 + R + 3G + 2A + 3M e Elo)
    FOR v_player IN
        SELECT mp.*, pp.current_rating, pp.rating_uncertainty, pp.total_validated_matches
        FROM public.match_players mp
        JOIN public.player_profiles pp ON pp.id = mp.player_id
        WHERE mp.match_id = p_match_id AND mp.participation_status = 'participou'
    LOOP
        -- Gols e Assistências validados na versão
        SELECT COUNT(*) INTO v_goals FROM public.match_events
        WHERE result_version_id = p_result_version_id
          AND player_id = v_player.player_id
          AND event_type = 'gol'
          AND verification_status = 'validado';

        SELECT COUNT(*) INTO v_assists FROM public.match_events
        WHERE result_version_id = p_result_version_id
          AND player_id = v_player.player_id
          AND event_type = 'assistencia'
          AND verification_status = 'validado';

        v_is_mvp := CASE WHEN v_result.mvp_player_id = v_player.player_id THEN 1 ELSE 0 END;

        IF v_player.team_side = 'home' THEN
            v_expected := v_expected_home;
            v_actual := v_actual_home;
        ELSE
            v_expected := v_expected_away;
            v_actual := v_actual_away;
        END IF;

        v_result_bonus := CASE
            WHEN v_actual = 1.0 THEN 15
            WHEN v_actual = 0.5 THEN 5
            ELSE 0
        END;

        -- Fórmula oficial: P = 5 + R + 3G + 2A + 3M
        v_total_points := 5 + v_result_bonus + (3 * v_goals) + (2 * v_assists) + (3 * v_is_mvp);

        -- Inserir no Livro-Razão de Pontos (point_transactions)
        INSERT INTO public.point_transactions (
            player_id, season_id, match_id, source_result_version_id,
            transaction_type, points_delta, breakdown, reason_code, created_by
        ) VALUES (
            v_player.player_id, v_match.season_id, p_match_id, p_result_version_id,
            'credito', v_total_points,
            jsonb_build_object(
                'participacao', 5,
                'resultado', v_result_bonus,
                'gols', v_goals,
                'assistencias', v_assists,
                'mvp', v_is_mvp
            ),
            'PARTIDA_VALIDADA', p_actor_user_id
        );

        -- Fator K dinâmico por maturidade da amostra (Seção 3.2)
        IF v_player.total_validated_matches < 5 THEN
            v_k_factor := 40;
        ELSIF v_player.current_rating < 1400 THEN
            v_k_factor := 24;
        ELSE
            v_k_factor := 16;
        END IF;

        v_rating_delta := ROUND(v_k_factor * (v_actual - v_expected));
        v_new_rating := GREATEST(600, v_player.current_rating + v_rating_delta);
        v_new_uncertainty := GREATEST(15.0, v_player.rating_uncertainty - 12.0);

        INSERT INTO public.player_ratings (
            player_id, match_id, result_version_id, operation_type,
            rating_before, rating_after, rating_delta,
            uncertainty_before, uncertainty_after,
            k_factor, expected_score, actual_score, algorithm_version
        ) VALUES (
            v_player.player_id, p_match_id, p_result_version_id, 'aplicacao',
            v_player.current_rating, v_new_rating, v_rating_delta,
            v_player.rating_uncertainty, v_new_uncertainty,
            v_k_factor, v_expected, v_actual, 'elo-team-v1.0'
        );

        -- Atualizar Perfil do Atleta
        UPDATE public.player_profiles
        SET current_rating = v_new_rating,
            rating_uncertainty = v_new_uncertainty,
            total_validated_matches = total_validated_matches + 1,
            is_provisional = (total_validated_matches + 1) < 5,
            updated_at = now()
        WHERE id = v_player.player_id;

        -- Atualizar Projeção da Temporada (season_entries)
        UPDATE public.season_entries
        SET season_points = season_points + v_total_points,
            matches_played = matches_played + 1,
            wins = wins + CASE WHEN v_actual = 1.0 THEN 1 ELSE 0 END,
            draws = draws + CASE WHEN v_actual = 0.5 THEN 1 ELSE 0 END,
            losses = losses + CASE WHEN v_actual = 0.0 THEN 1 ELSE 0 END,
            goals = goals + v_goals,
            assists = assists + v_assists,
            mvp_count = mvp_count + v_is_mvp,
            status = CASE WHEN (matches_played + 1) >= 5 THEN 'elegivel' ELSE 'provisorio' END,
            updated_at = now()
        WHERE season_id = v_match.season_id AND player_id = v_player.player_id;
    END LOOP;

    -- 4. Marcar resultado e partida como Validados
    UPDATE public.match_results
    SET validation_status = 'validado',
        validated_by = p_actor_user_id,
        validated_at = now()
    WHERE id = p_result_version_id;

    UPDATE public.matches
    SET status = 'validada',
        official_home_score = v_result.home_score,
        official_away_score = v_result.away_score,
        active_result_version_id = p_result_version_id,
        updated_at = now()
    WHERE id = p_match_id;

    -- 5. Registrar Auditoria
    INSERT INTO public.audit_logs (
        actor_user_id, actor_role, action_type, entity_type, entity_id, reason, after_data
    ) VALUES (
        p_actor_user_id, 'system_or_moderator', 'MATCH_VALIDATED_AND_SCORED', 'matches', p_match_id,
        'Partida validada e processada pelo motor v1.0.0',
        jsonb_build_object('result_version_id', p_result_version_id, 'home_score', v_result.home_score, 'away_score', v_result.away_score)
    );

    RETURN jsonb_build_object('status', 'validated', 'match_id', p_match_id, 'result_version_id', p_result_version_id);
END;
$$;
