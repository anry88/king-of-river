import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { GameSnapshot } from './game/types';

type GameActions = {
  init: () => Promise<GameSnapshot>;
  startCast: () => Promise<GameSnapshot>;
  hook: (reactionSeconds: number) => Promise<GameSnapshot>;
  finishCast: (taps: number) => Promise<GameSnapshot>;
  expireCast: (castId: string) => Promise<GameSnapshot>;
  selectLocation: (locationId: string) => Promise<GameSnapshot>;
  selectBait: (baitId: string) => Promise<GameSnapshot>;
};

export type TrpcContext = {
  gameService: GameActions;
};

const t = initTRPC.context<TrpcContext>().create();

const publicProcedure = t.procedure.use(async (opts) => {
  try {
    return await opts.next();
  } catch (error) {
    if (error instanceof Error && error.name === 'GameRuleError') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error.message,
      });
    }

    throw error;
  }
});

export const appRouter = t.router({
  game: t.router({
    init: publicProcedure.query(({ ctx }) => {
      return ctx.gameService.init();
    }),
    startCast: publicProcedure.mutation(({ ctx }) => {
      return ctx.gameService.startCast();
    }),
    hook: publicProcedure
      .input(
        z.object({
          reactionSeconds: z.number().min(0).max(30),
        })
      )
      .mutation(({ ctx, input }) => {
        return ctx.gameService.hook(input.reactionSeconds);
      }),
    finishCast: publicProcedure
      .input(
        z.object({
          taps: z.number().int().min(0).max(500),
        })
      )
      .mutation(({ ctx, input }) => {
        return ctx.gameService.finishCast(input.taps);
      }),
    expireCast: publicProcedure
      .input(
        z.object({
          castId: z.string().min(1),
        })
      )
      .mutation(({ ctx, input }) => {
        return ctx.gameService.expireCast(input.castId);
      }),
    selectLocation: publicProcedure
      .input(
        z.object({
          locationId: z.string().min(1),
        })
      )
      .mutation(({ ctx, input }) => {
        return ctx.gameService.selectLocation(input.locationId);
      }),
    selectBait: publicProcedure
      .input(
        z.object({
          baitId: z.string().min(1),
        })
      )
      .mutation(({ ctx, input }) => {
        return ctx.gameService.selectBait(input.baitId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
