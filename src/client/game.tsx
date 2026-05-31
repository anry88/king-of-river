import './index.css';

import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CSSProperties, RefObject } from 'react';
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
  castCooldownActive: boolean;
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

type FloatVisual = {
  offset: number;
  xOffset: number;
  tilt: number;
  submerge: number;
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
};

type RodGeometryInput = {
  size: StageSize;
  activeCast: ActiveCast | null;
  lineAttach: Point;
  floatVisual: FloatVisual;
  fightIntensity: number;
};

type RigMotion = {
  floatVisual: FloatVisual;
  fightIntensity: number;
  lineAttach: Point;
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
  bobberClipStyle: CSSProperties | undefined;
  isCastInWater: boolean;
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
const bobberVisibleAboveWater = Math.round(bobberSize * 0.72);
const bobberMinimumVisibleAboveWater = Math.round(bobberSize * 0.28);
const bobberMaxDownOffset = bobberVisibleAboveWater - bobberMinimumVisibleAboveWater;
const rigLineHeight = 36;
const hookSize = 18;
const rigWidth = 44;
const rigCenterX = rigWidth / 2;
const shorePosition = { x: 0.44, y: 0.56 };
const idleFloatVisual = { offset: 0, xOffset: 0, tilt: 0, submerge: 0 };
const waitingFloatVisual = { offset: 4, xOffset: 0, tilt: 0, submerge: 0.45 };
const castAnimationWaitFactorMs = 85;
const castAnimationMinMs = 420;
const castAnimationMaxMs = 620;
const castAnimationDefaultMs = 520;
const catchCooldownMs = 3000;
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

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const easeInOutCubic = (value: number): number => {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
};

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

const useCooldownRemaining = (availableAt: number): number => {
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const remainingMs = Math.max(0, availableAt - cooldownNow);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCooldownNow(Date.now());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [availableAt]);

  useEffect(() => {
    if (remainingMs <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCooldownNow(Date.now());
    }, Math.min(250, remainingMs + 20));

    return () => window.clearTimeout(timeoutId);
  }, [availableAt, remainingMs]);

  return remainingMs;
};

const useRiverKingRigMotion = (
  size: StageSize,
  activeCast: ActiveCast | null,
  now: number
): RigMotion => {
  const { w, h } = size;
  const [floatRel, setFloatRel] = useState<Point>(shorePosition);
  const [floatVisual, setFloatVisual] = useState<FloatVisual>(idleFloatVisual);
  const [landedCastKey, setLandedCastKey] = useState<string | null>(null);
  const floatRelRef = useRef<Point>(shorePosition);
  const tweenCancelRef = useRef<(() => void) | null>(null);
  const activeCastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    floatRelRef.current = floatRel;
  }, [floatRel]);

  useEffect(() => {
    return () => {
      if (tweenCancelRef.current) {
        tweenCancelRef.current();
        tweenCancelRef.current = null;
      }
    };
  }, []);

  const targetX = activeCast ? clamp(activeCast.castX, 0.05, 0.88) : shorePosition.x;
  const targetY = activeCast ? clamp(activeCast.castY, 0.42, 0.9) : shorePosition.y;
  const activeCastKey = activeCast ? `${activeCast.id}:${targetX}:${targetY}` : null;

  useEffect(() => {
    if (!activeCastKey) {
      let resetFrameId: number | null = null;
      activeCastKeyRef.current = null;
      floatRelRef.current = shorePosition;
      resetFrameId = window.requestAnimationFrame(() => {
        setFloatRel((current) => {
          if (Math.abs(current.x - shorePosition.x) < 0.0001 && Math.abs(current.y - shorePosition.y) < 0.0001) {
            return current;
          }

          return shorePosition;
        });
      });

      return () => {
        if (resetFrameId !== null) {
          window.cancelAnimationFrame(resetFrameId);
        }
      };
    }

    if (activeCastKeyRef.current === activeCastKey) {
      return undefined;
    }

    activeCastKeyRef.current = activeCastKey;

    if (tweenCancelRef.current) {
      tweenCancelRef.current();
      tweenCancelRef.current = null;
    }

    const from = {
      x: Number.isFinite(floatRelRef.current.x) ? floatRelRef.current.x : shorePosition.x,
      y: Number.isFinite(floatRelRef.current.y) ? floatRelRef.current.y : shorePosition.y,
    };
    const to = { x: targetX, y: targetY };
    const relDistanceY = Math.abs(to.y - from.y);
    const arcHeight = clamp(relDistanceY * 0.75, 0.015, 0.08);
    const durationMs = clamp(
      activeCast?.waitSeconds ? activeCast.waitSeconds * castAnimationWaitFactorMs : castAnimationDefaultMs,
      castAnimationMinMs,
      castAnimationMaxMs
    );
    let frameId: number | null = null;
    let cancelled = false;
    const start = performance.now();

    const step = (frameNow: number) => {
      if (cancelled) {
        return;
      }

      const progress = Math.min(1, (frameNow - start) / durationMs);
      const eased = easeInOutCubic(progress);
      const arc = Math.sin(progress * Math.PI) * arcHeight;
      const nextRel = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased - arc,
      };

      floatRelRef.current = nextRel;
      setFloatRel(nextRel);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
        return;
      }

      frameId = null;
      tweenCancelRef.current = null;
      setLandedCastKey(activeCastKey);
    };

    frameId = window.requestAnimationFrame(step);

    const cancelTween = () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    tweenCancelRef.current = cancelTween;

    return () => {
      cancelTween();
      if (activeCastKeyRef.current === activeCastKey) {
        activeCastKeyRef.current = null;
      }
      if (tweenCancelRef.current === cancelTween) {
        tweenCancelRef.current = null;
      }
    };
  }, [activeCast?.waitSeconds, activeCastKey, targetX, targetY]);

  const biting =
    activeCast?.stage === 'casting' && now >= activeCast.hookReadyAt && now <= activeCast.hookExpiresAt;
  const tapping = activeCast?.stage === 'hooked';
  const shouldAnimateFloat = biting || tapping;
  const fightIntensity = tapping ? clamp(activeCast.challenge?.struggleIntensity ?? 0, 0, 1) : 0;
  const isCurrentCastLanded = Boolean(activeCastKey) && landedCastKey === activeCastKey;
  const waitingForBite = activeCast?.stage === 'casting' && isCurrentCastLanded && !biting;
  const restingFloatVisual = waitingForBite ? waitingFloatVisual : idleFloatVisual;

  useEffect(() => {
    if (!shouldAnimateFloat) {
      const resetFrameId = window.requestAnimationFrame(() => {
        setFloatVisual((current) => {
          if (
            current.offset === restingFloatVisual.offset &&
            current.xOffset === restingFloatVisual.xOffset &&
            current.tilt === restingFloatVisual.tilt &&
            current.submerge === restingFloatVisual.submerge
          ) {
            return current;
          }

          return restingFloatVisual;
        });
      });

      return () => window.cancelAnimationFrame(resetFrameId);
    }

    let frameId: number | null = null;
    let start: number | null = null;

    const animate = (frameNow: number) => {
      if (start === null) {
        start = frameNow;
      }

      const elapsedSeconds = (frameNow - start) / 1000;
      const state = tapping ? 'tapping' : 'biting';
      const basePeriod = state === 'biting' ? 0.8 : 0.65;
      const mainWave = Math.sin((elapsedSeconds * Math.PI * 2) / basePeriod);
      let offset = 0;
      let xOffset = 0;
      let tilt = 0;
      let submerge = 0;

      if (state === 'biting') {
        const extraWave = Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 0.75));
        offset = 3.5 + mainWave * 4.2 + extraWave * 1;
        tilt = Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 0.9)) * 6.5;
        submerge = offset > 0 ? Math.min(1, offset / 8) : 0;
      } else {
        const quickWave = Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 0.85));
        const pullWave = Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 1.45));
        const snapWave = Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 0.42));
        offset =
          5 +
          fightIntensity * 18 +
          mainWave * (4.2 + fightIntensity * 9) +
          quickWave * (1.1 + fightIntensity * 5);
        xOffset = pullWave * (5 + fightIntensity * 22) + snapWave * fightIntensity * 7;
        tilt = Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 0.95)) * (5 + fightIntensity * 18);
        submerge = offset > 0 ? Math.min(1, offset / (9 + fightIntensity * 14)) : 0;
      }

      setFloatVisual((current) => {
        const lerp = (currentValue: number, targetValue: number) => {
          return currentValue + (targetValue - currentValue) * 0.18;
        };
        const next = {
          offset: lerp(current.offset, offset),
          xOffset: lerp(current.xOffset, xOffset),
          tilt: lerp(current.tilt, tilt),
          submerge: lerp(current.submerge, submerge),
        };

        if (
          Math.abs(next.offset - current.offset) < 0.01 &&
          Math.abs(next.xOffset - current.xOffset) < 0.01 &&
          Math.abs(next.tilt - current.tilt) < 0.01 &&
          Math.abs(next.submerge - current.submerge) < 0.01
        ) {
          return current;
        }

        return next;
      });

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [biting, fightIntensity, restingFloatVisual, shouldAnimateFloat, tapping]);

  const floatBasePx = {
    x: floatRel.x * w,
    y: floatRel.y * h,
  };
  const isCastInWater = Boolean(activeCastKey) && (isCurrentCastLanded || biting || tapping);
  const floatDisplayOffset = isCastInWater
    ? Math.min(floatVisual.offset, bobberMaxDownOffset)
    : floatVisual.offset;
  const floatPx = {
    x: floatBasePx.x + floatVisual.xOffset,
    y: floatBasePx.y + floatDisplayOffset,
  };
  const waterlineY = clamp(
    floatBasePx.y - bobberRadius + bobberVisibleAboveWater,
    0,
    Math.max(0, h)
  );
  const bobberBottom = floatPx.y + bobberRadius;
  const bobberHiddenHeight = clamp(bobberBottom - waterlineY, 0, bobberSize);
  const bobberClipPath =
    isCastInWater && bobberHiddenHeight > 0.01
      ? `inset(0 0 ${bobberHiddenHeight}px 0 round ${bobberRadius}px)`
      : undefined;
  const bobberClipStyle = bobberClipPath
    ? {
        clipPath: bobberClipPath,
        WebkitClipPath: bobberClipPath,
      }
    : undefined;
  const lineAttach = {
    x: floatPx.x,
    y: isCastInWater ? Math.min(floatPx.y, Math.max(0, waterlineY - 1)) : floatPx.y,
  };

  return {
    floatVisual,
    fightIntensity,
    lineAttach,
    bobberStyle: {
      left: floatPx.x - bobberRadius,
      top: floatPx.y - bobberRadius,
      width: bobberSize,
      height: bobberSize,
    },
    rigStyle: {
      left: floatPx.x - rigCenterX,
      top: floatPx.y + bobberRadius * 0.44,
      width: rigWidth,
      height: rigLineHeight + hookSize + 4,
    },
    bobberClipStyle,
    isCastInWater,
  };
};

const buildRodGeometry = ({
  size,
  activeCast,
  lineAttach,
  floatVisual,
  fightIntensity,
}: RodGeometryInput): RodGeometry => {
  const { w, h } = size;
  if (w <= 0 || h <= 0) {
    return {
      ready: false,
      rodStyle: { left: 0, top: 0, width: 0, height: 0 },
      rodLinePath: '',
      waterLinePath: '',
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
  const hookedLinePull = activeCast?.stage === 'hooked' ? floatVisual.xOffset * (0.4 + fightIntensity * 0.75) : 0;
  const waterLinePath = shouldShowSlack
    ? buildSlackLine(lastRodPoint, lineAttach, dist, h)
    : buildTautLine(lastRodPoint, lineAttach, dist, h, hookedLinePull, fightIntensity);

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

const buildTautLine = (
  from: Point,
  to: Point,
  dist: number,
  stageHeight: number,
  hookedLinePull: number,
  fightIntensity: number
): string => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const gentleSag = Math.min(stageHeight * 0.08, dist * 0.12);
  const control = {
    x: from.x + dx * 0.5 + hookedLinePull,
    y: from.y + dy * 0.5 + gentleSag + stageHeight * 0.03 * fightIntensity,
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
      <section className="rk-screen">
        <AssetPreloads images={catalog.fish.map((fish) => fish.image)} />
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

const AssetPreloads = ({ images = [] }: { images?: string[] }) => {
  const preloadImages = [...new Set([...assetPreloadImages, ...images])];

  return (
    <div className="asset-preloads" aria-hidden="true">
      {preloadImages.map((src) => (
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
  const previousActiveCastIdRef = useRef<string | null>(null);
  const [localCycleCooldownUntil, setLocalCycleCooldownUntil] = useState(0);
  const rigMotion = useRiverKingRigMotion(stageSize, activeCast, now);
  const nextCastAvailableAt = Math.max(
    lastCatch ? lastCatch.caughtAt + catchCooldownMs : 0,
    localCycleCooldownUntil
  );
  const castCooldownRemainingMs = useCooldownRemaining(nextCastAvailableAt);
  const castCooldownActive = castCooldownRemainingMs > 0;

  useEffect(() => {
    if (activeCast) {
      previousActiveCastIdRef.current = activeCast.id;
      return;
    }

    if (!previousActiveCastIdRef.current) {
      return;
    }

    previousActiveCastIdRef.current = null;
    setLocalCycleCooldownUntil(Date.now() + catchCooldownMs);
  }, [activeCast]);

  const rodGeometry = useMemo(
    () =>
      buildRodGeometry({
        size: stageSize,
        activeCast,
        lineAttach: rigMotion.lineAttach,
        floatVisual: rigMotion.floatVisual,
        fightIntensity: rigMotion.fightIntensity,
      }),
    [
      activeCast,
      rigMotion.fightIntensity,
      rigMotion.floatVisual,
      rigMotion.lineAttach,
      stageSize,
    ]
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
              <div className="bobber-node" style={rigMotion.bobberStyle}>
                <img
                  className="bobber-img"
                  src="/riverking/menu/bobber.webp"
                  style={{
                    transform: `rotate(${rigMotion.floatVisual.tilt}deg)`,
                    ...rigMotion.bobberClipStyle,
                  }}
                  alt=""
                />
              </div>

              {!rigMotion.isCastInWater ? (
                <div className="rig-node" style={rigMotion.rigStyle}>
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
          castCooldownActive={castCooldownActive}
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
  castCooldownActive,
  tapCount,
  now,
  onStartCast,
  onHook,
  onPull,
}: ActionControlsProps) => {
  if (!activeCast) {
    return (
      <button
        className={`cast-action ${castCooldownActive ? 'cast-action-cooldown' : ''}`}
        disabled={actionPending || castCooldownActive}
        onClick={onStartCast}
        type="button"
      >
        {castCooldownActive ? 'Waiting' : 'Cast'}
      </button>
    );
  }

  if (activeCast.stage === 'casting') {
    const hookReady = now >= activeCast.hookReadyAt && now <= activeCast.hookExpiresAt;

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
