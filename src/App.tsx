import { useState } from 'react'
import { CardView } from './components/CardView'
import { loadDeck, saveDeck, resetDeck, pickNextCard } from './lib/cards'
import { updateCard } from './lib/sm2'
import type { Card } from './types'
import './App.css'

type Screen = 'playing' | 'quit'

const DEV = import.meta.env.DEV

export default function App() {
  const [screen, setScreen] = useState<Screen>('playing')
  const [deck, setDeck] = useState<Card[]>(() => loadDeck())
  const [current, setCurrent] = useState<Card>(() => pickNextCard(loadDeck()))
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)

  const [correctDelay, setCorrectDelay] = useState(1000)
  const [wrongDelay, setWrongDelay] = useState(2000)
  const [devOpen, setDevOpen] = useState(false)

  function handleResult(wasCorrect: boolean) {
    if (wasCorrect) setCorrect(c => c + 1)
    else setWrong(w => w + 1)

    const updatedCard = updateCard(current, wasCorrect)
    const newDeck = deck.map(c => (c.a === current.a && c.b === current.b) ? updatedCard : c)
    saveDeck(newDeck)
    setDeck(newDeck)
    setCurrent(pickNextCard(newDeck, updatedCard))
  }

  function handleQuit() {
    setScreen('quit')
  }

  function handleRestart() {
    setCorrect(0)
    setWrong(0)
    const deck = loadDeck()
    setCurrent(pickNextCard(deck))
    setScreen('playing')
  }

  function handleResetProgress() {
    const fresh = resetDeck()
    setDeck(fresh)
    setCorrect(0)
    setWrong(0)
    setCurrent(pickNextCard(fresh))
    setScreen('playing')
  }

  if (screen === 'quit') {
    const total = correct + wrong
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    return (
      <div className="app">
        <div className="quit-screen">
          <h1>סיום</h1>
          <p className="quit-score">✓ {correct} &nbsp; ✗ {wrong} &nbsp; ({pct}%)</p>
          <button className="btn-primary" onClick={handleRestart}>שחקו שוב</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1 className="title">לוח הכפל</h1>
        <button className="btn-quit" onClick={handleQuit}>עצור</button>
      </div>

      <div className="scoreboard">
        <span className="score correct">✓ {correct}</span>
        <span className="score wrong">✗ {wrong}</span>
      </div>

      <CardView
        card={current}
        onResult={handleResult}
        onStop={handleQuit}
        correctDelay={correctDelay}
        wrongDelay={wrongDelay}
      />

      {DEV && (
        <div className="dev-panel">
          <button className="dev-toggle" onClick={() => setDevOpen(o => !o)}>
            {devOpen ? '▾' : '▸'} Dev
          </button>
          {devOpen && (
            <div className="dev-controls">
              <div className="dev-sm2">
                <span className="dev-sm2-title">SM-2 — {current.a} × {current.b}</span>
                <span>repetitions <b>{current.repetitions}</b></span>
                <span>interval <b>{current.interval}d</b></span>
                <span>easeFactor <b>{current.easeFactor.toFixed(2)}</b></span>
                <span>next review <b>{current.interval === 0 ? 'now' : new Date(current.nextReview).toLocaleDateString()}</b></span>
              </div>
              <label>
                Correct delay (ms)
                <input type="number" value={correctDelay} min={0} step={100}
                  onChange={e => setCorrectDelay(Number(e.target.value))} />
              </label>
              <label>
                Wrong delay (ms)
                <input type="number" value={wrongDelay} min={0} step={100}
                  onChange={e => setWrongDelay(Number(e.target.value))} />
              </label>
              <button className="dev-btn-reset" onClick={handleResetProgress}>
                Reset progress
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
