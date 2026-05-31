import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '../trpcClient';
import type { ActiveCast, GameSnapshot } from '../../shared/game/types';

type LoadState = 'loading' | 'ready' | 'error';

type UseGameState = {
  snapshot: GameSnapshot | null;
  loadState: LoadState;
  actionPending: boolean;
  tapCount: number;
  errorMessage: string | null;
};

const requestTimeoutMs = 10000;
const localReactionWindowMs = 5000;

const escapedMessage = 'The fish got away.';

type LocalCastingTiming = {
  castId: string;
  hookReadyAt: number;
  hookExpiresAt: number;
};

type LocalHookedTiming = {
  castId: string;
  expiresAt: number;
};

const withTimeout = async <T,>(promise: Promise<T>, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, requestTimeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const useGame = () => {
  const [state, setState] = useState<UseGameState>({
    snapshot: null,
    loadState: 'loading',
    actionPending: false,
    tapCount: 0,
    errorMessage: null,
  });
  const stateRef = useRef(state);
  const tapCountRef = useRef(0);
  const localCastingTimingRef = useRef<LocalCastingTiming | null>(null);
  const localHookedTimingRef = useRef<LocalHookedTiming | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyClientCastTiming = useCallback((snapshot: GameSnapshot): GameSnapshot => {
    const activeCast = snapshot.profile.activeCast;

    if (!activeCast) {
      localCastingTimingRef.current = null;
      localHookedTimingRef.current = null;
      return snapshot;
    }

    if (activeCast.stage === 'casting') {
      localHookedTimingRef.current = null;
      let timing = localCastingTimingRef.current;

      if (timing?.castId !== activeCast.id) {
        const hookReadyAt = Date.now() + activeCast.waitSeconds * 1000;
        timing = {
          castId: activeCast.id,
          hookReadyAt,
          hookExpiresAt: hookReadyAt + localReactionWindowMs,
        };
        localCastingTimingRef.current = timing;
      }

      const clientTimedActiveCast: ActiveCast = {
        ...activeCast,
        hookReadyAt: timing.hookReadyAt,
        hookExpiresAt: timing.hookExpiresAt,
      };

      return {
        ...snapshot,
        profile: {
          ...snapshot.profile,
          activeCast: clientTimedActiveCast,
        },
      };
    }

    localCastingTimingRef.current = null;

    if (!activeCast.challenge) {
      return snapshot;
    }

    let timing = localHookedTimingRef.current;

    if (timing?.castId !== activeCast.id) {
      timing = {
        castId: activeCast.id,
        expiresAt: Date.now() + activeCast.challenge.durationMs,
      };
      localHookedTimingRef.current = timing;
    }

    const clientTimedActiveCast: ActiveCast = {
      ...activeCast,
      expiresAt: timing.expiresAt,
    };

    return {
      ...snapshot,
      profile: {
        ...snapshot.profile,
        activeCast: clientTimedActiveCast,
      },
    };
  }, []);

  const runAction = useCallback(
    async (action: () => Promise<GameSnapshot>, resetTaps: boolean) => {
      setState((current) => ({
        ...current,
        actionPending: true,
        errorMessage: null,
      }));

      try {
        const snapshot = applyClientCastTiming(await withTimeout(action(), 'Game action'));
        if (resetTaps) {
          tapCountRef.current = 0;
        }
        setState((current) => ({
          ...current,
          snapshot,
          loadState: 'ready',
          actionPending: false,
          tapCount: resetTaps ? 0 : current.tapCount,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Game action failed.';
        setState((current) => ({
          ...current,
          loadState: current.snapshot ? 'ready' : 'error',
          actionPending: false,
          errorMessage: message,
        }));
      }
    },
    [applyClientCastTiming]
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialState = async () => {
      try {
        const loadedSnapshot = await withTimeout(trpc.game.init.query(), 'Game loading');
        const snapshot = applyClientCastTiming(loadedSnapshot);
        if (cancelled) return;

        tapCountRef.current = 0;
        setState((current) => ({
          ...current,
          snapshot,
          loadState: 'ready',
          actionPending: false,
          tapCount: 0,
          errorMessage: null,
        }));
      } catch (error) {
        if (cancelled) return;

        const message = error instanceof Error ? error.message : 'Game loading failed.';
        setState((current) => ({
          ...current,
          loadState: 'error',
          actionPending: false,
          errorMessage: message,
        }));
      }
    };

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, [applyClientCastTiming]);

  const startCastAction = useCallback(() => {
    void runAction(() => trpc.game.startCast.mutate(), true);
  }, [runAction]);

  const hookAction = useCallback(() => {
    const activeCast = stateRef.current.snapshot?.profile.activeCast;
    const reactionSeconds =
      activeCast?.stage === 'casting'
        ? Math.max(0, (Date.now() - activeCast.hookReadyAt) / 1000)
        : 0;

    void runAction(
      () =>
        trpc.game.hook.mutate({
          reactionSeconds,
        }),
      true
    );
  }, [runAction]);

  const selectLocationAction = useCallback(
    (locationId: string) => {
      void runAction(
        () =>
          trpc.game.selectLocation.mutate({
            locationId,
          }),
        true
      );
    },
    [runAction]
  );

  const selectBaitAction = useCallback(
    (baitId: string) => {
      void runAction(
        () =>
          trpc.game.selectBait.mutate({
            baitId,
          }),
        true
      );
    },
    [runAction]
  );

  const buyBaitPackAction = useCallback(
    (baitPackId: string) => {
      void runAction(
        () =>
          trpc.game.buyBaitPack.mutate({
            baitPackId,
          }),
        false
      );
    },
    [runAction]
  );

  const claimDailyRewardAction = useCallback(() => {
    void runAction(() => trpc.game.claimDailyReward.mutate(), false);
  }, [runAction]);

  const pullAction = useCallback(() => {
    const snapshot = stateRef.current.snapshot;
    const activeCast = snapshot?.profile.activeCast;
    const challenge = activeCast?.challenge;

    if (!activeCast || activeCast.stage !== 'hooked' || !challenge) {
      return;
    }

    const nextTapCount = tapCountRef.current + 1;
    tapCountRef.current = nextTapCount;

    setState((current) => ({
      ...current,
      tapCount: nextTapCount,
    }));

    if (nextTapCount >= challenge.tapGoal) {
      void runAction(
        () =>
          trpc.game.finishCast.mutate({
            taps: nextTapCount,
          }),
        true
      );
    }
  }, [runAction]);

  const expireCastLocally = useCallback((castId: string) => {
    tapCountRef.current = 0;
    localCastingTimingRef.current = null;
    localHookedTimingRef.current = null;

    setState((current) => {
      const snapshot = current.snapshot;
      const activeCast = snapshot?.profile.activeCast;
      if (!snapshot || activeCast?.id !== castId) {
        return current;
      }

      return {
        ...current,
        snapshot: {
          ...snapshot,
          profile: {
            ...snapshot.profile,
            activeCast: null,
            updatedAt: Date.now(),
          },
          message: escapedMessage,
        },
        actionPending: false,
        tapCount: 0,
        errorMessage: null,
      };
    });

    void trpc.game.expireCast.mutate({ castId }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const activeCast = state.snapshot?.profile.activeCast;
    if (!activeCast || state.actionPending) {
      return undefined;
    }

    if (activeCast.stage === 'casting') {
      const timeoutMs = Math.max(0, activeCast.hookExpiresAt - Date.now() + 40);
      const timeoutId = setTimeout(() => {
        const currentActiveCast = stateRef.current.snapshot?.profile.activeCast;
        if (currentActiveCast?.id === activeCast.id && currentActiveCast.stage === 'casting') {
          expireCastLocally(activeCast.id);
        }
      }, timeoutMs);

      return () => clearTimeout(timeoutId);
    }

    if (activeCast.stage === 'hooked' && activeCast.expiresAt) {
      const timeoutMs = Math.max(0, activeCast.expiresAt - Date.now() + 40);
      const timeoutId = setTimeout(() => {
        const currentActiveCast = stateRef.current.snapshot?.profile.activeCast;
        if (currentActiveCast?.id === activeCast.id && currentActiveCast.stage === 'hooked') {
          expireCastLocally(activeCast.id);
        }
      }, timeoutMs);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [expireCastLocally, state.actionPending, state.snapshot?.profile.activeCast]);

  return {
    ...state,
    startCast: startCastAction,
    hook: hookAction,
    selectLocation: selectLocationAction,
    selectBait: selectBaitAction,
    buyBaitPack: buyBaitPackAction,
    claimDailyReward: claimDailyRewardAction,
    pull: pullAction,
  };
};
