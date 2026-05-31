import { gameCatalog } from '../../shared/game/catalog';
import type { GameSnapshot } from '../../shared/game/types';
import {
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

export type GameService = {
  init: () => Promise<GameSnapshot>;
  startCast: () => Promise<GameSnapshot>;
  hook: (reactionSeconds: number) => Promise<GameSnapshot>;
  finishCast: (taps: number) => Promise<GameSnapshot>;
  expireCast: (castId: string) => Promise<GameSnapshot>;
  selectLocation: (locationId: string) => Promise<GameSnapshot>;
  selectBait: (baitId: string) => Promise<GameSnapshot>;
};

export const createGameService = (
  repository: GameRepository,
  identity: PlayerIdentity
): GameService => {
  const loadProfile = async () => {
    const now = Date.now();
    const profile = await repository.loadProfile(identity);
    if (profile) {
      const normalizedProfile = expireActiveCast(profile, now);
      if (normalizedProfile !== profile) {
        await repository.saveProfile(normalizedProfile);
      }
      return normalizedProfile;
    }

    const createdProfile = createInitialProfile(identity.postId, identity.username, now);
    await repository.saveProfile(createdProfile);
    return createdProfile;
  };

  const saveSnapshot = async (
    profile: Awaited<ReturnType<typeof loadProfile>>,
    message: string
  ): Promise<GameSnapshot> => {
    await repository.saveProfile(profile);
    return {
      profile,
      catalog: gameCatalog,
      message,
      lastCatch: profile.catches[0] ?? null,
    };
  };

  return {
    init: async () => {
      const profile = await loadProfile();
      return {
        profile,
        catalog: gameCatalog,
        message: '',
        lastCatch: profile.catches[0] ?? null,
      };
    },
    startCast: async () => {
      const profile = await loadProfile();
      return saveSnapshot(startCast(profile, Date.now()), '');
    },
    hook: async (reactionSeconds) => {
      const profile = await loadProfile();
      const result = hookCast(profile, Date.now(), reactionSeconds);
      return saveSnapshot(result.profile, result.hooked ? '' : 'The fish got away.');
    },
    finishCast: async (taps) => {
      const profile = await loadProfile();
      const result = finishCast(profile, taps, Date.now());
      const message = result.success
        ? `Caught: ${result.catchRecord?.fishName ?? 'fish'}.`
        : 'The fish got away.';
      return saveSnapshot(result.profile, message);
    },
    expireCast: async (castId) => {
      const profile = await loadProfile();
      return saveSnapshot(expireCastById(profile, castId, Date.now()), 'The fish got away.');
    },
    selectLocation: async (locationId) => {
      const profile = await loadProfile();
      return saveSnapshot(selectLocation(profile, locationId, Date.now()), '');
    },
    selectBait: async (baitId) => {
      const profile = await loadProfile();
      return saveSnapshot(selectBait(profile, baitId, Date.now()), '');
    },
  };
};
