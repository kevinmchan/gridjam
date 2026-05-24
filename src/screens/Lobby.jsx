import { page, card, display, THEME } from '../theme.js';
import { primaryBtn, ghostBtn } from '../components.jsx';

export default function Lobby({ code, room, mySeat, onStart, onLeave }) {
  const guestJoined = Boolean(room?.seats?.[2]);
  const isHost = mySeat === 1;
  const names = room?.names || { 1: 'Player 1', 2: 'Player 2' };

  const seatRow = (p, joined) => (
    <div key={p} style={{
      ...card, padding: '12px 14px', marginBottom: 10, display: 'flex',
      alignItems: 'center', gap: 10, opacity: joined ? 1 : 0.6,
    }}>
      <span style={{ width: 18, height: 18, borderRadius: 6, background: THEME[p].solid, flexShrink: 0 }} />
      <span style={{ flex: 1, fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600 }}>
        {names[p]}{p === mySeat ? '  (you)' : ''}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: joined ? THEME[2].flat : '#9a8a66' }}>
        {joined ? 'ready' : 'waiting…'}
      </span>
    </div>
  );

  return (
    <div style={page}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16, animation: 'gl-rise .5s ease' }}>
          <div style={{ ...display, fontSize: 34, fontWeight: 700, letterSpacing: '0.04em' }}>GRIDLOCK</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, fontWeight: 600 }}>game lobby</div>
        </div>

        <div style={{ ...card, padding: 18, marginBottom: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, letterSpacing: '0.06em' }}>SHARE THIS CODE</div>
          <div style={{ ...display, fontSize: 52, fontWeight: 700, letterSpacing: '0.16em', color: THEME[1].flat, marginTop: 4 }}>
            {code}
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.66, marginTop: 4 }}>
            Your opponent enters this on the home screen to join.
          </div>
        </div>

        {seatRow(1, Boolean(room?.seats?.[1]))}
        {seatRow(2, guestJoined)}

        <div style={{ marginTop: 14 }}>
          {isHost ? (
            <button onClick={onStart} disabled={!guestJoined} style={primaryBtn(guestJoined)}>
              {guestJoined ? 'Start the duel' : 'Waiting for player 2…'}
            </button>
          ) : (
            <div style={{ ...card, padding: 14, textAlign: 'center', fontSize: 13.5, fontWeight: 700, opacity: 0.8 }}>
              Joined! Waiting for the host to start…
            </div>
          )}
          <button onClick={onLeave} style={{ ...ghostBtn, width: '100%', marginTop: 10 }}>Leave</button>
        </div>
      </div>
    </div>
  );
}
