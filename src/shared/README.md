# `shared` package

Shared code can be imported by both client and server.

## Current modules

- `game/types.ts`: DTOs for profiles, casts, catches, catalog entries, snapshots, and persisted profile validation.
- `game/catalog.ts`: first freshwater `Pond` fish pool, base baits, six RiverKing bait packs, starter rod, and lookup helpers.
- `trpc.ts`: shared tRPC router contract and procedure input validation, including the client-timeout `expireCast` path and bait-pack purchase path.
- `api.ts`: small REST response types.

Keep shared modules free of Devvit server imports, browser-only APIs, and side effects.
