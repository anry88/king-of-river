import { randomUUID } from 'node:crypto';
import {
  defaultLocationId,
  defaultRodId,
  findFish,
  findLocation,
  findRod,
} from '../../shared/game/catalog';
import type {
  ActiveCast,
  CatchRecord,
  FishDefinition,
  GameProfile,
  HookChallenge,
  HookedFish,
  LocationDefinition,
  Rarity,
} from '../../shared/game/types';

const maxRecentCatches = 12;

const rarityChallenge: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.25,
  rare: 1.65,
  epic: 2.15,
  legendary: 2.8,
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
    version: 1,
    postId,
    username,
    coins: 40,
    xp: 0,
    level: 1,
    currentLocationId: defaultLocationId,
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

  return {
    ...profile,
    activeCast: {
      id: randomUUID(),
      locationId: location.id,
      stage: 'casting',
      startedAt: now,
      hookedFish: null,
      challenge: null,
      expiresAt: null,
    },
    updatedAt: now,
  };
};

export const hookCast = (profile: GameProfile, now: number): GameProfile => {
  const activeCast = requireActiveCast(profile.activeCast, 'casting');
  const location = requireUnlockedLocation(profile, activeCast.locationId);
  const fish = pickFish(location);
  const hookedFish = createHookedFish(fish);
  const challenge = createChallenge(hookedFish, profile.currentRodId);

  return {
    ...profile,
    activeCast: {
      ...activeCast,
      stage: 'hooked',
      hookedFish,
      challenge,
      expiresAt: now + challenge.durationMs,
    },
    updatedAt: now,
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

const requireActiveCast = (
  activeCast: ActiveCast | null,
  stage: ActiveCast['stage']
): ActiveCast => {
  if (!activeCast || activeCast.stage !== stage) {
    throw new GameRuleError('The cast is not in the expected state.');
  }

  return activeCast;
};

const pickFish = (location: LocationDefinition): FishDefinition => {
  const pool = location.fishWeights
    .map((entry) => {
      const fish = findFish(entry.fishId);
      return fish ? { fish, weight: entry.weight } : null;
    })
    .filter((entry) => entry !== null);

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

const createHookedFish = (fish: FishDefinition): HookedFish => {
  const weightRange = fish.maxWeightKg - fish.minWeightKg;
  const weightKg = roundWeight(fish.minWeightKg + Math.random() * weightRange);

  return {
    fishId: fish.id,
    fishName: fish.name,
    rarity: fish.rarity,
    weightKg,
  };
};

const createChallenge = (hookedFish: HookedFish, rodId: string): HookChallenge => {
  const rod = findRod(rodId);
  const rodPower = rod?.power ?? 1;
  const rarityPower = rarityChallenge[hookedFish.rarity];
  const tapGoal = Math.max(4, Math.round(5 + hookedFish.weightKg * rarityPower - rodPower));
  const durationMs = Math.max(3500, Math.round(8200 - rarityPower * 700 + rodPower * 250));

  return {
    tapGoal,
    durationMs,
    struggleIntensity: Number((rarityPower + hookedFish.weightKg / 12).toFixed(2)),
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

  const rarityPower = rarityChallenge[hookedFish.rarity];
  const coins = Math.round(fish.baseCoins * rarityPower + hookedFish.weightKg * 2);
  const xp = Math.round(fish.baseXp * rarityPower + hookedFish.weightKg * 3);

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

const calculateLevel = (xp: number): number => {
  return Math.max(1, Math.floor(Math.sqrt(xp / 60)) + 1);
};

const roundWeight = (weightKg: number): number => {
  return Number(weightKg.toFixed(2));
};
