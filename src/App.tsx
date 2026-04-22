import { useState } from 'react'
import { CardView } from './components/CardView'
import { buildDeck, pickNextCard } from './lib/cards'
import type { Card } from './types'
import './App.css'

const initialDeck = buildDeck()

export default function App() {
  const [deck] = useState<Card[]>(initialDeck)
  const [current, setCurrent] = useState<Card>(() => pickNextCard(initialDeck))
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)

  function handleResult(wasCorrect: boolean) {
    if (wasCorrect) setCorrect(c => c + 1)
    else setWrong(w => w + 1)
    setCurrent(pickNextCard(deck))
  }

  return (
    <div className="app">
      <h1 className="title">לוח הכפל</h1>
      <div className="scoreboard">
        <span className="score correct">✓ {correct}</span>
        <span className="score wrong">✗ {wrong}</span>
      </div>
      <CardView card={current} onResult={handleResult} />
    </div>
  )
}
