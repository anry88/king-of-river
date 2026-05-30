import { useCallback, useEffect, useState } from 'react';
import { trpc } from '../trpcClient';
import type { GameSnapshot } from '../../shared/game/types';

type LoadState = 'loading' | 'ready' | 'error';

type UseGameState = {
  snapshot: GameSnapshot | null;
  loadState: LoadState;
  actionPending: boolean;
  tapCount: number;
  errorMessage: string | null;
};

const requestTimeoutMs = 10000;

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

  const runAction = useCallback(
    async (action: () => Promise<GameSnapshot>, resetTaps: boolean) => {
      setState((current) => ({
        ...current,
        actionPending: true,
        errorMessage: null,
      }));

      try {
        const snapshot = await withTimeout(action(), 'Game action');
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
    []
  );

  useEffect(() => {
    let cancelled = false;

    const loadInitialState = async () => {
      try {
        const snapshot = await withTimeout(
          trpc.game.init.query(),
          'Game loading'
        );
        if (cancelled) return;

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
  }, []);

  const startCastAction = useCallback(() => {
    void runAction(() => trpc.game.startCast.mutate(), true);
  }, [runAction]);

  const hookAction = useCallback(() => {
    void runAction(() => trpc.game.hook.mutate(), true);
  }, [runAction]);

  const landAction = useCallback(() => {
    void runAction(
      () =>
        trpc.game.finishCast.mutate({
          taps: state.tapCount,
        }),
      true
    );
  }, [runAction, state.tapCount]);

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

  const addTap = useCallback(() => {
    setState((current) => ({
      ...current,
      tapCount: current.tapCount + 1,
    }));
  }, []);

  return {
    ...state,
    startCast: startCastAction,
    hook: hookAction,
    land: landAction,
    selectLocation: selectLocationAction,
    addTap,
  };
};
