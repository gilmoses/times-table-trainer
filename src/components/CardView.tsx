import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import type { Card } from '../types'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { DECK_COLORS, DECK_TEXT } from '../lib/colors'
import { playWrong, playCorrect, playCorrectWithHelp } from '../lib/sounds'
import './CardView.css'

type FeedbackState = 'idle' | 'correct' | 'wrong' | 'revealing'

const STOP_COMMAND = 'סטופ'
const REVEAL_COMMAND = 'עזרה'
export const DISCARD_MS = 450

interface OutgoingCard {
  answer: number
  bg: string
  fg: string
  dir: 'left' | 'right'
}

interface Props {
  card: Card
  onResult: (correct: boolean, timeMs: number) => void
  onStop: () => void
  micEnabled: boolean
  correctDelay: number
  wrongDelay: number
  revealDuration: number
  timeLimitEnabled: boolean
  timeLimit: number
  advanceOnWrong?: boolean
  discardDirection?: 'left' | 'right'
  showStop?: boolean
}

export function CardView({ card, onResult, onStop, micEnabled, correctDelay, wrongDelay, revealDuration, timeLimitEnabled, timeLimit, advanceOnWrong = false, discardDirection = 'left', showStop = false }: Props) {
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [userAnswer, setUserAnswer] = useState<number | null>(null)
  const [tainted, setTainted] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [idlePhase, setIdlePhase] = useState(0)
  const [outgoingCard, setOutgoingCard] = useState<OutgoingCard | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answerStartRef = useRef<number>(Date.now())
  const timeMsRef = useRef<number>(0)
  // Stable ref so the correct-effect doesn't re-run when App re-renders
  // (e.g. race-mode countdown ticks every second, creating a new onResult)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useVoiceInput({
    active: micEnabled && feedback === 'idle',
    onNumber: submitAnswer,
    onRaw: (text) => {
      const t = text.trim()
      if (t === STOP_COMMAND) onStop()
      else if (t === REVEAL_COMMAND) handleReveal()
    },
    card,
  })

  // Fires before paint — prevents new card's answer flashing on the back face
  useLayoutEffect(() => {
    answerStartRef.current = Date.now()
    timeMsRef.current = 0
    setInput('')
    setFeedback('idle')
    setUserAnswer(null)
    setTainted(false)
    setIdlePhase(p => p + 1)
  }, [card])

  // Blur when game ends (showStop false = overlay showing in solo)
  // Declared before focus so focus wins on two-player mount where showStop is always false
  useEffect(() => {
    if (!showStop) inputRef.current?.blur()
  }, [showStop])

  useEffect(() => {
    if (feedback === 'idle') inputRef.current?.focus()
  }, [idlePhase, feedback])

  // Countdown display — stops (and doesn't restart) once tainted
  useEffect(() => {
    if (feedback !== 'idle' || !timeLimitEnabled || tainted) { setCountdown(null); return }
    setCountdown(timeLimit)
    const iv = setInterval(() => setCountdown(c => (c !== null && c > 0) ? c - 1 : null), 1000)
    return () => clearInterval(iv)
  }, [feedback, timeLimitEnabled, timeLimit, tainted])

  // Time limit trigger — stops once tainted
  useEffect(() => {
    if (feedback !== 'idle' || !timeLimitEnabled || tainted) return
    timerRef.current = setTimeout(() => {
      if (timeMsRef.current === 0) timeMsRef.current = Date.now() - answerStartRef.current
      setTainted(true)
      setFeedback('revealing')
    }, timeLimit * 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, timeLimitEnabled, timeLimit, tainted])

  // Correct: show answer on back for correctDelay, then fly the card to the discard pile
  useEffect(() => {
    if (feedback !== 'correct') return
    timerRef.current = setTimeout(() => {
      setOutgoingCard({
        answer: card.a * card.b,
        bg: DECK_COLORS[card.a] ?? DECK_COLORS[1],
        fg: DECK_TEXT[card.a] ?? DECK_TEXT[1],
        dir: discardDirection,
      })
      onResultRef.current(!tainted, timeMsRef.current)
      discardTimerRef.current = setTimeout(() => setOutgoingCard(null), DISCARD_MS)
    }, correctDelay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, correctDelay, card, tainted, discardDirection])

  // Sound feedback
  useEffect(() => {
    if (feedback === 'wrong') playWrong()
    else if (feedback === 'correct') {
      if (tainted) playCorrectWithHelp()
      else playCorrect()
    }
  }, [feedback, tainted])

  // Wrong: briefly show ring, then flip to reveal
  useEffect(() => {
    if (feedback !== 'wrong') return
    timerRef.current = setTimeout(() => setFeedback('revealing'), wrongDelay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, wrongDelay])

  // Revealing: show answer, then either advance (2-player) or flip back to idle (solo)
  useEffect(() => {
    if (feedback !== 'revealing') return
    timerRef.current = setTimeout(() => {
      if (advanceOnWrong) {
        setOutgoingCard({
          answer: card.a * card.b,
          bg: DECK_COLORS[card.a] ?? DECK_COLORS[1],
          fg: DECK_TEXT[card.a] ?? DECK_TEXT[1],
          dir: discardDirection,
        })
        discardTimerRef.current = setTimeout(() => setOutgoingCard(null), DISCARD_MS)
        onResultRef.current(false, timeMsRef.current)
      } else {
        answerStartRef.current = Date.now()
        setIdlePhase(p => p + 1)
        setFeedback('idle')
        setInput('')
        inputRef.current?.focus()
      }
    }, revealDuration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, revealDuration, advanceOnWrong, card, discardDirection])

  function submitAnswer(answer: number) {
    if (feedback !== 'idle') return
    if (timeMsRef.current === 0) timeMsRef.current = Date.now() - answerStartRef.current
    setUserAnswer(answer)
    if (answer === card.a * card.b) {
      setFeedback('correct')
    } else {
      setTainted(true)
      setFeedback('wrong')
    }
  }

  function handleReveal() {
    if (feedback !== 'idle') return
    if (timeMsRef.current === 0) timeMsRef.current = Date.now() - answerStartRef.current
    setTainted(true)
    setFeedback('revealing')
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && input !== '') submitAnswer(parseInt(input, 10))
  }

  const correctAnswer = card.a * card.b
  const bg = DECK_COLORS[card.a] ?? DECK_COLORS[1]
  const fg = DECK_TEXT[card.a] ?? DECK_TEXT[1]

  return (
    <div className="card-area">
      <div className="card-scene">
        {/* deck depth — two shadow cards sitting behind the active card */}
        <div className="deck-shadow s2" style={{ background: bg }} />
        <div className="deck-shadow s1" style={{ background: bg }} />

        {/* card-perspective isolates the 3D flip so card-scene has no stacking context */}
        <div className="card-perspective">
          <div className={`card-flip ${feedback}`} key={`${card.a}x${card.b}`}>
            <div className="card-face front" style={{ background: bg }}>
              <p className="card-question" style={{ color: fg }}>{card.a} × {card.b}</p>
            </div>
            <div className="card-face back" style={{ background: bg }}>
              <p className="card-answer" style={{ color: fg }}>{correctAnswer}</p>
            </div>
          </div>
        </div>

        {/* outgoing card: animates to the discard pile while showing the answer */}
        {outgoingCard && (
          <div
            className={`card-outgoing fly-${outgoingCard.dir}`}
            style={{ background: outgoingCard.bg, color: outgoingCard.fg }}
          >
            <p className="card-answer">{outgoingCard.answer}</p>
          </div>
        )}
      </div>

      <div className="card-aux">
        {feedback === 'idle' && (
          <>
            <div className="answer-row">
              <input
                ref={inputRef}
                type="number"
                autoFocus
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder=""
                className="answer-input"
              />
              {showStop && (
                <button className="btn-stop-card" onClick={onStop}>עצור</button>
              )}
            </div>
            {timeLimitEnabled && countdown !== null && (
              <div className="time-limit-display">
                <div className="time-bar-track">
                  <div
                    key={idlePhase}
                    className="time-bar-fill"
                    style={{ animationDuration: `${timeLimit}s` }}
                  />
                </div>
                <span className={`countdown${countdown <= 3 ? ' urgent' : ''}`}>{countdown}</span>
              </div>
            )}
          </>
        )}
        {feedback === 'wrong' && (
          <p className="aux-text wrong">✗ &nbsp; {userAnswer}</p>
        )}
        {feedback === 'correct' && (
          <p className="aux-text correct">{tainted ? 'נכון - עם עזרה' : 'נכון'}</p>
        )}
      </div>
    </div>
  )
}
