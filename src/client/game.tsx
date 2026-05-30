import './index.css';

import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { RefObject } from 'react';
import { useGame } from './hooks/useGame';
import type {
  ActiveCast,
  BaitDefinition,
  CatchRecord,
  FishDefinition,
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
  tapCount: number;
  selectedBait: BaitDefinition | null;
  caughtFish: FishDefinition | null;
  lastCatch: CatchRecord | null;
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
  tapCount: number;
  now: number;
  onStartCast: () => void;
  onHook: () => void;
  onPull: () => void;
};

type StatPillProps = {
  label: string;
  value: string;
};

type CatchFlightProps = {
  catchRecord: CatchRecord;
  fish: FishDefinition;
  startXPercent: number;
  startYPercent: number;
};

type StageSize = {
  w: number;
  h: number;
};

type Point = {
  x: number;
  y: number;
};

type RodGeometry = {
  ready: boolean;
  rodStyle: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  rodLinePath: string;
  waterLinePath: string;
  bobberStyle: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  rigStyle: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

const bottomTabs = [
  { id: 'fishing', label: 'Fishing', icon: '/riverking/menu/fishing.webp', active: true },
  { id: 'ratings', label: 'Ratings', icon: '/riverking/menu/ratings.webp', active: false },
  { id: 'catalog', label: 'Catalog', icon: '/riverking/menu/guide.webp', active: false },
  { id: 'shop', label: 'Shop', icon: '/riverking/menu/shop.webp', active: false },
];

const assetPreloadImages = [
  '/riverking/backgrounds/pond.webp',
  '/riverking/baits/grain_crumble.webp',
  '/riverking/baits/brook_minnow.webp',
  '/riverking/baits/seaweed_strand.webp',
  '/riverking/baits/squid_rings.webp',
];

const bobberSize = 30;
const bobberRadius = bobberSize / 2;
const rigLineHeight = 36;
const hookSize = 18;
const rigWidth = 44;
const rigCenterX = rigWidth / 2;
const shorePosition = { x: 0.44, y: 0.56 };
const rodImageSize = { width: 1536, height: 1024 };
const rodTipAnchor = { x: 0.07878, y: 0.04785 };
const rodBaseAnchor = { x: 0.383, y: 0.998 };
const rodSizeMultiplier = 1.5;
const rodBaseXFraction = 2 / 3;
const rodLinePoints = [
  { x: 0.765, y: 0.98 },
  { x: 0.635, y: 0.8 },
  { x: 0.495, y: 0.61 },
  { x: 0.355, y: 0.42 },
  { x: 0.215, y: 0.23 },
  { x: 0.078, y: 0.048 },
];

const useCastClock = (activeCast: ActiveCast | null): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeCast || activeCast.stage !== 'casting') {
      return undefined;
    }

    const currentTime = Date.now();
    const biteVisible = currentTime >= activeCast.hookReadyAt && currentTime <= activeCast.hookExpiresAt;
    const nextTickAt = currentTime < activeCast.hookReadyAt ? activeCast.hookReadyAt : activeCast.hookExpiresAt;
    const timeoutMs = biteVisible ? 110 : Math.max(80, nextTickAt - currentTime + 20);
    const timeoutId = window.setTimeout(() => {
      setNow(Date.now());
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [activeCast, now]);

  return now;
};

const useStageSize = (stageRef: RefObject<HTMLDivElement | null>): StageSize => {
  const [size, setSize] = useState<StageSize>({ w: 0, h: 0 });

  useEffect(() => {
    const element = stageRef.current;
    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const nextSize = {
        w: Math.max(0, rect.width),
        h: Math.max(0, rect.height),
      };

      setSize((current) => {
        if (Math.abs(current.w - nextSize.w) < 0.5 && Math.abs(current.h - nextSize.h) < 0.5) {
          return current;
        }

        return nextSize;
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [stageRef]);

  return size;
};

const buildRodGeometry = (
  size: StageSize,
  activeCast: ActiveCast | null,
  now: number
): RodGeometry => {
  const { w, h } = size;
  if (w <= 0 || h <= 0) {
    return {
      ready: false,
      rodStyle: { left: 0, top: 0, width: 0, height: 0 },
      rodLinePath: '',
      waterLinePath: '',
      bobberStyle: { left: 0, top: 0, width: 0, height: 0 },
      rigStyle: { left: 0, top: 0, width: 0, height: 0 },
    };
  }

  const isSmall = w < 420;
  const isTablet = w >= 420 && w < 1024;
  const targetWFrac = isSmall ? 0.7 : isTablet ? 0.55 : 0.48;
  const targetHFrac = isSmall ? 0.92 : isTablet ? 0.9 : 0.86;
  const rodScaleBase = Math.min(
    (w * targetWFrac) / rodImageSize.width,
    (h * targetHFrac) / rodImageSize.height
  );
  const rodScale = rodScaleBase * rodSizeMultiplier;
  const rodW = rodImageSize.width * rodScale;
  const rodH = rodImageSize.height * rodScale;
  const rodLeft = w * rodBaseXFraction - rodW * rodBaseAnchor.x;
  const rodTop = h - rodH - h * 0.28;
  const biteVisible =
    activeCast?.stage === 'casting' && now >= activeCast.hookReadyAt && now <= activeCast.hookExpiresAt;
  const biteElapsedSeconds = biteVisible ? (now - activeCast.hookReadyAt) / 1000 : 0;
  const biteOffset = {
    x: biteVisible ? Math.sin(biteElapsedSeconds * Math.PI * 8) * 1.4 : 0,
    y: biteVisible
      ? Math.sin(biteElapsedSeconds * Math.PI * 7) * 4 + Math.max(0, Math.sin(biteElapsedSeconds * Math.PI * 3)) * 3
      : 0,
  };
  const baseBobberCenter = activeCast
    ? {
        x: Math.min(0.88, Math.max(0.05, activeCast.castX)) * w,
        y: Math.min(0.9, Math.max(0.42, activeCast.castY)) * h,
      }
    : {
        x: shorePosition.x * w,
        y: shorePosition.y * h,
      };
  const bobberCenter = {
    x: baseBobberCenter.x + biteOffset.x,
    y: baseBobberCenter.y + biteOffset.y,
  };
  const lineAttach = {
    x: bobberCenter.x,
    y: activeCast ? bobberCenter.y - Math.round(bobberRadius * 0.28) : bobberCenter.y,
  };
  const tip = {
    x: rodLeft + rodW * rodTipAnchor.x,
    y: rodTop + rodH * rodTipAnchor.y,
  };
  const rodPointsPx = rodLinePoints.map((point) => ({
    x: rodLeft + rodW * point.x,
    y: rodTop + rodH * point.y,
  }));
  const fallbackLastPoint = tip;
  const firstRodPoint = rodPointsPx[0];
  const lastRodPoint = rodPointsPx[rodPointsPx.length - 1] ?? fallbackLastPoint;
  const rodLinePath = firstRodPoint
    ? rodPointsPx
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
        .join(' ')
    : '';
  const dx = lineAttach.x - lastRodPoint.x;
  const dy = lineAttach.y - lastRodPoint.y;
  const dist = Math.hypot(dx, dy);
  const shouldShowSlack = !activeCast;
  const waterLinePath = shouldShowSlack
    ? buildSlackLine(lastRodPoint, lineAttach, dist, h)
    : buildTautLine(lastRodPoint, lineAttach, dist, h);

  return {
    ready: true,
    rodStyle: {
      left: rodLeft,
      top: rodTop,
      width: rodW,
      height: rodH,
    },
    rodLinePath,
    waterLinePath,
    bobberStyle: {
      left: bobberCenter.x - bobberRadius,
      top: bobberCenter.y - bobberRadius,
      width: bobberSize,
      height: bobberSize,
    },
    rigStyle: {
      left: bobberCenter.x - rigCenterX,
      top: bobberCenter.y + bobberRadius * 0.44,
      width: rigWidth,
      height: rigLineHeight + hookSize + 4,
    },
  };
};

const buildSlackLine = (from: Point, to: Point, dist: number, stageHeight: number): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sag = Math.min(stageHeight * 0.06, Math.max(8, dist * 0.2));
  const baseMidY = from.y + dy * 0.5;
  const control1 = {
    x: from.x + dx * 0.35,
    y: baseMidY + sag * 0.45,
  };
  const control2 = {
    x: from.x + dx * 0.75,
    y: baseMidY + sag,
  };

  return `M ${from.x},${from.y} C ${control1.x},${control1.y} ${control2.x},${control2.y} ${to.x},${to.y}`;
};

const buildTautLine = (from: Point, to: Point, dist: number, stageHeight: number): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const gentleSag = Math.min(stageHeight * 0.08, dist * 0.12);
  const control = {
    x: from.x + dx * 0.5,
    y: from.y + dy * 0.5 + gentleSag,
  };

  return `M ${from.x},${from.y} Q ${control.x},${control.y} ${to.x},${to.y}`;
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
  const lastCatch = snapshot.lastCatch;
  const caughtFish =
    lastCatch ? catalog.fish.find((fish) => fish.id === lastCatch.fishId) ?? null : null;

  return (
    <main className="rk-shell">
      <AssetPreloads />
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
          tapCount={tapCount}
          selectedBait={selectedBait}
          caughtFish={caughtFish}
          lastCatch={lastCatch}
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

const AssetPreloads = () => {
  return (
    <div className="asset-preloads" aria-hidden="true">
      {assetPreloadImages.map((src) => (
        <img key={src} src={src} alt="" />
      ))}
    </div>
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
  tapCount,
  selectedBait,
  caughtFish,
  lastCatch,
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
  const now = useCastClock(activeCast);
  const stageRef = useRef<HTMLDivElement>(null);
  const stageSize = useStageSize(stageRef);

  const rodGeometry = useMemo(
    () => buildRodGeometry(stageSize, activeCast, now),
    [activeCast, now, stageSize]
  );
  const biteReady = activeCast?.stage === 'casting' && now >= activeCast.hookReadyAt;
  const rigStateClass =
    activeCast?.stage === 'hooked'
      ? 'fishing-rig-hooked'
      : biteReady
        ? 'fishing-rig-bite'
      : activeCast
        ? 'fishing-rig-active'
        : 'fishing-rig-idle';
  const shouldShowCatchFlight = Boolean(
    lastCatch && caughtFish && message.startsWith('Caught:')
  );
  const catchFlightStart = {
    x: Math.min(0.88, Math.max(0.05, lastCatch?.castX ?? 0.44)) * 100,
    y: Math.min(0.9, Math.max(0.42, lastCatch?.castY ?? 0.58)) * 100,
  };

  return (
    <section className="stage-wrap">
      <div
        className="pond-stage"
        ref={stageRef}
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

        {rodGeometry.ready ? (
          <>
            <svg
              className={`stage-water-line ${rigStateClass}`}
              height={stageSize.h}
              viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
              width={stageSize.w}
            >
              <path className="water-line" d={rodGeometry.waterLinePath} />
            </svg>

            <img
              className="stage-rod"
              src="/riverking/rods/yellow_rod.webp"
              style={rodGeometry.rodStyle}
              alt=""
            />

            <svg
              className="stage-rod-line"
              height={stageSize.h}
              viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
              width={stageSize.w}
            >
              <path className="rod-line" d={rodGeometry.rodLinePath} />
            </svg>

            <div className={`fishing-rig ${rigStateClass}`} aria-hidden="true">
              <div className="bobber-node" style={rodGeometry.bobberStyle}>
                <img className="bobber-img" src="/riverking/menu/bobber.webp" alt="" />
              </div>

              {activeCast?.stage !== 'hooked' ? (
                <div className="rig-node" style={rodGeometry.rigStyle}>
                  <span className="rig-drop-line" />
                  <svg className="hook-icon" viewBox="0 0 28 28">
                    <path d="M15.8 3.4C14 6.9 14.2 10.7 16.2 13.8L19.5 19C20.8 21.1 20 23.9 17.7 25.1C15.5 26.2 12.7 25.3 11.6 23C11.1 22 11 20.9 11.3 19.9" />
                    <path d="M10.1 20.2L6.4 18" />
                    <path d="M15.2 3.9L19 2.2" />
                  </svg>
                  {selectedBait ? <img className="bait-on-hook" src={selectedBait.image} alt="" /> : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {shouldShowCatchFlight && lastCatch && caughtFish ? (
          <CatchFlight
            catchRecord={lastCatch}
            fish={caughtFish}
            key={lastCatch.id}
            startXPercent={catchFlightStart.x}
            startYPercent={catchFlightStart.y}
          />
        ) : null}

        <ActionControls
          activeCast={activeCast}
          actionPending={actionPending}
          tapCount={tapCount}
          now={now}
          onStartCast={onStartCast}
          onHook={onHook}
          onPull={onPull}
        />
      </div>
    </section>
  );
};

const CatchFlight = ({
  catchRecord,
  fish,
  startXPercent,
  startYPercent,
}: CatchFlightProps) => {
  return (
    <div
      className="catch-flight"
      style={{
        left: `${startXPercent}%`,
        top: `${startYPercent}%`,
      }}
      aria-hidden="true"
    >
      <img src={fish.image} alt={catchRecord.fishName} />
    </div>
  );
};

const ActionControls = ({
  activeCast,
  actionPending,
  tapCount,
  now,
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
    const hookReady = now >= activeCast.hookReadyAt;

    return (
      <button
        className="cast-action"
        disabled={actionPending || !hookReady}
        onClick={onHook}
        type="button"
      >
        {hookReady ? 'Hook' : 'Waiting'}
      </button>
    );
  }

  return (
    <button
      className={`cast-action cast-action-pull ${tapCount > 0 ? 'cast-action-pull-feedback' : ''}`}
      disabled={actionPending}
      key={`${activeCast.id}-${tapCount}`}
      onClick={onPull}
      type="button"
    >
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
