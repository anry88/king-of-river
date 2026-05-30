import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  const username = context?.username ?? 'angler';

  return (
    <main className="game-shell">
      <div className="game-bg" />
      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-6 text-white">
        <div className="w-full max-w-sm text-center">
          <img
            className="mx-auto h-20 w-20 rounded-2xl shadow-2xl"
            src="/riverking/icon.png"
            alt="King of River icon"
          />
          <h1 className="mt-5 text-3xl font-semibold">King of River</h1>
          <p className="mt-2 text-sm text-sky-100">
            {username}, the river is open.
          </p>
          <button
            className="mt-6 h-11 w-full rounded-lg bg-amber-300 px-5 text-sm font-bold text-slate-950 shadow-xl transition hover:bg-amber-200"
            onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
          >
            Play
          </button>
        </div>
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
