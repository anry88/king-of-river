# `storage` package

Storage modules isolate persistence details from services and domain rules.

## Current module

- `gameRepository.ts`: stores one serialized `GameProfile` per Reddit post and username in Redis.

Persisted JSON is parsed as `unknown` and validated with shared runtime guards before use. Invalid or stale data is treated as missing state so a fresh starter profile can be created.

The current persisted profile version is `2`, which includes `currentBaitId` and active-cast bait locking.
