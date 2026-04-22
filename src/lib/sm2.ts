import type { Card } from '../types'

// SM-2 algorithm: correct = quality 4, wrong = quality 1
export function updateCard(card: Card, correct: boolean): Card {
  const quality = correct ? 4 : 1
  let { easeFactor, interval, repetitions } = card

  if (quality >= 3) {
    if (repetitions === 0)      interval = 1
    else if (repetitions === 1) interval = 6
    else                        interval = Math.round(interval * easeFactor)
    repetitions += 1
  } else {
    repetitions = 0
    interval = 1
  }

  easeFactor = Math.max(1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  )

  return {
    ...card,
    easeFactor,
    interval,
    repetitions,
    nextReview: Date.now() + interval * 24 * 60 * 60 * 1000,
  }
}
