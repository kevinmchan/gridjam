import { useEffect, useReducer, useRef, useState } from 'react';
import { createLocalSession } from './backends/local.js';
import { createOnlineSession, joinOnlineSession } from './backends/firebase.js';
import { displayTime } from './engine.js';

/* Owns the active backend session, the subscribed room state, screen
   navigation, and the clock tick. Both local and online play flow through
   the same `place`/`restart`/`timeout` actions. */
export function useRoom() {
  const [screen, setScreen] = useState('home');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, forceTick] = useReducer((x) => x + 1, 0);

  const sessionRef = useRef(null);
  const unsubRef = useRef(null);

  const bind = (session) => {
    if (unsubRef.current) unsubRef.current();
    sessionRef.current = session;
    unsubRef.current = session.subscribe(setRoom);
  };

  // navigate from the subscribed room status (drives the joining client too)
  useEffect(() => {
    if (!room) return;
    if (room.status === 'lobby') setScreen('lobby');
    else if (room.status === 'playing' || room.status === 'over') setScreen('game');
  }, [room?.status]);

  // clock display tick + timeout detection (display only; never trusts a
  // local interval for the authoritative clock — see engine.displayTime)
  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    const s = sessionRef.current;
    const t = setInterval(() => {
      forceTick();
      if (displayTime(room, room.player, s.now()) <= 0) s.timeout();
    }, 100);
    return () => clearInterval(t);
  }, [room?.status, room?.player, room?.turnStartedAt]);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const actions = {
    playLocal(config) {
      const session = createLocalSession();
      bind(session);
      session.start(config);
    },
    async createOnline(config) {
      setBusy(true); setError(null);
      try { bind(await createOnlineSession(config)); }
      catch (e) { setError(e.message); }
      finally { setBusy(false); }
    },
    async joinOnline(code) {
      setBusy(true); setError(null);
      try { bind(await joinOnlineSession((code || '').trim().toUpperCase())); }
      catch (e) { setError(e.message); }
      finally { setBusy(false); }
    },
    startGame() { sessionRef.current?.startGame(); },
    place(move) { sessionRef.current?.place(move); },
    restart() { sessionRef.current?.restart(); },
    leave() {
      if (unsubRef.current) unsubRef.current();
      sessionRef.current = null;
      unsubRef.current = null;
      setRoom(null);
      setError(null);
      setScreen('home');
    },
  };

  const session = sessionRef.current;
  return {
    screen, setScreen, room, error, busy, actions,
    mode: session?.mode || null,
    code: session?.code || null,
    mySeat: session?.mySeat ?? null,
    serverNow: session ? session.now() : Date.now(),
  };
}
