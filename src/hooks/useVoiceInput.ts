import { useRef, useState, useCallback } from 'react'
import { parseHebrewNumber } from '../lib/hebrewNumbers'

export type VoiceState = 'idle' | 'listening' | 'unsupported'

interface Options {
  onNumber: (n: number) => void
  onRaw?: (text: string) => void
}

export function useVoiceInput({ onNumber, onRaw }: Options) {
  const [state, setState] = useState<VoiceState>(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    return SR ? 'idle' : 'unsupported'
  })

  const recRef = useRef<any>(null)

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR || state === 'listening') return

    const rec = new SR()
    rec.lang = 'he-IL'
    rec.interimResults = false
    rec.maxAlternatives = 5

    rec.onstart = () => setState('listening')
    rec.onend   = () => setState('idle')
    rec.onerror = () => setState('idle')

    rec.onresult = (e: any) => {
      // try all alternatives, return first that parses
      const results: string[] = []
      for (let i = 0; i < e.results[0].length; i++) {
        results.push(e.results[0][i].transcript)
      }
      onRaw?.(results[0])
      for (const r of results) {
        const n = parseHebrewNumber(r)
        if (n !== null) { onNumber(n); return }
      }
    }

    recRef.current = rec
    rec.start()
  }, [state, onNumber, onRaw])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setState('idle')
  }, [])

  return { state, start, stop }
}
