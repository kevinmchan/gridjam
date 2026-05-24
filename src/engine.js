/* ============================================================
   GRIDLOCK — game engine (pure state transitions)

   The authoritative game state lives in one record. Exactly one
   client (the host at start, the active player on each move) computes
   the next state here and writes it; the other client only reads.
   Keeping this pure means the in-memory local backend and the
   Firebase backend produce identical results from identical input.

   "Rich" state shape (used in React + here):
     status     'lobby' | 'playing' | 'over'
     grid       8x8 array of null | 1 | 2
     pool       [{ id, shapeIdx, shape, used }]   (3 shared blocks)
     nextId     next pool-entry id (deterministic across clients)
     player     1 | 2  (whose turn)
     scores     { 1, 2 }
     target     points to win
     times      { 1, 2 }  remaining ms
     turnStartedAt  server-ms when the current turn began
     names      { 1, 2 }
     stats      { lines: { 1, 2 }, turns }
     gameOver   null | { winner, reason: 'target'|'time'|'nomove' }
     lastMove   null | { seq, by, clearedRows, clearedCols, pts, combo, boardBefore }
     seats      { 1, 2 }  clientId per seat (online only)
     config     { names, mins: { 1, 2 }, target }
   ============================================================ */

import {
  RAW_SHAPES, emptyGrid, canPlace, anyMove, fullLines,
  applyCleared, scoreFor, comboLabel,
} from './gameLogic.js';

export const CLEAR_ANIM_MS = 440;

function poolEntry(id, shapeIdx) {
  return { id, shapeIdx, shape: RAW_SHAPES[shapeIdx], used: false };
}

// Randomness happens on a single writer only (host start / mover refill).
export function makePool(startId) {
  return [0, 1, 2].map((i) =>
    poolEntry(startId + i, Math.floor(Math.random() * RAW_SHAPES.length))
  );
}

export function createInitialState(config, seats = {}) {
  return {
    status: 'playing',
    grid: emptyGrid(),
    pool: makePool(1),
    nextId: 4,
    player: 1,
    scores: { 1: 0, 2: 0 },
    target: config.target,
    times: { 1: config.mins[1] * 60000, 2: config.mins[2] * 60000 },
    turnStartedAt: null, // stamped with server time by the backend
    names: { ...config.names },
    stats: { lines: { 1: 0, 2: 0 }, turns: 0 },
    gameOver: null,
    lastMove: null,
    moveSeq: 0,
    seats,
    config,
  };
}

/* Resolve a placement attempt into the next state.
   `move`: { seat, id, anchor: { r, c }, now }  (now = server-aligned ms)
   Returns the next rich state, or null if the move is illegal/ignored. */
export function resolveMove(state, move) {
  const { seat, id, anchor, now } = move;
  if (!state || state.status !== 'playing') return null;
  if (seat !== state.player) return null;

  const entry = state.pool.find((e) => e.id === id);
  if (!entry || entry.used) return null;
  const shape = RAW_SHAPES[entry.shapeIdx];
  if (!canPlace(state.grid, shape, anchor.r, anchor.c)) return null;

  // place the block
  const ng = state.grid.map((row) => row.slice());
  for (const [dr, dc] of shape) ng[anchor.r + dr][anchor.c + dc] = seat;

  const poolAfter = state.pool.map((e) =>
    e.id === id ? { ...e, used: true } : e
  );

  const { rows, cols } = fullLines(ng);
  const lineCount = rows.length + cols.length;
  const pts = lineCount > 0 ? scoreFor(lineCount) : 0;
  const nextScores = { ...state.scores, [seat]: state.scores[seat] + pts };
  const boardAfter = lineCount > 0 ? applyCleared(ng, rows, cols) : ng;

  // refill the shared pool once all three are used (single writer)
  let nextPool = poolAfter;
  let nextId = state.nextId;
  if (poolAfter.every((e) => e.used)) {
    nextPool = makePool(nextId);
    nextId += 3;
  }

  const elapsed = state.turnStartedAt ? Math.max(0, now - state.turnStartedAt) : 0;
  const newRemaining = Math.max(0, state.times[seat] - elapsed);

  const base = {
    ...state,
    grid: boardAfter,
    pool: nextPool,
    nextId,
    scores: nextScores,
    times: { ...state.times, [seat]: newRemaining },
    stats: {
      lines: { ...state.stats.lines, [seat]: state.stats.lines[seat] + lineCount },
      turns: state.stats.turns + 1,
    },
    lastMove: {
      seq: (state.lastMove?.seq || 0) + 1,
      by: seat,
      clearedRows: rows,
      clearedCols: cols,
      pts,
      combo: comboLabel(lineCount),
      boardBefore: lineCount > 0 ? ng : null, // pre-clear board, for the flash
    },
  };

  // win by reaching the target
  if (nextScores[seat] >= state.target) {
    return { ...base, status: 'over', gameOver: { winner: seat, reason: 'target' } };
  }
  // the opponent has no legal move on the (refilled) board → they lose
  if (!anyMove(boardAfter, nextPool)) {
    return { ...base, status: 'over', gameOver: { winner: seat, reason: 'nomove' } };
  }
  // otherwise flip the turn; backend stamps a fresh server turnStartedAt
  return { ...base, player: seat === 1 ? 2 : 1, turnStartedAt: null };
}

/* The active player's clock crossed zero. Returns a game-over state or null. */
export function resolveTimeout(state, now) {
  if (!state || state.status !== 'playing') return null;
  const p = state.player;
  const elapsed = state.turnStartedAt ? Math.max(0, now - state.turnStartedAt) : 0;
  if (state.times[p] - elapsed > 0) return null;
  return {
    ...state,
    status: 'over',
    times: { ...state.times, [p]: 0 },
    gameOver: { winner: p === 1 ? 2 : 1, reason: 'time' },
  };
}

/* Remaining ms to display for a player, given a server-aligned clock. */
export function displayTime(state, p, serverNow) {
  if (!state) return 0;
  if (p === state.player && state.status === 'playing' && state.turnStartedAt) {
    return Math.max(0, state.times[p] - (serverNow - state.turnStartedAt));
  }
  return state.times[p];
}
