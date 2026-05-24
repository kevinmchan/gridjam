/* Firebase Realtime Database backend.

   One record per game at /rooms/{CODE}. The active player computes the
   next state with the shared engine and writes the whole record; both
   clients subscribe with onValue. Single-writer discipline (only the
   player whose turn it is writes a move) keeps writes conflict-free.
   The clock uses serverTimestamp() + .info/serverTimeOffset so both
   devices compute the same remaining time. */

import {
  ref, onValue, get, set, runTransaction, serverTimestamp, child,
} from 'firebase/database';
import { getDb } from '../firebase.js';
import {
  createInitialState, resolveMove, resolveTimeout,
} from '../engine.js';
import { encodeGrid, decodeGrid, emptyGrid, RAW_SHAPES } from '../gameLogic.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L ambiguity

function genCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export function getClientId() {
  let id = localStorage.getItem('gridlock-cid');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('gridlock-cid', id);
  }
  return id;
}

function serialize(s) {
  const wire = {
    status: s.status,
    grid: encodeGrid(s.grid),
    pool: (s.pool || []).map(({ id, shapeIdx, used }) => ({ id, shapeIdx, used })),
    nextId: s.nextId,
    player: s.player,
    scores: s.scores,
    target: s.target,
    times: s.times,
    names: s.names,
    stats: s.stats,
    seats: s.seats || {},
    config: s.config,
  };
  if (s.turnStartedAt != null) wire.turnStartedAt = s.turnStartedAt;
  if (s.gameOver) wire.gameOver = s.gameOver;
  if (s.lastMove) {
    wire.lastMove = {
      seq: s.lastMove.seq,
      by: s.lastMove.by,
      clearedRows: s.lastMove.clearedRows || [],
      clearedCols: s.lastMove.clearedCols || [],
      pts: s.lastMove.pts,
      combo: s.lastMove.combo || '',
      boardBefore: s.lastMove.boardBefore ? encodeGrid(s.lastMove.boardBefore) : null,
    };
  }
  return wire;
}

function deserialize(w) {
  if (!w) return null;
  return {
    status: w.status,
    grid: w.grid ? decodeGrid(w.grid) : emptyGrid(),
    pool: (w.pool || []).map((e) => ({ ...e, shape: RAW_SHAPES[e.shapeIdx] })),
    nextId: w.nextId || 1,
    player: w.player || 1,
    scores: w.scores || { 1: 0, 2: 0 },
    target: w.target || 20,
    times: w.times || { 1: 0, 2: 0 },
    turnStartedAt: w.turnStartedAt ?? null,
    names: w.names || { 1: 'Player 1', 2: 'Player 2' },
    stats: w.stats || { lines: { 1: 0, 2: 0 }, turns: 0 },
    gameOver: w.gameOver || null,
    lastMove: w.lastMove
      ? {
          ...w.lastMove,
          clearedRows: w.lastMove.clearedRows || [],
          clearedCols: w.lastMove.clearedCols || [],
          boardBefore: w.lastMove.boardBefore ? decodeGrid(w.lastMove.boardBefore) : null,
        }
      : null,
    seats: w.seats || {},
    config: w.config,
  };
}

function makeSession(code, mySeat) {
  const db = getDb();
  const roomRef = ref(db, `rooms/${code}`);

  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => { offset = snap.val() || 0; });
  const now = () => Date.now() + offset;

  const writeState = (state) => {
    const wire = serialize(state);
    // authoritative server time whenever a new turn begins
    if (state.status === 'playing' && state.turnStartedAt == null) {
      wire.turnStartedAt = serverTimestamp();
    }
    return set(roomRef, wire);
  };

  return {
    mode: 'online',
    code,
    mySeat,
    now,
    subscribe(cb) {
      return onValue(roomRef, (snap) => cb(deserialize(snap.val())));
    },
    async startGame() {
      const snap = await get(roomRef);
      const cur = deserialize(snap.val());
      if (!cur || !cur.config) return;
      await writeState(createInitialState(cur.config, cur.seats));
    },
    async place(move) {
      const snap = await get(roomRef);
      const state = deserialize(snap.val());
      const next = resolveMove(state, { ...move, now: now() });
      if (!next) return;
      await writeState(next);
    },
    async timeout() {
      // transaction guards against both clients resolving the timeout at once
      await runTransaction(roomRef, (w) => {
        if (!w || w.status !== 'playing') return w;
        const next = resolveTimeout(deserialize(w), now());
        if (!next) return w;
        return serialize(next);
      });
    },
    async restart() {
      const snap = await get(roomRef);
      const cur = deserialize(snap.val());
      if (!cur || !cur.config) return;
      await writeState(createInitialState(cur.config, cur.seats));
    },
  };
}

export async function createOnlineSession(config) {
  const db = getDb();
  const cid = getClientId();
  let code = genCode();
  for (let i = 0; i < 5; i++) {
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) break;
    code = genCode();
  }
  await set(ref(db, `rooms/${code}`), {
    status: 'lobby',
    config,
    names: config.names,
    seats: { 1: cid },
    createdAt: serverTimestamp(),
  });
  return makeSession(code, 1);
}

export async function joinOnlineSession(code) {
  const db = getDb();
  const cid = getClientId();
  const roomRef = ref(db, `rooms/${code}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error('No game with that code.');

  let mySeat = null;
  await runTransaction(child(roomRef, 'seats'), (seats) => {
    seats = seats || {};
    if (seats[1] === cid) { mySeat = 1; return seats; }       // host reconnecting
    if (seats[2] === cid || !seats[2]) { seats[2] = cid; mySeat = 2; return seats; }
    return; // both seats taken by others → abort
  });
  if (mySeat == null) throw new Error('That game is full.');
  return makeSession(code, mySeat);
}
