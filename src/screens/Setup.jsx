import { useState } from 'react';
import { page, card, display, THEME } from '../theme.js';
import { Stepper, primaryBtn, ghostBtn } from '../components.jsx';

const DEFAULT_MINS = 10; // generous clock for remote play

export default function Setup({ intent, onSubmit, onBack, busy }) {
  const [names, setNames] = useState({ 1: 'Player 1', 2: 'Player 2' });
  const [mins, setMins] = useState({ 1: DEFAULT_MINS, 2: DEFAULT_MINS });
  const [target, setTarget] = useState(20);

  const submit = () => onSubmit({ names, mins, target });
  const cta = intent === 'online' ? 'Create the game' : 'Start the duel';

  return (
    <div style={page}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18, animation: 'gl-rise .5s ease' }}>
          <div style={{ ...display, fontSize: 38, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
            GRIDLOCK
          </div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6, fontWeight: 600 }}>
            {intent === 'online' ? 'set up an online game' : 'pass-and-play setup'}
          </div>
        </div>

        <div style={{ ...card, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.78, letterSpacing: '0.04em' }}>RACE TO</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stepper value={target} onChange={(v) => setTarget(Math.min(60, Math.max(10, v)))} />
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
                <Stepper value={mins[p]} onChange={(v) => setMins({ ...mins, [p]: Math.min(30, Math.max(1, v)) })} />
                <span style={{ fontSize: 13, fontWeight: 700, width: 40, opacity: 0.75 }}>min</span>
              </div>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12, opacity: 0.62, textAlign: 'center', margin: '4px 0 14px', lineHeight: 1.5 }}>
          Tip: give the less-experienced player a longer clock — an honest handicap
          everyone can see.
        </div>

        <button onClick={submit} disabled={busy} style={primaryBtn(!busy)}>
          {busy ? 'Creating…' : cta}
        </button>
        <button onClick={onBack} disabled={busy} style={{ ...ghostBtn, width: '100%', marginTop: 8 }}>
          Back
        </button>
      </div>
    </div>
  );
}
