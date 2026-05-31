# `shared` package

Shared code can be imported by both client and server.

## Current modules

- `game/types.ts`: DTOs for profiles, casts, catches, catalog entries, daily reward status, snapshots, and persisted profile validation.
- `game/catalog.ts`: base baits, six RiverKing bait packs, seven-day daily reward schedules, starter rod, and lookup helpers.
- `game/riverkingCatalog.ts`: regular RiverKing fish and location catalog generated from the original source data, excluding event-only content.
- `trpc.ts`: shared tRPC router contract and procedure input validation, including the client-timeout `expireCast` path, bait-pack purchase path, and daily reward claim path.
- `api.ts`: small REST response types.

Keep shared modules free of Devvit server imports, browser-only APIs, and side effects.
