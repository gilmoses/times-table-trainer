import type { Card } from '../types'

export function buildDeck(): Card[] {
  const cards: Card[] = []
  for (let a = 1; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      cards.push({
        a,
        b,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: Date.now(),
      })
    }
  }
  return cards
}

export function pickNextCard(cards: Card[]): Card {
  const due = cards.filter(c => c.nextReview <= Date.now())
  const pool = due.length > 0 ? due : cards
  return pool[Math.floor(Math.random() * pool.length)]
}
