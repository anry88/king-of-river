# King of River Product Overview

King of River is a Reddit-native mini fishing game adapted from the broader RiverKing concept. The original project is a Telegram-first product with bot flows, tournaments, clubs, quests, payments, and Android clients. This repository narrows that idea to a Devvit custom post game that can run inside Reddit.

## Product Scope

The first Reddit version focuses on a short-session fishing loop:

- enter from the subreddit feed
- expand the custom post into the game iframe
- cast at a location
- hook a fish
- pull through a hidden tap challenge before the fish escapes
- save coins, XP, total caught weight, discoveries, and recent catches
- compete in per-post global daily ratings for coin prizes
- review unlocked locations and discovered fish in the catalog

The architecture leaves explicit room for the RiverKing systems that make sense on Reddit:

- broader per-subreddit leaderboards
- scheduled tournaments
- daily and weekly quests
- fish collection achievements
- community club or team mechanics
- moderator-created events through Devvit menu actions

## Core Loop

The loop is deliberately small:

1. `Cast`: the player starts a cast in the current location.
2. `Hook`: the backend chooses a fish from the location pool and can fail the hook if the player reacts too late.
3. `Land`: the player taps one pull button enough times before the hidden challenge expires.
4. `Progress`: the backend records the catch, coins, XP, total caught weight, location unlock progress, and discoveries.

This keeps the Reddit game fast while preserving the same staged shape as RiverKing: cast, hook, hidden dynamic landing challenge, catch or escape presentation.

## Reddit Operating Model

The game runs inside Reddit custom posts:

- `splash.html` is the inline feed card.
- `game.html` is the expanded game.
- server code runs in the secure Devvit environment.
- Redis stores per-post player state.
- moderator menu actions can create game posts or later administer events.

## Next Product Passes

- Add domain tests for challenge resolution and weighted fish selection.
- Add deeper balancing around the regular RiverKing fish and location catalog.
- Add leaderboards with Redis sorted sets.
- Add achievement and quest services.
- Add richer visual polish around the RiverKing source catalog.
- Add event configuration routes and corresponding `devvit.json` menu mappings.
