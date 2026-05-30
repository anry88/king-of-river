# `shared` package

Shared code can be imported by both client and server.

## Current modules

- `game/types.ts`: DTOs for profiles, casts, catches, catalog entries, snapshots, and persisted profile validation.
- `game/catalog.ts`: starter fish, locations, rods, and lookup helpers.
- `trpc.ts`: shared tRPC router contract and procedure input validation.
- `api.ts`: small REST response types.

Keep shared modules free of Devvit server imports, browser-only APIs, and side effects.
