import type { RedisClient } from '@devvit/redis';
import { findLocation, locationCatalog } from '../../shared/game/catalog';
import type {
  CatchRecord,
  RatingEntry,
  RatingFilters,
  RatingOrder,
  RatingRewardStatus,
  RatingSnapshot,
  Rarity,
} from '../../shared/game/types';
import type { PlayerIdentity } from './gameRepository';

type StoredRatingCatch = {
  catchId: string;
  username: string;
  fishId: string;
  fishName: string;
  locationId: string;
  locationName: string;
  rarity: Rarity;
  weightKg: number;
  caughtAt: number;
};

export type RatingRepository = {
  recordCatch: (
    identity: PlayerIdentity,
    catchRecord: CatchRecord
  ) => Promise<void>;
  loadRatings: (
    identity: PlayerIdentity,
    filters: RatingFilters,
    now: number
  ) => Promise<RatingSnapshot>;
  distributeDailyPrizes: (
    identity: PlayerIdentity,
    now: number
  ) => Promise<void>;
  getRewardStatus: (
    identity: PlayerIdentity,
    now: number
  ) => Promise<RatingRewardStatus>;
  claimPendingReward: (identity: PlayerIdentity) => Promise<number>;
};

const ratingTimeZone = 'Europe/Belgrade';
const ratingDayMs = 24 * 60 * 60 * 1000;
const ratingListLimit = 50;
const dailyIndexTtlSeconds = 10 * 24 * 60 * 60;
const allFilterId = 'all';

const rarityRank: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  mythic: 5,
  legendary: 6,
};

export const createRatingRepository = (
  redis: RedisClient
): RatingRepository => {
  const loadRankedCatches = async (
    identity: PlayerIdentity,
    periodKey: string,
    filterKey: string,
    order: RatingOrder,
    limit: number | null
  ): Promise<StoredRatingCatch[]> => {
    const rows = await redis.zRange(
      ratingIndexKey(identity, periodKey, filterKey),
      0,
      limit === null ? -1 : Math.max(0, limit - 1),
      {
        by: 'rank',
        reverse: order === 'desc',
      }
    );
    const catchIds = rows.map((row) => row.member);
    if (catchIds.length === 0) return [];

    const rawValues = await redis.hMGet(ratingCatchesKey(identity), catchIds);
    const catches: StoredRatingCatch[] = [];
    for (const rawValue of rawValues) {
      const parsed = parseStoredRatingCatch(rawValue);
      if (parsed) {
        catches.push(parsed);
      }
    }

    return catches;
  };

  const dailyPrizeMap = async (
    identity: PlayerIdentity,
    dateKey: string,
    locationId: string
  ): Promise<Map<number, number>> => {
    const catches = await loadRankedCatches(
      identity,
      dateKey,
      locationFilterKey(locationId),
      'desc',
      null
    );
    if (catches.length === 0) return new Map();

    const uniquePlayers = new Set(catches.map((entry) => entry.username));
    const maxPlaces = Math.min(catches.length, uniquePlayers.size, 10);
    if (maxPlaces <= 0) return new Map();

    const coinsByRank = new Map<number, number>();
    for (let index = 0; index < maxPlaces; index += 1) {
      coinsByRank.set(index + 1, (maxPlaces - index) * 50);
    }

    return coinsByRank;
  };

  return {
    recordCatch: async (identity, catchRecord) => {
      const storedCatch = createStoredRatingCatch(identity, catchRecord);
      const score = ratingScore(storedCatch);
      const dateKey = ratingDateKey(catchRecord.caughtAt);
      const indexKeys = [
        ratingIndexKey(identity, 'all', locationFilterKey(allFilterId)),
        ratingIndexKey(
          identity,
          'all',
          locationFilterKey(catchRecord.locationId)
        ),
        ratingIndexKey(identity, 'all', fishFilterKey(catchRecord.fishId)),
        ratingIndexKey(identity, dateKey, locationFilterKey(allFilterId)),
        ratingIndexKey(
          identity,
          dateKey,
          locationFilterKey(catchRecord.locationId)
        ),
        ratingIndexKey(identity, dateKey, fishFilterKey(catchRecord.fishId)),
      ];

      await redis.hSet(ratingCatchesKey(identity), {
        [storedCatch.catchId]: JSON.stringify(storedCatch),
      });
      await Promise.all(
        indexKeys.map(async (key) => {
          await redis.zAdd(key, { member: storedCatch.catchId, score });
          if (key.includes(`:day:${dateKey}:`)) {
            await redis.expire(key, dailyIndexTtlSeconds);
          }
        })
      );
    },

    loadRatings: async (identity, filters, now) => {
      const periodKey = ratingPeriodKey(filters.period, now);
      const filterKey =
        filters.fishId === allFilterId
          ? locationFilterKey(filters.locationId)
          : fishFilterKey(filters.fishId);
      const catches = await loadRankedCatches(
        identity,
        periodKey,
        filterKey,
        filters.order,
        ratingListLimit
      );
      const prizePreview =
        filters.order === 'desc' &&
        filters.fishId === allFilterId &&
        filters.locationId !== allFilterId &&
        filters.period !== 'all'
          ? await dailyPrizeMap(identity, periodKey, filters.locationId)
          : new Map<number, number>();

      return {
        filters,
        entries: catches.map((entry, index) =>
          createRatingEntry(entry, index + 1, prizePreview)
        ),
        rewardStatus: await getRatingRewardStatus(redis, identity, now),
      };
    },

    distributeDailyPrizes: async (identity, now) => {
      const prizeDateKey = ratingDateKey(now - ratingDayMs);
      const claimedDistribution = await redis.hSetNX(
        ratingDistributedKey(identity),
        prizeDateKey,
        String(now)
      );
      if (claimedDistribution === 0) return;

      for (const location of locationCatalog) {
        const catches = await loadRankedCatches(
          identity,
          prizeDateKey,
          locationFilterKey(location.id),
          'desc',
          null
        );
        if (catches.length === 0) continue;

        const uniquePlayers = new Set(catches.map((entry) => entry.username));
        const maxPlaces = Math.min(catches.length, uniquePlayers.size, 10);
        for (let index = 0; index < maxPlaces; index += 1) {
          const catchEntry = catches[index];
          if (!catchEntry) continue;

          await redis.hIncrBy(
            ratingPendingKey(identity),
            catchEntry.username,
            (maxPlaces - index) * 50
          );
        }
      }
    },

    getRewardStatus: async (identity, now) => {
      return getRatingRewardStatus(redis, identity, now);
    },

    claimPendingReward: async (identity) => {
      const pendingCoins = await pendingCoinsForUser(redis, identity);
      if (pendingCoins <= 0) return 0;

      await redis.hDel(ratingPendingKey(identity), [identity.username]);
      return pendingCoins;
    },
  };
};

const createStoredRatingCatch = (
  identity: PlayerIdentity,
  catchRecord: CatchRecord
): StoredRatingCatch => {
  const location = findLocation(catchRecord.locationId);

  return {
    catchId: catchRecord.id,
    username: identity.username,
    fishId: catchRecord.fishId,
    fishName: catchRecord.fishName,
    locationId: catchRecord.locationId,
    locationName: location?.name ?? catchRecord.locationId,
    rarity: catchRecord.rarity,
    weightKg: catchRecord.weightKg,
    caughtAt: catchRecord.caughtAt,
  };
};

const createRatingEntry = (
  entry: StoredRatingCatch,
  rank: number,
  prizePreview: Map<number, number>
): RatingEntry => {
  return {
    rank,
    catchId: entry.catchId,
    username: entry.username,
    fishId: entry.fishId,
    fishName: entry.fishName,
    locationId: entry.locationId,
    locationName: entry.locationName,
    rarity: entry.rarity,
    weightKg: entry.weightKg,
    caughtAt: entry.caughtAt,
    prizeCoins: prizePreview.get(rank) ?? null,
  };
};

const ratingScore = (entry: StoredRatingCatch): number => {
  return (
    rarityRank[entry.rarity] * 1_000_000_000 + Math.round(entry.weightKg * 1000)
  );
};

const getRatingRewardStatus = async (
  redis: RedisClient,
  identity: PlayerIdentity,
  now: number
): Promise<RatingRewardStatus> => {
  const yesterdayKey = ratingDateKey(now - ratingDayMs);
  const distributedAt = await redis.hGet(
    ratingDistributedKey(identity),
    yesterdayKey
  );

  return {
    pendingCoins: await pendingCoinsForUser(redis, identity),
    lastDistributedDate: distributedAt ? yesterdayKey : null,
  };
};

const pendingCoinsForUser = async (
  redis: RedisClient,
  identity: PlayerIdentity
): Promise<number> => {
  const rawValue = await redis.hGet(
    ratingPendingKey(identity),
    identity.username
  );
  if (!rawValue) return 0;

  const pendingCoins = Number(rawValue);
  return Number.isFinite(pendingCoins)
    ? Math.max(0, Math.floor(pendingCoins))
    : 0;
};

const ratingPeriodKey = (
  period: RatingFilters['period'],
  now: number
): string => {
  if (period === 'all') return 'all';
  if (period === 'today') return ratingDateKey(now);
  return ratingDateKey(now - ratingDayMs);
};

const ratingDateKey = (timestamp: number): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ratingTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
};

const locationFilterKey = (locationId: string): string => {
  return `location:${locationId}`;
};

const fishFilterKey = (fishId: string): string => {
  return `fish:${fishId}`;
};

const ratingBaseKey = (identity: PlayerIdentity): string => {
  return `king-of-river:post:${identity.postId}:rating`;
};

const ratingCatchesKey = (identity: PlayerIdentity): string => {
  return `${ratingBaseKey(identity)}:catches`;
};

const ratingPendingKey = (identity: PlayerIdentity): string => {
  return `${ratingBaseKey(identity)}:pending`;
};

const ratingDistributedKey = (identity: PlayerIdentity): string => {
  return `${ratingBaseKey(identity)}:distributed`;
};

const ratingIndexKey = (
  identity: PlayerIdentity,
  periodKey: string,
  filterKey: string
): string => {
  const periodSegment = periodKey === 'all' ? 'all' : `day:${periodKey}`;
  return `${ratingBaseKey(identity)}:index:${periodSegment}:${filterKey}`;
};

const parseStoredRatingCatch = (
  rawValue: string | null | undefined
): StoredRatingCatch | null => {
  if (!rawValue) return null;

  try {
    const parsed: unknown = JSON.parse(rawValue);
    return isStoredRatingCatch(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isStoredRatingCatch = (value: unknown): value is StoredRatingCatch => {
  if (!isRecord(value)) return false;

  return (
    typeof value.catchId === 'string' &&
    typeof value.username === 'string' &&
    typeof value.fishId === 'string' &&
    typeof value.fishName === 'string' &&
    typeof value.locationId === 'string' &&
    typeof value.locationName === 'string' &&
    isRarity(value.rarity) &&
    typeof value.weightKg === 'number' &&
    Number.isFinite(value.weightKg) &&
    typeof value.caughtAt === 'number' &&
    Number.isFinite(value.caughtAt)
  );
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
