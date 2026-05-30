# King of River architecture

This document mirrors the original RiverKing documentation style while describing the Reddit Devvit implementation.

- [Client app (`src/client`)](src/client/README.md)
- [Server runtime (`src/server`)](src/server/README.md)
- [Game domain (`src/server/domain`)](src/server/domain/README.md)
- [Services (`src/server/services`)](src/server/services/README.md)
- [Storage (`src/server/storage`)](src/server/storage/README.md)
- [Shared contracts (`src/shared`)](src/shared/README.md)

## Overview

The app runs as a Devvit Web application on Reddit. The inline entrypoint (`splash.html`) stays small and only opens expanded mode. The expanded entrypoint (`game.html`) renders the fishing UI and talks to the server through tRPC v11.

Server startup lives in `src/server/index.ts`. Hono owns HTTP routing, Devvit supplies the serverless request context, and `fetchRequestHandler` mounts the tRPC router at `/api/trpc` because Devvit Web server endpoints must start with `/api/`. The router contract lives in `src/shared/trpc.ts`; `src/server/trpc.ts` binds it to Devvit context, Reddit identity, Redis, and the game service. Internal Devvit menu and trigger endpoints remain under `/internal`.

The first game loop intentionally keeps rendering in React DOM rather than introducing a canvas engine. The simulation is isolated in `src/server/domain/fishing.ts`, the service layer persists save state through Redis, and the client only renders snapshots returned by tRPC. This keeps the Reddit iframe light while leaving room for Phaser or canvas rendering later if the game needs more complex animation.

## Runtime Boundaries

- `src/client/splash.tsx`: inline feed view, no heavy dependencies.
- `src/client/game.tsx`: expanded gameplay surface and DOM HUD.
- `src/client/hooks/useGame.ts`: client-side action orchestration around the typed tRPC client.
- `src/shared/trpc.ts`: application router contract and procedure inputs.
- `src/server/trpc.ts`: Devvit context factory for the shared router.
- `src/server/domain/fishing.ts`: pure game rules for cast, hook, and finish.
- `src/server/services/gameService.ts`: loads state, calls domain rules, saves snapshots.
- `src/server/storage/gameRepository.ts`: Redis keying and JSON serialization.
- `src/shared/game/catalog.ts`: static fish/location/bait/rod catalog.
- `src/shared/game/types.ts`: DTOs and runtime validation for persisted profile shape.

## Current Data Model

Redis stores one `GameProfile` per Reddit post and username:

```text
king-of-river:post:{postId}:player:{username}
```

The saved profile contains:

- player coins, XP, level, selected location, selected bait, and selected rod
- discovered fish IDs
- recent catch records
- active cast state
- daily reward placeholder state for the next product pass

## Current tRPC Surface

- `game.init`: load or create the player profile.
- `game.startCast`: create an active cast for the selected location.
- `game.hook`: reveal the hooked fish and challenge.
- `game.finishCast`: resolve the tap challenge and save the result.
- `game.selectLocation`: switch unlocked locations and clear active cast state.
- `game.selectBait`: switch the active bait and clear active cast state.

## Current Game Surface

The first playable screen mirrors the Android RiverKing fishing surface at a small scope:

- one regular location, `Пруд`, using the original Android background asset
- the original `Пруд` fish pool and weights, including rare koi entries
- four base baits: `Пресная мирная`, `Пресная хищная`, `Морская мирная`, `Морская хищная`
- event-style bait weighting, so bait water type biases the pool but does not hard-filter it
- bottom tab placeholders for fishing, ratings, catalog, and shop

## Design Rules

- Keep saveable simulation state outside React components.
- Keep renderer/UI state lightweight and disposable.
- Use shared DTOs for every client/server payload.
- Use type aliases for TypeScript data shapes.
- Avoid TypeScript casts; validate unknown persisted data before using it.
- Do not use `@devvit/public-api` or Blocks APIs in this repo.
