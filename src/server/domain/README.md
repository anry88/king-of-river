# `domain` package

Pure game rules live here. Domain code should not import Devvit, Hono, Redis, React, or browser APIs.

## Current module

- `fishing.ts`: creates profiles, starts casts, applies bait-weighted fish selection, resolves tap challenges, computes rewards, and updates progression.

## Current fishing rule

The starter `Пруд` pool uses the original RiverKing fish weights. Bait selection follows the original event-location style: water and predator type change weights, but they do not remove fish from the pool. This allows sea bait to catch freshwater fish while still biasing results toward the bait type.

## Boundary

Domain functions accept serializable data and return updated serializable data. They may throw `GameRuleError` for invalid player actions. The tRPC layer converts these errors into client-safe responses.
