# `services` package

Services orchestrate repositories, domain rules, and response snapshots.

## Current module

- `gameService.ts`: loads or creates the player profile, invokes fishing domain rules, saves the result, and returns `GameSnapshot` payloads with the shared catalog.

Service functions are the right place to add future product systems such as daily rewards, quests, achievements, tournaments, and moderator event operations.
