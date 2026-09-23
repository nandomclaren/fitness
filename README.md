# Maromba — Treino de Musculação e Sobrecarga Progressiva

Um personal trainer digital para rastrear cargas, sugerir progressão de carga
automaticamente, montar treinos com IA a partir dos seus objetivos e mostrar um resumo
pós-treino com mapa muscular anatômico. Cliente-servidor: o app roda no navegador e
guarda o histórico num banco Postgres, para acessar de qualquer dispositivo.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS v4 + Lucide Icons.
- **Backend:** Express (TypeScript, rodando via `tsx`) servindo a API e o build estático
  do frontend no mesmo processo.
- **Banco de dados:** PostgreSQL via Prisma ORM (sessões de treino, séries, recordes
  pessoais e objetivos do usuário).
- **IA:** [Claude API](https://www.anthropic.com/api) (`claude-sonnet-5`) para montar a
  rotina sugerida do dia e alimentar o chat do coach, a partir dos objetivos, do
  histórico recente e (no chat) fotos anexadas.
- **vite-plugin-pwa:** manifest + service worker, para instalar o app no celular
  (Android/iOS) como ícone de tela inicial.

> Sem sistema de login/contas — pensado para uso pessoal. A API é protegida por um token
> simples compartilhado (ver `APP_ACCESS_TOKEN` abaixo), não por autenticação de verdade.

## Como rodar localmente

Requer Node 22+ e um Postgres local (ou remoto) rodando.

```bash
npm install                        # instala tudo e gera o Prisma Client (postinstall)
cp .env.example .env               # preencha DATABASE_URL, APP_ACCESS_TOKEN etc. (veja abaixo)
npm run db:migrate                 # cria as tabelas no seu Postgres local

npm run server:dev                 # backend Express na porta 3001 (num terminal)
npm run dev                        # frontend Vite na porta 5173, proxy /api -> :3001 (noutro terminal)
```

Outros comandos:

```bash
npm run build     # typecheck + build de produção do frontend em dist/
npm run lint      # oxlint
npm run fetch-exercises   # regenera src/data/exercises.json (veja seção abaixo)
```

## Variáveis de ambiente

Veja `.env.example` para a lista completa e comentada. As principais:

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Connection string do Postgres. |
| `APP_ACCESS_TOKEN` | Token que protege a API. Gere um valor aleatório (`openssl rand -hex 32`). |
| `VITE_APP_ACCESS_TOKEN` | Mesmo valor acima — embutido no build do frontend para autenticar as chamadas. |
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic, usada pela rotina sugerida por IA (veja abaixo). |
| `RAPIDAPI_KEY` | Opcional — só para trocar a fonte de exercícios pela ExerciseDB (veja abaixo). |

## Rotina sugerida por IA

Na tela inicial, depois de escolher o tipo de treino, o botão **"Treino sugerido pela
IA"** chama o endpoint `POST /api/routine/suggested`, que usa a Claude API
(`claude-sonnet-5`) para montar a lista de exercícios considerando:

- Seus **objetivos** (definidos no onboarding / tela de Objetivos ⚙️): meta, nível,
  dias por semana, equipamentos disponíveis, limitações/lesões.
- Seu **histórico recente** de treinos (últimas sessões concluídas).
- O **catálogo real** de exercícios do app — a IA só pode escolher exercícios que
  existem de fato (IDs inventados são filtrados no backend); se a IA falhar ou não
  retornar nada válido, o app cai automaticamente na rotina balanceada padrão
  (regra fixa, sem IA), então o app nunca quebra por causa disso.

### Como conseguir a chave da Anthropic (Claude API)

1. Acesse **https://console.anthropic.com** e crie uma conta (ou faça login).
2. No menu lateral, vá em **"API Keys"**.
3. Clique em **"Create Key"**, dê um nome (ex.: `sobrecarga-app`) e confirme.
4. Copie a chave (começa com `sk-ant-...`) — ela só é exibida **uma vez**.
5. Adicione um método de pagamento em **"Billing"** (a API é paga por uso, mas o custo
   por rotina gerada é muito baixo — poucos centavos de dólar; não há tier gratuito
   permanente, mas costuma vir um crédito inicial pra novas contas).
6. Cole a chave na variável `ANTHROPIC_API_KEY` (local: `.env`; produção: variável de
   ambiente no Railway — veja abaixo).

**Nunca cole a chave em código, commits ou conversas/chats.**

## Base de dados de exercícios

Toda a biblioteca de exercícios é consolidada em `src/data/exercises.json` por um script
de ingestão (`scripts/fetch-exercises.ts`), usado tanto pelo frontend quanto pelo backend
(nenhum dos dois depende de chamadas à API de exercícios em tempo real).

### Fonte padrão (sem necessidade de chave)

Por padrão, o script usa a **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)**,
uma base aberta (domínio público) com centenas de exercícios de musculação, já filtrada
para as categorias de força e normalizada para o schema interno do app:

```bash
npm run fetch-exercises
```

### Fonte ExerciseDB (RapidAPI) — GIFs animados reais (subconjunto prioritário)

A **ExerciseDB** fornece GIFs animados reais de execução (em vez das duas fotos estáticas
do free-exercise-db). Duas limitações técnicas importantes descobertas na prática:

1. A listagem da API **não retorna mais o `gifUrl` direto** — o GIF só vem de um endpoint
   separado (`/image?exerciseId=...`), que exige o header `X-RapidAPI-Key` em toda
   chamada. Uma tag `<img>` no navegador não consegue enviar esse header, então **não dá
   pra simplesmente linkar a URL da imagem** — o GIF precisa ser baixado por este script
   (que tem a chave) e re-hospedado em `public/exercises/gifs/`.
2. O plano gratuito da RapidAPI tem uma cota de **690 requisições/mês**. Cada exercício
   custa 1 requisição pra listar + 1 requisição pra baixar o GIF. Baixar o GIF dos
   ~1.357 exercícios da base estouraria a cota em um único mês.

Por isso, o modo `--source=exercisedb` funciona de forma **aditiva e curada**: baixa a
lista completa de metadados (barata — a listagem pagina 10 por vez, ~140 requisições no
total), escolhe até **15 exercícios "âncora" por grupo muscular** (priorizando
barra/halteres/máquina, mesma lógica de `src/lib/routine.ts`), baixa o GIF real só
desses (~200-250 requisições) e **acrescenta** esse subconjunto ao catálogo existente do
free-exercise-db — sem substituir nem remover nada. Assim o catálogo cresce com GIFs de
alta qualidade para os exercícios mais usados, cabendo na cota gratuita mensal.

1. Crie uma conta em [rapidapi.com](https://rapidapi.com).
2. Acesse a página da [ExerciseDB API](https://rapidapi.com/exercisedb/api/exercisedb) e
   clique em **"Subscribe to Test"**, escolhendo o plano **Basic (gratuito)**.
3. Na aba **Endpoints**, copie sua `X-RapidAPI-Key` (painel de "Code Snippets"), ou vá em
   **avatar → "My Apps" → app padrão → aba "Security"** pra ver a chave isolada.
4. Rode o script apontando para essa fonte:

   ```bash
   RAPIDAPI_KEY=sua_chave_aqui npm run fetch-exercises -- --source=exercisedb
   ```

   No Windows (PowerShell): `$env:RAPIDAPI_KEY="sua_chave_aqui"; npm run fetch-exercises -- --source=exercisedb`

O script normaliza os nomes de músculos para a taxonomia interna (`src/types/muscle.ts`),
salva os GIFs em `public/exercises/gifs/*.gif` e atualiza `src/data/exercises.json`.
Depois é só commitar os dois (arquivo JSON + pasta de GIFs). Rodar de novo é seguro —
o script substitui só os exercícios com prefixo `edb-` do run anterior, sem duplicar.
Quer aumentar a cobertura? Ajuste `MAX_GIFS_PER_MUSCLE` no script (de olho na cota
mensal). **Nunca cole a chave em código, commits ou chats.**

### Schema de cada exercício

```ts
interface Exercise {
  id: string
  name: string // traduzido/padronizado em PT-BR quando disponível no dicionário interno
  bodyPart: 'upper body' | 'lower body' | 'core'
  target: MuscleId // músculo primário (taxonomia canônica)
  secondaryMuscles: MuscleId[]
  equipment: string
  gifUrl: string
  loopFrameUrl?: string // 2º quadro, usado para simular loop quando não há GIF real
  instructions?: string[]
}
```

## Fluxo do app

0. **Onboarding** (primeiro uso) — objetivo, nível, dias/semana, equipamento e
   limitações. Pode ser revisado depois pelo ícone ⚙️ na tela inicial.
1. **Tela Inicial** — escolha **Superior**, **Inferior** ou **Completo**; o app monta uma
   rotina sugerida balanceada (regra fixa) automaticamente, ou gere uma com **"Treino
   sugerido pela IA"**. A lista pode ser livremente ajustada (adicionar/remover).
2. **Player de Treino** — para cada exercício: demonstração em loop, o "cérebro" de
   sobrecarga progressiva mostra `Última sessão: X kg × Y repetições (RPE Z)` e sugere o
   ajuste do dia (RPE ≤7 → +2kg/+2 reps; RPE 8 → manter; RPE ≥9 → reduzir ~5%); registro de
   séries (peso, reps, RPE) e timer de descanso entre séries.
3. **Resumo Pós-Treino** — volume total, duração, séries/exercícios concluídos, recordes
   pessoais batidos (por 1RM estimado, fórmula de Epley) e um **mapa muscular anatômico
   (SVG, frente e verso)** com heatmap: vermelho = músculos primários, laranja = músculos
   secundários, cinza = não trabalhados.

## Modo TV e projeção em tela grande

O Player de Treino tem um botão de **Modo TV** (alto contraste, textos maiores) pensado
para ser lido à distância. Para efetivamente enviar a tela para uma TV:

- **Android TV / Chromecast**: use a função nativa "Transmitir" do Chrome (menu ⋮ → Cast).
- **Apple TV / Mac**: use o **AirPlay** nativo do sistema (espelhamento de tela).

Não existe uma API web padrão para "enviar" uma página inteira via AirPlay — por isso o
app não tenta simular esse fluxo, e sim otimiza o layout para ficar legível quando a
aba/tela é espelhada pelos recursos nativos do sistema operacional (botão "Enviar para
TV" no player mostra essas instruções).

## Deploy no Railway

O app inteiro (frontend + backend + Postgres) roda como **um único serviço** no Railway.

1. Crie uma conta em **https://railway.com** (dá pra usar login com GitHub).
2. No dashboard, clique em **"New Project" → "Deploy from GitHub repo"** e escolha este
   repositório (autorize o Railway a acessar sua conta GitHub se pedir).
3. O Railway detecta o `railway.json` e builda automaticamente (Nixpacks: `npm install`
   → `npm run build` → `npm run start`).
4. Adicione o banco: no mesmo projeto, **"+ New" → "Database" → "Add PostgreSQL"**.
5. Configure as variáveis de ambiente do serviço do app (aba **"Variables"**):
   - `DATABASE_URL` → clique em **"+ New Variable" → "Add Reference"** e selecione a
     variável `DATABASE_URL` do serviço Postgres (fica algo como
     `${{Postgres.DATABASE_URL}}`) — assim não precisa copiar a senha manualmente.
   - `APP_ACCESS_TOKEN` → gere um valor aleatório (ex.: `openssl rand -hex 32` no seu
     terminal) e cole aqui.
   - `VITE_APP_ACCESS_TOKEN` → **o mesmo valor** de `APP_ACCESS_TOKEN` (o frontend
     precisa dele para autenticar as chamadas à API; como é embutido no build, mude os
     dois juntos e refaça o deploy se precisar trocar).
   - `ANTHROPIC_API_KEY` → sua chave da Anthropic (veja seção acima).
6. Clique em **"Deploy"** (ou dê um novo push na branch principal — o Railway reimplanta
   automaticamente a cada push, já que está conectado ao GitHub).
7. Em **"Settings" → "Networking"**, clique em **"Generate Domain"** para obter uma URL
   pública `https://seu-app.up.railway.app`.

A cada deploy, o comando `start` roda `prisma migrate deploy` antes de subir o servidor,
aplicando automaticamente qualquer migração nova do banco.

## Instalar o app no Android (PWA)

Com a URL do Railway publicada:

1. Abra a URL no **Chrome** do Android.
2. Toque no menu **⋮** (três pontinhos) → **"Instalar app"** (ou "Adicionar à tela
   inicial").
3. Confirme — o ícone do app aparece na tela inicial e abre em tela cheia, sem a barra do
   navegador, como um app nativo.

Como o app agora depende do backend/banco, ele **precisa de internet** para funcionar
(diferente de um PWA totalmente offline) — o service worker acelera o carregamento de
telas/imagens já visitadas, mas registrar treinos e consultar histórico sempre passam
pela API.

### Caminho opcional para a Google Play Store

Para publicar de fato na Play Store sem reescrever o app como nativo, empacote a URL do
Railway como **TWA (Trusted Web Activity)** usando o
[PWABuilder](https://www.pwabuilder.com/) ou o
[Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap) do Google, configure o
**Digital Asset Links** (`/.well-known/assetlinks.json`) apontando pro domínio do
Railway, assine o `.aab` gerado e publique no Google Play Console. Isso está fora do
escopo deste repositório (requer conta de desenvolvedor Google Play), mas o app já está
tecnicamente pronto pra esse empacotamento.

## Estrutura do projeto

```
scripts/fetch-exercises.ts    # ingestão de exercícios (free-exercise-db ou ExerciseDB)
scripts/translations-pt.ts    # dicionário de tradução EN -> PT-BR
scripts/gen-icons.mjs         # gera os ícones PNG do manifest
prisma/schema.prisma          # schema do banco (sessões, séries, PRs, objetivos)
server/index.ts               # servidor Express (API + build estático do frontend)
server/routes/                # sessions (treino/séries/resumo), goals, routine (IA)
src/data/exercises.json       # catálogo de exercícios consolidado
src/types/                    # Exercise, WorkoutSession, UserGoals, taxonomia de músculos
src/lib/api.ts                # cliente HTTP (fetch) do frontend para a API
src/lib/progression.ts        # cérebro de sobrecarga progressiva (RIR, dupla progressão)
src/lib/session.ts            # chamadas de sessão de treino/séries/resumo
src/lib/routine.ts            # rotina sugerida balanceada (regra fixa, fallback da IA)
src/lib/workout-context.tsx   # estado do treino em andamento: sessão, séries, timer global
src/components/MuscleMap.tsx  # mapa muscular SVG (heatmap)
src/components/ExerciseStrip.tsx     # tira de miniaturas — navegação livre entre exercícios
src/components/SetTable.tsx          # tabela de séries com check + linha de sugestão
src/components/PreviousSessionCard.tsx # referência completa da sessão anterior
src/components/RestTimer.tsx         # pill flutuante do descanso
src/components/WeekStrip.tsx         # tira Dom-Sáb decorativa (marca "hoje") na Home
src/lib/plans.ts              # cliente da API de planos (listar/criar/ativar/arquivar)
server/routes/plans.ts        # CRUD de planos: gerador IA ou regra fixa, activate/archive
src/screens/PlanWizardScreen.tsx # wizard de criação de plano (gerador vs. vazio → config → revisão)
src/screens/AllPlansScreen.tsx   # "Meus planos" — arquivar/reativar
src/screens/                  # Onboarding, Goals, Home, Player, Summary
```

---

## Roadmap — trazendo ideias do Alpha Progression

Em setembro/2026 o usuário revisou ~40 screenshots de um app concorrente ("Alpha
Progression", salvos em `design-reference/` — não entram no build) e pediu pra portar as
boas ideias de UX pro Maromba, aproximando ao máximo do visual/comportamento de lá dentro
da nossa paleta. Esta seção existe pra sobreviver a compactações de contexto: qualquer
sessão nova (ou o próprio usuário) deve conseguir retomar o trabalho só lendo aqui, sem
depender de memória de conversa.

### Itens combinados e status

- [x] **Timer de descanso em pill flutuante** (não bloqueia a tela; popover
  pausar/reiniciar fechando ao tocar fora sem interceptar o clique; conta negativo/estoura
  em vez de sumir).
- [x] **Navegação livre entre exercícios** — tira de miniaturas no topo (`ExerciseStrip`),
  toca em qualquer exercício a qualquer momento, sem exigir que o atual esteja concluído.
- [x] **Tabela de séries com check** (`SetTable`) — substitui wheel pickers soltos + botão
  "Registrar série" por linhas com checkmark; série já registrada é editável (toca, corrige,
  salva). Colunas mudam por exercício (`Kg` some em bodyweight).
- [x] **Avanço automático** — registrar a última série de um exercício pula pro próximo
  (por posição) sozinho; quando *todos* os exercícios da rotina batem a meta (checado por
  dados reais, não por posição na lista), o botão "Concluir treino" (largura cheia)
  substitui a pill.
- [x] **RIR em vez de RPE** — 0 a 5 em passos de 0.5 (era 1-10 inteiro). Migração
  `20260923204925_set_entry_rir` converteu os dados existentes (`rir = 10 - rpe`), não
  descartou.
- [x] **10RM por série** (coluna `10RM`) — fórmula de Epley (`oneRepMax.ts`,
  `estimateNRepMax`) normalizada pra 10 reps, comparável entre sessões mesmo quando as reps
  reais variam.
- [x] **Linha de sugestão de progressão** — dupla progressão (double progression: sobe reps
  dentro da faixa prescrita antes de subir peso), separada da linha padrão (que repete a
  última sessão), com motivo em texto e toque em "USAR" pra aplicar. Ver decisão sobre
  preferência por reps abaixo.
- [x] **Referência completa da sessão anterior** (`PreviousSessionCard`) — todas as séries
  da última vez, não só a de topo, mesmas colunas da tabela ativa.
- [x] **Plano multi-semana** — wizard de criação (`PlanWizardScreen`: escolha
  gerador IA vs. regra fixa → nº de rotinas + duração + toggles opcionais → revisão), tira
  semanal + "Semana X de Y" na Home, tela "Meus planos" (`AllPlansScreen`) com
  arquivar/reativar (só um plano ativo por vez, nunca perde os outros). Reaproveitou toda a
  infra que já existia (`WorkoutPlan`/`PlanRoutine`/`PlanExercise`, `/plan/active`) — só
  faltava o jeito de criar plano fora do chat do coach e a gestão de vários planos. Ver
  decisões sobre deload/periodização e consolidação de split abaixo.
- [ ] **Streaks/gamificação** (dias seguidos, contagem de treinos) — não iniciado.
- [ ] **Biblioteca de exercícios com vídeo/instruções passo-a-passo** — hoje só temos
  imagem estática (`ExerciseMedia`); Alpha tem vídeo em loop + texto de setup/execução.
- [ ] **Notificação OS-level "descanso concluído"** — gap real, nunca implementado. Ver
  decisão sobre Live Activity/AOD abaixo (bloqueado por infra nativa).
- [ ] **Gestão de equipamento ("My gym") como tela dedicada** — hoje só existe dentro do
  onboarding; Alpha permite editar a qualquer momento.

### Decisões de arquitetura registradas ao longo do caminho

- **O timer de descanso é do treino, não da tela do exercício.** Vive em
  `workout-context` (`restTimer: {seconds, key} | null`), não em estado local do
  `PlayerScreen`. Só **registrar uma série nova** cancela/reinicia (via remount por
  `key`); navegar entre exercícios pela tira nunca mexe nele — resolve um bug real do
  Alpha Progression (lá, a notificação de "descanso concluído" dispara errado porque o
  app só percebe que você mudou de série *depois do fato*, via checkbox). Isso também
  significa que o pill continua contando mesmo se você sair da tela do exercício que o
  disparou.
- **Progresso por exercício também é da sessão, não da tela.** `sessionSets` no
  `workout-context` (map `exerciseId -> SetEntry[]`) sobrevive à navegação — voltar pra um
  exercício já visitado mostra as séries certas, e a tira sabe quais exercícios já bateram
  a meta sem re-fetch.
- **RIR em vez de RPE**: as duas escalas medem a mesma coisa (a RPE de treino de força já é
  ancorada em reps-in-reserve), então a troca não é por "mais ciência" — é porque RIR é
  mais concreto pro usuário e é o que a referência usa.
- **Sugestão prefere reps a peso quando possível (dupla progressão)** — pedido explícito do
  usuário: ele treina em academia caseira, onde trocar peso (halteres fixos, poucas
  anilhas) dá mais trabalho que fazer mais 1-2 reps. `suggestNextLoad` só sobe peso quando
  a faixa de reps prescrita já foi batida no teto; confirmado que é método padrão da
  literatura ("double progression"), não uma simplificação.
- **Live Activity / Always-On-Display real não é alcançável só com PWA.** Investigado a
  pedido do usuário: tanto iOS (ActivityKit/WidgetKit) quanto o "Live Updates" do Android
  exigem código nativo (foreground service + notificação com progress bar — a Web
  Notifications API não tem isso). Caminho viável, se/quando o app for empacotado nativo
  (decisão já tomada antes: empacotar, não reescrever): plugin nativo pequeno (~150 linhas
  Kotlin) só pra essa notificação, resto continua sendo a mesma base web. Até lá, o gap
  fica só em "notificação pontual quando o descanso acaba" (nem isso foi implementado
  ainda).
- **Deload e periodização linear são calculados, não guardados por semana.** Só dois
  booleanos no `WorkoutPlan` (`deload`, `linearPeriodization`) — nenhuma cópia de
  `PlanExercise` por semana. `currentPlanWeek`/`applyWeekAdjustments`
  (`src/lib/prescription.ts`) derivam a prescrição efetiva da semana atual a partir da
  base + `activatedAt`, on-the-fly, toda vez que a Home monta os `RoutineItem[]` do plano.
  Deload é a cada 4 semanas (menos 1 série, RIR alvo sobe pra 4 — via
  `Prescription.deload`, que `suggestNextLoad` lê pra trocar de ramo inteiro em vez de
  tentar progredir). Periodização desliza a faixa de reps até 3 reps entre a semana 1 e a
  última do bloco. Os dois são opt-in na criação (pedido explícito do usuário depois de eu
  mostrar exemplos — ele achou "tentador" mas quis controle, não automático).
- **"Core" deixou de ser split isolado.** `WorkoutSplit` agora só tem
  `upper | lower | full`; todo split inclui `abs` + `obliques` em `SPLIT_MUSCLES`
  (`src/lib/routine.ts`) — todo treino de força carrega algum core junto, em vez de um dia
  dedicado só a isso. Confirmado por Playwright: rotina "Completo" gerada inclui
  "Barbell Ab Rollout" e "Barbell Leg Twist Press" (oblíquos) sem precisar de um split
  Core à parte.
- **Ativar um plano sempre arquiva o anterior, nunca deleta.** Mesma transação
  (`updateMany status=active→archived` + o novo vira `active`) usada tanto pra criar plano
  no wizard quanto pra reativar um arquivado (`POST /plans/:id/activate`) — status "core"
  são só `active`/`archived`, nunca removido de verdade.
- **Correção de série já registrada precisa de round-trip ao backend** —
  `PATCH /sessions/:id/sets/:setId` (`server/routes/sessions.ts`), reaproveitando a mesma
  lógica de recálculo de recorde pessoal do POST (extraída pra `maybeUpdatePR`). Editar um
  recorde pra baixo não "desfaz" o PR automaticamente (caso raro, fora de escopo).

---

## Ajustes para Versão Comercial

Esta versão inicial utiliza a base e CDN da ExerciseDB/WorkoutX para fins de prototipagem e uso pessoal. Caso o app seja lançado comercialmente ao público, os seguintes pontos estruturais de mídia devem ser ajustados:

1. **Licenciamento e Termos de Uso de Mídia:**
   - As assinaturas de desenvolvedor de APIs como ExerciseDB e WorkoutX possuem restrições contratuais para redistribuição comercial em massa. É necessário migrar para o tier enterprise ou adquirir licença comercial explícita.
2. **Hospedagem e CDN Própria (Self-Hosting):**
   - Não depender de URLs externas de terceiros para entrega dos GIFs/vídeos em produção.
   - Baixar todos os arquivos de mídia e hospedá-los em um bucket privado (ex: Cloudflare R2 ou AWS S3) conectado a uma CDN global (ex: Cloudflare/CloudFront), evitando quedas de serviço, quebra de links ou custos imprevisíveis de transferência externa.
3. **Propriedade Intelectual e Identidade Visual Única:**
   - Substituir os GIFs genéricos de terceiros por ativos proprietários:
     - Renderizações 3D anatômicas padronizadas (geradas internamente via Blender ou estúdios parceiros).
     - Ou gravação proprietária com atletas/modelos reais, garantindo direitos de imagem 100% controlados e eliminando qualquer risco de copyright de bibliotecas públicas.
4. **Otimização de Formatos de Vídeo:**
   - Converter todos os GIFs para formatos modernos e comprimidos (como WebM e MP4 H.264/H.265 em loop mudo), reduzindo o payload de rede em até 80% e melhorando a velocidade de carregamento em redes móveis.
