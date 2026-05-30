import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './hooks/useGame';
import type {
  ActiveCast,
  BaitDefinition,
  FishDefinition,
  GameCatalog,
  GameProfile,
  LocationDefinition,
  Rarity,
} from '../shared/game/types';

type SetupBarProps = {
  catalog: GameCatalog;
  profile: GameProfile;
  disabled: boolean;
  onSelectLocation: (locationId: string) => void;
  onSelectBait: (baitId: string) => void;
};

type FishingStageProps = {
  catalog: GameCatalog;
  activeCast: ActiveCast | null;
  actionPending: boolean;
  selectedBait: BaitDefinition | null;
  selectedLocation: LocationDefinition | null;
  hookedFish: FishDefinition | null;
  profile: GameProfile;
  message: string;
  errorMessage: string | null;
  tapCount: number;
  progressPercent: number;
  onStartCast: () => void;
  onHook: () => void;
  onTap: () => void;
  onLand: () => void;
};

type ActionControlsProps = {
  activeCast: ActiveCast | null;
  actionPending: boolean;
  tapCount: number;
  onStartCast: () => void;
  onHook: () => void;
  onTap: () => void;
  onLand: () => void;
};

type StatPillProps = {
  label: string;
  value: string;
};

const rarityClass: Record<Rarity, string> = {
  common: 'rarity-common',
  uncommon: 'rarity-uncommon',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  mythic: 'rarity-mythic',
  legendary: 'rarity-legendary',
};

const bottomTabs = [
  { id: 'fishing', label: 'Рыбалка', icon: '/riverking/menu/fishing.webp', active: true },
  { id: 'ratings', label: 'Рейтинги', icon: '/riverking/menu/ratings.webp', active: false },
  { id: 'catalog', label: 'Каталог', icon: '/riverking/menu/guide.webp', active: false },
  { id: 'shop', label: 'Магазин', icon: '/riverking/menu/shop.webp', active: false },
];

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
    selectBait,
  } = useGame();

  if (loadState === 'loading') {
    return <LoadingState text="Загружаем Пруд" />;
  }

  if (!snapshot) {
    return <LoadingState text={errorMessage ?? 'Игра не загрузилась'} />;
  }

  const { profile, catalog, message } = snapshot;
  const activeCast = profile.activeCast;
  const challenge = activeCast?.challenge ?? null;
  const selectedLocation =
    catalog.locations.find((location) => location.id === profile.currentLocationId) ??
    catalog.locations[0] ??
    null;
  const selectedBait =
    catalog.baits.find((bait) => bait.id === profile.currentBaitId) ??
    catalog.baits[0] ??
    null;
  const hookedFish = activeCast?.hookedFish
    ? catalog.fish.find((fish) => fish.id === activeCast.hookedFish?.fishId) ?? null
    : null;
  const progressPercent = challenge
    ? Math.min(100, Math.round((tapCount / challenge.tapGoal) * 100))
    : 0;

  return (
    <main className="rk-shell">
      <section className="rk-screen">
        <SetupBar
          catalog={catalog}
          profile={profile}
          disabled={Boolean(activeCast) || actionPending}
          onSelectLocation={selectLocation}
          onSelectBait={selectBait}
        />

        <FishingStage
          catalog={catalog}
          activeCast={activeCast}
          actionPending={actionPending}
          selectedBait={selectedBait}
          selectedLocation={selectedLocation}
          hookedFish={hookedFish}
          profile={profile}
          message={message}
          errorMessage={errorMessage}
          tapCount={tapCount}
          progressPercent={progressPercent}
          onStartCast={startCast}
          onHook={hook}
          onTap={addTap}
          onLand={land}
        />

        <BottomTabs />
      </section>
    </main>
  );
};

const LoadingState = ({ text }: { text: string }) => {
  return (
    <main className="rk-shell">
      <section className="rk-loading">
        <img className="rk-loading-icon" src="/riverking/icon.png" alt="King of River" />
        <h1>King of River</h1>
        <p>{text}</p>
      </section>
    </main>
  );
};

const SetupBar = ({
  catalog,
  profile,
  disabled,
  onSelectLocation,
  onSelectBait,
}: SetupBarProps) => {
  return (
    <header className="setup-bar">
      <div className="location-strip" aria-label="Локация">
        {catalog.locations.map((location) => {
          const selected = location.id === profile.currentLocationId;

          return (
            <button
              className={`setup-location ${selected ? 'setup-location-selected' : ''}`}
              disabled={disabled}
              key={location.id}
              onClick={() => onSelectLocation(location.id)}
              type="button"
            >
              <span>Локация</span>
              <strong>{location.name}</strong>
            </button>
          );
        })}
      </div>

      <div className="bait-strip" aria-label="Приманка">
        {catalog.baits.map((bait) => {
          const selected = bait.id === profile.currentBaitId;

          return (
            <button
              className={`bait-chip ${selected ? 'bait-chip-selected' : ''}`}
              disabled={disabled}
              key={bait.id}
              onClick={() => onSelectBait(bait.id)}
              type="button"
            >
              <img src={bait.image} alt="" />
              <span>{bait.name}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};

const FishingStage = ({
  catalog,
  activeCast,
  actionPending,
  selectedBait,
  selectedLocation,
  hookedFish,
  profile,
  message,
  errorMessage,
  tapCount,
  progressPercent,
  onStartCast,
  onHook,
  onTap,
  onLand,
}: FishingStageProps) => {
  const currentHooked = activeCast?.hookedFish ?? null;
  const lastCatch = profile.catches[0] ?? null;
  const lastCatchFish = lastCatch
    ? catalog.fish.find((fish) => fish.id === lastCatch.fishId) ?? null
    : null;
  const backgroundImage = selectedLocation?.image ?? '/riverking/backgrounds/pond.webp';

  return (
    <section className="stage-wrap">
      <div
        className="pond-stage"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      >
        <div className="stage-shade" />

        <div className="hud-row">
          <div className="hud-message">
            <strong>{selectedLocation?.name ?? 'Пруд'}</strong>
            <span>{errorMessage ?? message}</span>
          </div>
          <div className="stat-row">
            <StatPill label="Уровень" value={String(profile.level)} />
            <StatPill label="Монеты" value={String(profile.coins)} />
            <StatPill label="Рыбы" value={String(profile.discoveredFishIds.length)} />
          </div>
        </div>

        <img className="stage-rod" src="/riverking/rods/yellow_rod.webp" alt="" />

        <svg className="stage-line" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            className={activeCast ? 'line-active' : ''}
            d={activeCast ? 'M 73 55 C 58 38, 48 35, 41 43' : 'M 73 55 C 61 62, 50 63, 42 59'}
          />
        </svg>

        <div className={`bobber-node ${activeCast ? 'bobber-node-active' : ''}`}>
          <img src="/riverking/bobber.svg" alt="" />
          {selectedBait ? <img className="bait-on-hook" src={selectedBait.image} alt="" /> : null}
        </div>

        {currentHooked && hookedFish ? (
          <div className="hooked-card">
            <img src={hookedFish.image} alt="" />
            <div>
              <p className={rarityClass[currentHooked.rarity]}>{currentHooked.fishName}</p>
              <span>{currentHooked.weightKg} кг</span>
            </div>
          </div>
        ) : null}

        {!activeCast && lastCatch && lastCatchFish ? (
          <div className="last-catch-card">
            <img src={lastCatchFish.image} alt="" />
            <div>
              <span>Последний улов</span>
              <strong className={rarityClass[lastCatch.rarity]}>{lastCatch.fishName}</strong>
              <small>{lastCatch.weightKg} кг</small>
            </div>
          </div>
        ) : null}

        {activeCast?.challenge ? (
          <div className="challenge-panel">
            <div className="challenge-copy">
              <span>Натяжение</span>
              <strong>
                {tapCount}/{activeCast.challenge.tapGoal}
              </strong>
            </div>
            <div className="challenge-track">
              <div className="challenge-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        ) : null}

        <ActionControls
          activeCast={activeCast}
          actionPending={actionPending}
          tapCount={tapCount}
          onStartCast={onStartCast}
          onHook={onHook}
          onTap={onTap}
          onLand={onLand}
        />
      </div>
    </section>
  );
};

const ActionControls = ({
  activeCast,
  actionPending,
  tapCount,
  onStartCast,
  onHook,
  onTap,
  onLand,
}: ActionControlsProps) => {
  if (!activeCast) {
    return (
      <button className="cast-action" disabled={actionPending} onClick={onStartCast} type="button">
        Забросить
      </button>
    );
  }

  if (activeCast.stage === 'casting') {
    return (
      <button className="cast-action" disabled={actionPending} onClick={onHook} type="button">
        Подсечь
      </button>
    );
  }

  return (
    <div className="fight-actions">
      <button className="fight-button" disabled={actionPending} onClick={onTap} type="button">
        Тянуть {tapCount}
      </button>
      <button className="land-button" disabled={actionPending} onClick={onLand} type="button">
        Вытащить
      </button>
    </div>
  );
};

const StatPill = ({ label, value }: StatPillProps) => {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
};

const BottomTabs = () => {
  return (
    <nav className="bottom-tabs" aria-label="Разделы">
      {bottomTabs.map((tab) => (
        <button
          className={`bottom-tab ${tab.active ? 'bottom-tab-active' : ''}`}
          disabled={!tab.active}
          key={tab.id}
          type="button"
        >
          <img src={tab.icon} alt="" />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
