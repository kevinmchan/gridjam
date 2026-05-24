/* Small presentational pieces, lifted unchanged from the original prototype. */

import { shapeBounds } from './gameLogic.js';

export function Stepper({ value, onChange }) {
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

export function ShapeIcon({ shape, color }) {
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

export function primaryBtn(active) {
  return {
    width: '100%', padding: '14px', borderRadius: 13, border: 'none',
    fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 700,
    color: '#fff', cursor: active ? 'pointer' : 'default',
    background: active ? 'linear-gradient(150deg,#e88a4a,#cf5f2c)' : '#cdbf9e',
    boxShadow: active ? '0 4px 0 rgba(140,80,30,0.35)' : 'none',
  };
}

export const ghostBtn = {
  flex: 1, padding: '11px', borderRadius: 11, cursor: 'pointer',
  border: '1px solid #d8c49a', background: 'transparent',
  fontFamily: "'Nunito Sans', sans-serif", fontSize: 13.5, fontWeight: 700,
  color: '#6b5b3c',
};
