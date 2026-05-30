import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './hooks/useGame';
import type {
  ActiveCast,
  GameCatalog,
  GameProfile,
  Rarity,
} from '../shared/game/types';

type StatTileProps = {
  label: string;
  value: string;
};

type CastControlsProps = {
  activeCast: ActiveCast | null;
  actionPending: boolean;
  tapCount: number;
  onStartCast: () => void;
  onHook: () => void;
  onTap: () => void;
  onLand: () => void;
};

type LocationSelectProps = {
  catalog: GameCatalog;
  profile: GameProfile;
  disabled: boolean;
  onSelectLocation: (locationId: string) => void;
};

type CatchLogProps = {
  profile: GameProfile;
};

const rarityClass: Record<Rarity, string> = {
  common: 'text-slate-100',
  uncommon: 'text-emerald-200',
  rare: 'text-sky-200',
  epic: 'text-fuchsia-200',
  legendary: 'text-amber-200',
};

export const App = () => {
  const {
    snapshot,
    loadState,
    actionPending,
    tapCount,
    errorMessage,
    startCast,
    hook,
    land,
    addTap,
    selectLocation,
  } = useGame();

  if (loadState === 'loading') {
    return (
      <main className="game-shell">
        <div className="game-bg" />
        <section className="relative z-10 flex min-h-screen items-center justify-center px-6 text-white">
          <div className="text-center">
            <img
              className="mx-auto mb-5 h-20 w-20 rounded-2xl shadow-2xl"
              src="/riverking/icon.png"
              alt="King of River icon"
            />
            <h1 className="text-3xl font-semibold">King of River</h1>
            <p className="mt-2 text-sm text-sky-100">Loading fishing grounds</p>
          </div>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="game-shell">
        <div className="game-bg" />
        <section className="relative z-10 flex min-h-screen items-center justify-center px-6 text-white">
          <div className="max-w-sm text-center">
            <img
              className="mx-auto mb-5 h-20 w-20 rounded-2xl shadow-2xl"
              src="/riverking/icon.png"
              alt="King of River icon"
            />
            <h1 className="text-3xl font-semibold">King of River</h1>
            <p className="mt-2 text-sm text-amber-100">
              {errorMessage ?? 'Game loading failed.'}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const { profile, catalog, message } = snapshot;
  const activeCast = profile.activeCast;
  const hookedFish = activeCast?.hookedFish ?? null;
  const challenge = activeCast?.challenge ?? null;
  const selectedLocation =
    catalog.locations.find((location) => location.id === profile.currentLocationId) ??
    catalog.locations[0];
  const progressPercent = challenge
    ? Math.min(100, Math.round((tapCount / challenge.tapGoal) * 100))
    : 0;

  return (
    <main className="game-shell">
      <div className="game-bg" />
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-5 text-white sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              className="h-12 w-12 rounded-xl shadow-xl"
              src="/riverking/icon.png"
              alt="King of River icon"
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold sm:text-3xl">
                King of River
              </h1>
              <p className="truncate text-sm text-sky-100">
                {profile.username} at {selectedLocation?.name ?? 'River Bank'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right">
            <StatTile label="Level" value={String(profile.level)} />
            <StatTile label="Coins" value={String(profile.coins)} />
            <StatTile label="Fish" value={String(profile.discoveredFishIds.length)} />
          </div>
        </header>

        <section className="grid flex-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="game-stage">
            <div className="absolute left-6 top-6 max-w-[70%]">
              <p className="text-sm font-medium text-sky-100">{message}</p>
              {errorMessage ? (
                <p className="mt-1 text-sm font-medium text-amber-100">{errorMessage}</p>
              ) : null}
            </div>

            <div className="water-line">
              <img
                className={`bobber ${activeCast ? 'bobber-active' : ''}`}
                src="/riverking/bobber.svg"
                alt="Fishing bobber"
              />
            </div>

            {hookedFish ? (
              <div className="hooked-fish">
                <p className={`text-xl font-semibold ${rarityClass[hookedFish.rarity]}`}>
                  {hookedFish.fishName}
                </p>
                <p className="text-sm text-sky-100">
                  {hookedFish.weightKg} kg / {hookedFish.rarity}
                </p>
              </div>
            ) : null}

            {challenge ? (
              <div className="challenge-bar">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-sky-100">
                  <span>Pressure</span>
                  <span>
                    {tapCount}/{challenge.tapGoal}
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-950/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-amber-200 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}

            <CastControls
              activeCast={activeCast}
              actionPending={actionPending}
              tapCount={tapCount}
              onStartCast={startCast}
              onHook={hook}
              onTap={addTap}
              onLand={land}
            />
          </div>

          <aside className="side-panel">
            <LocationSelect
              catalog={catalog}
              profile={profile}
              disabled={Boolean(activeCast) || actionPending}
              onSelectLocation={selectLocation}
            />
            <CatchLog profile={profile} />
          </aside>
        </section>
      </section>
    </main>
  );
};

const StatTile = ({ label, value }: StatTileProps) => {
  return (
    <div className="min-w-16 rounded-lg border border-white/15 bg-slate-950/35 px-3 py-2 backdrop-blur">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-sky-100">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
};

const CastControls = ({
  activeCast,
  actionPending,
  tapCount,
  onStartCast,
  onHook,
  onTap,
  onLand,
}: CastControlsProps) => {
  if (!activeCast) {
    return (
      <button className="primary-action" disabled={actionPending} onClick={onStartCast}>
        Cast
      </button>
    );
  }

  if (activeCast.stage === 'casting') {
    return (
      <button className="primary-action" disabled={actionPending} onClick={onHook}>
        Hook
      </button>
    );
  }

  return (
    <div className="absolute inset-x-4 bottom-4 grid gap-3 sm:grid-cols-2">
      <button className="primary-action static" disabled={actionPending} onClick={onTap}>
        Tap {tapCount}
      </button>
      <button className="secondary-action" disabled={actionPending} onClick={onLand}>
        Land
      </button>
    </div>
  );
};

const LocationSelect = ({
  catalog,
  profile,
  disabled,
  onSelectLocation,
}: LocationSelectProps) => {
  return (
    <section>
      <h2 className="section-title">Locations</h2>
      <div className="mt-3 grid gap-2">
        {catalog.locations.map((location) => {
          const locked = location.unlockLevel > profile.level;
          const selected = location.id === profile.currentLocationId;

          return (
            <button
              key={location.id}
              className={`location-row ${selected ? 'location-row-selected' : ''}`}
              disabled={disabled || locked}
              onClick={() => onSelectLocation(location.id)}
            >
              <span className="font-semibold">{location.name}</span>
              <span className="text-xs text-sky-100">
                {locked ? `Level ${location.unlockLevel}` : location.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const CatchLog = ({ profile }: CatchLogProps) => {
  return (
    <section className="mt-6">
      <h2 className="section-title">Recent Catches</h2>
      <div className="mt-3 grid gap-2">
        {profile.catches.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-3 text-sm text-sky-100">
            No catches yet.
          </p>
        ) : (
          profile.catches.map((catchRecord) => (
            <div
              className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2"
              key={catchRecord.id}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`font-semibold ${rarityClass[catchRecord.rarity]}`}>
                  {catchRecord.fishName}
                </span>
                <span className="text-sm text-sky-100">{catchRecord.weightKg} kg</span>
              </div>
              <div className="mt-1 text-xs text-sky-100">
                +{catchRecord.coins} coins / +{catchRecord.xp} xp
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
