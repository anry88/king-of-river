# `client` package

The client package owns code that runs inside the Reddit iframe.

## Entrypoints

- `splash.html` / `splash.tsx`: inline feed surface. Keep this small and avoid heavy game dependencies.
- `game.html` / `game.tsx`: expanded game surface. This renders the fishing screen, top location and bait picker controls, caught-weight progression, fishing controls, the daily reward icon beside coins, and the Shop tab.

## Supporting files

- `hooks/useGame.ts`: wraps tRPC calls, local action state, client-owned bite/hook/landing timers, hidden pull taps, shop purchases, daily reward claims, and timeout handling.
- `trpcClient.ts`: creates the browser tRPC client.
- `index.css`: Tailwind import plus shared game UI component classes.

## Rules

- Use `requestExpandedMode` to open the game from the inline card.
- Use `navigateTo` from `@devvit/web/client` for external navigation if navigation is added.
- Keep saveable game state on the server; client state should only cover active UI input, loading states, and latency-sensitive interaction clocks.
