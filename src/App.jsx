import { useState } from 'react';
import { css } from './theme.js';
import { firebaseReady } from './firebase.js';
import { useRoom } from './useRoom.js';
import Home from './screens/Home.jsx';
import Setup from './screens/Setup.jsx';
import Lobby from './screens/Lobby.jsx';
import Game from './Game.jsx';

export default function App() {
  const r = useRoom();
  const [intent, setIntent] = useState('local'); // 'local' | 'online'

  let view = null;
  switch (r.screen) {
    case 'setup':
      view = (
        <Setup
          intent={intent}
          busy={r.busy}
          onBack={() => r.setScreen('home')}
          onSubmit={(config) =>
            intent === 'online' ? r.actions.createOnline(config) : r.actions.playLocal(config)
          }
        />
      );
      break;
    case 'lobby':
      view = (
        <Lobby
          code={r.code}
          room={r.room}
          mySeat={r.mySeat}
          onStart={r.actions.startGame}
          onLeave={r.actions.leave}
        />
      );
      break;
    case 'game':
      view = r.room ? (
        <Game
          room={r.room}
          mySeat={r.mySeat}
          mode={r.mode}
          code={r.code}
          serverNow={r.serverNow}
          onPlace={r.actions.place}
          onRestart={r.actions.restart}
          onLeave={r.actions.leave}
        />
      ) : null;
      break;
    default:
      view = (
        <Home
          firebaseReady={firebaseReady}
          busy={r.busy}
          error={r.error}
          onLocal={() => { setIntent('local'); r.setScreen('setup'); }}
          onCreate={() => { setIntent('online'); r.setScreen('setup'); }}
          onJoin={(code) => r.actions.joinOnline(code)}
        />
      );
  }

  return (
    <>
      <style>{css}</style>
      {view}
    </>
  );
}
