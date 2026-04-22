import { useState, useRef, useEffect } from 'react'
import type { Card } from '../types'
import { useVoiceInput, voiceSupported } from '../hooks/useVoiceInput'
import './CardView.css'

type FeedbackState = 'idle' | 'correct' | 'wrong' | 'revealing'

const STOP_COMMAND = 'סטופ'
const REVEAL_COMMAND = 'עזרה'

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

  // Reset all state on new card
  useEffect(() => {
    answerStartRef.current = Date.now()
    timeMsRef.current = 0
    setInput('')
    setFeedback('idle')
    setUserAnswer(null)
    setTainted(false)
    inputRef.current?.focus()
  }, [card])

  // Countdown display (visual only)
  useEffect(() => {
    if (feedback !== 'idle' || !timeLimitEnabled) { setCountdown(null); return }
    setCountdown(timeLimit)
    const iv = setInterval(() => setCountdown(c => (c !== null && c > 0) ? c - 1 : null), 1000)
    return () => clearInterval(iv)
  }, [feedback, timeLimitEnabled, timeLimit])

  // Time limit: auto-reveal when limit expires
  useEffect(() => {
    if (feedback !== 'idle' || !timeLimitEnabled) return
    timerRef.current = setTimeout(() => {
      if (timeMsRef.current === 0) timeMsRef.current = Date.now() - answerStartRef.current
      setTainted(true)
      setFeedback('revealing')
    }, timeLimit * 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, timeLimitEnabled, timeLimit])

  // Correct: advance after delay (tainted = counts as wrong)
  useEffect(() => {
    if (feedback !== 'correct') return
    timerRef.current = setTimeout(() => onResult(!tainted, timeMsRef.current), correctDelay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, correctDelay, onResult, tainted])

  // Wrong: briefly show, then transition to reveal
  useEffect(() => {
    if (feedback !== 'wrong') return
    timerRef.current = setTimeout(() => setFeedback('revealing'), wrongDelay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, wrongDelay])

  // Revealing: show answer, then return to idle for re-answer
  useEffect(() => {
    if (feedback !== 'revealing') return
    timerRef.current = setTimeout(() => {
      answerStartRef.current = Date.now()
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

  return (
    <div className={`card-wrap ${feedback}`}>
      <div className="card">

        {voiceSupported && (
          <span className={`mic-indicator ${listening ? 'on' : ''}`} title="מיקרופון">🎤</span>
        )}

        <p className="question">{card.a} × {card.b} = ?</p>

        {feedback === 'idle' ? (
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
            {countdown !== null && (
              <span className={`countdown${countdown <= 3 ? ' urgent' : ''}`}>{countdown}</span>
            )}
          </>
        ) : feedback === 'revealing' ? (
          <p className="reveal-answer">{correctAnswer}</p>
        ) : feedback === 'wrong' ? (
          <div className="feedback-row">
            <p className="user-answer">{userAnswer}</p>
            <p className="feedback-text wrong">✗</p>
          </div>
        ) : (
          <div className="feedback-row">
            <p className="user-answer">{userAnswer}</p>
            <p className="feedback-text correct">{tainted ? 'נכון - עם עזרה 👍' : 'נכון! 🎉'}</p>
          </div>
        )}

      </div>
    </div>
  )
}
