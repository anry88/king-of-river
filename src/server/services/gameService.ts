import { gameCatalog } from '../../shared/game/catalog';
import type { GameSnapshot } from '../../shared/game/types';
import {
  createInitialProfile,
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
  hook: () => Promise<GameSnapshot>;
  finishCast: (taps: number) => Promise<GameSnapshot>;
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
    if (profile) return profile;

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
        message: 'Можно рыбачить.',
        lastCatch: profile.catches[0] ?? null,
      };
    },
    startCast: async () => {
      const profile = await loadProfile();
      return saveSnapshot(startCast(profile, Date.now()), 'Поплавок на воде.');
    },
    hook: async () => {
      const profile = await loadProfile();
      return saveSnapshot(hookCast(profile, Date.now()), 'Рыба на крючке.');
    },
    finishCast: async (taps) => {
      const profile = await loadProfile();
      const result = finishCast(profile, taps, Date.now());
      const message = result.success
        ? `Поймана рыба: ${result.catchRecord?.fishName ?? 'улов'}.`
        : 'Рыба сорвалась.';
      return saveSnapshot(result.profile, message);
    },
    selectLocation: async (locationId) => {
      const profile = await loadProfile();
      return saveSnapshot(selectLocation(profile, locationId, Date.now()), 'Локация выбрана.');
    },
    selectBait: async (baitId) => {
      const profile = await loadProfile();
      return saveSnapshot(selectBait(profile, baitId, Date.now()), 'Приманка выбрана.');
    },
  };
};
