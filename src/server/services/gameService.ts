import { gameCatalog } from '../../shared/game/catalog';
import {
  defaultRatingFilters,
  type CatchRecord,
  type GameSnapshot,
  type RatingFilters,
  type RatingSnapshot,
} from '../../shared/game/types';
import {
  buyBaitPack,
  claimDailyReward,
  createDailyRewardStatus,
  createInitialProfile,
  expireActiveCast,
  expireCastById,
  finishCast,
  hookCast,
  selectBait,
  selectLocation,
  startCast,
} from '../domain/fishing';
import type { GameRepository, PlayerIdentity } from '../storage/gameRepository';
import type { RatingRepository } from '../storage/ratingRepository';

export type GameService = {
  init: () => Promise<GameSnapshot>;
  startCast: () => Promise<GameSnapshot>;
  hook: (reactionSeconds: number) => Promise<GameSnapshot>;
  finishCast: (taps: number) => Promise<GameSnapshot>;
  expireCast: (castId: string) => Promise<GameSnapshot>;
  selectLocation: (locationId: string) => Promise<GameSnapshot>;
  selectBait: (baitId: string) => Promise<GameSnapshot>;
  buyBaitPack: (baitPackId: string) => Promise<GameSnapshot>;
  claimDailyReward: () => Promise<GameSnapshot>;
  loadRatings: (filters: RatingFilters) => Promise<RatingSnapshot>;
  claimRatingReward: () => Promise<GameSnapshot>;
};

export const createGameService = (
  repository: GameRepository,
  ratingRepository: RatingRepository,
  identity: PlayerIdentity
): GameService => {
  const loadProfile = async () => {
    const now = Date.now();
    await ratingRepository.distributeDailyPrizes(identity, now);

    const profile = await repository.loadProfile(identity);
    if (profile) {
      const normalizedProfile = expireActiveCast(profile, now);
      if (normalizedProfile !== profile) {
        await repository.saveProfile(normalizedProfile);
      }
      return normalizedProfile;
    }

    const createdProfile = createInitialProfile(
      identity.postId,
      identity.username,
      now
    );
    await repository.saveProfile(createdProfile);
    return createdProfile;
  };

  const saveSnapshot = async (
    profile: Awaited<ReturnType<typeof loadProfile>>,
    message: string,
    ratingCatch: CatchRecord | null = null
  ): Promise<GameSnapshot> => {
    await repository.saveProfile(profile);
    if (ratingCatch) {
      await ratingRepository.recordCatch(identity, ratingCatch);
    }
    return createSnapshot(profile, message);
  };

  const createSnapshot = async (
    profile: Awaited<ReturnType<typeof loadProfile>>,
    message: string
  ): Promise<GameSnapshot> => {
    const now = Date.now();

    return {
      profile,
      catalog: gameCatalog,
      dailyRewardStatus: createDailyRewardStatus(profile, now),
      ratings: await ratingRepository.loadRatings(
        identity,
        {
          ...defaultRatingFilters,
          locationId: profile.currentLocationId,
        },
        now
      ),
      message,
      lastCatch: profile.catches[0] ?? null,
    };
  };

  const formatDailyRewardMessage = (
    result: ReturnType<typeof claimDailyReward>
  ): string => {
    const rewardList = result.rewards
      .map((item) => {
        const bait = gameCatalog.baits.find(
          (entry) => entry.id === item.baitId
        );
        return `${bait?.displayName ?? item.baitId} x${item.quantity}`;
      })
      .join(', ');

    return `Daily reward claimed: ${rewardList}.`;
  };

  return {
    init: async () => {
      const profile = await loadProfile();
      return createSnapshot(profile, '');
    },
    startCast: async () => {
      const profile = await loadProfile();
      return saveSnapshot(startCast(profile, Date.now()), '');
    },
    hook: async (reactionSeconds) => {
      const profile = await loadProfile();
      const result = hookCast(profile, Date.now(), reactionSeconds);
      return saveSnapshot(
        result.profile,
        result.hooked ? '' : 'The fish got away.'
      );
    },
    finishCast: async (taps) => {
      const profile = await loadProfile();
      const result = finishCast(profile, taps, Date.now());
      const message = result.success
        ? `Caught: ${result.catchRecord?.fishName ?? 'fish'}.`
        : 'The fish got away.';
      return saveSnapshot(result.profile, message, result.catchRecord);
    },
    expireCast: async (castId) => {
      const profile = await loadProfile();
      return saveSnapshot(
        expireCastById(profile, castId, Date.now()),
        'The fish got away.'
      );
    },
    selectLocation: async (locationId) => {
      const profile = await loadProfile();
      return saveSnapshot(selectLocation(profile, locationId, Date.now()), '');
    },
    selectBait: async (baitId) => {
      const profile = await loadProfile();
      return saveSnapshot(selectBait(profile, baitId, Date.now()), '');
    },
    buyBaitPack: async (baitPackId) => {
      const profile = await loadProfile();
      return saveSnapshot(
        buyBaitPack(profile, baitPackId, Date.now()),
        'Bait pack purchased.'
      );
    },
    claimDailyReward: async () => {
      const profile = await loadProfile();
      const result = claimDailyReward(profile, Date.now());
      return saveSnapshot(result.profile, formatDailyRewardMessage(result));
    },
    loadRatings: async (filters) => {
      const now = Date.now();
      await ratingRepository.distributeDailyPrizes(identity, now);
      return ratingRepository.loadRatings(
        identity,
        normalizeRatingFilters(filters),
        now
      );
    },
    claimRatingReward: async () => {
      const profile = await loadProfile();
      const claimedCoins = await ratingRepository.claimPendingReward(identity);
      if (claimedCoins <= 0) {
        return createSnapshot(profile, '');
      }

      return saveSnapshot(
        {
          ...profile,
          coins: profile.coins + claimedCoins,
          updatedAt: Date.now(),
        },
        `Rating reward claimed: ${claimedCoins} coins.`
      );
    },
  };
};

const normalizeRatingFilters = (filters: RatingFilters): RatingFilters => {
  return {
    period: filters.period,
    order: filters.order,
    locationId:
      filters.locationId === 'all' ||
      gameCatalog.locations.some(
        (location) => location.id === filters.locationId
      )
        ? filters.locationId
        : 'all',
    fishId:
      filters.fishId === 'all' ||
      gameCatalog.fish.some((fish) => fish.id === filters.fishId)
        ? filters.fishId
        : 'all',
  };
};
