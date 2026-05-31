# `storage` package

Storage modules isolate persistence details from services and domain rules.

## Current modules

- `gameRepository.ts`: stores one serialized `GameProfile` per Reddit post and username in Redis.
- `ratingRepository.ts`: stores per-post global rating indexes, catch metadata, pending rating coin prizes, and once-per-day prize distribution guards.

Persisted JSON is parsed as `unknown` and validated with shared runtime guards before use. Invalid or stale data is treated as missing state so a fresh starter profile can be created.

The current persisted profile version is `5`, which includes `currentBaitId`, active-cast bait locking, shop and daily reward bait inventory, consumable bait counts, daily reward streak state, and lifetime total caught weight for location unlocks. Rating state is stored separately from profiles so daily prizes can be distributed across all players in a post.
