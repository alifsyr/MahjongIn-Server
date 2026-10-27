import { TileId, ClaimOption, Meld, FanItem, ServerPlayer } from '../types.js';

export const WINDS = ['Timur', 'Selatan', 'Barat', 'Utara'];
export const WIND_SIGNS = ['東', '南', '西', '北'];
export const NUMBER_SIGNS = '一二三四五六七八九';
export const HONORS = ['東', '南', '西', '北', '中', '發', '白'];
export const HONOR_NAMES = [
  'Angin Timur', 'Angin Selatan', 'Angin Barat', 'Angin Utara',
  'Naga Merah', 'Naga Hijau', 'Naga Putih'
];
export const FLOWER_NAMES = [
  'Bunga 1 (Plum / 梅)', 'Bunga 2 (Orchid / 蘭)', 'Bunga 3 (Chrysanthemum / 菊)', 'Bunga 4 (Bamboo / 竹)',
  'Musim 1 (Spring / 春)', 'Musim 2 (Summer / 夏)', 'Musim 3 (Autumn / 秋)', 'Musim 4 (Winter / 冬)'
];
export const FLOWER_SIGNS = ['梅', '蘭', '菊', '竹', '春', '夏', '秋', '冬'];

export const isFlower = (t: TileId): boolean => t >= 34 && t <= 41;

export function tileName(t: TileId): string {
  if (t < 9) return `${t + 1} Karakter`;
  if (t < 18) return `${t - 8} Lingkaran`;
  if (t < 27) return `${t - 17} Bambu`;
  if (t < 34) return HONOR_NAMES[t - 27];
  return FLOWER_NAMES[t - 34];
}

export function tileShort(t: TileId): string {
  if (t < 9) return `${t + 1} Wan`;
  if (t < 18) return `${t - 8} Pin`;
  if (t < 27) return `${t - 17} Sou`;
  if (t < 34) return HONOR_NAMES[t - 27];
  return FLOWER_SIGNS[t - 34];
}

export function createShuffledWall(): TileId[] {
  const standardTiles = Array.from({ length: 34 }, (_, type) => Array(4).fill(type)).flat();
  const flowerTiles = [34, 35, 36, 37, 38, 39, 40, 41];
  const wall = [...standardTiles, ...flowerTiles];
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

export function countsFor(hand: TileId[]): number[] {
  const counts = Array(34).fill(0);
  hand.forEach((t) => {
    if (t < 34) counts[t]++;
  });
  return counts;
}

export function canMakeMelds(counts: number[], groupsNeeded: number): boolean {
  const first = counts.findIndex((n) => n > 0);
  if (first === -1) return groupsNeeded === 0;
  if (!groupsNeeded) return false;
  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canMakeMelds(counts, groupsNeeded - 1)) {
      counts[first] += 3;
      return true;
    }
    counts[first] += 3;
  }
  if (first < 27 && first % 9 <= 6 && counts[first + 1] && counts[first + 2]) {
    counts[first]--; counts[first + 1]--; counts[first + 2]--;
    if (canMakeMelds(counts, groupsNeeded - 1)) {
      counts[first]++; counts[first + 1]++; counts[first + 2]++;
      return true;
    }
    counts[first]++; counts[first + 1]++; counts[first + 2]++;
  }
  return false;
}

export function isWinningHand(hand: TileId[], openMelds: number): boolean {
  const needed = 4 - openMelds;
  if (needed < 0 || hand.length !== needed * 3 + 2) return false;
  const counts = countsFor(hand);
  for (let pair = 0; pair < 34; pair++) {
    if (counts[pair] < 2) continue;
    counts[pair] -= 2;
    if (canMakeMelds(counts, needed)) {
      counts[pair] += 2;
      return true;
    }
    counts[pair] += 2;
  }
  return false;
}

export interface DecompositionGroup {
  type: 'pong' | 'chow';
  tile: TileId;
}

export function findWinningDecomposition(hand: TileId[], needed: number): { pair: TileId; groups: DecompositionGroup[] } | null {
  const counts = countsFor(hand);
  for (let pair = 0; pair < 34; pair++) {
    if (counts[pair] < 2) continue;
    counts[pair] -= 2;
    const groups: DecompositionGroup[] = [];
    if (extractMelds(counts, needed, groups)) {
      return { pair, groups };
    }
    counts[pair] += 2;
  }
  return null;
}

function extractMelds(counts: number[], needed: number, groups: DecompositionGroup[]): boolean {
  const first = counts.findIndex((n) => n > 0);
  if (first === -1) return needed === 0;
  if (!needed) return false;
  if (counts[first] >= 3) {
    counts[first] -= 3;
    groups.push({ type: 'pong', tile: first });
    if (extractMelds(counts, needed - 1, groups)) return true;
    groups.pop();
    counts[first] += 3;
  }
  if (first < 27 && first % 9 <= 6 && counts[first + 1] && counts[first + 2]) {
    counts[first]--; counts[first + 1]--; counts[first + 2]--;
    groups.push({ type: 'chow', tile: first });
    if (extractMelds(counts, needed - 1, groups)) return true;
    groups.pop();
    counts[first]++; counts[first + 1]++; counts[first + 2]++;
  }
  return false;
}

export function possibleChi(hand: TileId[], tile: TileId): ClaimOption[] {
  if (tile >= 27) return [];
  const suitStart = Math.floor(tile / 9) * 9;
  const options: ClaimOption[] = [];
  const counts = countsFor(hand);
  for (let start = Math.max(suitStart, tile - 2); start <= Math.min(suitStart + 6, tile); start++) {
    const tiles = [start, start + 1, start + 2];
    const consume = tiles.filter((v) => v !== tile);
    if (consume.every((v) => counts[v] > 0)) {
      options.push({ kind: 'chi', tiles, consume });
    }
  }
  return options;
}

export function availableClaims(
  seat: number,
  discarder: number,
  tile: TileId,
  hand: TileId[],
  openMeldsCount: number
): ClaimOption[] {
  if (seat === discarder || tile >= 34) return [];
  const counts = countsFor(hand);
  const options: ClaimOption[] = [];
  if (isWinningHand([...hand, tile], openMeldsCount)) {
    options.push({ kind: 'ron', tiles: [tile], consume: [] });
  }
  if (counts[tile] >= 3) {
    options.push({ kind: 'kan', tiles: [tile, tile, tile, tile], consume: [tile, tile, tile] });
  }
  if (counts[tile] >= 2) {
    options.push({ kind: 'pon', tiles: [tile, tile, tile], consume: [tile, tile] });
  }
  if (seat === (discarder + 1) % 4) {
    options.push(...possibleChi(hand, tile));
  }
  return options;
}

export function calculateFan(
  player: ServerPlayer,
  mode: 'Ron' | 'Tsumo',
  discarder: number | null,
  winningTile: TileId | null,
  roundWind: number = 0
): { items: FanItem[]; totalFan: number } {
  const items: FanItem[] = [];
  const needed = 4 - player.melds.length;
  const decomp = findWinningDecomposition(player.hand, needed);

  const allGroups: DecompositionGroup[] = [
    ...player.melds.map((m) => ({
      type: (m.kind === 'chi' ? 'chow' : 'pong') as 'chow' | 'pong',
      tile: m.tiles[0]
    })),
    ...(decomp ? decomp.groups : [])
  ];

  if (mode === 'Tsumo') {
    items.push({ name: 'Tsumo (Ambil Sendiri)', fan: 1 });
  }

  player.flowers.forEach((f) => {
    if ((f - 34) % 4 === player.seat) {
      items.push({ name: `Bunga Kursi (${tileShort(f)})`, fan: 1 });
    }
  });
  const plumSet = player.flowers.filter((f) => f >= 34 && f <= 37);
  if (plumSet.length === 4) {
    items.push({ name: 'Set Lengkap 4 Bunga (梅蘭菊竹)', fan: 2 });
  }
  const seasonSet = player.flowers.filter((f) => f >= 38 && f <= 41);
  if (seasonSet.length === 4) {
    items.push({ name: 'Set Lengkap 4 Musim (春夏秋冬)', fan: 2 });
  }
  if (player.flowers.length === 0) {
    items.push({ name: 'Tanpa Bunga (Wu Hua)', fan: 1 });
  }

  const dragonNames: Record<number, string> = { 31: 'Naga Merah (中)', 32: 'Naga Hijau (發)', 33: 'Naga Putih (白)' };
  [31, 32, 33].forEach((dragon) => {
    if (allGroups.some((g) => g.type === 'pong' && g.tile === dragon)) {
      items.push({ name: `Pung ${dragonNames[dragon]}`, fan: 1 });
    }
  });

  if (allGroups.some((g) => g.type === 'pong' && g.tile === 27 + roundWind)) {
    items.push({ name: `Pung Angin Ronde (${WINDS[roundWind]})`, fan: 1 });
  }
  if (player.seat !== roundWind && allGroups.some((g) => g.type === 'pong' && g.tile === 27 + player.seat)) {
    items.push({ name: `Pung Angin Kursi (${WINDS[player.seat]})`, fan: 1 });
  }

  if (decomp && allGroups.length === 4) {
    const isAllPongs = allGroups.every((g) => g.type === 'pong');
    const isAllChows = allGroups.every((g) => g.type === 'chow') && decomp.pair < 27;

    if (isAllPongs) {
      items.push({ name: 'Dui Dui Hu (Semua Pung/Kembar)', fan: 3 });
    } else if (isAllChows) {
      items.push({ name: 'Ping Hu (Semua Chow/Runtun)', fan: 1 });
    }

    const allTiles = [
      ...player.hand,
      ...player.melds.flatMap((m) => m.tiles)
    ];
    const hasWan = allTiles.some((t) => t < 9);
    const hasPin = allTiles.some((t) => t >= 9 && t < 18);
    const hasSou = allTiles.some((t) => t >= 18 && t < 27);
    const hasHonors = allTiles.some((t) => t >= 27 && t < 34);
    const suitCount = (hasWan ? 1 : 0) + (hasPin ? 1 : 0) + (hasSou ? 1 : 0);

    if (suitCount === 1 && !hasHonors) {
      items.push({ name: 'Qing Yi Se (Satu Jenis Murni)', fan: 7 });
    } else if (suitCount === 1 && hasHonors) {
      items.push({ name: 'Hun Yi Se (Satu Jenis Campur Honor)', fan: 3 });
    }
  }

  if (mode === 'Ron' && player.melds.filter((m) => m.from !== player.seat).length === 0) {
    items.push({ name: 'Menqian Qing (Tangan Tertutup)', fan: 1 });
  }

  if (items.length === 0) {
    items.push({ name: 'Ji Hu (Kombinasi Standar)', fan: 1 });
  }

  const totalFan = items.reduce((sum, item) => sum + item.fan, 0);
  return { items, totalFan };
}

export function fanToPoints(fan: number): number {
  if (fan <= 1) return 40;
  if (fan === 2) return 80;
  if (fan === 3) return 160;
  if (fan === 4) return 320;
  if (fan === 5) return 480;
  if (fan === 6) return 640;
  if (fan === 7) return 960;
  return 1280;
}
