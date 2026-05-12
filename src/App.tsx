import { useState, useEffect, useRef } from 'react'
import { CardView, DISCARD_MS } from './components/CardView'
import { playFinish } from './lib/sounds'
import { loadDeck, saveDeck, resetDeck, pickNextCard } from './lib/cards'
import { updateCard } from './lib/sm2'
import { DECK_COLORS, DECK_TEXT } from './lib/colors'
import { voiceSupported } from './hooks/useVoiceInput'
import type { Card } from './types'
import './App.css'

type Screen = 'menu' | 'playing' | 'two-player'
type SummaryOverlay = 'none' | 'solo-quit' | 'race' | 'two-player'

const DEV = import.meta.env.DEV
const DEV_SETTINGS_KEY = 'times-table-dev'
const SETTINGS_KEY = 'times-table-settings'
const BEST_SCORES_KEY = 'times-table-best'
const PLAYER_NAMES_KEY = 'times-table-player-names'
const CARDS_PER_PLAYER_KEY = 'times-table-cards-per-player'
const TABLE_DECKS = [2, 3, 4, 5, 6, 7, 8, 9]
const RACE_DURATIONS = [30, 60, 120]

// ── dev settings ─────────────────────────────────────────────────────────────

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

// ── user settings ─────────────────────────────────────────────────────────────

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

// ── best scores ───────────────────────────────────────────────────────────────

function bestScoreKey(deckFilter: number[] | null, duration: number) {
  const deckStr = deckFilter === null ? 'full' : [...deckFilter].sort((a, b) => a - b).join(',')
  return `${deckStr}-${duration}`
}

function loadBestScore(deckFilter: number[] | null, duration: number): number {
  try {
    const raw = localStorage.getItem(BEST_SCORES_KEY)
    if (raw) return (JSON.parse(raw) as Record<string, number>)[bestScoreKey(deckFilter, duration)] ?? 0
  } catch { /* ignore */ }
  return 0
}

function saveBestScore(deckFilter: number[] | null, duration: number, score: number) {
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

// ── two-player persistence ────────────────────────────────────────────────────

function loadPlayerNames(): [string, string] {
  try {
    const raw = localStorage.getItem(PLAYER_NAMES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 2) return parsed as [string, string]
    }
  } catch { /* ignore */ }
  return ['שחקן 1', 'שחקן 2']
}

function loadCardsPerPlayer(): number {
  try {
    const n = parseInt(localStorage.getItem(CARDS_PER_PLAYER_KEY) ?? '', 10)
    if (!isNaN(n) && n > 0) return n
  } catch { /* ignore */ }
  return 10
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [summaryOverlay, setSummaryOverlay] = useState<SummaryOverlay>('none')
  const [raceKey, setRaceKey] = useState(0)
  const [deck, setDeck] = useState<Card[]>(() => loadDeck())
  const [deckFilter, setDeckFilter] = useState<number[] | null>(null)
  const [current, setCurrent] = useState<Card>(() => pickNextCard(loadDeck()))
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [sessionErrors, setSessionErrors] = useState<Record<string, number>>({})
  const [lastDiscard, setLastDiscard] = useState<{ answer: number; bg: string; fg: string } | null>(null)
  const raceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const summaryOverlayRef = useRef<SummaryOverlay>('none')
  const raceActiveRef = useRef(false)

  // game mode
  const [gameMode, setGameMode] = useState<'solo' | 'two-player'>('solo')

  // two-player setup (persisted)
  const [playerNames, setPlayerNames] = useState<[string, string]>(loadPlayerNames)
  const [nameEdits, setNameEdits] = useState<[string, string]>(['', ''])
  const [cardsPerPlayer, setCardsPerPlayer] = useState(loadCardsPerPlayer)

  // two-player session
  const [twoPlayerQueue, setTwoPlayerQueue] = useState<Card[]>([])
  const [twoPlayerIdx, setTwoPlayerIdx] = useState(0)
  const [currentPlayer, setCurrentPlayer] = useState<0 | 1>(0)
  const [twoScores, setTwoScores] = useState<[number, number]>([0, 0])
  const [cardsLeft, setCardsLeft] = useState(0)
  const [twoPileCounts, setTwoPileCounts] = useState<[number, number]>([0, 0])
  const [twoLastDiscard, setTwoLastDiscard] = useState<[typeof lastDiscard, typeof lastDiscard]>([null, null])

  // deck selection (menu)
  const [selectedDecks, setSelectedDecks] = useState<number[]>([])

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
  const [settingsOpen, setSettingsOpen] = useState(false)

  // persist user settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ micEnabled, raceModeEnabled, raceDuration }))
  }, [micEnabled, raceModeEnabled, raceDuration])

  // persist dev settings
  useEffect(() => {
    if (!DEV) return
    localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify({ correctDelay, wrongDelay, revealDuration, timeLimitEnabled, timeLimit }))
  }, [correctDelay, wrongDelay, revealDuration, timeLimitEnabled, timeLimit])

  // persist two-player setup
  useEffect(() => {
    localStorage.setItem(PLAYER_NAMES_KEY, JSON.stringify(playerNames))
  }, [playerNames])

  useEffect(() => {
    localStorage.setItem(CARDS_PER_PLAYER_KEY, cardsPerPlayer.toString())
  }, [cardsPerPlayer])

  summaryOverlayRef.current = summaryOverlay

  // race timer countdown — raceKey restarts it without a screen change
  useEffect(() => {
    if (raceTimerRef.current) { clearInterval(raceTimerRef.current); raceTimerRef.current = null }
    if (screen !== 'playing' || !raceModeEnabled) return
    raceActiveRef.current = true
    setRaceTimeLeft(raceDuration)
    raceTimerRef.current = setInterval(() => {
      if (!raceActiveRef.current) return
      setRaceTimeLeft(t => Math.max(0, t - 1))
    }, 1000)
    return () => {
      raceActiveRef.current = false
      if (raceTimerRef.current) { clearInterval(raceTimerRef.current); raceTimerRef.current = null }
    }
  }, [screen, raceModeEnabled, raceDuration, raceKey])

  // end race when timer hits zero
  useEffect(() => {
    if (screen !== 'playing' || !raceModeEnabled || raceTimeLeft > 0) return
    if (summaryOverlayRef.current !== 'none') return
    if (raceTimerRef.current) { clearInterval(raceTimerRef.current); raceTimerRef.current = null }
    playFinish()
    saveBestScore(deckFilter, raceDuration, correct)
    setSummaryOverlay('race')
  }, [raceTimeLeft, screen, raceModeEnabled, deckFilter, raceDuration, correct])

  // ── helpers ───────────────────────────────────────────────────────────────

  function activeCards(d: Card[], filter: number[] | null) {
    return filter === null ? d : d.filter(c => filter.includes(c.a))
  }

  function handleStartDeck(filter: number[] | null) {
    const d = loadDeck()
    setDeckFilter(filter)
    setCorrect(0)
    setWrong(0)
    setSessionErrors({})
    setLastDiscard(null)
    setCurrent(pickNextCard(activeCards(d, filter)))
    if (raceModeEnabled) setRaceTimeLeft(raceDuration)
    setScreen('playing')
  }

  function handleResult(wasCorrect: boolean, _timeMs: number) {
    if (summaryOverlay !== 'none') return
    const key = `${current.a}x${current.b}`
    const newErrors = wasCorrect
      ? sessionErrors
      : { ...sessionErrors, [key]: (sessionErrors[key] ?? 0) + 1 }

    if (wasCorrect) setCorrect(c => c + 1)
    else { setWrong(w => w + 1); setSessionErrors(newErrors) }

    const discarded = {
      answer: current.a * current.b,
      bg: DECK_COLORS[current.a] ?? DECK_COLORS[1],
      fg: DECK_TEXT[current.a] ?? DECK_TEXT[1],
    }
    setTimeout(() => setLastDiscard(discarded), DISCARD_MS)

    const updatedCard = updateCard(current, wasCorrect)
    const newDeck = deck.map(c => (c.a === current.a && c.b === current.b) ? updatedCard : c)
    saveDeck(newDeck)
    setDeck(newDeck)
    setCurrent(pickNextCard(activeCards(newDeck, deckFilter), updatedCard, newErrors))
  }

  function buildTwoPlayerQueue(filter: number[] | null): Card[] {
    const available = activeCards(loadDeck(), filter)
    const total = Math.min(cardsPerPlayer * 2, available.length)
    const evenTotal = total % 2 === 0 ? total : total - 1
    return shuffled(available).slice(0, evenTotal)
  }

  function handleStartTwoPlayer(filter: number[] | null) {
    const n0 = nameEdits[0].trim() || playerNames[0]
    const n1 = nameEdits[1].trim() || playerNames[1]
    setPlayerNames([n0, n1])
    const queue = buildTwoPlayerQueue(filter)
    setDeckFilter(filter)
    setTwoPlayerQueue(queue)
    setTwoPlayerIdx(0)
    setCurrentPlayer(0)
    setTwoScores([0, 0])
    setCardsLeft(queue.length / 2)
    setTwoPileCounts([0, 0])
    setTwoLastDiscard([null, null])
    setScreen('two-player')
  }

  function handleTwoPlayerResult(wasCorrect: boolean, _timeMs: number) {
    if (wasCorrect) {
      setTwoScores(s => {
        const ns: [number, number] = [s[0], s[1]]
        ns[currentPlayer]++
        return ns
      })
    }

    const card = twoPlayerQueue[twoPlayerIdx]
    const discarded = {
      answer: card.a * card.b,
      bg: DECK_COLORS[card.a] ?? DECK_COLORS[1],
      fg: DECK_TEXT[card.a] ?? DECK_TEXT[1],
    }
    const p = currentPlayer
    setTwoPileCounts(c => { const nc: [number, number] = [c[0], c[1]]; nc[p]++; return nc })
    setTimeout(() => setTwoLastDiscard(d => { const nd: [typeof d[0], typeof d[1]] = [d[0], d[1]]; nd[p] = discarded; return nd }), DISCARD_MS)

    const nextIdx = twoPlayerIdx + 1
    const nextPlayer: 0 | 1 = currentPlayer === 0 ? 1 : 0

    if (currentPlayer === 1) setCardsLeft(l => l - 1)

    if (nextIdx >= twoPlayerQueue.length) {
      playFinish()
      setSummaryOverlay('two-player')
    } else {
      setTwoPlayerIdx(nextIdx)
      setCurrentPlayer(nextPlayer)
    }
  }

  function handleTwoPlayerRematch() {
    const queue = buildTwoPlayerQueue(deckFilter)
    setTwoPlayerQueue(queue)
    setTwoPlayerIdx(0)
    setCurrentPlayer(0)
    setTwoScores([0, 0])
    setCardsLeft(queue.length / 2)
    setTwoPileCounts([0, 0])
    setTwoLastDiscard([null, null])
    setSummaryOverlay('none')
  }

  function handleQuit() {
    raceActiveRef.current = false
    if (raceTimerRef.current) { clearInterval(raceTimerRef.current); raceTimerRef.current = null }
    setRaceTimeLeft(raceDuration)
    if (raceModeEnabled) {
      saveBestScore(deckFilter, raceDuration, correct)
      setSummaryOverlay('race')
    } else {
      setSummaryOverlay('solo-quit')
    }
  }

  function handleRestart() {
    const d = loadDeck()
    setCorrect(0)
    setWrong(0)
    setSessionErrors({})
    setLastDiscard(null)
    setCurrent(pickNextCard(activeCards(d, deckFilter)))
    setSummaryOverlay('none')
    if (raceModeEnabled) {
      setRaceTimeLeft(raceDuration)
      setRaceKey(k => k + 1)
    }
  }

  function handleBackToMenu() {
    setSummaryOverlay('none')
    setScreen('menu')
  }

  function handleResetProgress() {
    const fresh = resetDeck()
    setDeck(fresh)
    setCorrect(0)
    setWrong(0)
    setSessionErrors({})
    setCurrent(pickNextCard(activeCards(fresh, deckFilter)))
    setScreen('playing')
  }

  function toggleDeck(n: number) {
    setSelectedDecks(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }

  // ── screens ────────────────────────────────────────────────────────────────

  if (screen === 'menu') {
    const allSelected = selectedDecks.length === TABLE_DECKS.length
    const filter: number[] | null = allSelected ? null : selectedDecks
    const isTwoPlayer = gameMode === 'two-player'
    return (
      <div className="app">
        <div className="menu-screen">
          <h1 className="title">לוח הכפל</h1>

          <p className="menu-subtitle">בחרו לוחות</p>
          <div className="deck-grid">
            {TABLE_DECKS.map(n => {
              const sel = selectedDecks.includes(n)
              return (
                <button
                  key={n}
                  className={`btn-deck${sel ? ' selected' : ''}`}
                  style={{ background: DECK_COLORS[n], color: DECK_TEXT[n] }}
                  onClick={() => toggleDeck(n)}
                >
                  {sel && <span className="deck-checkmark">✓</span>}
                  {n}×
                </button>
              )
            })}
            <button
              className="btn-select-all"
              style={{ gridColumn: '1 / -1' }}
              onClick={() => setSelectedDecks(allSelected ? [] : [...TABLE_DECKS])}
            >
              {allSelected ? 'בטל הכל' : 'בחר הכל'}
            </button>
          </div>

          <div className="menu-controls">
            <div className="mode-toggle-row">
              <button
                className={`btn-mode${!isTwoPlayer ? ' active' : ''}`}
                onClick={() => setGameMode('solo')}
              >יחיד</button>
              <button
                className={`btn-mode${isTwoPlayer ? ' active' : ''}`}
                onClick={() => setGameMode('two-player')}
              >שני<br/>שחקנים</button>
            </div>

            <button className="btn-settings-toggle" onClick={() => setSettingsOpen(o => !o)}>
              {settingsOpen ? '▲ הסתר הגדרות' : '▼ הגדרות'}
            </button>
            <div className={`settings-panel${settingsOpen ? ' open' : ''}`}>
            <div className={`menu-mode-extra${isTwoPlayer ? ' two-p' : ''}`}>
              <div className="two-player-menu-setup">
                <div className="player-name-row">
                  <input
                    className="player-name-input"
                    value={nameEdits[0]}
                    placeholder={playerNames[0]}
                    onChange={e => setNameEdits([e.target.value, nameEdits[1]])}
                  />
                  <input
                    className="player-name-input"
                    value={nameEdits[1]}
                    placeholder={playerNames[1]}
                    onChange={e => setNameEdits([nameEdits[0], e.target.value])}
                  />
                </div>
                <div className="setting-row-compact">
                  <span className="setting-label">קלפים לכל שחקן</span>
                  <input
                    type="number"
                    className="cards-per-player-input"
                    value={cardsPerPlayer}
                    min={1}
                    max={100}
                    onChange={e => setCardsPerPlayer(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
                {voiceSupported && (
                  <div className="setting-row">
                    <span className="setting-label">🎤 מיקרופון</span>
                    <button
                      className={`toggle-pill${micEnabled ? ' on' : ''}`}
                      onClick={() => setMicEnabled(m => !m)}
                    />
                  </div>
                )}
              </div>
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

            <button
              className="btn-start"
              disabled={selectedDecks.length === 0 || (isTwoPlayer && cardsPerPlayer < 1)}
              onClick={() => isTwoPlayer ? handleStartTwoPlayer(filter) : handleStartDeck(filter)}
            >
              התחילו
            </button>
          </div>
        </div>
      </div>
    )
  }


  if (screen === 'two-player') {
    const card = twoPlayerQueue[twoPlayerIdx] ?? twoPlayerQueue[twoPlayerQueue.length - 1]
    if (!card) return null
    const tpWinner = twoScores[0] > twoScores[1] ? 0 : twoScores[1] > twoScores[0] ? 1 : -1
    return (
      <div className="app">
        <div className="two-player-header">
          <div className={`player-badge${currentPlayer === 0 && summaryOverlay === 'none' ? ' active' : ''}`}>
            <span className="player-badge-name">{playerNames[0]}</span>
            <span className="player-badge-score">{twoScores[0]}</span>
          </div>
          <div className="cards-left-badge">
            <span className="cards-left-number">{cardsLeft}</span>
            <span className="cards-left-label">קלפים</span>
          </div>
          <div className={`player-badge${currentPlayer === 1 && summaryOverlay === 'none' ? ' active' : ''}`}>
            <span className="player-badge-name">{playerNames[1]}</span>
            <span className="player-badge-score">{twoScores[1]}</span>
          </div>
        </div>

        <div className="playing-above" />

        <div className="card-table card-table-wide">
          <div className="discard-pile" aria-hidden="true">
            {twoPileCounts[0] > 0 && twoLastDiscard[0] && (
              <>
                <div className="discard-pile-cards">
                  {Array.from({ length: Math.min(twoPileCounts[0], 3) }, (_, i) => {
                    const depth = Math.min(twoPileCounts[0], 3) - 1 - i
                    return (
                      <div key={i} className="discard-mini" style={{
                        background: twoLastDiscard[0]!.bg, color: twoLastDiscard[0]!.fg,
                        transform: `translate(${-depth * 3}px, ${-depth * 3}px)`,
                        opacity: depth === 0 ? 1 : depth === 1 ? 0.7 : 0.5,
                      }}>
                        {depth === 0 && <span className="discard-answer">{twoLastDiscard[0]!.answer}</span>}
                      </div>
                    )
                  })}
                </div>
                <span className="discard-count">{twoPileCounts[0]}</span>
              </>
            )}
          </div>

          <div className="card-table-main">
            {summaryOverlay === 'two-player' ? (
              <div className="winner-card-area">
                <div className="winner-card">
                  <p className="winner-text">
                    {tpWinner === -1 ? 'תיקו' : <>ניצחון<br/>!ל{playerNames[tpWinner]}</>}
                  </p>
                </div>
                <div className="winner-card-spacer" />
              </div>
            ) : (
              <CardView
                card={card}
                onResult={handleTwoPlayerResult}
                onStop={() => setSummaryOverlay('two-player')}
                micEnabled={micEnabled}
                correctDelay={correctDelay}
                wrongDelay={wrongDelay}
                revealDuration={250}
                timeLimitEnabled={false}
                timeLimit={0}
                advanceOnWrong
                discardDirection={currentPlayer === 0 ? 'left' : 'right'}
              />
            )}
          </div>

          <div className="discard-pile" aria-hidden="true">
            {twoPileCounts[1] > 0 && twoLastDiscard[1] && (
              <>
                <div className="discard-pile-cards">
                  {Array.from({ length: Math.min(twoPileCounts[1], 3) }, (_, i) => {
                    const depth = Math.min(twoPileCounts[1], 3) - 1 - i
                    return (
                      <div key={i} className="discard-mini" style={{
                        background: twoLastDiscard[1]!.bg, color: twoLastDiscard[1]!.fg,
                        transform: `translate(${-depth * 3}px, ${-depth * 3}px)`,
                        opacity: depth === 0 ? 1 : depth === 1 ? 0.7 : 0.5,
                      }}>
                        {depth === 0 && <span className="discard-answer">{twoLastDiscard[1]!.answer}</span>}
                      </div>
                    )
                  })}
                </div>
                <span className="discard-count">{twoPileCounts[1]}</span>
              </>
            )}
          </div>
        </div>

        <div className="playing-below">
          {summaryOverlay === 'none' ? (
            <button className="btn-quit" onClick={() => setSummaryOverlay('two-player')}>עצור</button>
          ) : (
            <div className="session-actions">
              <button className="btn-primary" onClick={handleTwoPlayerRematch}>שחקו שוב</button>
              <button className="btn-primary" onClick={handleBackToMenu}>חזרה לתפריט</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // playing screen — also computes summary overlay values
  const raceBarPct = raceModeEnabled ? (raceTimeLeft / raceDuration) * 100 : 0
  const raceUrgent = raceModeEnabled && raceTimeLeft <= 5
  const racePrev = loadBestScore(deckFilter, raceDuration)
  const raceIsNewBest = correct > 0 && correct >= racePrev

  return (
    <div className="app">
      <div className="playing-above">
        {raceModeEnabled && summaryOverlay === 'none' && (
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
        {summaryOverlay === 'race' && (
          <div className="session-result">
            <h2>סיום המרוץ</h2>
            {raceIsNewBest
              ? <p className="quit-stat best">!🏆 שיא חדש</p>
              : racePrev > 0 && <p className="quit-stat">שיא: {racePrev}</p>
            }
          </div>
        )}
      </div>

      <div className={`card-table${summaryOverlay !== 'none' ? ' dimmed' : ''}`}>
        <div className="discard-pile" aria-hidden="true">
          {lastDiscard && (
            <>
              <div className="discard-pile-cards">
                {Array.from({ length: Math.min(correct, 3) }, (_, i) => {
                  const depth = Math.min(correct, 3) - 1 - i
                  return (
                    <div
                      key={i}
                      className="discard-mini"
                      style={{
                        background: lastDiscard.bg,
                        color: lastDiscard.fg,
                        transform: `translate(${-depth * 3}px, ${-depth * 3}px)`,
                        opacity: depth === 0 ? 1 : depth === 1 ? 0.7 : 0.5,
                      }}
                    >
                      {depth === 0 && <span className="discard-answer">{lastDiscard.answer}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="discard-stats">
                <span className="discard-stat-correct">👍 {correct}</span>
                <span className="discard-stat-wrong">👎 {wrong}</span>
              </div>
            </>
          )}
        </div>
        <div className="card-table-main">
          <CardView
            card={current}
            onResult={handleResult}
            onStop={handleQuit}
            micEnabled={micEnabled}
            correctDelay={correctDelay}
            wrongDelay={wrongDelay}
            revealDuration={revealDuration}
            timeLimitEnabled={timeLimitEnabled && !raceModeEnabled && summaryOverlay === 'none'}
            timeLimit={timeLimit}
            showStop={summaryOverlay === 'none'}
          />
        </div>
        <div className="card-table-spacer" />
      </div>

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

      <div className="playing-below">
        {summaryOverlay !== 'none' && summaryOverlay !== 'two-player' && (
          <div className="session-actions">
            <button className="btn-primary" onClick={handleRestart}>שחקו שוב</button>
            <button className="btn-primary" onClick={handleBackToMenu}>בחרו לוח</button>
          </div>
        )}
      </div>
    </div>
  )
}
