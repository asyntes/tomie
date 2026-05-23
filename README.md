# Tomie

Interactive AI terminal interface built with Next.js and React. Tomie is a character powered by xAI Grok: she replies in a retro terminal UI with distinct moods, each with its own personality, colors, and eye expressions.

## Features

- **Mood-based responses** — Five emotional states with dedicated prompts and visuals
- **Gradual mood transitions** — Approaching / cooling phases; UI changes only when thresholds are met
- **LLM-only mood detection** — No regex or word lists on user input in TypeScript; Grok emits `[MOOD:emotion]` and a state machine counts repeated tags
- **Tone vs tag separation** — Speaking style follows `responseMood`; the tag reflects user input tendency
- **Single API call per message** — One Grok request per user turn (transition system intro when mood changes)
- **Terminal aesthetic** — Typing animation, custom cursor, mood-themed styling, short glitch/interference burst on mood change (~0.5s, plays once)
- **Built-in commands** — `/clear`, `/help`, `/repo`, `/privacy`
- **i18n** — Italian and English (browser language detection)

## Mood states

| Mood | Theme | Typical trigger (via `[MOOD:]` tags) |
|------|-------|--------------------------------------|
| **Neutral** | Blue | Normal chat, factual questions |
| **Angry** | Red | Sustained hostility (2 tags) |
| **Romantic** | Purple | Explicit flirt / love (3 tags; slowest to enter) |
| **Excited** | Orange | Enthusiasm (2 tags) |
| **Confused** | Green | Unclear or lost user (2 tags) |

Each mood has unique colors, SVG eyes, and prompt personality definitions in `src/app/services/ai/prompts/`.

## How mood transitions work

Logic lives in [`src/app/core/moodStateMachine.ts`](src/app/core/moodStateMachine.ts). Configuration: `MOOD_TRANSITION_CONFIG`.

```mermaid
stateDiagram-v2
    [*] --> neutral
    neutral --> approaching: first non-neutral [MOOD:] tag
    approaching --> angry: threshold reached (2x hostile tags; romantic 3x)
    approaching --> neutral: neutral tag decays progress
    angry --> cooling: first [MOOD:neutral]
    cooling --> neutral: exit threshold reached
```

| Phase | Visual UI | Behavior |
|-------|-----------|----------|
| **Stable** | Current mood colors/eyes | Normal replies for `currentMood` |
| **Approaching** | Unchanged | Prompt hints at pending mood; `responseMood` stays on current mood |
| **Transition** | Glitch + intro line | Full new personality; `responseMood` switches |
| **Cooling** | Unchanged | Leaving a non-neutral mood toward neutral |

### Thresholds

| Direction | All moods (angry, romantic, excited, confused) |
|-----------|--------------------------------------------------|
| Enter (from neutral) | 2 tags (angry, excited, confused); **3 tags** for romantic |
| Exit (to neutral) | 2 consecutive `[MOOD:neutral]` tags |

**Important:** Progress uses only `detectedMood` from the API (parsed from `[MOOD:…]` in Grok’s reply). If the UI stays on neutral, inspect the `/api/grok` response — the model may be tagging `[MOOD:neutral]` too often.

Mismatch handling: a `[MOOD:neutral]` tag while approaching decays progress gradually (no hard reset).

### Trying moods manually

After `/clear`, send **two messages in a row** with the same emotional tone. The first starts **approaching** (UI unchanged); the second completes the transition (glitch + new colors).

| Target mood | Example inputs (×2) |
|-------------|---------------------|
| Excited | `WOW è INCREDIBILE!!!` |
| Confused | `Non capisco cosa intendi` |
| Romantic | 3 explicit flirt/love messages in a row |
| Angry | Sustained hostility / insults |

## Environment variables

Create `.env.local`:

```bash
XAI_API_KEY=your_xai_api_key_here
XAI_MODEL=grok-4.20-0309-non-reasoning
```

| Variable | Required | Description |
|----------|----------|-------------|
| `XAI_API_KEY` | Yes | xAI API key from [console.x.ai](https://console.x.ai) |
| `XAI_MODEL` | No | Chat model id (default: `grok-4.20-0309-non-reasoning`) |

If the API returns a model error, set `XAI_MODEL` to a model enabled for your team in the xAI console.

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/asyntes/tomie.git
cd tomie
npm install
```

Copy env vars into `.env.local` (see above), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm test` | Vitest — state machine, mood tag parser, scenarios |
| `npm run test:eval` | Optional LLM-as-judge evals (see below) |

### Optional LLM evals

Integration-style checks with Grok as judge (costs API tokens):

```bash
RUN_LLM_EVALS=1 npm run test:eval
```

Requires `XAI_API_KEY`. Evals live in `src/app/evals/*.eval.ts`.

## Architecture

### Mood pipeline (per user message)

```
TomieTerminal
  → responseHandler.generateFullResponse
      → moodStateMachine.previewTurn(state)     # pick responseMood for this turn
      → POST /api/grok                          # GrokService + PromptGenerator
      → moodDetector.extractMoodFromResponse    # [MOOD:] → detectedMood
      → moodStateMachine.commitTurn(state, tag) # update progress / transition
  → UI: brief interference (~550ms) + setMoodState if shouldChangeMood
```

### Key files

| Path | Role |
|------|------|
| [`src/app/core/moodStateMachine.ts`](src/app/core/moodStateMachine.ts) | Thresholds, approaching/cooling, `previewTurn` / `commitTurn` |
| [`src/app/core/moodSignalResolver.ts`](src/app/core/moodSignalResolver.ts) | Maps model tag → state machine signal (no input parsing) |
| [`src/app/core/responseHandler.ts`](src/app/core/responseHandler.ts) | One fetch per message, intro on transition |
| [`src/app/core/normalizeMoodState.ts`](src/app/core/normalizeMoodState.ts) | Safe state shape after hot reload |
| [`src/app/core/stateManager.ts`](src/app/core/stateManager.ts) | Initial state + thin wrapper over `commitTurn` |
| [`src/app/services/ai/grokService.ts`](src/app/services/ai/grokService.ts) | xAI client, model from env |
| [`src/app/services/ai/promptGenerator.ts`](src/app/services/ai/promptGenerator.ts) | System prompt: `responseMood`, approaching, tag rules |
| [`src/app/services/ai/moodDetector.ts`](src/app/services/ai/moodDetector.ts) | Parse and strip `[MOOD:…]` |
| [`src/app/services/ai/prompts/moodPersonalities.ts`](src/app/services/ai/prompts/moodPersonalities.ts) | Personalities + tag guidelines for the model |
| [`src/app/components/TomieTerminal/TomieTerminal.tsx`](src/app/components/TomieTerminal/TomieTerminal.tsx) | UI, typing, mood visuals |

### Tests

| Path | Type |
|------|------|
| `src/app/core/__tests__/moodStateMachine.test.ts` | Unit — thresholds, approaching, decay |
| `src/app/core/__tests__/moodTransitionScenarios.test.ts` | Unit — multi-turn tag sequences |
| `src/app/services/ai/__tests__/moodDetector.test.ts` | Unit — tag parsing |
| `src/app/evals/moodJudge.eval.ts` | Optional LLM judge |

## Commands

- `/clear` — Clear terminal and reset mood state
- `/help` — Command list
- `/repo` — Open GitHub repo
- `/privacy` — Privacy policy

## Technology stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- OpenAI SDK → xAI endpoint (`https://api.x.ai/v1`)
- Vitest
- Custom i18n (`src/app/i18n/`)

## AI prompts

- **Personalities** — Per-mood voice in `moodPersonalities.ts`
- **Tag rules** — Mandatory `[MOOD:]` on every reply; guidelines + examples teach Grok when to use each tag (not runtime keyword matching)
- **Language** — Replies match user language (IT/EN)
- **Approaching** — Subtle tone shift + hint to keep tagging the pending mood when the user continues the same tone
- **Tone vs tag** — Response text uses `responseMood`; the tag labels user input only

## Project structure (summary)

```
src/app/
├── api/grok/route.ts          # API route
├── components/TomieTerminal/  # Main UI
├── core/                      # State machine, response handler, mood config
├── services/ai/               # Grok, prompts, mood tag parsing
├── types/                     # Mood, AI, message types
└── i18n/                      # en.json, it.json
```

## License

MIT License
