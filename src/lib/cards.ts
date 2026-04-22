import type { Card } from '../types'

const STORAGE_KEY = 'times-table-deck'

export function buildDeck(): Card[] {
  const cards: Card[] = []
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      cards.push({ a, b, easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: Date.now() })
    }
  }
  return cards
}

export function loadDeck(): Card[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Card[]
      const valid = parsed.filter(c => c.a >= 1 && c.a <= 10 && c.b >= 1 && c.b <= 10)
      if (valid.length === 100) return valid
      // Merge valid SM-2 state into a fresh deck (migrates old 12×12 saves)
      const fresh = buildDeck()
      const lookup = new Map(valid.map(c => [`${c.a}x${c.b}`, c]))
      return fresh.map(c => lookup.get(`${c.a}x${c.b}`) ?? c)
    }
  } catch { /* ignore */ }
  return buildDeck()
}

export function saveDeck(cards: Card[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function resetDeck(): Card[] {
  const deck = buildDeck()
  saveDeck(deck)
  return deck
}

// Prefer due cards; session errors weight wrong-answer cards higher within the pool
export function pickNextCard(cards: Card[], exclude?: Card, sessionErrors?: Record<string, number>): Card {
  const due = cards.filter(c => c.nextReview <= Date.now() && c !== exclude)
  const pool = due.length > 0 ? due : cards.filter(c => c !== exclude)
  const fallback = due.length > 0 ? due : cards

  if (pool.length === 0) return fallback[Math.floor(Math.random() * fallback.length)]

  const key = (c: Card) => `${c.a}x${c.b}`
  const hasErrors = sessionErrors && Object.values(sessionErrors).some(v => v > 0)

  if (hasErrors) {
    const weighted: Card[] = []
    for (const card of pool) {
      const errors = sessionErrors![key(card)] ?? 0
      const weight = 1 + errors * 3
      for (let i = 0; i < weight; i++) weighted.push(card)
    }
    return weighted[Math.floor(Math.random() * weighted.length)]
  }

  // No session errors yet: prefer least-practiced third to avoid repeating the same card
  pool.sort((a, b) => a.repetitions - b.repetitions)
  const slice = pool.slice(0, Math.max(1, Math.ceil(pool.length / 3)))
  return slice[Math.floor(Math.random() * slice.length)]
}
