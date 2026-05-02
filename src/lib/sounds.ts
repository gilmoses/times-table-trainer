function makeAudio(src: string): HTMLAudioElement {
  const a = new Audio(src)
  a.preload = 'auto'
  return a
}

const sfx = {
  correct:     makeAudio('/sounds/correct.wav'),
  wrong:       makeAudio('/sounds/wrong.wav'),
  correctHelp: makeAudio('/sounds/correct-help.mp3'),
  finish:      makeAudio('/sounds/finish.wav'),
}

function play(a: HTMLAudioElement) {
  a.currentTime = 0
  a.play().catch(() => { /* autoplay policy */ })
}

export function playCorrect()         { play(sfx.correct) }
export function playWrong()           { play(sfx.wrong) }
export function playCorrectWithHelp() { play(sfx.correctHelp) }
export function playFinish()          { play(sfx.finish) }
