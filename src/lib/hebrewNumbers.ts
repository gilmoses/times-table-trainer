const onesM  = ['','אחד','שניים','שלושה','ארבעה','חמישה','שישה','שבעה','שמונה','תשעה']
const onesF  = ['','אחת','שתיים','שלוש','ארבע','חמש','שש','שבע','שמונה','תשע']
const onesM2 = ['','אחד','שנים','שלושה','ארבעה','חמישה','שישה','שבעה','שמונה','תשעה']

const tensWords: Record<number, string> = {
  10: 'עשר', 20: 'עשרים', 30: 'שלושים', 40: 'ארבעים',
  50: 'חמישים', 60: 'שישים', 70: 'שבעים', 80: 'שמונים', 90: 'תשעים',
}

const teensWords: Record<number, string[]> = {
  11: ['אחד עשר','אחת עשרה'],
  12: ['שניים עשר','שתים עשרה','שנים עשר','שתיים עשרה'],
  13: ['שלושה עשר','שלוש עשרה'],
  14: ['ארבעה עשר','ארבע עשרה'],
  15: ['חמישה עשר','חמש עשרה'],
  16: ['שישה עשר','שש עשרה'],
  17: ['שבעה עשר','שבע עשרה'],
  18: ['שמונה עשר','שמונה עשרה'],
  19: ['תשעה עשר','תשע עשרה'],
}

function oneForms(i: number) {
  return [...new Set([onesM[i], onesF[i], onesM2[i]].filter(Boolean))]
}

function buildLookup(): Record<string, number> {
  const L: Record<string, number> = {}

  const add = (phrase: string, n: number) => { L[phrase.trim()] = n }

  // digits 1-144 as strings (Speech API sometimes returns these)
  for (let i = 1; i <= 144; i++) add(String(i), i)

  // 1-9
  for (let i = 1; i <= 9; i++) for (const f of oneForms(i)) add(f, i)

  // 10, and tens 10-90
  add('עשרה', 10)
  for (const [n, w] of Object.entries(tensWords)) add(w, Number(n))

  // 11-19
  for (const [n, ps] of Object.entries(teensWords))
    for (const p of ps) add(p, Number(n))

  // 21-99: "עשרים ואחד", "עשרים ואחת" …
  for (const [tn, tw] of Object.entries(tensWords)) {
    const t = Number(tn)
    if (t < 20) continue
    for (let i = 1; i <= 9; i++) {
      for (const f of oneForms(i)) {
        add(`${tw} ו${f}`, t + i)
        add(`${tw} ו-${f}`, t + i)
      }
    }
  }

  // 100
  add('מאה', 100)

  // helper: add 100 + x phrasings
  function add100(suffix: string, n: number) {
    add(`מאה ${suffix}`, n)
    add(`מאה ו${suffix}`, n)
  }

  // 101-109
  for (let i = 1; i <= 9; i++) for (const f of oneForms(i)) add100(f, 100 + i)

  // 110-119
  add100('עשר', 110); add100('עשרה', 110)
  for (const [n, ps] of Object.entries(teensWords))
    for (const p of ps) add100(p, 100 + Number(n))

  // 120-144 — only tens that can appear (120,130,140)
  for (const t of [20, 30, 40]) {
    const tw = tensWords[t]
    add100(tw, 100 + t)
    add(`מאה ו${tw}`, 100 + t)
    const limit = t === 40 ? 4 : 9
    for (let i = 1; i <= limit; i++) {
      for (const f of oneForms(i)) {
        add(`מאה ${tw} ו${f}`, 100 + t + i)
        add(`מאה ו${tw} ו${f}`, 100 + t + i)
      }
    }
  }

  return L
}

const lookup = buildLookup()

export function parseHebrewNumber(text: string): number | null {
  const clean = text.trim().replace(/[.,!?]/g, '')
  return lookup[clean] ?? null
}
