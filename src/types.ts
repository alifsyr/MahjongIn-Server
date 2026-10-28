export type TileId = number; // 0..41 (144 tiles total)

export interface Meld {
  kind: 'chi' | 'pon' | 'kan';
  tiles: TileId[];
  from: number;
}

export interface ClaimOption {
  kind: 'chi' | 'pon' | 'kan' | 'ron';
  tiles: TileId[];
  consume: TileId[];
}

export interface FanItem {
  name: string;
  fan: number;
}

export interface ServerPlayer {
  id: string; // Socket ID or user ID
  name: string;
  seat: number; // 0=Timur, 1=Selatan, 2=Barat, 3=Utara
  hand: TileId[];
  flowers: TileId[];
  discards: TileId[];
  melds: Meld[];
  score: number;
  isReady: boolean;
  isBot: boolean;
}

export interface MaskedOpponent {
  seat: number;
  name: string;
  tileCount: number;
  flowers: TileId[];
  discards: TileId[];
  melds: Meld[];
  score: number;
  isBot: boolean;
}

export interface ClientGameState {
  roomCode: string;
  seat: number;
  wallCount: number;
  currentTurn: number;
  phase: 'waiting' | 'draw' | 'discard' | 'claim' | 'resolving' | 'over';
  myHand: TileId[];
  myFlowers: TileId[];
  myMelds: Meld[];
  myScore: number;
  opponents: MaskedOpponent[];
  lastDiscard: { seat: number; tile: TileId } | null;
  pendingClaim: {
    discarder: number;
    tile: TileId;
    options: ClaimOption[];
  } | null;
  turn: number;
  canTsumo?: boolean;
}
