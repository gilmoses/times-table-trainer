import type { Card } from '../types'

const STORAGE_KEY = 'times-table-deck'

export function buildDeck(): Card[] {
  const cards: Card[] = []
  for (let a = 1; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      cards.push({ a, b, easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: Date.now() })
    }
  }
  return cards
}

export function loadDeck(): Card[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Card[]
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

// Prefer due cards; among them prefer least-practiced (fewest repetitions)
export function pickNextCard(cards: Card[], exclude?: Card): Card {
  const due = cards.filter(c => c.nextReview <= Date.now() && c !== exclude)
  const pool = due.length > 0 ? due : cards.filter(c => c !== exclude)
  const fallback = due.length > 0 ? due : cards

  if (pool.length === 0) return fallback[Math.floor(Math.random() * fallback.length)]

  pool.sort((a, b) => a.repetitions - b.repetitions)
  // pick randomly from the least-practiced third to avoid always repeating the same card
  const slice = pool.slice(0, Math.max(1, Math.ceil(pool.length / 3)))
  return slice[Math.floor(Math.random() * slice.length)]
}
