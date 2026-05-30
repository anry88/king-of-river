# `client` package

The client package owns code that runs inside the Reddit iframe.

## Entrypoints

- `splash.html` / `splash.tsx`: inline feed surface. Keep this small and avoid heavy game dependencies.
- `game.html` / `game.tsx`: expanded game surface. This renders the first `Пруд` screen, top location/bait selectors, fishing controls, and bottom tab placeholders.

## Supporting files

- `hooks/useGame.ts`: wraps tRPC calls and local tap/action state.
- `trpcClient.ts`: creates the browser tRPC client.
- `index.css`: Tailwind import plus shared game UI component classes.

## Rules

- Use `requestExpandedMode` to open the game from the inline card.
- Use `navigateTo` from `@devvit/web/client` for external navigation if navigation is added.
- Keep saveable game state on the server; client state should only cover active UI input and loading states.
