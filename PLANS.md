# Feature Plans

## 1. Timed Challenge Mode ("Race the Clock")

Play for a fixed duration (e.g. 30 seconds) and see how many cards the user can solve correctly.

**Concept**
- User picks a duration (e.g. 10s / 30s / 60s) on the deck selection screen, alongside the existing deck picker.
- A countdown timer runs at the top of the screen during play.
- Cards advance as fast as the user answers — no per-card delay, just a brief flash of correct/wrong.
- When time runs out, show a results screen: cards attempted, correct, wrong, and a "best score" for that deck+duration combo (persisted in localStorage).

**Design notes**
- The per-card `correctDelay` / `wrongDelay` should be shortened or removed in this mode — speed is the point.
- SM-2 scheduling still updates in the background (correct answers still count toward long-term learning).
- "עזרה" / reveal still works but eats into the clock.
- Best scores stored per `(deckFilter, duration)` key so records are meaningful.

---

## 2. Two-Player Game

Two players take turns answering cards, competing for the higher score.

**Concept**
- On the menu, choose "שני שחקנים" (two players). Enter names (optional).
- Players alternate turns. Each turn: one card is shown, the player answers.
- Correct → point to that player. Wrong → no point (or point to the other player, TBD).
- After N cards (configurable, e.g. 10 or 20), show a winner screen with both scores.

**Design notes**
- The active player's name / color is shown prominently during their turn.
- Could use deck colors to visually distinguish whose turn it is.
- SM-2 state is shared (same deck), so both players' answers contribute to long-term scheduling.
- Voice input remains active — both players can speak their answers.
- Possible extension: each player picks their own deck (e.g. Player 1 on 6×, Player 2 on 7×).
