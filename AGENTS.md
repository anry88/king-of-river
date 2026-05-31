# King of River Agent Guide

You are writing a Devvit web application that will be executed on Reddit.com.

## Documentation Split

- `README.md` is the human-facing project overview.
- `docs/product-overview.md` describes the product scope and roadmap.
- `docs/github-about.md` is the source for GitHub About metadata.
- `DOCUMENTATION.md` is the engineering architecture map.
- Package READMEs under `src/**` are the low-level code navigation layer.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Vite
- **Backend**: Node.js v22 serverless environment (Devvit), Hono
- **Communication**: tRPC v11 for end-to-end type safety
- **Persistence**: Devvit Redis through `@devvit/web/server`

## Repository Map

- `src/client/`: frontend code executed inside the Reddit iframe.
  - `splash.html` / `splash.tsx`: inline feed entrypoint; keep it fast.
  - `game.html` / `game.tsx`: expanded game entrypoint.
  - `hooks/useGame.ts`: browser state wrapper around tRPC calls.
  - `trpcClient.ts`: typed tRPC browser client.
- `src/server/`: backend code executed in the secure Devvit serverless runtime.
  - `index.ts`: Hono app and route mounting.
  - `trpc.ts`: Devvit context factory for the shared tRPC router.
  - `domain/`: pure game rules with no Devvit imports.
  - `services/`: orchestration around domain rules and persistence.
  - `storage/`: Redis repositories and serialization.
  - `routes/`: Devvit internal routes, health, catalog, menu, triggers.
- `src/shared/`: shared types, DTOs, runtime validation, and static game catalog, including bait packs.
  - `trpc.ts`: tRPC router contract and procedure inputs.
- `public/riverking/`: first visual assets reused from the original RiverKing source.
- `docs/`: product-facing notes and repository metadata.

## First Pass For Any Agent

1. Read `README.md` for product positioning and public claims.
2. Read `AGENTS.md` and `DOCUMENTATION.md` for repository structure and runtime boundaries.
3. Read the nearest package README before changing code in that area:
   - `src/client/README.md`
   - `src/server/README.md`
   - `src/server/domain/README.md`
   - `src/server/services/README.md`
   - `src/server/storage/README.md`
   - `src/shared/README.md`
4. If the task touches Devvit configuration, inspect `devvit.json` before editing runtime code.
5. If the task touches visible Reddit UI, inspect the relevant client entrypoint and verify it in playtest when practical.

## Token Discipline

- Optimize token usage aggressively: think first, then act.
- Prefer the minimum necessary reads, searches, edits, and tool calls that can confidently solve the task.
- Avoid speculative rewrites, repetitive retries, and exploratory changes when the next correct step can be reasoned out in advance.

## Key Runtime Facts

- Server code can access `redis`, `reddit`, and `context` only from `@devvit/web/server`.
- Client code can access browser helpers such as `requestExpandedMode`, `navigateTo`, `showToast`, and `showForm` only from `@devvit/web/client`.
- Game state is saved per Reddit post and username with this Redis key shape:

  ```text
  king-of-river:post:{postId}:player:{username}
  ```

- Devvit Web server endpoints must start with `/api/`; tRPC is mounted at `/api/trpc`.
- REST `/api/health` and `/api/catalog` are diagnostics only; gameplay should go through tRPC.
- Bite wait, hook reaction, landing timeout, and post-cycle cooldown clocks are client-owned so Devvit network latency does not shorten the visible windows. The server still persists the active cast, picks fish, resolves rewards, and accepts `game.expireCast` when a local timeout ends a cycle.

## Frontend Rules

- Use `requestExpandedMode` to open the expanded game from the inline card.
- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`.
- Do not use `window.alert`; use `showToast` or `showForm`.
- File downloads are not supported; use the clipboard API with `showToast` if export-like flows are added.
- Geolocation, camera, microphone, and notifications web APIs have no Devvit Web alternatives.
- Do not put inline scripts in HTML files; add a separate JS/TS entrypoint and map it through Vite/Devvit.

## Architecture Rules

- Keep saveable simulation state on the server, not in React components.
- Keep domain logic pure. `src/server/domain/**` must not import Devvit, Hono, Redis, React, or browser APIs.
- Keep renderer/UI state disposable. Client state should cover loading, current tap count, and visible interaction state.
- Validate unknown persisted JSON before using it. Do not trust Redis payload shape.
- Prefer additive tRPC response changes over breaking field changes.
- Whenever you add an endpoint for a new menu item action, add the corresponding mapping to `devvit.json`.

## Common Change Paths

### Webview UI

You usually need to touch:

- `src/client/game.tsx` or `src/client/splash.tsx`
- `src/client/index.css`
- `src/client/hooks/useGame.ts` when UI changes require new game actions or loading states

### Server API or session flow

You usually need to touch:

- `src/shared/trpc.ts`
- `src/server/trpc.ts`
- `src/server/index.ts`
- a service under `src/server/services/`

Whenever you change a server API contract, prefer backward-compatible additions to JSON over renaming or repurposing existing fields, and verify the affected client path before finishing the change.

### Game systems

You usually need to touch:

- `src/server/domain/`
- `src/server/services/`
- `src/shared/game/`

Keep gameplay rules deterministic enough to test and keep Devvit/Redis imports out of domain logic.

### Persistence

Read first:

- `src/server/storage/README.md`
- `src/server/storage/`
- `src/shared/game/types.ts`

Persisted profile compatibility matters because existing Reddit posts can keep old Redis payloads.

## Development Cycle Rules

- Treat each coherent block of finished work as a development cycle.
- Before syncing with `npm run dev`, finish the current block so the watcher does not upload half-done micro changes.
- When using `npm run dev` for playtest sync, stop it before handing work back unless the user explicitly asks to keep it running.
- At the end of every completed development cycle, run the relevant verification commands, then create a focused commit and push it to `origin`.
- Do not leave completed local work uncommitted or unpushed unless the user explicitly says not to commit/push, credentials are missing, or the network/remote is unavailable. If push is blocked, report the blocker and the exact local commit state.

## Commands

- `npm run type-check`: check TypeScript types.
- `npm run lint`: check lint rules.
- `npm run build`: build client and server.
- `npm run dev`: start Devvit playtest.
- `npm run deploy`: type-check, lint, and upload.

## Code Style

- Prefer type aliases over interfaces when writing TypeScript.
- Prefer named exports over default exports.
- Never cast TypeScript types.
- Keep comments sparse and useful.

## Global Rules

- You may find code that references Blocks or `@devvit/public-api` while researching Devvit examples. Do not use it; this project is configured for Devvit Web only.
- Keep public claims honest. If README or product docs claim a system exists, the code should support at least the described foundation.
- When changing package structure or runtime surfaces, update `DOCUMENTATION.md`, `AGENTS.md`, and the nearest package README.
- If you change the public product promise, update `README.md`.
- If you change repository positioning for GitHub/About, update `docs/github-about.md`.
- If you change product scope or operating model, update `docs/product-overview.md`.
- Treat future screenshot/showcase assets as product evidence. Refresh them when the visible Reddit surface changes in a meaningful way.

Docs: https://developers.reddit.com/docs/llms.txt.
