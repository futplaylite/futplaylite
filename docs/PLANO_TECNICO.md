# Plano Técnico de Execução & Governança — Rosália Esportes

**Versão:** 1.0 · Outubro de 2026  
**Referência:** PRD v1.0 — Liga de Jogadores de Futebol Amador

---

## 1. Arquitetura de Diretórios

```text
ROSÁLIA ESPORTES/
├── docs/
│   ├── PRD.md                           # Documento de Requisitos do Produto (v1.0)
│   └── PLANO_TECNICO.md                 # Arquitetura, Motor de Regras, LGPD e DR (CA-040)
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql       # Tabelas, chaves, constraints únicas e índices
│   │   ├── 002_rls_policies.sql         # Row-Level Security (RLS) por papel e visibilidade
│   │   └── 003_scoring_and_elo_rpc.sql  # Funções transacionais idempotentes (PL/pgSQL)
│   └── seed.sql                         # Carga inicial (Município, Temporada 1, Divisões)
├── src/
│   ├── types/
│   │   └── league.ts                    # Tipagem estrita das entidades e versões de regras
│   ├── lib/
│   │   ├── engine/
│   │   │   ├── scoringEngine.ts         # Fórmula P = 5 + R + 3G + 2A + 3M, desempates e reversões
│   │   │   ├── eloEngine.ts             # Rating Elo coletivo + incerteza + fator K dinâmico
│   │   │   ├── positionRating.ts        # Nota experimental 0-100 por posição (RF-015)
│   │   │   ├── antiFraud.ts             # Detecção de anomalias e conluio (Seção 3.4)
│   │   │   └── homologationSuite.ts     # Executor automatizado dos 10 Testes de Homologação (Seção 9)
│   │   └── store/
│   │       └── leagueStore.ts           # Estado persistente auditável + controle de acesso RBAC
│   └── components/                      # Interface Web Responsiva (Verde #126B46, Dourado #C9A227, Grafite #17231D)
└── package.json
```

---

## 2. Motor de Regras Competitivas (`v1.0.0`)

### 2.1. Cálculo de Pontos da Temporada (`scoringEngine.ts`)
A pontuação de uma partida para cada atleta confirmado na escalação (`participation_status = 'participou'`) é calculada exclusivamente no servidor/motor de domínio após a versão do resultado atingir `validation_status = 'validado'`:

$$P = 5 + R + 3G + 2A + 3M$$

- **Idempotência (CA-014):** Cada lançamento em `point_transactions` possui chave única composta `(player_id, source_result_version_id, transaction_type)`. Se a operação for reenviada, o motor detecta a transação existente e retorna o resultado sem duplicar pontos.
- **Reversão Compensatória (CA-013, CA-022):** Quando um resultado validado ($v_1$) é anulado ou corrigido por uma nova versão ($v_2$):
  1. O sistema **nunca apaga** as linhas anteriores de `point_transactions` ou `match_results`.
  2. Gera uma transação `transaction_type = 'reversao'` com `points_delta = -P(v_1)` vinculada a $v_1$.
  3. Caso haja nova versão validada $v_2$, gera uma nova transação `transaction_type = 'credito'` com `points_delta = +P(v_2)` vinculada a $v_2$.

### 2.2. Cálculo do Rating de Habilidade — Elo Coletivo (`eloEngine.ts`)
- **Valor Inicial:** `1000` pontos (`uncertainty = 100`, status `provisorio` até completar `5` partidas validadas).
- **Força Esperada da Equipe ($E$):**
  $$E_{\text{casa}} = \frac{1}{1 + 10^{(\bar{R}_{\text{visitante}} - \bar{R}_{\text{casa}}) / 400}}$$
- **Fator $K$ Dinâmico:**
  - Jogador em classificação provisória ($< 5$ jogos): $K = 40$ (convergência rápida).
  - Jogador estabelecido ($\ge 5$ jogos, rating $< 1400$): $K = 24$.
  - Jogador de elite ($\ge 1400$, Platina/Diamante): $K = 16$ (estabilidade no topo).
- **Isolamento de Estatísticas Individuais (Seção 3.2):** Gols e assistências **não** somam pontos diretos no Elo, preservando a isonomia entre goleiros, defensores, meias e atacantes.

### 2.3. Critérios de Desempate no Ranking Municipal (CA-020)
Ordenação determinística para atletas com o mesmo `season_points`:
1. Maior `rating` de habilidade atual;
2. Maior número de vitórias validadas (`wins`) na temporada;
3. Maior número de partidas válidas (`matches_played`) na temporada;
4. Maior número de prêmios de `MVP` validados (`mvp_count`).

---

## 3. Procedimento de Restauração e Recuperação de Operações Interrompidas (CA-040)

### 3.1. Recuperação de Transações de Partida Interrompidas
Como o processamento de uma partida validada envolve múltiplas tabelas (`match_results`, `point_transactions`, `player_ratings`, `season_entries`), o sistema adota duas camadas de proteção:
1. **No Banco PostgreSQL (`003_scoring_and_elo_rpc.sql`):** A função `process_validated_match(p_match_id, p_result_version_id, p_actor_id)` executa dentro de um bloco transacional atômico (`BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE`). Qualquer falha faz rollback completo.
2. **Reconciliação de Projeções (`reconcileSeasonEntries`):**
   - A tabela `season_entries` funciona como uma projeção materializada do livro-razão (`point_transactions`) e do histórico de ratings (`player_ratings`).
   - Em caso de falha parcial ou inconsistência detectada pela auditoria, o administrador pode acionar a rotina **"Reconciliar Livro-Razão (Ledger)"**, que recalcula deterministicamente `season_points`, `wins`, `draws`, `losses`, `goals`, `assists`, `mvp_count` e `rating` a partir do zero usando apenas as versões de resultado com `validation_status = 'validado'` e `ruleset_version` correspondente.

### 3.2. Backup e Restauração (RNF-009)
- **Backups Automáticos (Point-in-Time Recovery - PITR):** Diários com retenção de 30 dias no PostgreSQL/Supabase.
- **Exportação e Restauração Local/JSON:** O Painel Administrativo dispõe de exportação instantânea do snapshot completo auditado (JSON assinado com timestamp e versão do schema) e restauração imediata de estado íntegro.

---

## 4. Governança, Privacidade e Conformidade LGPD (Seção 11)

| Categoria de Dado | Finalidade | Base Legal (LGPD) | Visibilidade Padrão |
| :--- | :--- | :--- | :--- |
| Apelido, Posição, Município | Identificação esportiva nos rankings e súmulas | Execução de contrato / Termos da Liga | Respeita `profile_visibility` (`publico`, `restrito`, `privado`) |
| E-mail e credenciais | Autenticação e recuperação de conta (CA-002) | Execução de contrato / Segurança | Estritamente privado (nunca exposto em APIs públicas) |
| Evidências de partida (fotos/vídeos) | Resolução de contestações e prevenção à fraude | Legítimo interesse / Prevenção à fraude | Restrito aos participantes da partida e moderadores (CA-015, CA-031) |
| Logs de auditoria e denúncias | Rastreabilidade de alterações administrativas | Obrigação legal e segurança da plataforma | Somente administradores/moderadores autorizados (CA-027) |
