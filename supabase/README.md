# Configuração do Supabase — ROSÁLIA ESPORTES / FUTPLAY LITE

Este guia explica passo a passo como criar seu projeto gratuito no Supabase, rodar o esquema de banco de dados e conectar com o seu aplicativo web (tanto localmente quanto na Vercel).

---

## 1. Criar o Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita (ou faça login com GitHub).
2. Clique em **"New Project"**.
3. Preencha os dados:
   * **Name:** `rosalia-esportes` ou `futplaylite`
   * **Database Password:** Escolha uma senha segura e guarde-a.
   * **Region:** Escolha `South America (São Paulo)` para menor latência no Brasil.
4. Clique em **"Create new project"** e aguarde cerca de 1 a 2 minutos para provisionar.

---

## 2. Executar as Migrações do Banco de Dados
No painel do Supabase, clique no menu lateral em **SQL Editor** (ícone `>_`) e execute os scripts da pasta `supabase/` na seguinte ordem:

1. **`001_initial_schema.sql`**: Cria as tabelas principais (`users`, `cities`, `divisions`, `player_profiles`, `seasons`, `matches`, `match_players`, `match_results`, `point_transactions`, etc.).
2. **`002_rls_policies.sql`**: Ativa e define as regras de segurança (Row-Level Security) para proteção de dados e permissões por papel.
3. **`003_scoring_and_elo_rpc.sql`**: Cria as funções transacionais em PL/pgSQL para processamento de partidas validadas e atualização de Elo.
4. **`004_monthly_fees_and_settings.sql`**: Cria as tabelas do módulo financeiro (`pelada_monthly_configs` e `monthly_payments` com chaves PIX).
5. *(Opcional)* **`seed.sql`**: Insere registros iniciais de teste (cidades, divisões e temporadas).

> **Dica:** Para cada arquivo, basta copiar o conteúdo completo, colar no **SQL Editor** e clicar em **"Run"** (Ctrl + Enter).

---

## 3. Obter as Chaves de Conexão
No painel do seu projeto no Supabase:
1. Vá em **Project Settings** (ícone de engrenagem) ➔ **API**.
2. Copie os dois valores:
   * **Project URL** (ex: `https://xyzcompany.supabase.co`)
   * **Project API Keys** ➔ copie a chave **`anon` `public`**

---

## 4. Configurar as Variáveis de Ambiente

### Para Desenvolvimento Local:
Crie um arquivo `.env` na raiz do projeto (baseando-se no `.env.example`):
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### Para Produção na Vercel:
1. Acesse seu projeto no painel da [Vercel](https://vercel.com).
2. Vá em **Settings** ➔ **Environment Variables**.
3. Adicione as duas variáveis:
   * **Key:** `VITE_SUPABASE_URL` | **Value:** `https://seu-projeto.supabase.co`
   * **Key:** `VITE_SUPABASE_ANON_KEY` | **Value:** `sua-chave-anon-aqui`
4. Marque os ambientes: **Production**, **Preview**, **Development**.
5. Clique em **Save**.
6. Faça um novo deploy ou clique em **Redeploy** na Vercel para carregar as novas variáveis.

---

## 5. Storage (Opcional - para Upload de Recibos e Fotos)
Se desejar armazenar comprovantes de súmula e fotos de partidas na nuvem:
1. Vá em **Storage** no menu lateral do Supabase.
2. Clique em **"New Bucket"**.
3. Nome: `evidence-files`
4. Deixe como **Public Bucket** para permitir visualização de comprovantes.
