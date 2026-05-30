import { TRPCError } from '@trpc/server';
import { context as devvitContext, redis } from '@devvit/web/server';
import { createGameService } from './services/gameService';
import { createGameRepository } from './storage/gameRepository';
import type { PlayerIdentity } from './storage/gameRepository';
import { appRouter, type TrpcContext } from '../shared/trpc';

export const createTrpcContext = async (): Promise<TrpcContext> => {
  const postId = devvitContext.postId;

  if (!postId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'postId is required but missing from Devvit context.',
    });
  }

  const username = devvitContext.username ?? devvitContext.userId ?? 'anonymous';

  const identity: PlayerIdentity = {
    postId,
    username,
  };

  return {
    gameService: createGameService(createGameRepository(redis), identity),
  };
};

export { appRouter };
