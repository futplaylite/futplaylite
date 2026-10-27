# ROSÁLIA ESPORTES — Liga de Jogadores de Futebol Amador (MVP v1.0)

Plataforma digital competitiva para organizar, validar e classificar o desempenho de atletas de futebol amador por meio de duas classificações independentes:
1. **Ranking de Temporada (Pontos):** $P = 5 + R + 3G + 2A + 3M$
2. **Rating de Habilidade (Elo Coletivo):** $R_{\text{novo}} = R_{\text{anterior}} + K(S - E)$

---

## Estrutura de Arquivos Criados

- [`docs/PRD.md`](./docs/PRD.md): Documento de Requisitos do Produto (v1.0) formatado em Markdown com diagramas Mermaid reconstruídos e fórmulas LaTeX.
- [`docs/PLANO_TECNICO.md`](./docs/PLANO_TECNICO.md): Arquitetura técnica, motor de regras competitivas, governança LGPD e procedimento de recuperação/restauração (CA-040).
- [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql): Esquema relacional PostgreSQL completo (16 tabelas, restrições únicas e controle de versão).
- [`supabase/migrations/002_rls_policies.sql`](./supabase/migrations/002_rls_policies.sql): Políticas Row-Level Security (RLS) por papel (`player`, `moderator`, `admin`) e visibilidade pública/privada.
- [`supabase/migrations/003_scoring_and_elo_rpc.sql`](./supabase/migrations/003_scoring_and_elo_rpc.sql): Função transacional idempotente `process_validated_match` em PL/pgSQL.
- [`supabase/seed.sql`](./supabase/seed.sql): Dados iniciais para o Município de Rosália - SP, divisões e temporada.
- [`src/`](./src/): Aplicação Web interativa completa com Design System oficial (`#126B46` Verde, `#C9A227` Dourado, `#17231D` Grafite, `#FFFFFF` Branco).

---

## Como Executar Localmente

```bash
npm install
npm run dev
```

Acesse no navegador: **http://localhost:3000**
