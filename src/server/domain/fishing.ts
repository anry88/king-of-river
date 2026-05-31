import { randomUUID } from 'node:crypto';
import {
  defaultBaitId,
  defaultLocationId,
  defaultRodId,
  dailyRewardSchedule,
  findBait,
  findBaitPack,
  findFish,
  findLocation,
  locationCatalog,
} from '../../shared/game/catalog';
import type {
  ActiveCast,
  BaitDefinition,
  BaitInventoryItem,
  BaitPackItem,
  CatchRecord,
  DailyRewardItem,
  DailyRewardStatus,
  FishDefinition,
  GameProfile,
  HookChallenge,
  HookedFish,
  LocationDefinition,
  Rarity,
  WaterType,
} from '../../shared/game/types';

const maxRecentCatches = 12;
const biteMinWaitSeconds = 5;
const biteMaxWaitSeconds = 30;
const reactionWindowMs = 5000;
const serverActiveCastStaleMs = 10 * 60 * 1000;
const dailyRewardTimeZone = 'Europe/Belgrade';
const dailyRewardMaxDay = 7;
const dayMs = 24 * 60 * 60 * 1000;
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

const initialBaitInventory: BaitInventoryItem[] = [
  { baitId: 'fresh-peaceful', quantity: 10 },
  { baitId: 'fresh-predator', quantity: 5 },
];

export const createInitialProfile = (
  postId: string,
  username: string,
  now: number
): GameProfile => {
  return {
    version: 4,
    postId,
    username,
    coins: 40,
    xp: 0,
    level: 1,
    currentLocationId: defaultLocationId,
    currentBaitId: defaultBaitId,
    currentRodId: defaultRodId,
    baitInventory: initialBaitInventory.map((item) => ({ ...item })),
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

export const buyBaitPack = (
  profile: GameProfile,
  baitPackId: string,
  now: number
): GameProfile => {
  if (profile.activeCast) {
    throw new GameRuleError('Finish the current cast first.');
  }

  const baitPack = findBaitPack(baitPackId);
  if (!baitPack) {
    throw new GameRuleError('Unknown bait pack.');
  }

  if (profile.coins < baitPack.priceCoins) {
    throw new GameRuleError('Not enough coins.');
  }

  return {
    ...profile,
    coins: profile.coins - baitPack.priceCoins,
    baitInventory: mergeBaitInventory(profile.baitInventory, baitPack.items),
    updatedAt: now,
  };
};

export const createDailyRewardStatus = (
  profile: GameProfile,
  now: number
): DailyRewardStatus => {
  const planWater = dailyRewardPlanWater(profile);
  const available = canClaimDailyReward(profile, now);
  const claimStreak = available
    ? nextDailyRewardStreak(profile, now)
    : Math.max(1, profile.dailyReward.streak);
  const claimDay = dailyRewardDay(claimStreak);

  return {
    available,
    streak: profile.dailyReward.streak,
    claimDay,
    planWater,
    todayRewards: dailyRewardsForDay(planWater, claimDay),
  };
};

export const claimDailyReward = (
  profile: GameProfile,
  now: number
): { profile: GameProfile; rewards: DailyRewardItem[]; claimDay: number } => {
  const status = createDailyRewardStatus(profile, now);

  if (!status.available) {
    throw new GameRuleError('Daily reward already claimed.');
  }

  const streak = nextDailyRewardStreak(profile, now);

  return {
    profile: {
      ...profile,
      baitInventory: mergeBaitInventory(profile.baitInventory, status.todayRewards),
      dailyReward: {
        lastClaimedAt: now,
        streak,
      },
      updatedAt: now,
    },
    rewards: status.todayRewards,
    claimDay: status.claimDay,
  };
};

export const startCast = (profile: GameProfile, now: number): GameProfile => {
  if (profile.activeCast) {
    return profile;
  }

  const location = requireUnlockedLocation(profile, profile.currentLocationId);
  const bait = requireBait(profile.currentBaitId);
  if (bait.water !== location.water) {
    throw new GameRuleError('This bait does not work at this location.');
  }

  const baitInventory = consumeBait(profile.baitInventory, bait.id);
  const waitSeconds = nextBiteWaitSeconds();
  const hookReadyAt = now + waitSeconds * 1000;
  const castSpot = nextCastSpot();

  return {
    ...profile,
    baitInventory,
    currentBaitId: nextCurrentBaitId(baitInventory, location.water, bait.id),
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

  if (now <= activeCast.startedAt + serverActiveCastStaleMs) {
    return profile;
  }

  return {
    ...profile,
    activeCast: null,
    updatedAt: now,
  };
};

export const expireCastById = (
  profile: GameProfile,
  castId: string,
  now: number
): GameProfile => {
  const activeCast = profile.activeCast;
  if (!activeCast || activeCast.id !== castId) return profile;

  return {
    ...profile,
    activeCast: null,
    updatedAt: now,
  };
};

export const hookCast = (
  profile: GameProfile,
  now: number,
  clientReactionSeconds: number
): HookCastResult => {
  const activeCast = requireActiveCast(profile.activeCast, 'casting');
  const location = requireUnlockedLocation(profile, activeCast.locationId);
  const bait = requireBait(activeCast.baitId);
  const reactionSeconds = Math.min(30, Math.max(0, clientReactionSeconds));

  if (!isHookSuccessful(location, reactionSeconds)) {
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

  const success = taps >= activeCast.challenge.tapGoal;

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

const canClaimDailyReward = (profile: GameProfile, now: number): boolean => {
  const lastClaimedAt = profile.dailyReward.lastClaimedAt;
  if (lastClaimedAt === null) return true;

  return localDateKey(lastClaimedAt) !== localDateKey(now);
};

const nextDailyRewardStreak = (profile: GameProfile, now: number): number => {
  const lastClaimedAt = profile.dailyReward.lastClaimedAt;
  if (lastClaimedAt === null) return 1;

  return localDateKey(lastClaimedAt) === localDateKey(now - dayMs)
    ? profile.dailyReward.streak + 1
    : 1;
};

const dailyRewardDay = (streak: number): number => {
  return Math.min(dailyRewardMaxDay, Math.max(1, streak));
};

const dailyRewardPlanWater = (profile: GameProfile): WaterType => {
  const saltUnlocked = locationCatalog.some((location) => {
    return location.water === 'salt' && location.unlockLevel <= profile.level;
  });

  return saltUnlocked ? 'salt' : 'fresh';
};

const dailyRewardsForDay = (water: WaterType, day: number): DailyRewardItem[] => {
  const plan = dailyRewardSchedule[water];
  const fallbackRewards = plan[0];
  if (!fallbackRewards) {
    throw new GameRuleError('Daily reward plan is empty.');
  }

  const rewards = plan.find((entry) => entry.day === day) ?? fallbackRewards;

  return rewards.items.map((item) => ({ ...item }));
};

const dailyDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  timeZone: dailyRewardTimeZone,
  year: 'numeric',
});

const localDateKey = (timestamp: number): string => {
  const parts = dailyDateFormatter.formatToParts(new Date(timestamp));
  let day = '';
  let month = '';
  let year = '';

  for (const part of parts) {
    if (part.type === 'day') {
      day = part.value;
    } else if (part.type === 'month') {
      month = part.value;
    } else if (part.type === 'year') {
      year = part.value;
    }
  }

  return `${year}-${month}-${day}`;
};

const mergeBaitInventory = (
  inventory: BaitInventoryItem[],
  items: (BaitPackItem | DailyRewardItem)[]
): BaitInventoryItem[] => {
  const quantitiesByBaitId = new Map<string, number>();

  for (const item of inventory) {
    quantitiesByBaitId.set(item.baitId, item.quantity);
  }

  for (const item of items) {
    quantitiesByBaitId.set(
      item.baitId,
      (quantitiesByBaitId.get(item.baitId) ?? 0) + item.quantity
    );
  }

  return Array.from(quantitiesByBaitId.entries()).map(([baitId, quantity]) => ({
    baitId,
    quantity,
  }));
};

const consumeBait = (inventory: BaitInventoryItem[], baitId: string): BaitInventoryItem[] => {
  const current = inventory.find((item) => item.baitId === baitId)?.quantity ?? 0;
  if (current <= 0) {
    throw new GameRuleError('No bait left.');
  }

  return inventory.map((item) =>
    item.baitId === baitId ? { ...item, quantity: item.quantity - 1 } : item
  );
};

const nextCurrentBaitId = (
  inventory: BaitInventoryItem[],
  water: WaterType,
  currentBaitId: string
): string => {
  const currentQuantity = inventory.find((item) => item.baitId === currentBaitId)?.quantity ?? 0;
  if (currentQuantity > 0) return currentBaitId;

  const nextInventoryItem = inventory.find((item) => {
    if (item.quantity <= 0) return false;
    return findBait(item.baitId)?.water === water;
  });

  return nextInventoryItem?.baitId ?? currentBaitId;
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
      if (fish.water !== location.water) return null;

      const predatorFactor = fish.isPredator === bait.isPredator ? 1 : 0.18;

      return {
        fish,
        weight: entry.weight * predatorFactor * rarityModifier(fish.rarity, rarityFactor),
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
    castX: activeCast.castX,
    castY: activeCast.castY,
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
