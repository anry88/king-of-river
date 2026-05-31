# `domain` package

Pure game rules live here. Domain code should not import Devvit, Hono, Redis, React, or browser APIs.

## Current module

- `fishing.ts`: creates profiles, starts casts, applies bait-weighted fish selection, resolves hook and hidden tap challenges, computes rewards, buys bait packs, and updates progression.

## Current fishing rule

The starter `Pond` pool uses the original RiverKing fish weights. Bait selection follows the original event-location style: water and predator type change weights, but they do not remove fish from the pool. This allows sea bait to catch freshwater fish while still biasing results toward the bait type.

The client owns the visible bite wait, hook reaction, landing timeout, and post-cycle cooldown clocks so Reddit/Devvit network latency does not shorten player-facing windows. The domain still creates active casts, picks fish, creates hidden tap goals, resolves rewards, adds purchased bait-pack contents to inventory, and clears casts requested by the client timeout path.

## Boundary

Domain functions accept serializable data and return updated serializable data. They may throw `GameRuleError` for invalid player actions. The tRPC layer converts these errors into client-safe responses.
