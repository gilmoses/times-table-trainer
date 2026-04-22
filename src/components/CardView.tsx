import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import type { Card } from '../types'
import { useVoiceInput, voiceSupported } from '../hooks/useVoiceInput'
import { DECK_COLORS, DECK_TEXT } from '../lib/colors'
import './CardView.css'

type FeedbackState = 'idle' | 'correct' | 'wrong' | 'revealing' | 'flipping-back'

const STOP_COMMAND = 'סטופ'
const REVEAL_COMMAND = 'עזרה'
const FLIP_MS = 560 // must match .card-flip transition duration in CardView.css

interface Props {
  card: Card
  onResult: (correct: boolean, timeMs: number) => void
  onStop: () => void
  correctDelay: number
  wrongDelay: number
  revealDuration: number
  timeLimitEnabled: boolean
  timeLimit: number
}

export function CardView({ card, onResult, onStop, correctDelay, wrongDelay, revealDuration, timeLimitEnabled, timeLimit }: Props) {
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [userAnswer, setUserAnswer] = useState<number | null>(null)
  const [tainted, setTainted] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [idlePhase, setIdlePhase] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answerStartRef = useRef<number>(Date.now())
  const timeMsRef = useRef<number>(0)

  const { listening } = useVoiceInput({
    active: feedback === 'idle',
    onNumber: submitAnswer,
    onRaw: (text) => {
      const t = text.trim()
      if (t === STOP_COMMAND) onStop()
      else if (t === REVEAL_COMMAND) handleReveal()
    },
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

  useEffect(() => { inputRef.current?.focus() }, [card])

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

  // Correct: show answer on back for correctDelay, then flip back to question
  useEffect(() => {
    if (feedback !== 'correct') return
    timerRef.current = setTimeout(() => setFeedback('flipping-back'), correctDelay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, correctDelay])

  // Flipping-back: card shows the old question again; advance after the flip animation
  useEffect(() => {
    if (feedback !== 'flipping-back') return
    timerRef.current = setTimeout(() => onResult(!tainted, timeMsRef.current), FLIP_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, onResult, tainted])

  // Wrong: briefly show ring, then flip to reveal
  useEffect(() => {
    if (feedback !== 'wrong') return
    timerRef.current = setTimeout(() => setFeedback('revealing'), wrongDelay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, wrongDelay])

  // Revealing: show answer, then flip back to idle for re-answer
  useEffect(() => {
    if (feedback !== 'revealing') return
    timerRef.current = setTimeout(() => {
      answerStartRef.current = Date.now()
      setIdlePhase(p => p + 1)
      setFeedback('idle')
      setInput('')
      inputRef.current?.focus()
    }, revealDuration)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, revealDuration])

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
      {voiceSupported && (
        <span className={`mic-indicator${listening ? ' on' : ''}`}>🎤</span>
      )}

      <div className="card-scene">
        <div className={`card-flip ${feedback}`} key={`${card.a}x${card.b}`}>
          <div className="card-face front" style={{ background: bg }}>
            <p className="card-question" style={{ color: fg }}>{card.a} × {card.b}</p>
          </div>
          <div className="card-face back" style={{ background: bg }}>
            <p className="card-answer" style={{ color: fg }}>{correctAnswer}</p>
          </div>
        </div>
      </div>

      <div className="card-aux">
        {feedback === 'idle' && (
          <>
            <input
              ref={inputRef}
              type="number"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="..."
              className="answer-input"
            />
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
        {(feedback === 'correct' || feedback === 'flipping-back') && (
          <p className="aux-text correct">{tainted ? 'נכון - עם עזרה 👍' : 'נכון! 🎉'}</p>
        )}
      </div>
    </div>
  )
}
