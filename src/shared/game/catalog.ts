import type { FishDefinition, GameCatalog, LocationDefinition, RodDefinition } from './types';

export const fishCatalog: FishDefinition[] = [
  {
    id: 'bleak',
    name: 'River Bleak',
    rarity: 'common',
    minWeightKg: 0.05,
    maxWeightKg: 0.18,
    baseCoins: 4,
    baseXp: 5,
  },
  {
    id: 'perch',
    name: 'Striped Perch',
    rarity: 'common',
    minWeightKg: 0.2,
    maxWeightKg: 0.9,
    baseCoins: 8,
    baseXp: 9,
  },
  {
    id: 'carp',
    name: 'Golden Carp',
    rarity: 'uncommon',
    minWeightKg: 0.8,
    maxWeightKg: 4.5,
    baseCoins: 18,
    baseXp: 22,
  },
  {
    id: 'pike',
    name: 'Northern Pike',
    rarity: 'rare',
    minWeightKg: 1.5,
    maxWeightKg: 7.8,
    baseCoins: 38,
    baseXp: 44,
  },
  {
    id: 'catfish',
    name: 'Old Catfish',
    rarity: 'epic',
    minWeightKg: 4.2,
    maxWeightKg: 18.5,
    baseCoins: 86,
    baseXp: 94,
  },
  {
    id: 'koi-king',
    name: 'Koi King',
    rarity: 'legendary',
    minWeightKg: 6.5,
    maxWeightKg: 22,
    baseCoins: 160,
    baseXp: 180,
  },
];

export const locationCatalog: LocationDefinition[] = [
  {
    id: 'river-bank',
    name: 'River Bank',
    description: 'Fast starter water with small common fish and occasional carp.',
    unlockLevel: 1,
    fishWeights: [
      { fishId: 'bleak', weight: 48 },
      { fishId: 'perch', weight: 34 },
      { fishId: 'carp', weight: 14 },
      { fishId: 'pike', weight: 4 },
    ],
  },
  {
    id: 'old-bridge',
    name: 'Old Bridge',
    description: 'Deeper shadows where rare predators and heavy carp start to appear.',
    unlockLevel: 3,
    fishWeights: [
      { fishId: 'perch', weight: 30 },
      { fishId: 'carp', weight: 36 },
      { fishId: 'pike', weight: 24 },
      { fishId: 'catfish', weight: 9 },
      { fishId: 'koi-king', weight: 1 },
    ],
  },
];

export const rodCatalog: RodDefinition[] = [
  {
    id: 'reed-rod',
    name: 'Reed Rod',
    power: 1,
    unlockLevel: 1,
  },
  {
    id: 'green-rod',
    name: 'Green Rod',
    power: 2,
    unlockLevel: 2,
  },
  {
    id: 'silver-rod',
    name: 'Silver Rod',
    power: 3,
    unlockLevel: 4,
  },
];

export const gameCatalog: GameCatalog = {
  locations: locationCatalog,
  rods: rodCatalog,
  fish: fishCatalog,
};

export const defaultLocationId = 'river-bank';

export const defaultRodId = 'reed-rod';

export const findFish = (fishId: string): FishDefinition | null => {
  return fishCatalog.find((fish) => fish.id === fishId) ?? null;
};

export const findLocation = (locationId: string): LocationDefinition | null => {
  return locationCatalog.find((location) => location.id === locationId) ?? null;
};

export const findRod = (rodId: string): RodDefinition | null => {
  return rodCatalog.find((rod) => rod.id === rodId) ?? null;
};
