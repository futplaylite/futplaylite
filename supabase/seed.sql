-- =============================================================================
-- ROSÁLIA ESPORTES / FUTPLAY LITE — Carga Inicial (Seed SQL)
-- =============================================================================

INSERT INTO public.cities (id, name, state_code, region_name, country_code, slug, status)
VALUES
    ('11111111-1111-4111-8111-111111111101', 'Planalto', 'BA', 'Sudoeste da Bahia', 'BR', 'planalto-ba', 'ativa'),
    ('11111111-1111-4111-8111-111111111102', 'Poções', 'BA', 'Sudoeste da Bahia', 'BR', 'pocoes-ba', 'em_preparacao'),
    ('11111111-1111-4111-8111-111111111103', 'Vitória da Conquista', 'BA', 'Sudoeste da Bahia', 'BR', 'vitoria-da-conquista-ba', 'em_preparacao')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.divisions (id, name, tier, min_rating, max_rating, min_matches_required, ruleset_version)
VALUES
    ('22222222-2222-4222-8222-222222222201', 'Bronze',   1, 0,    1099, 0, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222202', 'Prata',    2, 1100, 1249, 5, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222203', 'Ouro',     3, 1250, 1399, 5, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222204', 'Platina',  4, 1400, 1549, 5, 'v1.0.0'),
    ('22222222-2222-4222-8222-222222222205', 'Diamante', 5, 1550, NULL, 5, 'v1.0.0')
ON CONFLICT (tier, ruleset_version) DO NOTHING;

INSERT INTO public.seasons (id, city_id, name, starts_at, ends_at, grace_period_ends_at, ruleset_version, status)
VALUES
    (
        '33333333-3333-4333-8333-333333333301',
        '11111111-1111-4111-8111-111111111101',
        'Temporada 2026.2 · Liga Planalto - BA',
        '2026-09-01T00:00:00-03:00',
        '2026-11-10T23:59:59-03:00',
        '2026-11-17T23:59:59-03:00',
        'v1.0.0',
        'ativa'
    )
ON CONFLICT (id) DO NOTHING;
