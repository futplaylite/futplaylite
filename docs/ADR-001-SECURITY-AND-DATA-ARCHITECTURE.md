# ADR-001: Arquitetura Canônica de Identidade, Autorização Multi-Time, Finanças Imutáveis e Segurança de Dados

* **Status:** Congelado (Versão Definitiva — Quarta Revisão Técnica)
* **Data:** 2026-11-18
* **Branch:** `feat/security-and-integrity-rebuild`

---

## 1. Contexto e Problema
A auditoria adversarial do FutPlay Lite identificou que a arquitetura original utilizava autenticação customizada em `localStorage`, armazenava senhas em texto claro em `public.users.password_hash`, operava integralmente sob o papel anônimo (`anon`) do Supabase com políticas RLS `USING (true)`, determinava o vínculo de equipe por campos de texto editáveis (`team_name`) e utilizava a tabela `public.pelada_sumulas` como armazenamento chave-valor genérico para sessões, avaliações, caixa, mensalidades, configurações PIX e auditoria.

Este ADR congela uma **única arquitetura oficial** para os Scripts A e B e para o aplicativo, proibindo modelos híbridos ou fontes duplicadas de verdade.

---

## 2. Decisões Arquiteturais Congeladas

### 2.1. Identidade Canônica dos Usuários (`public.users.id = auth.users.id`)
1. **Relação 1:1 Estrita:** A chave primária `public.users.id` (`UUID`) é idêntica a `auth.users.id` (`UUID`), com chave estrangeira `REFERENCES auth.users(id) ON DELETE RESTRICT`. Não existe coluna `auth_user_id` separada.
2. **Proibição de Mutação Direta pelo Cliente:** Nenhum cliente (`anon` ou `authenticated`) possui permissão SQL de `INSERT`, `UPDATE` ou `DELETE` em `public.users`. Alterações de e-mail e telefone devem ocorrer pelo fluxo verificado do `Supabase Auth`, sincronizando `public.users` via trigger interno `ON auth.users`.
3. **Bloqueio de Backend por `must_reset_password`:** As 23 contas migradas iniciam com `must_reset_password = true`. Enquanto `must_reset_password = true`, a função base `private.is_active_verified_user()` retorna `false`, bloqueando no PostgreSQL/RLS qualquer acesso ao financeiro, alterações de perfil, operações esportivas e RPCs administrativas até que o usuário redefina sua senha após comprovação de posse do contato.

### 2.2. Titularidade Única e Associação Usuário ↔ Equipe (`public.team_memberships`)
1. **Fonte Única de Verdade:** A tabela `public.teams` **não possui** a coluna `owner_user_id` nem `invite_code` em texto claro.
2. **Estrutura Oficial de `public.team_memberships`:**
   * `team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE`
   * `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`
   * `player_id UUID NOT NULL REFERENCES public.player_profiles(id) ON DELETE CASCADE`
   * `is_owner BOOLEAN NOT NULL DEFAULT false` (Titularidade da equipe)
   * `can_manage_sport BOOLEAN NOT NULL DEFAULT false` (Permissão de Treinador: elenco, súmulas, escalações e agenda)
   * `can_manage_finance BOOLEAN NOT NULL DEFAULT false` (Permissão de Tesoureiro: Caixa, mensalidades e configuração PIX)
   * `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed'))`
3. **Invariantes Garantidas pelo Banco de Dados:**
   * `CHECK (NOT is_owner OR (can_manage_sport = true AND can_manage_finance = true))`: O proprietário sempre detém ambas as permissões; outro membro pode acumular `can_manage_sport = true` e `can_manage_finance = true` simultaneamente (Treinador + Tesoureiro), possuir apenas uma delas, ou nenhuma (Atleta).
   * `CREATE UNIQUE INDEX uq_one_active_owner_per_team ON public.team_memberships (team_id) WHERE is_owner = true AND status = 'active'`: Garante no máximo um proprietário ativo por equipe.
   * `CREATE UNIQUE INDEX uq_one_active_team_per_user ON public.team_memberships (user_id) WHERE status = 'active'`: Impede que um usuário pertença simultaneamente a duas equipes ativas.
   * **Zero Autorização por Nome:** Nenhuma função ou política RLS consulta `team_name`. Toda autorização consulta exclusivamente `team_id UUID` em `public.team_memberships`.

### 2.3. Códigos de Convite Criptográficos (`public.team_invites`)
1. **Proibição de Hashes Previsíveis:** É proibido derivar códigos de convite a partir do nome ou slug da equipe (como `MD5(slug)`).
2. **Entropia e Hash:** Cada convite é gerado no servidor com no mínimo **128 bits de entropia CSPRNG** (`gen_random_uuid()`). O banco armazena apenas o **hash SHA-256** (`token_hash TEXT UNIQUE NOT NULL`) do token normalizado, além de `expires_at`, `revoked_at`, `max_uses`, `uses_count` e `created_by`.
3. **Consumo Transacional Concorrente:** A RPC `public.join_team_with_invite_code_authenticated` aplica `pg_advisory_xact_lock` no usuário, verifica rate-limit em `private.invite_attempt_log`, bloqueia a linha do convite com `FOR UPDATE`, incrementa `uses_count` e insere o vínculo como atleta (`is_owner = false, can_manage_sport = false, can_manage_finance = false`).

### 2.4. Sessões (`auth.sessions` e Revogação de Tokens Legados)
1. Os 20 registros legados `user_session_*` em `pelada_sumulas` **não são sessões do Supabase Auth**. Eles são arquivados em `public.migration_archived_records` com o token antigo mascarado por hash SHA-256 (apenas para rastreabilidade forense) e revogados.
2. O aplicativo utiliza exclusivamente sessões emitidas pelo `Supabase Auth` (validadas via `auth.uid()` e claim `session_id` verificada contra `auth.sessions` quando exigido por operações críticas).

### 2.5. Privacidade de Perfis (`profile_visibility`) e Avaliações (`peer_evaluations`)
1. **`profile_visibility` em `public.player_profiles`:**
   * `'publico'`: visível para usuários autenticados ativos da plataforma.
   * `'restrito'`: visível apenas para o próprio atleta (`user_id = auth.uid()`), membros ativos da **mesma equipe** (verificados via `public.team_memberships`) e staff da plataforma (`admin`/`moderator`).
   * `'privado'`: visível apenas para o próprio atleta e administradores da plataforma (`admin`).
2. **Privacidade de Votos e Quórum Mínimo no Scout:**
   * Votos individuais em `public.peer_evaluations` são visíveis apenas ao próprio avaliador (`evaluator_user_id = auth.uid()`).
   * A view `public.player_skill_aggregates_view` exige um **quórum mínimo de 3 avaliações independentes (`COUNT(*) >= 3`)** para exibir as médias numéricas dos atributos, retornando `NULL` nas médias quando `total_votes < 3` para impedir a inferência do voto de um único avaliador.

### 2.6. Auditoria e Isolamento de Contexto Privilegiado (`private.trusted_rpc_locks`)
1. Clientes (`anon` e `authenticated`) não possuem permissão de `INSERT`, `UPDATE` ou `DELETE` em `public.audit_logs`.
2. **Eliminação de `set_config('app.trusted_rpc_context', ...)`:** Como qualquer sessão SQL pode invocar `pg_catalog.set_config()`, os triggers de segurança **não utilizam** variáveis GUC (`current_setting`) para liberar operações privilegiadas.
3. Em seu lugar, o schema não exposto `private` mantém a tabela `private.trusted_rpc_locks (txid BIGINT, operation TEXT, target_id TEXT, actor_id UUID)`, inacessível a `anon` e `authenticated`. Apenas funções `SECURITY DEFINER` após validarem a autorização inserem e removem o token transacional para o `target_id` específico daquela operação.
