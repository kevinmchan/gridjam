import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SIZE, canPlace, shapeBounds, timeFmt } from './gameLogic.js';
import { CLEAR_ANIM_MS, displayTime } from './engine.js';
import { page, card, display, THEME } from './theme.js';
import { ShapeIcon, primaryBtn, ghostBtn } from './components.jsx';

export default function Game({ room, mySeat, mode, serverNow, onPlace, onRestart, onLeave, code }) {
  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const attemptRef = useRef(null);
  const lastSeqRef = useRef(null);

  const [drag, setDragState] = useState(null);
  const [anim, setAnim] = useState(null);     // line-clear flash, from lastMove
  const [scorePop, setScorePop] = useState(null);

  const setDrag = (next) => {
    const v = typeof next === 'function' ? next(dragRef.current) : next;
    dragRef.current = v;
    setDragState(v);
  };

  const { status, grid, pool, player, scores, target, names, stats, gameOver } = room;
  const myTurn = mode === 'local' || player === mySeat;
  const canPlay = status === 'playing' && !anim && myTurn;

  // replay the placing client's clear flash + score popup on both devices
  useLayoutEffect(() => {
    const lm = room.lastMove;
    const seq = lm?.seq ?? 0;
    if (lastSeqRef.current === null) { lastSeqRef.current = seq; return; } // skip stale on mount
    if (!lm || seq === lastSeqRef.current) return;
    lastSeqRef.current = seq;
    const cleared = (lm.clearedRows?.length || 0) + (lm.clearedCols?.length || 0);
    if (cleared > 0 && lm.boardBefore) {
      setAnim({ seq, boardBefore: lm.boardBefore, rows: new Set(lm.clearedRows), cols: new Set(lm.clearedCols) });
    }
    if (lm.pts > 0) {
      setScorePop({ player: lm.by, text: `+${lm.pts}${lm.combo ? '  ' + lm.combo : ''}`, key: seq });
    }
  }, [room.lastMove?.seq]);

  useEffect(() => {
    if (!anim) return;
    const t = setTimeout(() => setAnim((a) => (a && a.seq === anim.seq ? null : a)), CLEAR_ANIM_MS);
    return () => clearTimeout(t);
  }, [anim?.seq]);

  useEffect(() => {
    if (!scorePop) return;
    const t = setTimeout(() => setScorePop((s) => (s && s.key === scorePop.key ? null : s)), 1150);
    return () => clearTimeout(t);
  }, [scorePop?.key]);

  function pointerToAnchor(shape, px, py, pType) {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return null;
    const cw = rect.width / SIZE;
    const ch = rect.height / SIZE;
    const colF = (px - rect.left) / cw;
    const rowF = (py - rect.top) / ch;
    const b = shapeBounds(shape);
    const lift = pType === 'touch' ? 1.2 : 0.35;
    return {
      r: Math.round(rowF - lift - b.rows + 0.5),
      c: Math.round(colF - b.cols / 2),
    };
  }

  function startDrag(e, entry) {
    if (!canPlay || entry.used) return;
    e.preventDefault();
    setDrag({
      id: entry.id,
      shape: entry.shape,
      pointerType: e.pointerType || 'mouse',
      anchor: pointerToAnchor(entry.shape, e.clientX, e.clientY, e.pointerType || 'mouse'),
    });
  }

  useEffect(() => {
    if (drag === null) return;
    const move = (e) => {
      if (e.cancelable) e.preventDefault();
      const d = dragRef.current;
      if (!d) return;
      setDrag({ ...d, anchor: pointerToAnchor(d.shape, e.clientX, e.clientY, d.pointerType) });
    };
    const up = () => {
      const d = dragRef.current;
      setDrag(null);
      if (d && d.anchor && attemptRef.current) attemptRef.current(d.id, d.shape, d.anchor);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag === null]);

  // reassigned every render so it sees the live grid/turn (no stale closure)
  attemptRef.current = (id, shape, anchor) => {
    if (!canPlay) return;
    if (!canPlace(grid, shape, anchor.r, anchor.c)) return;
    onPlace({ seat: player, id, anchor });
  };

  const dAnchor = drag?.anchor;
  const previewValid = drag && dAnchor ? canPlace(grid, drag.shape, dAnchor.r, dAnchor.c) : false;
  const previewMap = {};
  if (drag && dAnchor) {
    for (const [dr, dc] of drag.shape) {
      const r = dAnchor.r + dr, c = dAnchor.c + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) previewMap[`${r},${c}`] = true;
    }
  }

  const displayGrid = anim ? anim.boardBefore : grid;
  const low = (p) => displayTime(room, p, serverNow) <= 30000;
  const bannerText = gameOver
    ? 'Game over'
    : drag
      ? (previewValid ? 'Release to drop ✓' : 'No room there — keep moving')
      : myTurn
        ? (mode === 'online' ? 'Your turn' : `${names[player]}'s turn`)
        : `Waiting for ${names[player]}…`;

  return (
    <div style={page}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>

        {/* player panels: clock + score */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          {[1, 2].map((p) => {
            const active = p === player && !gameOver;
            const pct = Math.min(100, (scores[p] / target) * 100);
            return (
              <div key={p} style={{
                flex: 1, ...card, padding: '10px 12px', position: 'relative', overflow: 'hidden',
                border: active ? `2px solid ${THEME[p].flat}` : '1px solid #e2cfa3',
                background: active ? '#fffaef' : '#f3ead4',
                opacity: active ? 1 : 0.66,
                transform: active ? 'translateY(-2px)' : 'none',
                transition: 'all .18s ease',
                animation: active && low(p) ? 'gl-pulse 1s infinite' : 'none',
              }}>
                {scorePop && scorePop.player === p && (
                  <div key={scorePop.key} style={{
                    position: 'absolute', right: 10, top: 30, ...display,
                    fontSize: 17, fontWeight: 700, color: THEME[p].flat,
                    animation: 'gl-score 1.15s ease forwards', pointerEvents: 'none',
                  }}>
                    {scorePop.text}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: THEME[p].solid }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {names[p]}{mode === 'online' && p === mySeat ? ' (you)' : ''}
                  </span>
                </div>
                <div style={{
                  ...display, fontSize: 26, fontWeight: 700, lineHeight: 1.15, marginTop: 1,
                  fontVariantNumeric: 'tabular-nums',
                  color: low(p) ? '#c1392b' : '#3a3025',
                }}>
                  {timeFmt(displayTime(room, p, serverNow))}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                  <span style={{ ...display, fontSize: 22, fontWeight: 700, color: THEME[p].flat }}>
                    {scores[p]}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.5 }}>/ {target} pts</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: '#e7dabf', marginTop: 5 }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 4,
                    background: THEME[p].solid, transition: 'width .35s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* turn banner */}
        <div style={{
          ...card, padding: '7px 12px', marginBottom: 12, textAlign: 'center',
          background: drag && !previewValid ? '#b9462f' : THEME[player].solid,
          color: '#fff', border: 'none', transition: 'background .15s ease',
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{bannerText}</span>
        </div>

        {/* board */}
        <div style={{ ...card, padding: 8, marginBottom: 8, touchAction: 'none' }}>
          <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 4 }}>
            {displayGrid.map((row, r) =>
              row.map((val, c) => {
                const key = `${r},${c}`;
                const isPreview = previewMap[key];
                const isClearing = anim && (anim.rows.has(r) || anim.cols.has(c)) && val !== null;
                return (
                  <div key={key} style={{
                    position: 'relative',
                    aspectRatio: '1', background: '#e7dabf', borderRadius: 6,
                    boxShadow: 'inset 0 2px 4px rgba(120,90,40,0.18)',
                  }}>
                    {val && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 6,
                        background: THEME[val].solid,
                        boxShadow: '0 2px 0 rgba(0,0,0,0.16), inset 0 2px 1px rgba(255,255,255,0.4)',
                        animation: isClearing ? 'gl-flash .44s ease forwards' : 'gl-pop .22s ease',
                      }} />
                    )}
                    {isPreview && previewValid && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 6, boxSizing: 'border-box',
                        background: THEME[player].soft,
                        border: `2px dashed ${THEME[player].flat}`,
                      }} />
                    )}
                    {isPreview && !previewValid && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 6, boxSizing: 'border-box',
                        border: '2.5px dashed #a01a14',
                        background:
                          'repeating-linear-gradient(45deg,' +
                          'rgba(180,30,22,0.96) 0 7px,' +
                          'rgba(180,30,22,0.32) 7px 14px)',
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ fontSize: 11.5, opacity: 0.6, textAlign: 'center', marginBottom: 12, lineHeight: 1.45 }}>
          Drag a block onto the grid — watch the dashed outline, then let go. A line
          left one cell short is fair game for your opponent to finish and score.
        </div>

        {/* shared pool / tray */}
        <div style={{ ...card, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 9, letterSpacing: '0.05em' }}>
            SHARED BLOCKS
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-around' }}>
            {pool.map((e) => {
              const isDragged = drag && drag.id === e.id;
              const disabled = e.used || !canPlay;
              return (
                <div
                  key={e.id}
                  onPointerDown={(ev) => startDrag(ev, e)}
                  style={{
                    flex: 1, background: isDragged ? '#f3ead4' : '#f1e7cf',
                    border: '1px solid #e2cfa3', borderRadius: 12, padding: '12px 6px',
                    position: 'relative', touchAction: 'none', userSelect: 'none',
                    cursor: disabled ? 'default' : 'grab',
                    opacity: e.used ? 0.32 : (isDragged ? 0.35 : 1),
                    transition: 'opacity .12s ease',
                  }}
                >
                  <ShapeIcon shape={e.shape} color={THEME[player].flat} />
                  {e.used && (
                    <span style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 800, color: '#7a6c4f',
                    }}>✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...card, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
          <span style={{ fontWeight: 700, opacity: 0.6 }}>Turn {stats.turns}</span>
          <span style={{ fontWeight: 700 }}>
            Lines cleared — <span style={{ color: THEME[1].flat }}>{stats.lines[1]}</span>
            {' · '}
            <span style={{ color: THEME[2].flat }}>{stats.lines[2]}</span>
          </span>
        </div>

        {mode === 'online' && (
          <div style={{ textAlign: 'center', fontSize: 11.5, opacity: 0.55, marginTop: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
            ROOM {code}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={onRestart} style={ghostBtn}>Restart</button>
          <button onClick={onLeave} style={ghostBtn}>{mode === 'online' ? 'Leave' : 'New game'}</button>
        </div>
      </div>

      {/* game over overlay */}
      {gameOver && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(40,30,15,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ ...card, padding: 28, textAlign: 'center', maxWidth: 320, animation: 'gl-rise .35s ease' }}>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.6, letterSpacing: '0.1em' }}>WINNER</div>
            <div style={{ ...display, fontSize: 32, fontWeight: 700, margin: '6px 0 4px', color: THEME[gameOver.winner].flat }}>
              {names[gameOver.winner]}
            </div>
            <div style={{ fontSize: 13.5, opacity: 0.75, marginBottom: 14 }}>
              {gameOver.reason === 'target' && `${names[gameOver.winner]} hit ${target} points first.`}
              {gameOver.reason === 'time' && `${names[gameOver.winner === 1 ? 2 : 1]} ran out of time.`}
              {gameOver.reason === 'nomove' && `${names[gameOver.winner === 1 ? 2 : 1]} had no legal move left.`}
            </div>
            <div style={{ ...display, fontSize: 19, fontWeight: 700, marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ color: THEME[1].flat }}>{scores[1]}</span>
              <span style={{ opacity: 0.4, margin: '0 8px' }}>—</span>
              <span style={{ color: THEME[2].flat }}>{scores[2]}</span>
              <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 8 }}>pts</span>
            </div>
            <button onClick={onRestart} style={primaryBtn(true)}>Play again</button>
            <button onClick={onLeave} style={{ ...ghostBtn, marginTop: 8, width: '100%' }}>
              {mode === 'online' ? 'Leave' : 'New game'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
