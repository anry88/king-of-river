import type { RedisClient } from '@devvit/redis';
import { isGameProfile, type GameProfile } from '../../shared/game/types';

export type PlayerIdentity = {
  postId: string;
  username: string;
};

export type GameRepository = {
  loadProfile: (identity: PlayerIdentity) => Promise<GameProfile | null>;
  saveProfile: (profile: GameProfile) => Promise<void>;
};

export const createGameRepository = (redis: RedisClient): GameRepository => {
  return {
    loadProfile: async (identity) => {
      const rawProfile = await redis.get(profileKey(identity));
      if (!rawProfile) return null;

      try {
        const parsedProfile: unknown = JSON.parse(rawProfile);
        return isGameProfile(parsedProfile) ? parsedProfile : null;
      } catch {
        return null;
      }
    },
    saveProfile: async (profile) => {
      await redis.set(profileKey(profile), JSON.stringify(profile));
    },
  };
};

const profileKey = (identity: PlayerIdentity): string => {
  return `king-of-river:post:${identity.postId}:player:${identity.username}`;
};
