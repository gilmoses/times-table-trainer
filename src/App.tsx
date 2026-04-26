import { useState, useEffect } from 'react'
import { CardView } from './components/CardView'
import { loadDeck, saveDeck, resetDeck, pickNextCard } from './lib/cards'
import { updateCard } from './lib/sm2'
import { DECK_COLORS, DECK_TEXT } from './lib/colors'
import { voiceSupported } from './hooks/useVoiceInput'
import type { Card } from './types'
import './App.css'

type Screen = 'menu' | 'playing' | 'quit' | 'race-results'

const DEV = import.meta.env.DEV
const DEV_SETTINGS_KEY = 'times-table-dev'
const SETTINGS_KEY = 'times-table-settings'
const BEST_SCORES_KEY = 'times-table-best'
const TABLE_DECKS = [2, 3, 4, 5, 6, 7, 8, 9]
const RACE_DURATIONS = [30, 60, 120]

// ── dev settings ────────────────────────────────────────────────────────────

interface DevSettings {
  correctDelay: number
  wrongDelay: number
  revealDuration: number
  timeLimitEnabled: boolean
  timeLimit: number
}

function loadDevSettings(): DevSettings {
  const defaults: DevSettings = { correctDelay: 1000, wrongDelay: 800, revealDuration: 3000, timeLimitEnabled: false, timeLimit: 10 }
  try {
    const raw = localStorage.getItem(DEV_SETTINGS_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaults
}

// ── user settings ────────────────────────────────────────────────────────────

interface UserSettings {
  micEnabled: boolean
  raceModeEnabled: boolean
  raceDuration: number
}

function loadSettings(): UserSettings {
  const defaults: UserSettings = { micEnabled: true, raceModeEnabled: false, raceDuration: 30 }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaults
}

// ── best scores ──────────────────────────────────────────────────────────────

function bestScoreKey(deckFilter: number | null, duration: number) {
  return `${deckFilter ?? 'full'}-${duration}`
}

function loadBestScore(deckFilter: number | null, duration: number): number {
  try {
    const raw = localStorage.getItem(BEST_SCORES_KEY)
    if (raw) return (JSON.parse(raw) as Record<string, number>)[bestScoreKey(deckFilter, duration)] ?? 0
  } catch { /* ignore */ }
  return 0
}

function saveBestScore(deckFilter: number | null, duration: number, score: number) {
  try {
    const raw = localStorage.getItem(BEST_SCORES_KEY)
    const scores = raw ? JSON.parse(raw) as Record<string, number> : {}
    const key = bestScoreKey(deckFilter, duration)
    if (score > (scores[key] ?? 0)) {
      scores[key] = score
      localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(scores))
    }
  } catch { /* ignore */ }
}

// ── component ────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [deck, setDeck] = useState<Card[]>(() => loadDeck())
  const [deckFilter, setDeckFilter] = useState<number | null>(null)
  const [current, setCurrent] = useState<Card>(() => pickNextCard(loadDeck()))
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [sessionErrors, setSessionErrors] = useState<Record<string, number>>({})
  const [sessionTimes, setSessionTimes] = useState<number[]>([])

  // user settings
  const [micEnabled, setMicEnabled] = useState(() => loadSettings().micEnabled)
  const [raceModeEnabled, setRaceModeEnabled] = useState(() => loadSettings().raceModeEnabled)
  const [raceDuration, setRaceDuration] = useState(() => loadSettings().raceDuration)
  const [raceTimeLeft, setRaceTimeLeft] = useState(0)

  // dev settings
  const [correctDelay, setCorrectDelay] = useState(() => loadDevSettings().correctDelay)
  const [wrongDelay, setWrongDelay] = useState(() => loadDevSettings().wrongDelay)
  const [revealDuration, setRevealDuration] = useState(() => loadDevSettings().revealDuration)
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(() => loadDevSettings().timeLimitEnabled)
  const [timeLimit, setTimeLimit] = useState(() => loadDevSettings().timeLimit)
  const [devOpen, setDevOpen] = useState(false)

  // persist user settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ micEnabled, raceModeEnabled, raceDuration }))
  }, [micEnabled, raceModeEnabled, raceDuration])

  // persist dev settings
  useEffect(() => {
    if (!DEV) return
    localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify({ correctDelay, wrongDelay, revealDuration, timeLimitEnabled, timeLimit }))
  }, [correctDelay, wrongDelay, revealDuration, timeLimitEnabled, timeLimit])

  // race timer countdown
  useEffect(() => {
    if (screen !== 'playing' || !raceModeEnabled) return
    setRaceTimeLeft(raceDuration)
    const iv = setInterval(() => setRaceTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(iv)
  }, [screen, raceModeEnabled, raceDuration])

  // end race when timer hits zero
  useEffect(() => {
    if (screen !== 'playing' || !raceModeEnabled || raceTimeLeft > 0) return
    saveBestScore(deckFilter, raceDuration, correct)
    setScreen('race-results')
  }, [raceTimeLeft, correct, screen, raceModeEnabled, deckFilter, raceDuration])

  // ── helpers ──────────────────────────────────────────────────────────────

  function activeCards(d: Card[], filter: number | null) {
    return filter === null ? d : d.filter(c => c.a === filter)
  }

  function handleStartDeck(filter: number | null) {
    const d = loadDeck()
    setDeckFilter(filter)
    setCorrect(0)
    setWrong(0)
    setSessionErrors({})
    setSessionTimes([])
    setCurrent(pickNextCard(activeCards(d, filter)))
    setScreen('playing')
  }

  function handleResult(wasCorrect: boolean, timeMs: number) {
    const key = `${current.a}x${current.b}`
    const newErrors = wasCorrect
      ? sessionErrors
      : { ...sessionErrors, [key]: (sessionErrors[key] ?? 0) + 1 }

    setSessionTimes(prev => [...prev, timeMs])
    if (wasCorrect) setCorrect(c => c + 1)
    else { setWrong(w => w + 1); setSessionErrors(newErrors) }

    const updatedCard = updateCard(current, wasCorrect)
    const newDeck = deck.map(c => (c.a === current.a && c.b === current.b) ? updatedCard : c)
    saveDeck(newDeck)
    setDeck(newDeck)
    setCurrent(pickNextCard(activeCards(newDeck, deckFilter), updatedCard, newErrors))
  }

  function handleQuit() {
    if (raceModeEnabled) {
      saveBestScore(deckFilter, raceDuration, correct)
      setScreen('race-results')
    } else {
      setScreen('quit')
    }
  }

  function handleRestart() {
    const d = loadDeck()
    setCorrect(0)
    setWrong(0)
    setSessionErrors({})
    setSessionTimes([])
    setCurrent(pickNextCard(activeCards(d, deckFilter)))
    setScreen('playing')
  }

  function handleBackToMenu() {
    setScreen('menu')
  }

  function handleResetProgress() {
    const fresh = resetDeck()
    setDeck(fresh)
    setCorrect(0)
    setWrong(0)
    setSessionErrors({})
    setSessionTimes([])
    setCurrent(pickNextCard(activeCards(fresh, deckFilter)))
    setScreen('playing')
  }

  // ── screens ───────────────────────────────────────────────────────────────

  if (screen === 'menu') {
    return (
      <div className="app">
        <div className="menu-screen">
          <h1 className="title">לוח הכפל</h1>
          <p className="menu-subtitle">בחרו לוח</p>
          <div className="deck-grid">
            {TABLE_DECKS.map(n => (
              <button
                key={n}
                className="btn-deck"
                style={{ background: DECK_COLORS[n], color: DECK_TEXT[n] }}
                onClick={() => handleStartDeck(n)}
              >
                {n}×
              </button>
            ))}
          </div>
          <button className="btn-full-deck" onClick={() => handleStartDeck(null)}>
            כל הלוח
          </button>

          <div className="menu-settings">
            {voiceSupported && (
              <div className="setting-row">
                <span className="setting-label">🎤 מיקרופון</span>
                <button
                  className={`toggle-pill${micEnabled ? ' on' : ''}`}
                  onClick={() => setMicEnabled(m => !m)}
                />
              </div>
            )}
            <div className="setting-row">
              <span className="setting-label">⏱ מרוץ</span>
              <button
                className={`toggle-pill${raceModeEnabled ? ' on' : ''}`}
                onClick={() => setRaceModeEnabled(m => !m)}
              />
            </div>
            {raceModeEnabled && (
              <div className="race-duration-row">
                {RACE_DURATIONS.map(s => (
                  <button
                    key={s}
                    className={`btn-duration${raceDuration === s ? ' active' : ''}`}
                    onClick={() => setRaceDuration(s)}
                  >
                    {s >= 60 ? `${s / 60}′` : `${s}″`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'quit') {
    const total = correct + wrong
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    const avgSec = sessionTimes.length > 0
      ? parseFloat((sessionTimes.reduce((a, b) => a + b, 0) / sessionTimes.length / 1000).toFixed(1))
      : null
    return (
      <div className="app">
        <div className="quit-screen">
          <h1>סיום</h1>
          <p className="quit-score">✓ {correct} &nbsp; ✗ {wrong} &nbsp; ({pct}%)</p>
          {avgSec !== null && <p className="quit-stat">זמן ממוצע: {avgSec} שניות</p>}
          <button className="btn-primary" onClick={handleRestart}>שחקו שוב</button>
          <button className="btn-secondary" onClick={handleBackToMenu}>בחרו לוח</button>
        </div>
      </div>
    )
  }

  if (screen === 'race-results') {
    const prev = loadBestScore(deckFilter, raceDuration)
    const isNewBest = correct > 0 && correct >= prev
    return (
      <div className="app">
        <div className="quit-screen">
          <h1>סיום המרוץ!</h1>
          <p className="quit-score">✓ {correct} &nbsp; ✗ {wrong}</p>
          {isNewBest
            ? <p className="quit-stat best">🏆 שיא חדש!</p>
            : prev > 0 && <p className="quit-stat">שיא: {prev}</p>
          }
          <button className="btn-primary" onClick={handleRestart}>שחקו שוב</button>
          <button className="btn-secondary" onClick={handleBackToMenu}>בחרו לוח</button>
        </div>
      </div>
    )
  }

  // playing screen
  const raceBarPct = raceModeEnabled ? (raceTimeLeft / raceDuration) * 100 : 0
  const raceUrgent = raceModeEnabled && raceTimeLeft <= 5

  return (
    <div className="app">
      <div className="topbar">
        <h1 className="title">{deckFilter !== null ? `${deckFilter}×` : 'לוח הכפל'}</h1>
        {voiceSupported && (
          <button
            className={`btn-icon${micEnabled ? '' : ' muted'}`}
            onClick={() => setMicEnabled(m => !m)}
            title={micEnabled ? 'כבה מיקרופון' : 'הפעל מיקרופון'}
          >
            {micEnabled ? '🎤' : '🔇'}
          </button>
        )}
        <button className="btn-quit" onClick={handleQuit}>עצור</button>
      </div>

      {raceModeEnabled && (
        <div className="race-timer">
          <div className="race-bar-track">
            <div
              className={`race-bar-fill${raceUrgent ? ' urgent' : ''}`}
              style={{ width: `${raceBarPct}%` }}
            />
          </div>
          <span className={`race-time${raceUrgent ? ' urgent' : ''}`}>{raceTimeLeft}</span>
        </div>
      )}

      <div className="scoreboard">
        <span className="score correct">✓ {correct}</span>
        <span className="score wrong">✗ {wrong}</span>
      </div>

      <CardView
        card={current}
        onResult={handleResult}
        onStop={handleQuit}
        micEnabled={micEnabled}
        correctDelay={correctDelay}
        wrongDelay={wrongDelay}
        revealDuration={revealDuration}
        timeLimitEnabled={timeLimitEnabled}
        timeLimit={timeLimit}
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
              <label>
                Reveal duration (ms)
                <input type="number" value={revealDuration} min={500} step={500}
                  onChange={e => setRevealDuration(Number(e.target.value))} />
              </label>
              <label className="dev-label-row">
                <input type="checkbox" checked={timeLimitEnabled}
                  onChange={e => setTimeLimitEnabled(e.target.checked)} />
                Time limit
              </label>
              {timeLimitEnabled && (
                <label>
                  Limit (s)
                  <input type="number" value={timeLimit} min={3} max={60} step={1}
                    onChange={e => setTimeLimit(Number(e.target.value))} />
                </label>
              )}
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
