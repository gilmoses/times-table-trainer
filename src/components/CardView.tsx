import { useState, useRef, useEffect } from 'react'
import type { Card } from '../types'
import { useVoiceInput, voiceSupported } from '../hooks/useVoiceInput'
import './CardView.css'

type FeedbackState = 'idle' | 'correct' | 'wrong'

interface Props {
  card: Card
  onResult: (correct: boolean) => void
  correctDelay: number
  wrongDelay: number
}

export function CardView({ card, onResult, correctDelay, wrongDelay }: Props) {
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [userAnswer, setUserAnswer] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { listening } = useVoiceInput({
    active: feedback === 'idle',
    onNumber: submitAnswer,
    onRaw: () => {},
  })

  useEffect(() => {
    setInput('')
    setFeedback('idle')
    setUserAnswer(null)
    inputRef.current?.focus()
  }, [card])

  useEffect(() => {
    if (feedback === 'idle') return
    const delay = feedback === 'correct' ? correctDelay : wrongDelay
    timerRef.current = setTimeout(() => onResult(feedback === 'correct'), delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [feedback, correctDelay, wrongDelay, onResult])

  function submitAnswer(answer: number) {
    if (feedback !== 'idle') return
    setUserAnswer(answer)
    setFeedback(answer === card.a * card.b ? 'correct' : 'wrong')
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && input !== '') submitAnswer(parseInt(input, 10))
  }

  function handleSkip() {
    if (timerRef.current) clearTimeout(timerRef.current)
    onResult(feedback === 'correct')
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
          <input
            ref={inputRef}
            type="number"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="..."
            className="answer-input"
          />
        ) : (
          <div className="feedback-row">
            <p className="user-answer">{userAnswer}</p>
            {feedback === 'correct'
              ? <p className="feedback-text correct">נכון! 🎉</p>
              : <p className="feedback-text wrong">התשובה הנכונה: {correctAnswer}</p>
            }
            <button onClick={handleSkip} className="btn-skip">דלג</button>
          </div>
        )}

      </div>
    </div>
  )
}
