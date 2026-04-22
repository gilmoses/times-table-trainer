import { useState, useRef, useEffect } from 'react'
import type { Card } from '../types'
import './CardView.css'

type FeedbackState = 'idle' | 'correct' | 'wrong'

interface Props {
  card: Card
  onResult: (correct: boolean) => void
}

export function CardView({ card, onResult }: Props) {
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setInput('')
    setFeedback('idle')
    inputRef.current?.focus()
  }, [card])

  function submit() {
    if (feedback !== 'idle') {
      onResult(feedback === 'correct')
      return
    }
    const answer = parseInt(input, 10)
    const correct = answer === card.a * card.b
    setFeedback(correct ? 'correct' : 'wrong')
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit()
  }

  const answer = card.a * card.b

  return (
    <div className={`card-wrap ${feedback}`}>
      <div className="card">
        <p className="question">
          {card.a} × {card.b} = ?
        </p>

        {feedback === 'idle' ? (
          <div className="input-row">
            <input
              ref={inputRef}
              type="number"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="..."
              className="answer-input"
            />
            <button onClick={submit} className="btn-primary" disabled={input === ''}>
              אישור
            </button>
          </div>
        ) : (
          <div className="feedback-row">
            {feedback === 'correct' ? (
              <p className="feedback-text correct">נכון! 🎉</p>
            ) : (
              <p className="feedback-text wrong">התשובה הנכונה: {answer}</p>
            )}
            <button onClick={submit} className="btn-primary">
              הבא ←
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
