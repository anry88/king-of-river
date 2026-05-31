import type {
  BaitDefinition,
  BaitPackDefinition,
  DailyRewardSchedule,
  FishDefinition,
  GameCatalog,
  LocationDefinition,
  RodDefinition,
} from './types';
import { fishCatalog, locationCatalog } from './riverkingCatalog';

export { fishCatalog, locationCatalog };

export const baitCatalog: BaitDefinition[] = [
  {
    id: 'fresh-peaceful',
    name: 'Fresh Peaceful',
    displayName: 'Grain Crumble',
    water: 'fresh',
    isPredator: false,
    rarityBonus: 0,
    image: '/riverking/baits/grain_crumble.webp',
  },
  {
    id: 'fresh-predator',
    name: 'Fresh Predator',
    displayName: 'Brook Minnow',
    water: 'fresh',
    isPredator: true,
    rarityBonus: 0,
    image: '/riverking/baits/brook_minnow.webp',
  },
  {
    id: 'salt-peaceful',
    name: 'Sea Peaceful',
    displayName: 'Seaweed Strand',
    water: 'salt',
    isPredator: false,
    rarityBonus: 0,
    image: '/riverking/baits/seaweed_strand.webp',
  },
  {
    id: 'salt-predator',
    name: 'Sea Predator',
    displayName: 'Squid Rings',
    water: 'salt',
    isPredator: true,
    rarityBonus: 0,
    image: '/riverking/baits/squid_rings.webp',
  },
];

export const baitPackCatalog: BaitPackDefinition[] = [
  {
    id: 'fresh_topup_s',
    name: 'Freshwater Top-up S',
    description:
      '20 freshwater basics: 10 "Grain Crumble" and 10 "Brook Minnow"',
    water: 'fresh',
    priceCoins: 360,
    image: '/riverking/shop/fresh_topup_s.png',
    items: [
      { baitId: 'fresh-peaceful', quantity: 10 },
      { baitId: 'fresh-predator', quantity: 10 },
    ],
  },
  {
    id: 'fresh_stock_m',
    name: 'Freshwater Stock M',
    description:
      '50 freshwater basics: 25 "Grain Crumble" and 25 "Brook Minnow"',
    water: 'fresh',
    priceCoins: 825,
    image: '/riverking/shop/fresh_stock_m.png',
    items: [
      { baitId: 'fresh-peaceful', quantity: 25 },
      { baitId: 'fresh-predator', quantity: 25 },
    ],
  },
  {
    id: 'fresh_crate_l',
    name: 'Freshwater Crate L',
    description:
      '120 freshwater basics: 60 "Grain Crumble" and 60 "Brook Minnow"',
    water: 'fresh',
    priceCoins: 1875,
    image: '/riverking/shop/fresh_crate_l.png',
    items: [
      { baitId: 'fresh-peaceful', quantity: 60 },
      { baitId: 'fresh-predator', quantity: 60 },
    ],
  },
  {
    id: 'salt_topup_s',
    name: 'Saltwater Top-up S',
    description: '20 saltwater basics: 6 "Seaweed Strand" and 14 "Squid Rings"',
    water: 'salt',
    priceCoins: 675,
    image: '/riverking/shop/salt_topup_s.png',
    items: [
      { baitId: 'salt-peaceful', quantity: 6 },
      { baitId: 'salt-predator', quantity: 14 },
    ],
  },
  {
    id: 'salt_stock_m',
    name: 'Saltwater Stock M',
    description:
      '50 saltwater basics: 15 "Seaweed Strand" and 35 "Squid Rings"',
    water: 'salt',
    priceCoins: 1500,
    image: '/riverking/shop/salt_stock_m.png',
    items: [
      { baitId: 'salt-peaceful', quantity: 15 },
      { baitId: 'salt-predator', quantity: 35 },
    ],
  },
  {
    id: 'salt_crate_l',
    name: 'Saltwater Crate L',
    description:
      '120 saltwater basics: 40 "Seaweed Strand" and 80 "Squid Rings"',
    water: 'salt',
    priceCoins: 3300,
    image: '/riverking/shop/salt_crate_l.png',
    items: [
      { baitId: 'salt-peaceful', quantity: 40 },
      { baitId: 'salt-predator', quantity: 80 },
    ],
  },
];

export const dailyRewardSchedule: DailyRewardSchedule = {
  fresh: [
    {
      day: 1,
      items: [
        { baitId: 'fresh-peaceful', quantity: 8 },
        { baitId: 'fresh-predator', quantity: 4 },
      ],
    },
    {
      day: 2,
      items: [
        { baitId: 'fresh-peaceful', quantity: 10 },
        { baitId: 'fresh-predator', quantity: 6 },
      ],
    },
    {
      day: 3,
      items: [
        { baitId: 'fresh-peaceful', quantity: 12 },
        { baitId: 'fresh-predator', quantity: 6 },
      ],
    },
    {
      day: 4,
      items: [
        { baitId: 'fresh-peaceful', quantity: 12 },
        { baitId: 'fresh-predator', quantity: 8 },
      ],
    },
    {
      day: 5,
      items: [
        { baitId: 'fresh-peaceful', quantity: 13 },
        { baitId: 'fresh-predator', quantity: 8 },
      ],
    },
    {
      day: 6,
      items: [
        { baitId: 'fresh-peaceful', quantity: 12 },
        { baitId: 'fresh-predator', quantity: 10 },
      ],
    },
    {
      day: 7,
      items: [
        { baitId: 'fresh-peaceful', quantity: 13 },
        { baitId: 'fresh-predator', quantity: 13 },
      ],
    },
  ],
  salt: [
    {
      day: 1,
      items: [
        { baitId: 'fresh-peaceful', quantity: 6 },
        { baitId: 'fresh-predator', quantity: 6 },
        { baitId: 'salt-predator', quantity: 4 },
      ],
    },
    {
      day: 2,
      items: [
        { baitId: 'fresh-peaceful', quantity: 8 },
        { baitId: 'fresh-predator', quantity: 8 },
        { baitId: 'salt-predator', quantity: 5 },
      ],
    },
    {
      day: 3,
      items: [
        { baitId: 'fresh-peaceful', quantity: 8 },
        { baitId: 'fresh-predator', quantity: 8 },
        { baitId: 'salt-predator', quantity: 6 },
      ],
    },
    {
      day: 4,
      items: [
        { baitId: 'fresh-peaceful', quantity: 8 },
        { baitId: 'fresh-predator', quantity: 10 },
        { baitId: 'salt-predator', quantity: 6 },
      ],
    },
    {
      day: 5,
      items: [
        { baitId: 'fresh-peaceful', quantity: 8 },
        { baitId: 'fresh-predator', quantity: 10 },
        { baitId: 'salt-predator', quantity: 6 },
        { baitId: 'salt-peaceful', quantity: 2 },
      ],
    },
    {
      day: 6,
      items: [
        { baitId: 'fresh-peaceful', quantity: 8 },
        { baitId: 'fresh-predator', quantity: 10 },
        { baitId: 'salt-predator', quantity: 8 },
        { baitId: 'salt-peaceful', quantity: 2 },
      ],
    },
    {
      day: 7,
      items: [
        { baitId: 'fresh-peaceful', quantity: 9 },
        { baitId: 'fresh-predator', quantity: 11 },
        { baitId: 'salt-peaceful', quantity: 3 },
        { baitId: 'salt-predator', quantity: 9 },
      ],
    },
  ],
};

export const rodCatalog: RodDefinition[] = [
  {
    id: 'spark',
    name: 'Spark',
    power: 1,
    unlockLevel: 1,
  },
];

export const gameCatalog: GameCatalog = {
  locations: locationCatalog,
  baits: baitCatalog,
  baitPacks: baitPackCatalog,
  dailyRewards: dailyRewardSchedule,
  rods: rodCatalog,
  fish: fishCatalog,
};

export const defaultLocationId = 'pond';

export const defaultBaitId = 'fresh-peaceful';

export const defaultRodId = 'spark';

export const findFish = (fishId: string): FishDefinition | null => {
  return fishCatalog.find((fish) => fish.id === fishId) ?? null;
};

export const findBait = (baitId: string): BaitDefinition | null => {
  return baitCatalog.find((bait) => bait.id === baitId) ?? null;
};

export const findBaitPack = (baitPackId: string): BaitPackDefinition | null => {
  return baitPackCatalog.find((pack) => pack.id === baitPackId) ?? null;
};

export const findLocation = (locationId: string): LocationDefinition | null => {
  return locationCatalog.find((location) => location.id === locationId) ?? null;
};

export const findRod = (rodId: string): RodDefinition | null => {
  return rodCatalog.find((rod) => rod.id === rodId) ?? null;
};
