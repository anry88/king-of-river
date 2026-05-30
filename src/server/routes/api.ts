import { Hono } from 'hono';
import { gameCatalog } from '../../shared/game/catalog';
import type { CatalogResponse, HealthResponse } from '../../shared/api';

export const api = new Hono();

api.get('/health', (c) => {
  return c.json<HealthResponse>({
    status: 'ok',
    name: 'king-of-river',
  });
});

api.get('/catalog', (c) => {
  return c.json<CatalogResponse>({
    catalog: gameCatalog,
  });
});
