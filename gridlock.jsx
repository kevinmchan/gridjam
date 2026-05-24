import React, { useState, useEffect, useRef } from 'react';

/* ============================================================
   GRIDLOCK — a family block duel (points-race prototype)
   - 8x8 shared grid, free placement by DRAG, no rotation
   - Shared pool of 3 blocks; resets after all 3 are used
   - Full rows AND columns clear and SCORE points
   - Multi-line clears score far more (1/3/6/10/15...)
   - First to the target score wins
   - Lose if your clock runs out or you have no legal move
   ============================================================ */

const SIZE = 8;

const RAW_SHAPES = [
  [[0,0]],
  [[0,0],[0,1]],
  [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  [[0,0],[0,1],[1,0]],
  [[0,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1]],
  [[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[1,1]],
  [[0,1],[1,0],[1,1],[1,2]],
  [[0,0],[1,0],[1,1],[2,0]],
  [[0,1],[1,0],[1,1],[2,1]],
  [[0,1],[0,2],[1,0],[1,1]],
  [[0,0],[0,1],[1,1],[1,2]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,1],[1,1],[2,0],[2,1]],
  [[0,0],[0,1],[0,2],[1,0],[2,0]],
];

const emptyGrid = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

function canPlace(grid, shape, ar, ac) {
  for (const [dr, dc] of shape) {
    const r = ar + dr, c = ac + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

function anyMove(grid, pool) {
  for (const e of pool) {
    if (e.used) continue;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (canPlace(grid, e.shape, r, c)) return true;
  }
  return false;
}

function fullLines(grid) {
  const rows = [], cols = [];
  for (let r = 0; r < SIZE; r++)
    if (grid[r].every((x) => x !== null)) rows.push(r);
  for (let c = 0; c < SIZE; c++) {
    let f = true;
    for (let r = 0; r < SIZE; r++) if (grid[r][c] === null) { f = false; break; }
    if (f) cols.push(c);
  }
  return { rows, cols };
}

function applyCleared(grid, rows, cols) {
  const rs = new Set(rows), cs = new Set(cols);
  return grid.map((row, r) =>
    row.map((v, c) => (rs.has(r) || cs.has(c) ? null : v))
  );
}

function shapeBounds(shape) {
  let mr = 0, mc = 0;
  for (const [r, c] of shape) { mr = Math.max(mr, r); mc = Math.max(mc, c); }
  return { rows: mr + 1, cols: mc + 1 };
}

function timeFmt(ms) {
  const s = Math.max(0, ms / 1000);
  if (s < 10) return s.toFixed(1);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// triangular scoring: 1->1, 2->3, 3->6, 4->10, 5->15 ...
const scoreFor = (n) => (n * (n + 1)) / 2;
const COMBO = { 2: 'Double!', 3: 'Triple!', 4: 'Quad!' };
const comboLabel = (n) => (n >= 5 ? 'Mega!' : COMBO[n] || '');

const THEME = {
  1: { name: 'Coral', solid: 'linear-gradient(158deg,#ea8763,#cd5538)', flat: '#d96245', soft: 'rgba(217,98,69,0.5)' },
  2: { name: 'Teal',  solid: 'linear-gradient(158deg,#56b1a6,#2a8378)', flat: '#2f8c80', soft: 'rgba(47,140,128,0.5)' },
};

export default function Gridlock() {
  const uid = useRef(0);
  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const attemptRef = useRef(null);

  const makePool = () =>
    [0, 1, 2].map(() => ({
      id: ++uid.current,
      shape: RAW_SHAPES[Math.floor(Math.random() * RAW_SHAPES.length)],
      used: false,
    }));

  const [screen, setScreen] = useState('setup');
  const [names, setNames] = useState({ 1: 'Player 1', 2: 'Player 2' });
  const [setupMins, setSetupMins] = useState({ 1: 3, 2: 3 });
  const [setupTarget, setSetupTarget] = useState(20);

  const [grid, setGrid] = useState(emptyGrid);
  const [pool, setPool] = useState([]);
  const [player, setPlayer] = useState(1);
  const [times, setTimes] = useState({ 1: 180000, 2: 180000 });
  const [scores, setScores] = useState({ 1: 0, 2: 0 }); // points per player
  const [target, setTarget] = useState(20);             // points needed to win
  const [clearing, setClearing] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [scorePop, setScorePop] = useState(null);
  const [stats, setStats] = useState({ lines: { 1: 0, 2: 0 }, turns: 0 });

  // drag state (mirrored into a ref for window listeners)
  const [drag, setDragState] = useState(null);
  const setDrag = (next) => {
    const v = typeof next === 'function' ? next(dragRef.current) : next;
    dragRef.current = v;
    setDragState(v);
  };

  // chess clock
  useEffect(() => {
    if (screen !== 'game' || gameOver || clearing) return;
    const t = setInterval(() => {
      setTimes((prev) => ({ ...prev, [player]: Math.max(0, prev[player] - 100) }));
    }, 100);
    return () => clearInterval(t);
  }, [screen, player, gameOver, clearing]);

  useEffect(() => {
    if (screen === 'game' && !gameOver && times[player] <= 0) {
      setGameOver({ winner: player === 1 ? 2 : 1, reason: 'time', scores });
    }
  }, [times, player, screen, gameOver, scores]);

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
    if (entry.used || clearing || gameOver) return;
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

  function startGame() {
    setGrid(emptyGrid());
    setPool(makePool());
    setPlayer(1);
    setDrag(null);
    setTimes({ 1: setupMins[1] * 60000, 2: setupMins[2] * 60000 });
    setScores({ 1: 0, 2: 0 });
    setTarget(setupTarget);
    setClearing(null);
    setGameOver(null);
    setScorePop(null);
    setStats({ lines: { 1: 0, 2: 0 }, turns: 0 });
    setScreen('game');
  }

  function finalize(g, poolAfter, curScores) {
    let nextPool = poolAfter;
    if (poolAfter.every((e) => e.used)) nextPool = makePool();
    setGrid(g);
    setPool(nextPool);
    if (!anyMove(g, nextPool)) {
      // the next player is stuck with no legal move — they lose
      setGameOver({ winner: player, reason: 'nomove', scores: curScores });
      return;
    }
    setPlayer(player === 1 ? 2 : 1);
  }

  function attemptPlace(id, shape, anchor) {
    if (clearing || gameOver) return;
    const entry = pool.find((e) => e.id === id);
    if (!entry || entry.used) return;
    if (!canPlace(grid, shape, anchor.r, anchor.c)) return;

    const ng = grid.map((row) => row.slice());
    for (const [dr, dc] of shape) ng[anchor.r + dr][anchor.c + dc] = player;
    const poolAfter = pool.map((e) => (e.id === id ? { ...e, used: true } : e));
    const { rows, cols } = fullLines(ng);
    const lineCount = rows.length + cols.length;
    const pts = lineCount > 0 ? scoreFor(lineCount) : 0;
    const nextScores = { ...scores, [player]: scores[player] + pts };

    setStats((s) => ({
      lines: { ...s.lines, [player]: s.lines[player] + lineCount },
      turns: s.turns + 1,
    }));
    setScores(nextScores);
    if (pts > 0) {
      const cl = comboLabel(lineCount);
      setScorePop({ player, text: `+${pts}${cl ? '  ' + cl : ''}`, key: Date.now() });
      setTimeout(() => setScorePop(null), 1150);
    }

    const boardAfter = lineCount > 0 ? applyCleared(ng, rows, cols) : ng;
    const finish = () => {
      setClearing(null);
      if (nextScores[player] >= target) {
        setGrid(boardAfter);
        setGameOver({ winner: player, reason: 'target', scores: nextScores });
        return;
      }
      finalize(boardAfter, poolAfter, nextScores);
    };

    if (lineCount > 0) {
      setGrid(ng);
      setClearing({ rows: new Set(rows), cols: new Set(cols) });
      setTimeout(finish, 440);
    } else {
      finish();
    }
  }
  attemptRef.current = attemptPlace;

  const dAnchor = drag?.anchor;
  const previewValid = drag && dAnchor ? canPlace(grid, drag.shape, dAnchor.r, dAnchor.c) : false;
  const previewMap = {};
  if (drag && dAnchor) {
    for (const [dr, dc] of drag.shape) {
      const r = dAnchor.r + dr, c = dAnchor.c + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) previewMap[`${r},${c}`] = true;
    }
  }

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@400;600;700;800&display=swap');
    @keyframes gl-pop { 0%{transform:scale(0.45);} 70%{transform:scale(1.08);} 100%{transform:scale(1);} }
    @keyframes gl-flash { 0%{filter:brightness(1);} 45%{filter:brightness(2.4);} 100%{filter:brightness(1);opacity:0;transform:scale(0.6);} }
    @keyframes gl-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(208,72,60,0.55);} 50%{box-shadow:0 0 0 7px rgba(208,72,60,0);} }
    @keyframes gl-rise { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
    @keyframes gl-score { 0%{opacity:0;transform:translateY(6px) scale(0.8);} 20%{opacity:1;transform:translateY(0) scale(1.05);} 75%{opacity:1;} 100%{opacity:0;transform:translateY(-20px) scale(1);} }
    * { -webkit-tap-highlight-color: transparent; }
  `;

  const page = {
    fontFamily: "'Nunito Sans', sans-serif",
    minHeight: '100%',
    background: 'radial-gradient(120% 80% at 50% 0%, #f6ead0 0%, #ecd9b2 100%)',
    color: '#3a3025',
    padding: '18px 14px 40px',
    boxSizing: 'border-box',
  };
  const card = {
    background: '#fcf6e8',
    border: '1px solid #e2cfa3',
    borderRadius: 16,
    boxShadow: '0 6px 20px rgba(120,90,40,0.12)',
  };
  const display = { fontFamily: "'Fraunces', serif" };

  /* ---------------- SETUP SCREEN ---------------- */
  if (screen === 'setup') {
    return (
      <div style={page}>
        <style>{css}</style>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 22, animation: 'gl-rise .5s ease' }}>
            <div style={{ ...display, fontSize: 44, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
              GRIDLOCK
            </div>
            <div style={{ fontSize: 14, opacity: 0.7, marginTop: 6, fontWeight: 600 }}>
              a family block duel · prototype
            </div>
          </div>

          <div style={{ ...card, padding: 16, marginBottom: 14, fontSize: 13.5, lineHeight: 1.55 }}>
            Take turns dragging blocks onto the shared 8×8 grid. Complete a full row
            <em> or </em> column to clear it and score — clearing several lines at once
            scores far more. <strong>First to the target score wins.</strong> Your clock
            ticks only on your turn — run it out, or get stuck with no legal move, and you lose.
          </div>

          <div style={{ ...card, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.78, letterSpacing: '0.04em' }}>
              RACE TO
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Stepper
                value={setupTarget}
                onChange={(v) => setSetupTarget(Math.min(60, Math.max(10, v)))}
              />
              <span style={{ fontSize: 13, fontWeight: 700, width: 40, opacity: 0.75 }}>points</span>
            </div>
          </div>

          {[1, 2].map((p) => (
            <div key={p} style={{ ...card, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: THEME[p].solid, flexShrink: 0 }} />
                <input
                  value={names[p]}
                  onChange={(e) => setNames({ ...names, [p]: e.target.value })}
                  style={{
                    flex: 1, fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600,
                    background: 'transparent', border: 'none', borderBottom: '2px solid #e2cfa3',
                    color: '#3a3025', padding: '3px 2px', outline: 'none', minWidth: 0,
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.75 }}>CLOCK</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Stepper
                    value={setupMins[p]}
                    onChange={(v) => setSetupMins({ ...setupMins, [p]: Math.min(15, Math.max(1, v)) })}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, width: 40, opacity: 0.75 }}>min</span>
                </div>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 12, opacity: 0.62, textAlign: 'center', margin: '4px 0 14px', lineHeight: 1.5 }}>
            Tip: give the less-experienced player a longer clock — an honest handicap
            everyone can see.
          </div>

          <button onClick={startGame} style={primaryBtn(true)}>Start the duel</button>
        </div>
      </div>
    );
  }

  /* ---------------- GAME SCREEN ---------------- */
  const low = (p) => times[p] <= 30000;
  const bannerText = gameOver
    ? 'Game over'
    : drag
      ? (previewValid ? 'Release to drop ✓' : 'No room there — keep moving')
      : `${names[player]}'s turn`;

  return (
    <div style={page}>
      <style>{css}</style>
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
                    {names[p]}
                  </span>
                </div>
                <div style={{
                  ...display, fontSize: 26, fontWeight: 700, lineHeight: 1.15, marginTop: 1,
                  fontVariantNumeric: 'tabular-nums',
                  color: low(p) ? '#c1392b' : '#3a3025',
                }}>
                  {timeFmt(times[p])}
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
            {grid.map((row, r) =>
              row.map((val, c) => {
                const key = `${r},${c}`;
                const isPreview = previewMap[key];
                const isClearing = clearing && (clearing.rows.has(r) || clearing.cols.has(c)) && val !== null;
                return (
                  <div key={key} style={{
                    position: 'relative',
                    aspectRatio: '1', background: '#e7dabf', borderRadius: 6,
                    boxShadow: 'inset 0 2px 4px rgba(120,90,40,0.18)',
                  }}>
                    {/* a settled block */}
                    {val && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 6,
                        background: THEME[val].solid,
                        boxShadow: '0 2px 0 rgba(0,0,0,0.16), inset 0 2px 1px rgba(255,255,255,0.4)',
                        animation: isClearing ? 'gl-flash .44s ease forwards' : 'gl-pop .22s ease',
                      }} />
                    )}
                    {/* valid drop ghost — soft tint, dashed outline */}
                    {isPreview && previewValid && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: 6, boxSizing: 'border-box',
                        background: THEME[player].soft,
                        border: `2px dashed ${THEME[player].flat}`,
                      }} />
                    )}
                    {/* blocked drop ghost — bold red hatch, layered ON TOP of any
                        settled block so the whole shape (and the conflict) shows */}
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
              const disabled = e.used || !!gameOver || !!clearing;
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

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={startGame} style={ghostBtn}>Restart</button>
          <button onClick={() => setScreen('setup')} style={ghostBtn}>New setup</button>
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
              <span style={{ color: THEME[1].flat }}>{(gameOver.scores || scores)[1]}</span>
              <span style={{ opacity: 0.4, margin: '0 8px' }}>—</span>
              <span style={{ color: THEME[2].flat }}>{(gameOver.scores || scores)[2]}</span>
              <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 8 }}>pts</span>
            </div>
            <button onClick={startGame} style={primaryBtn(true)}>Play again</button>
            <button onClick={() => setScreen('setup')} style={{ ...ghostBtn, marginTop: 8, width: '100%' }}>
              New setup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- small components ---------------- */

function Stepper({ value, onChange }) {
  const btn = {
    width: 32, height: 32, borderRadius: 9, border: '1px solid #e2cfa3',
    background: '#f1e7cf', fontSize: 18, fontWeight: 800, color: '#3a3025',
    cursor: 'pointer', lineHeight: 1,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button style={btn} onClick={() => onChange(value - 1)}>−</button>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, width: 28, textAlign: 'center' }}>
        {value}
      </span>
      <button style={btn} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

function ShapeIcon({ shape, color }) {
  const { rows, cols } = shapeBounds(shape);
  const filled = new Set(shape.map(([r, c]) => `${r},${c}`));
  const dim = Math.max(rows, cols);
  const cell = dim <= 2 ? 13 : dim === 3 ? 11 : 9;
  return (
    <div style={{
      display: 'grid', gap: 2, justifyContent: 'center',
      gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
    }}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <div key={`${r},${c}`} style={{
            width: cell, height: cell, borderRadius: 3,
            background: filled.has(`${r},${c}`) ? color : 'transparent',
          }} />
        ))
      )}
    </div>
  );
}

function primaryBtn(active) {
  return {
    width: '100%', padding: '14px', borderRadius: 13, border: 'none',
    fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700,
    color: '#fff', cursor: active ? 'pointer' : 'default',
    background: active ? 'linear-gradient(150deg,#e88a4a,#cf5f2c)' : '#cdbf9e',
    boxShadow: active ? '0 4px 0 rgba(140,80,30,0.35)' : 'none',
  };
}

const ghostBtn = {
  flex: 1, padding: '11px', borderRadius: 11, cursor: 'pointer',
  border: '1px solid #d8c49a', background: 'transparent',
  fontFamily: "'Nunito Sans', sans-serif", fontSize: 13.5, fontWeight: 700,
  color: '#6b5b3c',
};
