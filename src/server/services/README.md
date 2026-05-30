# `services` package

Services orchestrate repositories, domain rules, and response snapshots.

## Current module

- `gameService.ts`: loads or creates the player profile, invokes fishing domain rules, saves the result, and returns `GameSnapshot` payloads with the shared catalog.

The service currently exposes initialization, cast, hook, finish, location selection, and bait selection through the shared tRPC router.

Service functions are the right place to add future product systems such as daily rewards, quests, achievements, tournaments, and moderator event operations.
