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
- `src/shared/game/catalog.ts`: static fish/location/bait/bait-pack/rod catalog.
- `src/shared/game/types.ts`: DTOs and runtime validation for persisted profile shape.

## Current Data Model

Redis stores one `GameProfile` per Reddit post and username:

```text
king-of-river:post:{postId}:player:{username}
```

The saved profile contains:

- player coins, XP, level, selected location, selected bait, and selected rod
- stored bait inventory added through shop purchases
- discovered fish IDs
- recent catch records
- active cast state
- daily reward placeholder state for the next product pass

## Current tRPC Surface

- `game.init`: load or create the player profile.
- `game.startCast`: create an active cast for the selected location.
- `game.hook`: reveal the hooked fish and challenge using client-measured reaction seconds.
- `game.finishCast`: resolve the tap challenge and save the result.
- `game.expireCast`: clear the active cast after a client-owned timeout.
- `game.selectLocation`: switch unlocked locations and clear active cast state.
- `game.selectBait`: switch the active bait and clear active cast state.
- `game.buyBaitPack`: spend coins on a RiverKing bait pack and add its contents to inventory.

## Current Game Surface

The first playable screen mirrors the Android RiverKing fishing surface at a small scope:

- one regular location, `Pond`, using the original Android background asset
- the original `Pond` fish pool and weights, including rare koi entries
- a top location button and a compact bait picker for `Fresh Peaceful`, `Fresh Predator`, `Sea Peaceful`, `Sea Predator`
- event-style bait weighting, so bait water type biases the pool but does not hard-filter it
- client-owned bite, hook, landing, and post-cycle cooldown timers so network latency does not shorten the visible interaction windows
- hidden landing tap goals with timeout-based local escapes
- active Fishing and Shop tabs; Ratings and Catalog remain placeholders
- six basic RiverKing bait packs split into freshwater and saltwater S/M/L groups

## Design Rules

- Keep saveable simulation state outside React components.
- Keep renderer/UI state lightweight and disposable.
- Use shared DTOs for every client/server payload.
- Use type aliases for TypeScript data shapes.
- Avoid TypeScript casts; validate unknown persisted data before using it.
- Do not use `@devvit/public-api` or Blocks APIs in this repo.
