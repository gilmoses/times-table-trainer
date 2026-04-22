import { useState } from 'react'
import { CardView } from './components/CardView'
import { buildDeck, pickNextCard } from './lib/cards'
import type { Card } from './types'
import './App.css'

type Screen = 'playing' | 'quit'

const DEV = import.meta.env.DEV

export default function App() {
  const [screen, setScreen] = useState<Screen>('playing')
  const [deck] = useState<Card[]>(() => buildDeck())
  const [current, setCurrent] = useState<Card>(() => pickNextCard(buildDeck()))
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)

  // dev controls
  const [correctDelay, setCorrectDelay] = useState(1000)
  const [wrongDelay, setWrongDelay] = useState(2000)
  const [devOpen, setDevOpen] = useState(false)

  function handleResult(wasCorrect: boolean) {
    if (wasCorrect) setCorrect(c => c + 1)
    else setWrong(w => w + 1)
    setCurrent(pickNextCard(deck))
  }

  function handleQuit() {
    setScreen('quit')
  }

  function handleRestart() {
    setCorrect(0)
    setWrong(0)
    setCurrent(pickNextCard(buildDeck()))
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
          <button className="btn-primary" onClick={handleRestart}>שחק שוב</button>
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
              <label>
                Correct delay (ms)
                <input
                  type="number"
                  value={correctDelay}
                  min={0}
                  step={100}
                  onChange={e => setCorrectDelay(Number(e.target.value))}
                />
              </label>
              <label>
                Wrong delay (ms)
                <input
                  type="number"
                  value={wrongDelay}
                  min={0}
                  step={100}
                  onChange={e => setWrongDelay(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
