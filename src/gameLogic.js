/* ============================================================
   GRIDLOCK — pure game logic (carried over from the original
   hot-seat prototype, unchanged). These functions have no
   dependency on React or the network, so both the local and
   the Firebase backends run the exact same rules.
   ============================================================ */

export const SIZE = 8;

export const RAW_SHAPES = [
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

export const emptyGrid = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

export function canPlace(grid, shape, ar, ac) {
  for (const [dr, dc] of shape) {
    const r = ar + dr, c = ac + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (grid[r][c] !== null) return false;
  }
  return true;
}

export function anyMove(grid, pool) {
  for (const e of pool) {
    if (e.used) continue;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (canPlace(grid, e.shape, r, c)) return true;
  }
  return false;
}

export function fullLines(grid) {
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

export function applyCleared(grid, rows, cols) {
  const rs = new Set(rows), cs = new Set(cols);
  return grid.map((row, r) =>
    row.map((v, c) => (rs.has(r) || cs.has(c) ? null : v))
  );
}

export function shapeBounds(shape) {
  let mr = 0, mc = 0;
  for (const [r, c] of shape) { mr = Math.max(mr, r); mc = Math.max(mc, c); }
  return { rows: mr + 1, cols: mc + 1 };
}

export function timeFmt(ms) {
  const s = Math.max(0, ms / 1000);
  if (s < 10) return s.toFixed(1);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// triangular scoring: 1->1, 2->3, 3->6, 4->10, 5->15 ...
export const scoreFor = (n) => (n * (n + 1)) / 2;
const COMBO = { 2: 'Double!', 3: 'Triple!', 4: 'Quad!' };
export const comboLabel = (n) => (n >= 5 ? 'Mega!' : COMBO[n] || '');

/* ---- serialization helpers (new) ----
   Realtime DB drops nulls and mangles sparse arrays, so the 8x8 grid
   travels over the wire as a 64-char string ('0' = empty, '1'/'2' = player). */

export function encodeGrid(grid) {
  let s = '';
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      s += grid[r][c] === null ? '0' : String(grid[r][c]);
  return s;
}

export function decodeGrid(str) {
  const grid = emptyGrid();
  if (!str) return grid;
  for (let i = 0; i < SIZE * SIZE; i++) {
    const ch = str[i];
    if (ch && ch !== '0') grid[Math.floor(i / SIZE)][i % SIZE] = Number(ch);
  }
  return grid;
}
