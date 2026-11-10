# 🏆 Roadmap: Módulo de Campeonatos e Torneios (Estilo Copa Fácil)
**Projeto:** FutPlay Lite / Rosália Esportes  
**Status:** Planejado para implementação futura  
**Referência de Mercado:** Copa Fácil (copafacil.com)

---

## 🎯 Objetivo
Transformar o FutPlay Lite em uma plataforma completa de gerenciamento de campeonatos esportivos (Society, Futsal, Campo, etc.), permitindo criar tabelas automáticas, chaveamento visual de mata-mata, controle de artilharia, suspensões por cartões e compartilhamento direto para o WhatsApp.

---

## 🏗️ Arquitetura e Fases de Implementação

### Fase 1: Modelagem no Banco de Dados (Supabase)
Tabelas necessárias para suportar torneios:
1. `public.championships`:
   - `id` (UUID / TEXT)
   - `name` (Nome do torneio: ex. "Copa Planalto Society 2026")
   - `format` ('pontos_corridos' | 'mata_mata' | 'grupos_mata_mata')
   - `modality` ('society' | 'futsal' | 'campo' | 'areia')
   - `banner_url` / `trophy_crest_url`
   - `created_by` / `organization_name`
   - `status` ('inscricoes' | 'em_andamento' | 'finalizado')
   - `created_at`
2. `public.championship_teams`:
   - `championship_id`
   - `team_name`
   - `team_crest_url`
   - `group_name` ('Grupo A', 'Grupo B' ou null)
3. `public.championship_matches`:
   - `id`
   - `championship_id`
   - `phase` ('grupo' | 'oitavas' | 'quartas' | 'semi' | 'final' | 'terceiro_lugar')
   - `round_number`
   - `home_team_name` / `away_team_name`
   - `home_score` / `away_score`
   - `match_date` / `match_time` / `venue_name`
   - `status` ('agendado' | 'em_andamento' | 'finalizado')
   - `match_data` (JSONB com autores dos gols, cartões e escalações)

---

### Fase 2: Painel de Criação e Configuração do Torneio
Tela exclusiva para organizadores e administradores:
- Escolha do formato de disputa:
  - **Pontos Corridos:** Turno único ou Turno e Returno.
  - **Mata-Mata:** Jogo único ou Ida e Volta (com critérios de desempate: pênaltis, prorrogação).
  - **Grupos + Mata-Mata:** Ex. 2 grupos de 4 times, avançando os 2 melhores de cada grupo para a Semifinal.
- Inscrição das equipes participantes.

---

### Fase 3: Gerador Automático de Rodadas e Chaveamento
- **Algoritmo Round Robin:** Gera automaticamente todos os confrontos da fase de grupos evitando que times joguem duas vezes na mesma rodada.
- **Chaveamento Visual (*Brackets*):** Componente interativo desenhando a árvore do mata-mata (Quartas ➔ Semifinal ➔ Final).
- **Avanço Automático:** Ao finalizar um jogo de mata-mata, o vencedor avança automaticamente para a próxima caixinha da chave.

---

### Fase 4: Integração com a Súmula Digital em Tempo Real
- O árbitro/mesário clica no jogo da tabela do torneio e abre a súmula em tempo real do FutPlay Lite.
- Ao clicar em "Finalizar Partida":
  - O placar é oficializado.
  - A tabela de classificação é recalculada na hora (Pontos, Vitórias, Empates, Derrotas, Saldo de Gols, Gols Pró e Gols Contra).
  - Os gols são somados na artilharia geral do campeonato.
  - Cartões são acumulados na ficha dos atletas.

---

### Fase 5: Central Pública do Campeonato (Atletas e Torcedores)
Interface fluida no app com 4 abas:
1. **Classificação:** Tabela dinâmica dos grupos com critérios de desempate configuráveis (Pontos > Vitórias > Saldo > Gols Pró > Confronto Direto).
2. **Mata-Mata:** Árvore gráfica e interativa das eliminatórias.
3. **Jogos & Resultados:** Lista de partidas filtráveis por rodada ou por equipe.
4. **Estatísticas:**
   - ⚽ **Artilharia do Campeonato** (foto do atleta, time e quantidade de gols).
   - 🧤 **Melhor Goleiro / Defesa Menos Vazada**.
   - 🟨 **Controle Disciplinar** (cartões amarelos/vermelhos e aviso de suspensões automáticas).

---

### Fase 6: Cards e Banners para WhatsApp / Instagram
- Gerador de imagens estilo Copa Fácil:
  - Card da **Tabela de Classificação Atualizada**.
  - Card do **Chaveamento do Mata-Mata**.
  - Card do **Confronto da Rodada** (Flyer pré-jogo com escudo dos dois times, data, local e horário).
  - Card dos **Resultados da Rodada** e **Artilharia**.
