# FUTPLAY LITE / ROSÁLIA ESPORTES — Liga de Futebol Amador

Plataforma digital para organização de peladas, ligas individuais e equipes de futebol amador em **Planalto - BA** e região sudoeste da Bahia.

🌐 **Acesse online em produção:** [https://futplaylite.vercel.app/](https://futplaylite.vercel.app/)

---

## ⚡ Recursos Principais

- ⚽ **Súmula Digital & Registro de Partidas:** Registro ao vivo de gols, assistências, defesas difíceis, capas e cartões.
- 📸 **Comprovante de Súmula em Imagem:** Gerador de imagem oficial de alta definição para compartilhamento direto no WhatsApp.
- 🏆 **Duplo Sistema de Classificação:**
  1. **Ranking da Temporada (Pontos):** $P = 5 + R + 3G + 2A + 3M$
  2. **Rating de Habilidade (Elo Coletivo):** $R_{\text{novo}} = R_{\text{anterior}} + K(S - E)$
- 💰 **Módulo de Mensalidades & PIX:** Gestão financeira de atletas com chave PIX, confirmação de status e lembretes de cobrança via WhatsApp.
- 📱 **Mobile First & PWA:** Interface leve, estável e otimizada para smartphones (código principal com apenas 96 kB gzipped).
- 🗄️ **Banco de Dados em Nuvem (Supabase):** PostgreSQL com regras de segurança Row-Level Security (RLS) e servidor no Brasil (São Paulo).

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Bundler:** Vite 6 (com Code-Splitting inteligente em chunks)
- **Hospedagem & CDN:** Vercel (Edge Network São Paulo `gru1`)
- **Backend & Database:** Supabase (PostgreSQL, RLS, Storage)

---

## 🚀 Como Executar Localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse no navegador: **http://localhost:3000**

---

## 📄 Scripts Supabase

Os scripts completos de banco de dados estão na pasta `supabase/`:
- `supabase/SETUP_COMPLETO_UNICO.sql`: Script mestre unificado para criação de tabelas, RLS, funções de Elo e dados iniciais de Planalto - BA.
