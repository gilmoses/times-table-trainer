import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { parseHebrewNumber } from '../lib/hebrewNumbers'

interface Options {
  active: boolean
  onNumber: (n: number) => void
  onRaw?: (text: string) => void
}

const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
export const voiceSupported = !!SR

export function useVoiceInput({ active, onNumber, onRaw }: Options) {
  const [listening, setListening] = useState(false)
  const activeRef    = useRef(active)
  const onNumberRef  = useRef(onNumber)
  const onRawRef     = useRef(onRaw)

  useLayoutEffect(() => { activeRef.current   = active   }, [active])
  useLayoutEffect(() => { onNumberRef.current = onNumber }, [onNumber])
  useLayoutEffect(() => { onRawRef.current    = onRaw    }, [onRaw])

  useEffect(() => {
    if (!SR) return
    let cancelled = false
    let rec: any = null
    let restartTimer: ReturnType<typeof setTimeout>

    function start() {
      if (cancelled || !activeRef.current) return
      rec = new SR()
      rec.lang = 'he-IL'
      rec.interimResults = false
      rec.maxAlternatives = 5

      rec.onstart = () => setListening(true)

      rec.onend = () => {
        setListening(false)
        rec = null
        if (!cancelled && activeRef.current)
          restartTimer = setTimeout(start, 250)
      }

      rec.onerror = (e: any) => {
        setListening(false)
        rec = null
        const fatal = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        if (!cancelled && activeRef.current && !fatal)
          restartTimer = setTimeout(start, 600)
      }

      rec.onresult = (e: any) => {
        const alts: string[] = Array.from({ length: e.results[0].length },
          (_, i) => e.results[0][i].transcript)
        onRawRef.current?.(alts[0])
        for (const r of alts) {
          const n = parseHebrewNumber(r)
          if (n !== null) { onNumberRef.current(n); return }
        }
      }

      try { rec.start() } catch { rec = null }
    }

    if (active) start()

    return () => {
      cancelled = true
      clearTimeout(restartTimer)
      rec?.abort()
    }
  }, [active])

  return { listening }
}
