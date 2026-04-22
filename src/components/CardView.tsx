import { useState, useRef, useEffect } from 'react'
import type { Card } from '../types'
import { useVoiceInput } from '../hooks/useVoiceInput'
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
  const [lastHeard, setLastHeard] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const voice = useVoiceInput({
    onNumber: (n) => submitAnswer(n),
    onRaw: (text) => setLastHeard(text),
  })

  useEffect(() => {
    setInput('')
    setFeedback('idle')
    setLastHeard('')
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
    setFeedback(answer === card.a * card.b ? 'correct' : 'wrong')
  }

  function submitTyped() {
    if (feedback !== 'idle') {
      if (timerRef.current) clearTimeout(timerRef.current)
      onResult(feedback === 'correct')
      return
    }
    submitAnswer(parseInt(input, 10))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submitTyped()
  }

  function handleSkip() {
    if (timerRef.current) clearTimeout(timerRef.current)
    onResult(feedback === 'correct')
  }

  const correctAnswer = card.a * card.b
  const isListening = voice.state === 'listening'

  return (
    <div className={`card-wrap ${feedback}`}>
      <div className="card">
        <p className="question">
          {card.a} × {card.b} = ?
        </p>

        {feedback === 'idle' ? (
          <div className="input-row">
            <div className="typed-row">
              <input
                ref={inputRef}
                type="number"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="..."
                className="answer-input"
              />
              <button
                onClick={submitTyped}
                className="btn-primary"
                disabled={input === ''}
              >
                אישור
              </button>
            </div>

            {voice.state !== 'unsupported' && (
              <button
                onClick={isListening ? voice.stop : voice.start}
                className={`btn-mic ${isListening ? 'listening' : ''}`}
                title={isListening ? 'עצור הקשבה' : 'ענה בקול'}
              >
                {isListening ? '⏹ מאזין…' : '🎤 דבר'}
              </button>
            )}

            {lastHeard && (
              <p className="heard-text">שמעתי: "{lastHeard}"</p>
            )}
          </div>
        ) : (
          <div className="feedback-row">
            {feedback === 'correct' ? (
              <p className="feedback-text correct">נכון! 🎉</p>
            ) : (
              <p className="feedback-text wrong">התשובה הנכונה: {correctAnswer}</p>
            )}
            <button onClick={handleSkip} className="btn-skip">דלג</button>
          </div>
        )}
      </div>
    </div>
  )
}
