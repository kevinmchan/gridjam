/* In-memory single-device backend = the original hot-seat game.
   Same engine as online, so it doubles as a no-Firebase test path. */

import { createInitialState, resolveMove, resolveTimeout } from '../engine.js';

export function createLocalSession() {
  let state = null;
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn(state));
  const now = () => Date.now();

  return {
    mode: 'local',
    code: null,
    mySeat: null, // one device controls whoever's turn it is
    now,
    subscribe(cb) {
      subs.add(cb);
      cb(state);
      return () => subs.delete(cb);
    },
    start(config) {
      state = { ...createInitialState(config), turnStartedAt: now() };
      emit();
    },
    startGame() { /* local games start immediately in start() */ },
    place(move) {
      const next = resolveMove(state, { ...move, now: now() });
      if (!next) return;
      if (next.status === 'playing' && next.turnStartedAt == null) {
        next.turnStartedAt = now();
      }
      state = next;
      emit();
    },
    timeout() {
      const next = resolveTimeout(state, now());
      if (next) { state = next; emit(); }
    },
    restart() {
      if (!state) return;
      state = { ...createInitialState(state.config), turnStartedAt: now() };
      emit();
    },
  };
}
