import './index.css';

import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CSSProperties, RefObject } from 'react';
import { useGame } from './hooks/useGame';
import type {
  ActiveCast,
  BaitDefinition,
  BaitPackDefinition,
  CatchRecord,
  DailyRewardStatus,
  FishDefinition,
  GameProfile,
  LocationDefinition,
  WaterType,
} from '../shared/game/types';

type BottomTabId = 'fishing' | 'ratings' | 'catalog' | 'shop';

type BottomTabDefinition = {
  id: BottomTabId;
  label: string;
  icon: string;
  disabled: boolean;
};

type SetupBarProps = {
  baits: BaitDefinition[];
  locations: LocationDefinition[];
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
  dailyRewardStatus: DailyRewardStatus;
  message: string;
  errorMessage: string | null;
  onStartCast: () => void;
  onHook: () => void;
  onPull: () => void;
  onClaimDailyReward: () => void;
};

type ShopStageProps = {
  packs: BaitPackDefinition[];
  baits: BaitDefinition[];
  profile: GameProfile;
  dailyRewardStatus: DailyRewardStatus;
  actionPending: boolean;
  message: string;
  errorMessage: string | null;
  onBuyBaitPack: (baitPackId: string) => void;
  onClaimDailyReward: () => void;
};

type ShopGroupProps = {
  title: string;
  water: WaterType;
  packs: BaitPackDefinition[];
  baits: BaitDefinition[];
  profile: GameProfile;
  actionPending: boolean;
  onBuyBaitPack: (baitPackId: string) => void;
};

type ShopPackCardProps = {
  pack: BaitPackDefinition;
  baits: BaitDefinition[];
  profile: GameProfile;
  actionPending: boolean;
  onBuyBaitPack: (baitPackId: string) => void;
};

type ActionControlsProps = {
  activeCast: ActiveCast | null;
  actionPending: boolean;
  castCooldownActive: boolean;
  canStartCast: boolean;
  startBlockedLabel: string;
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

type DailyRewardButtonProps = {
  status: DailyRewardStatus;
  disabled: boolean;
  onClaim: () => void;
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

const bottomTabs: BottomTabDefinition[] = [
  {
    id: 'fishing',
    label: 'Fishing',
    icon: '/riverking/menu/fishing.webp',
    disabled: false,
  },
  {
    id: 'ratings',
    label: 'Ratings',
    icon: '/riverking/menu/ratings.webp',
    disabled: true,
  },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: '/riverking/menu/guide.webp',
    disabled: true,
  },
  {
    id: 'shop',
    label: 'Shop',
    icon: '/riverking/menu/shop.webp',
    disabled: false,
  },
];

const assetPreloadImages = [
  '/riverking/backgrounds/pond.webp',
  '/riverking/baits/grain_crumble.webp',
  '/riverking/baits/brook_minnow.webp',
  '/riverking/baits/seaweed_strand.webp',
  '/riverking/baits/squid_rings.webp',
  '/riverking/inline_commands/daily.png',
];

const bobberSize = 30;
const bobberRadius = bobberSize / 2;
const bobberVisibleAboveWater = Math.round(bobberSize * 0.72);
const bobberMinimumVisibleAboveWater = Math.round(bobberSize * 0.28);
const bobberMaxDownOffset =
  bobberVisibleAboveWater - bobberMinimumVisibleAboveWater;
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
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
};

const useCastClock = (activeCast: ActiveCast | null): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeCast || activeCast.stage !== 'casting') {
      return undefined;
    }

    const currentTime = Date.now();
    const biteVisible =
      currentTime >= activeCast.hookReadyAt &&
      currentTime <= activeCast.hookExpiresAt;
    const nextTickAt =
      currentTime < activeCast.hookReadyAt
        ? activeCast.hookReadyAt
        : activeCast.hookExpiresAt;
    const timeoutMs = biteVisible
      ? 110
      : Math.max(80, nextTickAt - currentTime + 20);
    const timeoutId = window.setTimeout(() => {
      setNow(Date.now());
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [activeCast, now]);

  return now;
};

const useStageSize = (
  stageRef: RefObject<HTMLDivElement | null>
): StageSize => {
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
        if (
          Math.abs(current.w - nextSize.w) < 0.5 &&
          Math.abs(current.h - nextSize.h) < 0.5
        ) {
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

    const timeoutId = window.setTimeout(
      () => {
        setCooldownNow(Date.now());
      },
      Math.min(250, remainingMs + 20)
    );

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

  const targetX = activeCast
    ? clamp(activeCast.castX, 0.05, 0.88)
    : shorePosition.x;
  const targetY = activeCast
    ? clamp(activeCast.castY, 0.42, 0.9)
    : shorePosition.y;
  const activeCastKey = activeCast
    ? `${activeCast.id}:${targetX}:${targetY}`
    : null;

  useEffect(() => {
    if (!activeCastKey) {
      let resetFrameId: number | null = null;
      activeCastKeyRef.current = null;
      floatRelRef.current = shorePosition;
      resetFrameId = window.requestAnimationFrame(() => {
        setFloatRel((current) => {
          if (
            Math.abs(current.x - shorePosition.x) < 0.0001 &&
            Math.abs(current.y - shorePosition.y) < 0.0001
          ) {
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
      x: Number.isFinite(floatRelRef.current.x)
        ? floatRelRef.current.x
        : shorePosition.x,
      y: Number.isFinite(floatRelRef.current.y)
        ? floatRelRef.current.y
        : shorePosition.y,
    };
    const to = { x: targetX, y: targetY };
    const relDistanceY = Math.abs(to.y - from.y);
    const arcHeight = clamp(relDistanceY * 0.75, 0.015, 0.08);
    const durationMs = clamp(
      activeCast?.waitSeconds
        ? activeCast.waitSeconds * castAnimationWaitFactorMs
        : castAnimationDefaultMs,
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
    activeCast?.stage === 'casting' &&
    now >= activeCast.hookReadyAt &&
    now <= activeCast.hookExpiresAt;
  const tapping = activeCast?.stage === 'hooked';
  const shouldAnimateFloat = biting || tapping;
  const fightIntensity = tapping
    ? clamp(activeCast.challenge?.struggleIntensity ?? 0, 0, 1)
    : 0;
  const isCurrentCastLanded =
    Boolean(activeCastKey) && landedCastKey === activeCastKey;
  const waitingForBite =
    activeCast?.stage === 'casting' && isCurrentCastLanded && !biting;
  const restingFloatVisual = waitingForBite
    ? waitingFloatVisual
    : idleFloatVisual;

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
        const extraWave = Math.sin(
          (elapsedSeconds * Math.PI * 2) / (basePeriod * 0.75)
        );
        offset = 3.5 + mainWave * 4.2 + extraWave * 1;
        tilt =
          Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 0.9)) * 6.5;
        submerge = offset > 0 ? Math.min(1, offset / 8) : 0;
      } else {
        const quickWave = Math.sin(
          (elapsedSeconds * Math.PI * 2) / (basePeriod * 0.85)
        );
        const pullWave = Math.sin(
          (elapsedSeconds * Math.PI * 2) / (basePeriod * 1.45)
        );
        const snapWave = Math.sin(
          (elapsedSeconds * Math.PI * 2) / (basePeriod * 0.42)
        );
        offset =
          5 +
          fightIntensity * 18 +
          mainWave * (4.2 + fightIntensity * 9) +
          quickWave * (1.1 + fightIntensity * 5);
        xOffset =
          pullWave * (5 + fightIntensity * 22) + snapWave * fightIntensity * 7;
        tilt =
          Math.sin((elapsedSeconds * Math.PI * 2) / (basePeriod * 0.95)) *
          (5 + fightIntensity * 18);
        submerge =
          offset > 0 ? Math.min(1, offset / (9 + fightIntensity * 14)) : 0;
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
  const isCastInWater =
    Boolean(activeCastKey) && (isCurrentCastLanded || biting || tapping);
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
    y: isCastInWater
      ? Math.min(floatPx.y, Math.max(0, waterlineY - 1))
      : floatPx.y,
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
        .map(
          (point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`
        )
        .join(' ')
    : '';
  const dx = lineAttach.x - lastRodPoint.x;
  const dy = lineAttach.y - lastRodPoint.y;
  const dist = Math.hypot(dx, dy);
  const shouldShowSlack = !activeCast;
  const hookedLinePull =
    activeCast?.stage === 'hooked'
      ? floatVisual.xOffset * (0.4 + fightIntensity * 0.75)
      : 0;
  const waterLinePath = shouldShowSlack
    ? buildSlackLine(lastRodPoint, lineAttach, dist, h)
    : buildTautLine(
        lastRodPoint,
        lineAttach,
        dist,
        h,
        hookedLinePull,
        fightIntensity
      );

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

const buildSlackLine = (
  from: Point,
  to: Point,
  dist: number,
  stageHeight: number
): string => {
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
    buyBaitPack,
    claimDailyReward,
  } = useGame();
  const [activeTab, setActiveTab] = useState<BottomTabId>('fishing');

  if (loadState === 'loading') {
    return <LoadingState text="Loading Pond" />;
  }

  if (!snapshot) {
    return <LoadingState text={errorMessage ?? 'Game failed to load'} />;
  }

  const { profile, catalog, message } = snapshot;
  const activeCast = profile.activeCast;
  const selectedLocation =
    catalog.locations.find(
      (location) => location.id === profile.currentLocationId
    ) ??
    catalog.locations[0] ??
    null;
  const selectedBait =
    catalog.baits.find((bait) => bait.id === profile.currentBaitId) ??
    catalog.baits[0] ??
    null;
  const lastCatch = snapshot.lastCatch;
  const dailyRewardStatus = snapshot.dailyRewardStatus;
  const caughtFish = lastCatch
    ? (catalog.fish.find((fish) => fish.id === lastCatch.fishId) ?? null)
    : null;

  return (
    <main className="rk-shell">
      <section className="rk-screen">
        <AssetPreloads
          images={[
            ...catalog.locations.map((location) => location.image),
            ...catalog.baits.map((bait) => bait.image),
            ...catalog.baitPacks.map((pack) => pack.image),
            ...(selectedBait ? [selectedBait.image] : []),
            ...(caughtFish ? [caughtFish.image] : []),
          ]}
        />
        <SetupBar
          baits={catalog.baits}
          locations={catalog.locations}
          profile={profile}
          selectedBait={selectedBait}
          selectedLocation={selectedLocation}
          disabled={
            activeTab !== 'fishing' || Boolean(activeCast) || actionPending
          }
          onSelectLocation={selectLocation}
          onSelectBait={selectBait}
        />

        {activeTab === 'shop' ? (
          <ShopStage
            packs={catalog.baitPacks}
            baits={catalog.baits}
            profile={profile}
            dailyRewardStatus={dailyRewardStatus}
            actionPending={actionPending}
            message={message}
            errorMessage={errorMessage}
            onBuyBaitPack={buyBaitPack}
            onClaimDailyReward={claimDailyReward}
          />
        ) : (
          <FishingStage
            activeCast={activeCast}
            actionPending={actionPending}
            tapCount={tapCount}
            selectedBait={selectedBait}
            caughtFish={caughtFish}
            lastCatch={lastCatch}
            selectedLocation={selectedLocation}
            profile={profile}
            dailyRewardStatus={dailyRewardStatus}
            message={message}
            errorMessage={errorMessage}
            onStartCast={startCast}
            onHook={hook}
            onPull={pull}
            onClaimDailyReward={claimDailyReward}
          />
        )}

        <BottomTabs
          activeTab={activeTab}
          locked={Boolean(activeCast) || actionPending}
          onSelectTab={setActiveTab}
        />
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
        <img
          className="rk-loading-icon"
          src="/riverking/icon.png"
          alt="King of River"
        />
        <h1>King of River</h1>
        <p>{text}</p>
      </section>
    </main>
  );
};

const SetupBar = ({
  baits,
  locations,
  profile,
  selectedBait,
  selectedLocation,
  disabled,
  onSelectLocation,
  onSelectBait,
}: SetupBarProps) => {
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [baitPickerOpen, setBaitPickerOpen] = useState(false);
  const selectedBaitQuantity = selectedBait
    ? getBaitInventoryQuantity(profile, selectedBait.id)
    : 0;

  const handleSelectLocation = (locationId: string) => {
    setLocationPickerOpen(false);
    onSelectLocation(locationId);
  };

  const handleSelectBait = (baitId: string) => {
    setBaitPickerOpen(false);
    onSelectBait(baitId);
  };

  return (
    <header className="setup-bar">
      <div className="setup-picker-wrap setup-location-picker-wrap">
        <button
          className="setup-cell setup-cell-location"
          disabled={disabled}
          onClick={() => {
            setLocationPickerOpen((open) => !open);
            setBaitPickerOpen(false);
          }}
          type="button"
        >
          <span>
            <span className="setup-label">Location</span>
            <strong>{selectedLocation?.name ?? 'Pond'}</strong>
          </span>
          <span className="setup-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {locationPickerOpen && !disabled ? (
          <div className="location-picker" aria-label="Location picker">
            {locations.map((location) => {
              const selected = location.id === profile.currentLocationId;
              const unlocked = isLocationUnlocked(location, profile);

              return (
                <button
                  className={`location-option ${selected ? 'location-option-selected' : ''} ${
                    !unlocked ? 'location-option-disabled' : ''
                  }`}
                  disabled={!unlocked}
                  key={location.id}
                  onClick={() => handleSelectLocation(location.id)}
                  type="button"
                >
                  <span
                    className="location-option-thumb"
                    style={{ backgroundImage: `url(${location.image})` }}
                  />
                  <span>
                    <strong>{location.name}</strong>
                    <small>
                      {unlocked
                        ? getLocationWaterLabel(location.water)
                        : `${formatWeight(location.unlockWeightKg)} kg required`}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="setup-picker-wrap">
        <button
          className="setup-cell setup-cell-bait"
          disabled={disabled}
          onClick={() => {
            setBaitPickerOpen((open) => !open);
            setLocationPickerOpen(false);
          }}
          type="button"
        >
          {selectedBait ? <img src={selectedBait.image} alt="" /> : null}
          <span>
            <span className="setup-label">Bait</span>
            <strong>
              {selectedBait
                ? `${selectedBait.name} · ${selectedBaitQuantity}`
                : 'Choose'}
            </strong>
          </span>
          <span className="setup-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {baitPickerOpen && !disabled ? (
          <div className="bait-picker" aria-label="Bait picker">
            {baits.map((bait) => {
              const selected = bait.id === profile.currentBaitId;
              const quantity = getBaitInventoryQuantity(profile, bait.id);
              const wrongWater = selectedLocation
                ? !locationAcceptsBait(selectedLocation, bait)
                : false;
              const unavailable = quantity <= 0 || wrongWater;

              return (
                <button
                  className={`bait-option ${selected ? 'bait-option-selected' : ''} ${
                    unavailable ? 'bait-option-disabled' : ''
                  }`}
                  disabled={unavailable}
                  key={bait.id}
                  onClick={() => handleSelectBait(bait.id)}
                  type="button"
                >
                  <img src={bait.image} alt="" />
                  <span>
                    <strong>{bait.name}</strong>
                    <small>
                      {wrongWater ? 'Wrong water' : `${quantity} left`}
                    </small>
                  </span>
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
  dailyRewardStatus,
  message,
  errorMessage,
  onStartCast,
  onHook,
  onPull,
  onClaimDailyReward,
}: FishingStageProps) => {
  const backgroundImage =
    selectedLocation?.image ?? '/riverking/backgrounds/pond.webp';
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
  const biteReady =
    activeCast?.stage === 'casting' && now >= activeCast.hookReadyAt;
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
  const selectedBaitQuantity = selectedBait
    ? getBaitInventoryQuantity(profile, selectedBait.id)
    : 0;
  const selectedBaitWorksHere = Boolean(
    selectedBait &&
    selectedLocation &&
    locationAcceptsBait(selectedLocation, selectedBait)
  );
  const canStartCast = selectedBaitQuantity > 0 && selectedBaitWorksHere;
  const startBlockedLabel = selectedBaitWorksHere ? 'No bait' : 'Wrong water';

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
            <DailyRewardButton
              status={dailyRewardStatus}
              disabled={actionPending}
              onClaim={onClaimDailyReward}
            />
            <StatPill
              label="Caught"
              value={`${formatWeight(profile.totalCaughtWeightKg)} kg`}
            />
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
                  {selectedBait ? (
                    <img
                      className="bait-on-hook"
                      src={selectedBait.image}
                      alt=""
                    />
                  ) : null}
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
          canStartCast={canStartCast}
          startBlockedLabel={startBlockedLabel}
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

const ShopStage = ({
  packs,
  baits,
  profile,
  dailyRewardStatus,
  actionPending,
  message,
  errorMessage,
  onBuyBaitPack,
  onClaimDailyReward,
}: ShopStageProps) => {
  const infoMessage =
    message === 'Bait pack purchased.' ||
    message.startsWith('Daily reward claimed:')
      ? message
      : '';
  const outcomeMessage = errorMessage ?? infoMessage;

  return (
    <section className="stage-wrap shop-stage-wrap">
      <div className="shop-stage">
        <div className="shop-header">
          <div>
            <span>Shop</span>
            <h1>Bait Packs</h1>
          </div>
          <div className="stat-row">
            <DailyRewardButton
              status={dailyRewardStatus}
              disabled={actionPending}
              onClaim={onClaimDailyReward}
            />
            <StatPill
              label="Caught"
              value={`${formatWeight(profile.totalCaughtWeightKg)} kg`}
            />
            <StatPill label="Coins" value={profile.coins.toLocaleString()} />
          </div>
        </div>

        {outcomeMessage ? (
          <div className="shop-message">{outcomeMessage}</div>
        ) : null}

        <BaitBalance baits={baits} profile={profile} />

        <div className="shop-groups">
          <ShopGroup
            title="Freshwater"
            water="fresh"
            packs={packs}
            baits={baits}
            profile={profile}
            actionPending={actionPending}
            onBuyBaitPack={onBuyBaitPack}
          />
          <ShopGroup
            title="Saltwater"
            water="salt"
            packs={packs}
            baits={baits}
            profile={profile}
            actionPending={actionPending}
            onBuyBaitPack={onBuyBaitPack}
          />
        </div>
      </div>
    </section>
  );
};

const BaitBalance = ({
  baits,
  profile,
}: {
  baits: BaitDefinition[];
  profile: GameProfile;
}) => {
  return (
    <section className="bait-balance" aria-label="Bait balance">
      <h2>Bait Balance</h2>
      <div className="bait-balance-grid">
        {baits.map((bait) => (
          <div className="bait-balance-item" key={bait.id}>
            <img src={bait.image} alt="" />
            <span>{bait.displayName}</span>
            <strong>{getBaitInventoryQuantity(profile, bait.id)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
};

const ShopGroup = ({
  title,
  water,
  packs,
  baits,
  profile,
  actionPending,
  onBuyBaitPack,
}: ShopGroupProps) => {
  const visiblePacks = packs.filter((pack) => pack.water === water);

  return (
    <section className="shop-group">
      <h2>{title}</h2>
      <div className="shop-pack-grid">
        {visiblePacks.map((pack) => (
          <ShopPackCard
            key={pack.id}
            pack={pack}
            baits={baits}
            profile={profile}
            actionPending={actionPending}
            onBuyBaitPack={onBuyBaitPack}
          />
        ))}
      </div>
    </section>
  );
};

const ShopPackCard = ({
  pack,
  baits,
  profile,
  actionPending,
  onBuyBaitPack,
}: ShopPackCardProps) => {
  const canAfford = profile.coins >= pack.priceCoins;
  const buyDisabled =
    actionPending || Boolean(profile.activeCast) || !canAfford;

  return (
    <article className="shop-pack">
      <div className="shop-pack-main">
        <img className="shop-pack-icon" src={pack.image} alt="" />
        <div className="shop-pack-copy">
          <h3>{pack.name}</h3>
          <p>{pack.description}</p>
        </div>
      </div>

      <ul className="shop-pack-items">
        {pack.items.map((item) => {
          const bait = getBaitById(baits, item.baitId);

          return (
            <li key={item.baitId}>
              {bait ? <img src={bait.image} alt="" /> : null}
              <span>
                <strong>{bait?.displayName ?? item.baitId}</strong>
                <small>{item.quantity} in pack</small>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="shop-pack-footer">
        <button
          disabled={buyDisabled}
          onClick={() => onBuyBaitPack(pack.id)}
          type="button"
        >
          {`${pack.priceCoins.toLocaleString()} coins`}
        </button>
      </div>
    </article>
  );
};

const getBaitById = (
  baits: BaitDefinition[],
  baitId: string
): BaitDefinition | null => {
  return baits.find((bait) => bait.id === baitId) ?? null;
};

const getBaitInventoryQuantity = (
  profile: GameProfile,
  baitId: string
): number => {
  return (
    profile.baitInventory.find((item) => item.baitId === baitId)?.quantity ?? 0
  );
};

const isLocationUnlocked = (
  location: LocationDefinition,
  profile: GameProfile
): boolean => {
  return location.unlockWeightKg <= profile.totalCaughtWeightKg;
};

const locationAcceptsBait = (
  location: LocationDefinition,
  bait: BaitDefinition
): boolean => {
  return location.water === 'mixed' || location.water === bait.water;
};

const getLocationWaterLabel = (water: LocationDefinition['water']): string => {
  if (water === 'mixed') return 'Fresh + Salt';
  return water === 'fresh' ? 'Freshwater' : 'Saltwater';
};

const formatWeight = (weightKg: number): string => {
  return Number(weightKg.toFixed(2)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits:
      weightKg < 10 && weightKg !== Math.round(weightKg) ? 2 : 0,
  });
};

const ActionControls = ({
  activeCast,
  actionPending,
  castCooldownActive,
  canStartCast,
  startBlockedLabel,
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
        disabled={actionPending || castCooldownActive || !canStartCast}
        onClick={onStartCast}
        type="button"
      >
        {castCooldownActive
          ? 'Waiting'
          : canStartCast
            ? 'Cast'
            : startBlockedLabel}
      </button>
    );
  }

  if (activeCast.stage === 'casting') {
    const hookReady =
      now >= activeCast.hookReadyAt && now <= activeCast.hookExpiresAt;

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

const DailyRewardButton = ({
  status,
  disabled,
  onClaim,
}: DailyRewardButtonProps) => {
  const title = status.available
    ? 'Claim daily reward'
    : 'Daily reward claimed';

  return (
    <button
      aria-label={title}
      className={`daily-reward-button ${status.available ? 'daily-reward-button-ready' : ''}`}
      disabled={disabled || !status.available}
      onClick={onClaim}
      title={title}
      type="button"
    >
      <img src="/riverking/inline_commands/daily.png" alt="" />
      {status.available ? <span className="daily-reward-badge">!</span> : null}
    </button>
  );
};

const BottomTabs = ({
  activeTab,
  locked,
  onSelectTab,
}: {
  activeTab: BottomTabId;
  locked: boolean;
  onSelectTab: (tabId: BottomTabId) => void;
}) => {
  return (
    <nav className="bottom-tabs" aria-label="Sections">
      {bottomTabs.map((tab) => {
        const active = tab.id === activeTab;

        return (
          <button
            className={`bottom-tab ${active ? 'bottom-tab-active' : ''}`}
            disabled={tab.disabled || (locked && !active)}
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            type="button"
          >
            <img src={tab.icon} alt="" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
