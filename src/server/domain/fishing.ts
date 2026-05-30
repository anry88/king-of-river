import { randomUUID } from 'node:crypto';
import {
  defaultBaitId,
  defaultLocationId,
  defaultRodId,
  findBait,
  findFish,
  findLocation,
} from '../../shared/game/catalog';
import type {
  ActiveCast,
  BaitDefinition,
  CatchRecord,
  FishDefinition,
  GameProfile,
  HookChallenge,
  HookedFish,
  LocationDefinition,
  Rarity,
} from '../../shared/game/types';

const maxRecentCatches = 12;
const biteMinWaitSeconds = 5;
const biteMaxWaitSeconds = 30;
const reactionWindowMs = 5000;
const pondCastArea = {
  minX: 0.08,
  maxX: 0.72,
  farY: 0.46,
  nearY: 0.66,
};

const rarityReward: Record<Rarity, { coins: number; xp: number }> = {
  common: { coins: 4, xp: 5 },
  uncommon: { coins: 9, xp: 12 },
  rare: { coins: 20, xp: 26 },
  epic: { coins: 44, xp: 56 },
  mythic: { coins: 90, xp: 115 },
  legendary: { coins: 160, xp: 180 },
};

type WeightedFish = {
  fish: FishDefinition;
  weight: number;
};

export type HookCastResult = {
  profile: GameProfile;
  hooked: boolean;
};

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export const createInitialProfile = (
  postId: string,
  username: string,
  now: number
): GameProfile => {
  return {
    version: 2,
    postId,
    username,
    coins: 40,
    xp: 0,
    level: 1,
    currentLocationId: defaultLocationId,
    currentBaitId: defaultBaitId,
    currentRodId: defaultRodId,
    discoveredFishIds: [],
    catches: [],
    activeCast: null,
    dailyReward: {
      lastClaimedAt: null,
      streak: 0,
    },
    updatedAt: now,
  };
};

export const startCast = (profile: GameProfile, now: number): GameProfile => {
  if (profile.activeCast) {
    return profile;
  }

  const location = requireUnlockedLocation(profile, profile.currentLocationId);
  const bait = requireBait(profile.currentBaitId);
  const waitSeconds = nextBiteWaitSeconds();
  const hookReadyAt = now + waitSeconds * 1000;
  const castSpot = nextCastSpot();

  return {
    ...profile,
    activeCast: {
      id: randomUUID(),
      locationId: location.id,
      baitId: bait.id,
      stage: 'casting',
      startedAt: now,
      hookReadyAt,
      hookExpiresAt: hookReadyAt + reactionWindowMs,
      waitSeconds,
      castX: castSpot.x,
      castY: castSpot.y,
      hookedFish: null,
      challenge: null,
      expiresAt: null,
    },
    updatedAt: now,
  };
};

export const expireActiveCast = (profile: GameProfile, now: number): GameProfile => {
  const activeCast = profile.activeCast;
  if (!activeCast) return profile;

  const castingExpired = activeCast.stage === 'casting' && now > activeCast.hookExpiresAt;
  const hookedExpired =
    activeCast.stage === 'hooked' && activeCast.expiresAt !== null && now > activeCast.expiresAt;

  if (!castingExpired && !hookedExpired) {
    return profile;
  }

  return {
    ...profile,
    activeCast: null,
    updatedAt: now,
  };
};

export const hookCast = (profile: GameProfile, now: number): HookCastResult => {
  const activeCast = requireActiveCast(profile.activeCast, 'casting');
  const location = requireUnlockedLocation(profile, activeCast.locationId);
  const bait = requireBait(activeCast.baitId);

  if (now < activeCast.hookReadyAt) {
    throw new GameRuleError('No bite yet.');
  }

  const reactionSeconds = Math.max(0, (now - activeCast.hookReadyAt) / 1000);

  if (now > activeCast.hookExpiresAt || !isHookSuccessful(location, reactionSeconds)) {
    return {
      profile: {
        ...profile,
        activeCast: null,
        updatedAt: now,
      },
      hooked: false,
    };
  }

  const fish = pickFish(location, bait, activeCast.waitSeconds);
  const hookedFish = createHookedFish(fish, location);
  const challenge = createChallenge(hookedFish);

  return {
    profile: {
      ...profile,
      activeCast: {
        ...activeCast,
        stage: 'hooked',
        hookedFish,
        challenge,
        expiresAt: now + challenge.durationMs,
      },
      updatedAt: now,
    },
    hooked: true,
  };
};

export const finishCast = (
  profile: GameProfile,
  taps: number,
  now: number
): { profile: GameProfile; catchRecord: CatchRecord | null; success: boolean } => {
  const activeCast = requireActiveCast(profile.activeCast, 'hooked');

  if (!activeCast.hookedFish || !activeCast.challenge || !activeCast.expiresAt) {
    throw new GameRuleError('No hooked fish is ready to land.');
  }

  const success = taps >= activeCast.challenge.tapGoal && now <= activeCast.expiresAt;

  if (!success) {
    return {
      profile: {
        ...profile,
        activeCast: null,
        updatedAt: now,
      },
      catchRecord: null,
      success: false,
    };
  }

  const catchRecord = createCatchRecord(profile, activeCast, now);
  const catches = [catchRecord, ...profile.catches].slice(0, maxRecentCatches);
  const discoveredFishIds = catchRecord.isNewDiscovery
    ? [...profile.discoveredFishIds, catchRecord.fishId]
    : profile.discoveredFishIds;
  const xp = profile.xp + catchRecord.xp;

  return {
    profile: {
      ...profile,
      coins: profile.coins + catchRecord.coins,
      xp,
      level: calculateLevel(xp),
      discoveredFishIds,
      catches,
      activeCast: null,
      updatedAt: now,
    },
    catchRecord,
    success: true,
  };
};

export const selectLocation = (
  profile: GameProfile,
  locationId: string,
  now: number
): GameProfile => {
  const location = requireUnlockedLocation(profile, locationId);

  return {
    ...profile,
    currentLocationId: location.id,
    activeCast: null,
    updatedAt: now,
  };
};

export const selectBait = (
  profile: GameProfile,
  baitId: string,
  now: number
): GameProfile => {
  const bait = requireBait(baitId);

  return {
    ...profile,
    currentBaitId: bait.id,
    activeCast: null,
    updatedAt: now,
  };
};

const requireUnlockedLocation = (
  profile: GameProfile,
  locationId: string
): LocationDefinition => {
  const location = findLocation(locationId);
  if (!location) {
    throw new GameRuleError('Unknown fishing location.');
  }

  if (location.unlockLevel > profile.level) {
    throw new GameRuleError('This location is not unlocked yet.');
  }

  return location;
};

const requireBait = (baitId: string): BaitDefinition => {
  const bait = findBait(baitId);
  if (!bait) {
    throw new GameRuleError('Unknown bait.');
  }

  return bait;
};

const requireActiveCast = (
  activeCast: ActiveCast | null,
  stage: ActiveCast['stage']
): ActiveCast => {
  if (!activeCast || activeCast.stage !== stage) {
    throw new GameRuleError('The cast is not in the expected state.');
  }

  return activeCast;
};

const pickFish = (
  location: LocationDefinition,
  bait: BaitDefinition,
  waitSeconds: number
): FishDefinition => {
  const rarityFactor = biteRarityFactor(waitSeconds, bait.rarityBonus);
  const pool = location.fishWeights
    .map((entry) => {
      const fish = findFish(entry.fishId);
      if (!fish) return null;

      const predatorFactor = fish.isPredator === bait.isPredator ? 1 : 0.18;
      const waterFactor = fish.water === bait.water ? 1 : 0.65;

      return {
        fish,
        weight: entry.weight * predatorFactor * waterFactor * rarityModifier(fish.rarity, rarityFactor),
      };
    })
    .filter(isWeightedFish);

  const firstEntry = pool[0];
  if (!firstEntry) {
    throw new GameRuleError('Location has no fish pool.');
  }

  const totalWeight = pool.reduce((total, entry) => total + entry.weight, 0);
  const threshold = Math.random() * totalWeight;
  let cursor = 0;

  for (const entry of pool) {
    cursor += entry.weight;
    if (threshold <= cursor) {
      return entry.fish;
    }
  }

  return firstEntry.fish;
};

const isHookSuccessful = (location: LocationDefinition, reactionSeconds: number): boolean => {
  if (reactionSeconds >= 5) return false;

  const catchChance =
    (1 - baseEscapeChance(location)) * Math.min(1, Math.max(0, 1 - reactionSeconds / 5));

  return Math.random() <= catchChance;
};

const baseEscapeChance = (location: LocationDefinition): number => {
  const tier = location.id === defaultLocationId ? 0 : 1;
  return Math.min(0.5, 0.05 * tier);
};

const nextBiteWaitSeconds = (): number => {
  const spread = biteMaxWaitSeconds - biteMinWaitSeconds + 1;
  return biteMinWaitSeconds + Math.floor(Math.random() * spread);
};

const nextCastSpot = (): { x: number; y: number } => {
  return {
    x: pondCastArea.minX + Math.random() * (pondCastArea.maxX - pondCastArea.minX),
    y: pondCastArea.farY + Math.random() * (pondCastArea.nearY - pondCastArea.farY),
  };
};

const biteRarityFactor = (waitSeconds: number, baitRarityBonus: number): number => {
  const wait = Math.min(biteMaxWaitSeconds, Math.max(biteMinWaitSeconds, waitSeconds));
  const waitFactor = (wait - biteMinWaitSeconds) / (biteMaxWaitSeconds - biteMinWaitSeconds);

  return Math.min(1, Math.max(0, waitFactor + baitRarityBonus));
};

const isWeightedFish = (value: WeightedFish | null): value is WeightedFish => {
  return value !== null && value.weight > 0;
};

const createHookedFish = (
  fish: FishDefinition,
  location: LocationDefinition
): HookedFish => {
  const weightKg = logNormalWeight(
    fish.meanWeightKg,
    fish.weightVarianceKg,
    location.sizeMultiplier
  );

  return {
    fishId: fish.id,
    fishName: fish.name,
    rarity: fish.rarity,
    weightKg,
  };
};

const createChallenge = (hookedFish: HookedFish): HookChallenge => {
  const tapGoal = rarityTapCount(hookedFish.rarity) + weightTapCount(hookedFish.weightKg);
  const durationMs = tapGoal > 15 ? 15000 : tapGoal > 10 ? 10000 : 5000;
  const struggleIntensity = Number(((tapGoal - 3) / 19).toFixed(2));

  return {
    tapGoal,
    durationMs,
    struggleIntensity: Math.min(1, Math.max(0, struggleIntensity)),
  };
};

const createCatchRecord = (
  profile: GameProfile,
  activeCast: ActiveCast,
  now: number
): CatchRecord => {
  const hookedFish = activeCast.hookedFish;
  if (!hookedFish) {
    throw new GameRuleError('Cannot create a catch without a hooked fish.');
  }

  const fish = findFish(hookedFish.fishId);
  if (!fish) {
    throw new GameRuleError('Hooked fish is missing from the catalog.');
  }

  const reward = rarityReward[hookedFish.rarity];
  const coins = Math.max(1, Math.round(reward.coins + hookedFish.weightKg * 2));
  const xp = Math.max(1, Math.round(reward.xp + hookedFish.weightKg * 3));

  return {
    id: randomUUID(),
    fishId: hookedFish.fishId,
    fishName: hookedFish.fishName,
    rarity: hookedFish.rarity,
    weightKg: hookedFish.weightKg,
    coins,
    xp,
    caughtAt: now,
    locationId: activeCast.locationId,
    isNewDiscovery: !profile.discoveredFishIds.includes(hookedFish.fishId),
  };
};

const rarityModifier = (rarity: Rarity, factor: number): number => {
  const normalizedFactor = Math.min(1, Math.max(0, factor));

  switch (rarity) {
    case 'common':
      return 1 - 0.7 * normalizedFactor;
    case 'uncommon':
      return 0.6 + 0.3 * normalizedFactor;
    case 'rare':
      return 0.3 + 0.4 * normalizedFactor;
    case 'epic':
      return 0.2 + 0.3 * normalizedFactor;
    case 'mythic':
      return 0.15 + 0.25 * normalizedFactor;
    case 'legendary':
      return 0.1 + 0.2 * normalizedFactor;
  }
};

const rarityTapCount = (rarity: Rarity): number => {
  switch (rarity) {
    case 'common':
      return 2;
    case 'uncommon':
      return 4;
    case 'rare':
      return 6;
    case 'epic':
      return 8;
    case 'mythic':
      return 10;
    case 'legendary':
      return 12;
  }
};

const weightTapCount = (weight: number): number => {
  if (weight < 1) return 1;
  if (weight < 5) return 2;
  if (weight < 10) return 3;
  if (weight < 30) return 4;
  if (weight < 60) return 5;
  if (weight < 100) return 6;
  if (weight < 150) return 7;
  if (weight < 250) return 8;
  if (weight < 400) return 9;
  return 10;
};

const calculateLevel = (xp: number): number => {
  return Math.max(1, Math.floor(Math.sqrt(xp / 60)) + 1);
};

const logNormalWeight = (
  meanWeightKg: number,
  weightVarianceKg: number,
  sizeMultiplier: number
): number => {
  const mu = Math.log(
    (meanWeightKg * meanWeightKg) / Math.sqrt(weightVarianceKg + meanWeightKg * meanWeightKg)
  );
  const sigma = Math.sqrt(Math.log(1 + weightVarianceKg / (meanWeightKg * meanWeightKg)));
  const weightKg = Math.exp(mu + sigma * nextGaussian()) * sizeMultiplier;

  return roundWeight(Math.max(0.05, weightKg));
};

const nextGaussian = (): number => {
  while (true) {
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    const radiusSquared = x * x + y * y;

    if (radiusSquared < 1 && radiusSquared !== 0) {
      return x * Math.sqrt((-2 * Math.log(radiusSquared)) / radiusSquared);
    }
  }
};

const roundWeight = (weightKg: number): number => {
  return Number(weightKg.toFixed(2));
};
