import './index.css';

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './hooks/useGame';
import type {
  ActiveCast,
  BaitDefinition,
  GameCatalog,
  GameProfile,
  LocationDefinition,
  Rarity,
} from '../shared/game/types';

type SetupBarProps = {
  catalog: GameCatalog;
  profile: GameProfile;
  selectedBait: BaitDefinition | null;
  selectedLocation: LocationDefinition | null;
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
  profile: GameProfile;
  message: string;
  errorMessage: string | null;
  onStartCast: () => void;
  onHook: () => void;
  onPull: () => void;
};

type ActionControlsProps = {
  activeCast: ActiveCast | null;
  actionPending: boolean;
  onStartCast: () => void;
  onHook: () => void;
  onPull: () => void;
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
    errorMessage,
    startCast,
    hook,
    pull,
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
  const selectedLocation =
    catalog.locations.find((location) => location.id === profile.currentLocationId) ??
    catalog.locations[0] ??
    null;
  const selectedBait =
    catalog.baits.find((bait) => bait.id === profile.currentBaitId) ??
    catalog.baits[0] ??
    null;

  return (
    <main className="rk-shell">
      <section className="rk-screen">
        <SetupBar
          catalog={catalog}
          profile={profile}
          selectedBait={selectedBait}
          selectedLocation={selectedLocation}
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
          profile={profile}
          message={message}
          errorMessage={errorMessage}
          onStartCast={startCast}
          onHook={hook}
          onPull={pull}
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
  selectedBait,
  selectedLocation,
  disabled,
  onSelectLocation,
  onSelectBait,
}: SetupBarProps) => {
  const [baitPickerOpen, setBaitPickerOpen] = useState(false);

  const handleSelectBait = (baitId: string) => {
    setBaitPickerOpen(false);
    onSelectBait(baitId);
  };

  return (
    <header className="setup-bar">
      <button
        className="setup-cell setup-cell-location"
        disabled={disabled}
        onClick={() => onSelectLocation(selectedLocation?.id ?? profile.currentLocationId)}
        type="button"
      >
        <span className="setup-label">Локация</span>
        <strong>{selectedLocation?.name ?? 'Пруд'}</strong>
      </button>

      <div className="setup-picker-wrap">
        <button
          className="setup-cell setup-cell-bait"
          disabled={disabled}
          onClick={() => setBaitPickerOpen((open) => !open)}
          type="button"
        >
          {selectedBait ? <img src={selectedBait.image} alt="" /> : null}
          <span>
            <span className="setup-label">Приманка</span>
            <strong>{selectedBait?.name ?? 'Выбрать'}</strong>
          </span>
          <span className="setup-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {baitPickerOpen && !disabled ? (
          <div className="bait-picker" aria-label="Выбор приманки">
            {catalog.baits.map((bait) => {
              const selected = bait.id === profile.currentBaitId;

              return (
                <button
                  className={`bait-option ${selected ? 'bait-option-selected' : ''}`}
                  key={bait.id}
                  onClick={() => handleSelectBait(bait.id)}
                  type="button"
                >
                  <img src={bait.image} alt="" />
                  <span>{bait.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
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
  profile,
  message,
  errorMessage,
  onStartCast,
  onHook,
  onPull,
}: FishingStageProps) => {
  const lastCatch = profile.catches[0] ?? null;
  const lastCatchFish = lastCatch
    ? catalog.fish.find((fish) => fish.id === lastCatch.fishId) ?? null
    : null;
  const backgroundImage = selectedLocation?.image ?? '/riverking/backgrounds/pond.webp';
  const outcomeMessage = errorMessage ?? message;

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
          {outcomeMessage ? <div className="outcome-chip">{outcomeMessage}</div> : <span />}
          <div className="stat-row">
            <StatPill label="Монеты" value={String(profile.coins)} />
          </div>
        </div>

        <img className="stage-rod" src="/riverking/rods/yellow_rod.webp" alt="" />

        {activeCast ? (
          <>
            <svg className="stage-line" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path className="line-active" d="M 25 50 C 30 56, 38 59, 46 58" />
            </svg>

            <div className="bobber-node bobber-node-active">
              <img src="/riverking/bobber.svg" alt="" />
              {selectedBait ? <img className="bait-on-hook" src={selectedBait.image} alt="" /> : null}
            </div>
          </>
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

        <ActionControls
          activeCast={activeCast}
          actionPending={actionPending}
          onStartCast={onStartCast}
          onHook={onHook}
          onPull={onPull}
        />
      </div>
    </section>
  );
};

const ActionControls = ({
  activeCast,
  actionPending,
  onStartCast,
  onHook,
  onPull,
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
    <button className="cast-action cast-action-pull" disabled={actionPending} onClick={onPull} type="button">
      Тянуть
    </button>
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
