# `server` package

The server package runs in the Devvit serverless environment.

## Entry and routing

- `index.ts`: creates the Hono app, mounts `/api`, `/api/trpc`, and `/internal`, and starts the Devvit server.
- `trpc.ts`: binds the shared tRPC router to Devvit context, Reddit identity, Redis, and the game service.
- `routes/menu.ts`: moderator menu endpoints.
- `routes/triggers.ts`: Devvit lifecycle triggers.
- `routes/api.ts`: small REST health/catalog endpoints for diagnostics.

## Runtime integrations

Server code can use `context`, `redis`, and `reddit` from `@devvit/web/server`. Do not import these from client code.

Game state is keyed by Reddit `postId` plus current username. This keeps each custom post's progression isolated while still allowing repeat sessions for the same player.
