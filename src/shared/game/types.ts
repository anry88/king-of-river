export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'mythic' | 'legendary';

export type WaterType = 'fresh' | 'salt';

export type FishDefinition = {
  id: string;
  name: string;
  rarity: Rarity;
  meanWeightKg: number;
  weightVarianceKg: number;
  isPredator: boolean;
  water: WaterType;
  image: string;
};

export type BaitDefinition = {
  id: string;
  name: string;
  displayName: string;
  water: WaterType;
  isPredator: boolean;
  rarityBonus: number;
  image: string;
};

export type LocationFishWeight = {
  fishId: string;
  weight: number;
};

export type LocationDefinition = {
  id: string;
  name: string;
  description: string;
  unlockLevel: number;
  sizeMultiplier: number;
  image: string;
  fishWeights: LocationFishWeight[];
};

export type RodDefinition = {
  id: string;
  name: string;
  power: number;
  unlockLevel: number;
};

export type HookedFish = {
  fishId: string;
  fishName: string;
  rarity: Rarity;
  weightKg: number;
};

export type HookChallenge = {
  tapGoal: number;
  durationMs: number;
  struggleIntensity: number;
};

export type ActiveCast = {
  id: string;
  locationId: string;
  baitId: string;
  stage: 'casting' | 'hooked';
  startedAt: number;
  hookReadyAt: number;
  hookExpiresAt: number;
  waitSeconds: number;
  castX: number;
  castY: number;
  hookedFish: HookedFish | null;
  challenge: HookChallenge | null;
  expiresAt: number | null;
};

export type CatchRecord = {
  id: string;
  fishId: string;
  fishName: string;
  rarity: Rarity;
  weightKg: number;
  coins: number;
  xp: number;
  caughtAt: number;
  locationId: string;
  castX?: number;
  castY?: number;
  isNewDiscovery: boolean;
};

export type DailyRewardState = {
  lastClaimedAt: number | null;
  streak: number;
};

export type GameProfile = {
  version: 2;
  postId: string;
  username: string;
  coins: number;
  xp: number;
  level: number;
  currentLocationId: string;
  currentBaitId: string;
  currentRodId: string;
  discoveredFishIds: string[];
  catches: CatchRecord[];
  activeCast: ActiveCast | null;
  dailyReward: DailyRewardState;
  updatedAt: number;
};

export type GameCatalog = {
  locations: LocationDefinition[];
  baits: BaitDefinition[];
  rods: RodDefinition[];
  fish: FishDefinition[];
};

export type GameSnapshot = {
  profile: GameProfile;
  catalog: GameCatalog;
  message: string;
  lastCatch: CatchRecord | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isRarity = (value: unknown): value is Rarity => {
  return (
    value === 'common' ||
    value === 'uncommon' ||
    value === 'rare' ||
    value === 'epic' ||
    value === 'mythic' ||
    value === 'legendary'
  );
};

const isHookedFish = (value: unknown): value is HookedFish => {
  if (!isRecord(value)) return false;

  return (
    typeof value.fishId === 'string' &&
    typeof value.fishName === 'string' &&
    isRarity(value.rarity) &&
    isNumber(value.weightKg)
  );
};

const isHookChallenge = (value: unknown): value is HookChallenge => {
  if (!isRecord(value)) return false;

  return (
    isNumber(value.tapGoal) &&
    isNumber(value.durationMs) &&
    isNumber(value.struggleIntensity)
  );
};

const isCatchRecordArray = (value: unknown): value is CatchRecord[] => {
  if (!Array.isArray(value)) return false;

  return value.every((item) => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === 'string' &&
      typeof item.fishId === 'string' &&
      typeof item.fishName === 'string' &&
      isRarity(item.rarity) &&
      isNumber(item.weightKg) &&
      isNumber(item.coins) &&
      isNumber(item.xp) &&
      isNumber(item.caughtAt) &&
      typeof item.locationId === 'string' &&
      (item.castX === undefined || isNumber(item.castX)) &&
      (item.castY === undefined || isNumber(item.castY)) &&
      typeof item.isNewDiscovery === 'boolean'
    );
  });
};

const isActiveCast = (value: unknown): value is ActiveCast => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.locationId === 'string' &&
    typeof value.baitId === 'string' &&
    (value.stage === 'casting' || value.stage === 'hooked') &&
    isNumber(value.startedAt) &&
    isNumber(value.hookReadyAt) &&
    isNumber(value.hookExpiresAt) &&
    isNumber(value.waitSeconds) &&
    isNumber(value.castX) &&
    isNumber(value.castY) &&
    (value.hookedFish === null || isHookedFish(value.hookedFish)) &&
    (value.challenge === null || isHookChallenge(value.challenge)) &&
    (value.expiresAt === null || isNumber(value.expiresAt))
  );
};

export const isGameProfile = (value: unknown): value is GameProfile => {
  if (!isRecord(value)) return false;
  if (value.version !== 2) return false;

  const dailyReward = value.dailyReward;
  if (!isRecord(dailyReward)) return false;

  if (value.activeCast !== null && !isActiveCast(value.activeCast)) {
    value.activeCast = null;
  }

  return (
    typeof value.postId === 'string' &&
    typeof value.username === 'string' &&
    isNumber(value.coins) &&
    isNumber(value.xp) &&
    isNumber(value.level) &&
    typeof value.currentLocationId === 'string' &&
    typeof value.currentBaitId === 'string' &&
    typeof value.currentRodId === 'string' &&
    isStringArray(value.discoveredFishIds) &&
    isCatchRecordArray(value.catches) &&
    (value.activeCast === null || isActiveCast(value.activeCast)) &&
    (dailyReward.lastClaimedAt === null || isNumber(dailyReward.lastClaimedAt)) &&
    isNumber(dailyReward.streak) &&
    isNumber(value.updatedAt)
  );
};
