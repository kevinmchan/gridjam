# Gridlock

A turn-based, two-player block duel for families — now playable online (each
player on their own device) as well as pass-and-play on a single device.

Drag blocks from a shared pool onto an 8×8 grid; complete full rows or columns
to clear them and score (triangular scoring, so multi-line clears pay off big).
First to the target score wins. Run out your chess clock, or get stuck with no
legal move, and you lose.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. **Pass-and-play (hot seat)** works with no setup. To play
**online**, add a Firebase config (below) and restart the dev server.

## Online play (Firebase Realtime Database)

1. Create a project at <https://console.firebase.google.com>.
2. Add a **Realtime Database** (Build → Realtime Database → Create).
3. Add a **Web app** (Project settings → General → Your apps) and copy its config.
4. Copy `.env.example` to `.env.local` and fill in the values:

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_DATABASE_URL=...   # e.g. https://your-project-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

   The Firebase web config is not secret (it's safe to ship in a client app),
   but `.env.local` is gitignored so you don't commit project-specific values.

5. Publish the database rules in `database.rules.json` (Realtime Database →
   Rules). They allow open read/write under `/rooms`.

### How it works

One record at `/rooms/{CODE}` holds the entire game: board, shared pool, scores,
clocks, whose turn, and status. Both clients subscribe and re-render on change.
The player whose turn it is computes the next state and writes it (single-writer,
so no conflicts). The chess clock uses Firebase `serverTimestamp()` plus the
client's server-time offset, so both devices compute the same remaining time —
the clock only ticks on the active player's turn.

To play: one person taps **Create a game** and shares the 4-letter code; the
other enters it under **Join**. Refreshing and re-entering the same code
reconnects you to the same seat.

### Trust model

Clients are trusted and there is **no server-side validation or anti-cheat** —
a deliberate choice for casual family play (see the rules: anyone with a room
code can write to that room). Don't use this for anything adversarial.

## Project layout

- `src/gameLogic.js` — pure rules (placement, line clears, scoring) + grid
  string encode/decode for the database.
- `src/engine.js` — pure state transitions (`resolveMove`, timeout, clock).
  Shared by both backends, so the local game and the online game run identical
  rules.
- `src/backends/local.js` — in-memory single-device backend (hot seat).
- `src/backends/firebase.js` — Realtime Database backend.
- `src/useRoom.js` — subscription, navigation, and the clock tick.
- `src/screens/`, `src/Game.jsx` — UI, ported from the original prototype.

The original standalone files (`gridlock.jsx`, `gridlock.html`) are not in the
repo; this project supersedes them.
