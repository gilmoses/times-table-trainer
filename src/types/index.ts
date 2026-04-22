export interface Card {
  a: number
  b: number
  easeFactor: number  // SM-2: starts at 2.5
  interval: number    // days until next review
  repetitions: number
  nextReview: number  // timestamp
}

export interface PlayerState {
  name: string
  cards: Card[]
  sessionCorrect: number
  sessionWrong: number
  streak: number
}
