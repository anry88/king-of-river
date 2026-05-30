import type { GameCatalog } from './game/types';

export type HealthResponse = {
  status: 'ok';
  name: 'king-of-river';
};

export type CatalogResponse = {
  catalog: GameCatalog;
};
