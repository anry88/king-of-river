# `domain` package

Pure game rules live here. Domain code should not import Devvit, Hono, Redis, React, or browser APIs.

## Current module

- `fishing.ts`: creates profiles, starts casts, hooks fish, resolves tap challenges, computes rewards, and updates progression.

## Boundary

Domain functions accept serializable data and return updated serializable data. They may throw `GameRuleError` for invalid player actions. The tRPC layer converts these errors into client-safe responses.
