import { useState } from 'react';
import { page, card, display } from '../theme.js';
import { primaryBtn, ghostBtn } from '../components.jsx';

export default function Home({ onLocal, onCreate, onJoin, error, busy, firebaseReady }) {
  const [code, setCode] = useState('');

  return (
    <div style={page}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22, animation: 'gl-rise .5s ease' }}>
          <div style={{ ...display, fontSize: 44, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1 }}>
            GRIDLOCK
          </div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 6, fontWeight: 600 }}>
            a family block duel
          </div>
        </div>

        <div style={{ ...card, padding: 16, marginBottom: 14, fontSize: 13.5, lineHeight: 1.55 }}>
          Take turns dragging blocks onto a shared 8×8 grid. Complete a full row
          <em> or </em> column to clear it and score — clearing several lines at once
          scores far more. <strong>First to the target score wins.</strong> Play on one
          device, or online with someone on theirs.
        </div>

        <div style={{ ...card, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 10, letterSpacing: '0.05em' }}>
            PLAY ONLINE
          </div>
          <button onClick={onCreate} disabled={!firebaseReady || busy} style={primaryBtn(firebaseReady && !busy)}>
            Create a game
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={4}
              style={{
                flex: 1, fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700,
                letterSpacing: '0.18em', textAlign: 'center', textTransform: 'uppercase',
                background: '#f1e7cf', border: '1px solid #e2cfa3', borderRadius: 11,
                color: '#3a3025', padding: '10px 8px', outline: 'none', minWidth: 0,
              }}
            />
            <button
              onClick={() => onJoin(code)}
              disabled={!firebaseReady || busy || code.length < 4}
              style={{ ...ghostBtn, flex: '0 0 auto', padding: '11px 18px', opacity: (firebaseReady && code.length >= 4 && !busy) ? 1 : 0.5 }}
            >
              Join
            </button>
          </div>
          {!firebaseReady && (
            <div style={{ fontSize: 12, opacity: 0.62, marginTop: 10, lineHeight: 1.45 }}>
              Online play needs a Firebase config. Add your <code>VITE_FIREBASE_*</code> values
              to <code>.env.local</code> (see <code>.env.example</code>) and restart the dev server.
            </div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: '#b9462f', marginTop: 10, fontWeight: 700 }}>{error}</div>
          )}
        </div>

        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 10, letterSpacing: '0.05em' }}>
            ON THIS DEVICE
          </div>
          <button onClick={onLocal} disabled={busy} style={{ ...ghostBtn, width: '100%', padding: '13px' }}>
            Pass-and-play (hot seat)
          </button>
        </div>
      </div>
    </div>
  );
}
