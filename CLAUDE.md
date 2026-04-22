# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite HMR)
npm run build     # tsc type-check + Vite production build
npm run lint      # ESLint
npm run preview   # serve the dist/ build locally
```

No test runner is configured.

## Architecture

**Stack:** React 19 + TypeScript + Vite. No state management library — plain `useState`/`useEffect`.

**App.tsx** is the top-level shell. It owns the deck state, session scores, and screen routing (`playing` | `quit`). It calls `pickNextCard` after each answer and persists the updated deck via `saveDeck`. A `DEV`-gated panel exposes SM-2 stats and delay controls.

**CardView.tsx** handles a single card interaction: renders the question, accepts typed or spoken answers, shows feedback, and auto-advances after a configurable delay. It receives `onResult(wasCorrect)` and `onStop()` callbacks from App — it never touches the deck directly.

**lib/cards.ts** — deck lifecycle: `buildDeck` (144 cards, 1–12 × 1–12), `loadDeck`/`saveDeck` (localStorage key `times-table-deck`), `resetDeck`, and `pickNextCard`. The picker prefers due cards, then among them picks from the least-practiced third to avoid repetition.

**lib/sm2.ts** — pure SM-2 implementation. `updateCard(card, correct)` maps correct → quality 4, wrong → quality 1, and returns an updated `Card` with new `easeFactor`, `interval`, `repetitions`, and `nextReview` timestamp.

**hooks/useVoiceInput.ts** — wraps the Web Speech API (`he-IL`). Continuously restarts recognition while `active` is true. On each result it tries up to 5 alternatives: calls `onRaw` with the first transcript (used for stop-command detection), then calls `onNumber` with the first alternative that `parseHebrewNumber` can resolve.

**lib/hebrewNumbers.ts** — builds a static lookup table at module load covering all Hebrew number phrases for 1–144 (the full range of 12×12 products), plus plain digit strings for when the Speech API returns numerals.

## Key types

```ts
interface Card {
  a: number; b: number
  easeFactor: number   // SM-2, starts 2.5
  interval: number     // days
  repetitions: number
  nextReview: number   // ms timestamp
}
```

`PlayerState` is defined in `types/index.ts` but not yet wired up — it's scaffolding for a future multi-player or profile feature.

## UI language

All user-facing strings are in Hebrew. The app is RTL. Voice input uses `he-IL`. Stop commands recognised by CardView: `סטופ`, `עצור`, `הפסק`, `stop`.
