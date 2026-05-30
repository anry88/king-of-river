import './index.css';

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './hooks/useGame';
import type {
  ActiveCast,
  BaitDefinition,
  GameProfile,
  LocationDefinition,
} from '../shared/game/types';

type SetupBarProps = {
  baits: BaitDefinition[];
  profile: GameProfile;
  selectedBait: BaitDefinition | null;
  selectedLocation: LocationDefinition | null;
  disabled: boolean;
  onSelectLocation: (locationId: string) => void;
  onSelectBait: (baitId: string) => void;
};

type FishingStageProps = {
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

const bottomTabs = [
  { id: 'fishing', label: 'Fishing', icon: '/riverking/menu/fishing.webp', active: true },
  { id: 'ratings', label: 'Ratings', icon: '/riverking/menu/ratings.webp', active: false },
  { id: 'catalog', label: 'Catalog', icon: '/riverking/menu/guide.webp', active: false },
  { id: 'shop', label: 'Shop', icon: '/riverking/menu/shop.webp', active: false },
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
    return <LoadingState text="Loading Pond" />;
  }

  if (!snapshot) {
    return <LoadingState text={errorMessage ?? 'Game failed to load'} />;
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
          baits={catalog.baits}
          profile={profile}
          selectedBait={selectedBait}
          selectedLocation={selectedLocation}
          disabled={Boolean(activeCast) || actionPending}
          onSelectLocation={selectLocation}
          onSelectBait={selectBait}
        />

        <FishingStage
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
  baits,
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
        <span className="setup-label">Location</span>
        <strong>{selectedLocation?.name ?? 'Pond'}</strong>
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
            <span className="setup-label">Bait</span>
            <strong>{selectedBait?.name ?? 'Choose'}</strong>
          </span>
          <span className="setup-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {baitPickerOpen && !disabled ? (
          <div className="bait-picker" aria-label="Bait picker">
            {baits.map((bait) => {
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
  const backgroundImage = selectedLocation?.image ?? '/riverking/backgrounds/pond.webp';
  const outcomeMessage = errorMessage ?? message;
  const outcomeKey = `${profile.updatedAt}-${outcomeMessage}`;

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
          {outcomeMessage ? (
            <div className="outcome-chip" key={outcomeKey}>
              {outcomeMessage}
            </div>
          ) : (
            <span />
          )}
          <div className="stat-row">
            <StatPill label="Coins" value={String(profile.coins)} />
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
        Cast
      </button>
    );
  }

  if (activeCast.stage === 'casting') {
    return (
      <button className="cast-action" disabled={actionPending} onClick={onHook} type="button">
        Hook
      </button>
    );
  }

  return (
    <button className="cast-action cast-action-pull" disabled={actionPending} onClick={onPull} type="button">
      Pull
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
    <nav className="bottom-tabs" aria-label="Sections">
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
