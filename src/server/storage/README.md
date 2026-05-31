# `storage` package

Storage modules isolate persistence details from services and domain rules.

## Current module

- `gameRepository.ts`: stores one serialized `GameProfile` per Reddit post and username in Redis.

Persisted JSON is parsed as `unknown` and validated with shared runtime guards before use. Invalid or stale data is treated as missing state so a fresh starter profile can be created.

The current persisted profile version is `4`, which includes `currentBaitId`, active-cast bait locking, shop bait inventory, and consumable bait counts.
