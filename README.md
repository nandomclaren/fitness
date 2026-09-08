# Sobrecarga — Treino de Musculação e Sobrecarga Progressiva

Um personal trainer digital, agnóstico de ecossistema, para rastrear cargas, sugerir
progressão de carga automaticamente e mostrar um resumo pós-treino com mapa muscular
anatômico. Roda inteiramente no navegador, funciona offline (PWA) e é otimizado tanto
para celular quanto para projeção em telas grandes (Android TV / Apple TV / Mac via
espelhamento).

## Stack

- **Vite + React + TypeScript** — SPA local-first, sem backend.
- **Tailwind CSS v4** — estilização utilitária, tema escuro de alto contraste.
- **Lucide Icons** — ícones.
- **Dexie.js (IndexedDB)** — persistência offline do histórico de treinos, séries e
  recordes pessoais.
- **react-router-dom** — navegação entre as 3 telas do app.
- **vite-plugin-pwa** — manifest + service worker (instalação e uso 100% offline).

## Como rodar

```bash
npm install
npm run dev       # ambiente de desenvolvimento
npm run build     # build de produção em dist/
npm run preview   # servir o build de produção localmente
npm run lint       # oxlint
```

## Base de dados de exercícios

O app **nunca** faz chamadas de API durante a execução do treino: toda a biblioteca de
exercícios é consolidada previamente em `src/data/exercises.json` por um script de
ingestão (`scripts/fetch-exercises.ts`).

### Fonte padrão (sem necessidade de chave)

Por padrão, o script usa a **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)**,
uma base aberta (domínio público) com centenas de exercícios de musculação, já filtrada
para as categorias de força (`strength`, `powerlifting`, `strongman`,
`olympic weightlifting`) e normalizada para o schema interno do app:

```bash
npm run fetch-exercises
```

### Fonte ExerciseDB (RapidAPI) — biblioteca com GIFs animados

Para usar a **ExerciseDB**, que fornece GIFs animados reais de execução (em vez das duas
fotos estáticas do free-exercise-db), é necessário uma chave gratuita da RapidAPI:

1. Crie uma conta em [rapidapi.com](https://rapidapi.com).
2. Acesse a página da [ExerciseDB API](https://rapidapi.com/exercisedb/api/exercisedb) e
   clique em **"Subscribe to Test"**, escolhendo o plano **Basic (gratuito)**.
3. Na aba **Endpoints**, copie sua `X-RapidAPI-Key` (painel de "Code Snippets").
4. Rode o script apontando para essa fonte:

```bash
RAPIDAPI_KEY=sua_chave_aqui npm run fetch-exercises -- --source=exercisedb
```

O script pagina automaticamente por toda a base, normaliza os nomes de músculos para a
taxonomia interna (`src/types/muscle.ts`) e sobrescreve `src/data/exercises.json`. **Não
compartilhe sua chave em repositórios públicos** — rode o comando localmente ou configure
a variável de ambiente em um `.env` (já ignorado pelo `.gitignore`).

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

1. **Tela Inicial** — escolha **Superior**, **Inferior** ou **Completo**; o app monta uma
   rotina sugerida balanceada (um exercício-âncora por grupo muscular do split, priorizando
   barra/halteres/máquina), que pode ser livremente ajustada (adicionar/remover
   exercícios).
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

## PWA e caminho para a Google Play Store

O app já é um **PWA instalável** (manifest + service worker com cache offline dos GIFs de
exercício via `vite-plugin-pwa`). Para publicar na Google Play Store sem reescrever o app
como nativo, o caminho recomendado é empacotar como **TWA (Trusted Web Activity)**:

1. Hospede o build (`npm run build` → `dist/`) em um domínio HTTPS público.
2. Use o [PWABuilder](https://www.pwabuilder.com/) ou o
   [Bubblewrap CLI](https://github.com/GoogleChromeLabs/bubblewrap) do Google para gerar o
   projeto Android/TWA a partir da URL do PWA.
3. Configure o **Digital Asset Links** (`/.well-known/assetlinks.json`) no seu domínio para
   vincular o app ao pacote Android e habilitar a experiência em tela cheia sem barra de
   navegador.
4. Assine o `.aab` gerado e publique no Google Play Console.

Isso está fora do escopo deste repositório (requer domínio próprio e conta de
desenvolvedor Google Play), mas o app já está pronto tecnicamente para esse empacotamento.

## Estrutura do projeto

```
scripts/fetch-exercises.ts   # ingestão de exercícios (free-exercise-db ou ExerciseDB)
scripts/translations-pt.ts   # dicionário de tradução EN -> PT-BR
scripts/gen-icons.mjs        # gera os ícones PNG do manifest
src/data/exercises.json      # base de exercícios consolidada (offline)
src/types/                   # Exercise, WorkoutSession, taxonomia de músculos
src/lib/db.ts                # schema Dexie/IndexedDB
src/lib/progression.ts       # cérebro de sobrecarga progressiva
src/lib/session.ts           # sessão de treino, séries, PRs, resumo
src/lib/routine.ts           # geração da rotina sugerida
src/components/MuscleMap.tsx # mapa muscular SVG (heatmap)
src/screens/                 # HomeScreen, PlayerScreen, SummaryScreen
```

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
