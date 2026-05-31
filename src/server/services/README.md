# `services` package

Services orchestrate repositories, domain rules, and response snapshots.

## Current module

- `gameService.ts`: loads or creates the player profile, invokes fishing domain rules, saves the result, records successful catches into ratings, lazily distributes daily rating prizes, and returns `GameSnapshot` payloads with the shared catalog.

The service currently exposes initialization, cast, hook, finish, client-timeout cast expiration, location selection, bait selection, bait-pack purchases, daily reward claims, global rating loads, and rating prize claims through the shared tRPC router.

Service functions are the right place to add future product systems such as quests, achievements, tournaments, and moderator event operations.
