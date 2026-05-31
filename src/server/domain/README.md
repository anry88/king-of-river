# `domain` package

Pure game rules live here. Domain code should not import Devvit, Hono, Redis, React, or browser APIs.

## Current module

- `fishing.ts`: creates profiles, starts casts, applies bait-weighted fish selection, resolves hook and hidden tap challenges, computes rewards, buys bait packs, claims daily bait rewards, and updates progression.

## Current fishing rule

The regular RiverKing location catalog unlocks by lifetime caught weight. Location water type hard-gates usable bait, so sea bait cannot be cast in freshwater locations; mixed locations accept both bait waters and filter the fish pool by the selected bait. Predator bait type changes fish weights, but it does not remove fish from the pool.

The client owns the visible bite wait, hook reaction, landing timeout, and post-cycle cooldown clocks so Reddit/Devvit network latency does not shorten player-facing windows. The domain still creates active casts, consumes one bait per cast, picks fish, creates hidden tap goals, resolves rewards, increments total caught weight, adds purchased or daily reward bait contents to inventory, tracks daily streaks, and clears casts requested by the client timeout path.

## Boundary

Domain functions accept serializable data and return updated serializable data. They may throw `GameRuleError` for invalid player actions. The tRPC layer converts these errors into client-safe responses.
