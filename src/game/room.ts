import { TileId, ServerPlayer, ClientGameState, ClaimOption, Meld } from '../types.js';
import {
  createShuffledWall,
  isFlower,
  availableClaims,
  isWinningHand,
  calculateFan,
  fanToPoints,
  countsFor
} from './rules.js';

export function claimPriority(kind: 'chi' | 'pon' | 'kan' | 'ron'): number {
  if (kind === 'ron') return 3;
  if (kind === 'pon' || kind === 'kan') return 2;
  return 1;
}

export class MahjongRoom {
  public code: string;
  public players: (ServerPlayer | null)[] = [null, null, null, null];
  public wall: TileId[] = [];
  public currentTurn: number = 0;
  public turnNumber: number = 1;
  public phase: 'waiting' | 'draw' | 'discard' | 'claim' | 'resolving' | 'over' = 'waiting';
  public lastDiscard: { seat: number; tile: TileId } | null = null;
  public pendingClaims: Map<number, ClaimOption[]> = new Map();
  public stagedClaims: Map<number, { kind: 'chi' | 'pon' | 'kan' | 'ron'; choiceIndex: number }> = new Map();
  public winner: number | null = null;

  constructor(code: string) {
    this.code = code;
  }

  public addPlayer(id: string, name: string): number | null {
    const seat = this.players.findIndex((p) => p === null);
    if (seat === -1) return null;
    this.players[seat] = {
      id,
      name,
      seat,
      hand: [],
      flowers: [],
      discards: [],
      melds: [],
      score: 10000,
      isReady: false,
      isBot: false
    };
    return seat;
  }

  public removePlayer(id: string): number | null {
    const seat = this.players.findIndex((p) => p?.id === id);
    if (seat === -1) return null;
    this.players[seat] = null;
    return seat;
  }

  public fillBots(): void {
    const BOT_NAMES = ['Hana (Bot)', 'Kenji (Bot)', 'Sora (Bot)'];
    let botIdx = 0;
    for (let s = 0; s < 4; s++) {
      if (this.players[s] === null) {
        this.players[s] = {
          id: `bot-${s}`,
          name: BOT_NAMES[botIdx++] || `Bot ${s}`,
          seat: s,
          hand: [],
          flowers: [],
          discards: [],
          melds: [],
          score: 10000,
          isReady: true,
          isBot: true
        };
      }
    }
  }

  public startGame(): void {
    this.wall = createShuffledWall();
    this.phase = 'draw';
    this.currentTurn = 0;
    this.turnNumber = 1;
    this.lastDiscard = null;
    this.pendingClaims.clear();
    this.stagedClaims.clear();
    this.winner = null;

    for (let s = 0; s < 4; s++) {
      const p = this.players[s];
      if (p) {
        p.hand = [];
        p.flowers = [];
        p.discards = [];
        p.melds = [];
      }
    }

    for (let n = 0; n < 13; n++) {
      for (let s = 0; s < 4; s++) {
        const tile = this.wall.pop();
        if (tile !== undefined) this.players[s]?.hand.push(tile);
      }
    }

    for (let s = 0; s < 4; s++) {
      this.replaceInitialFlowers(s);
      this.players[s]?.hand.sort((a, b) => a - b);
    }
  }

  private replaceInitialFlowers(seat: number): void {
    const player = this.players[seat];
    if (!player) return;
    let found = true;
    while (found && this.wall.length > 0) {
      const idx = player.hand.findIndex(isFlower);
      if (idx === -1) {
        found = false;
      } else {
        const flower = player.hand.splice(idx, 1)[0];
        player.flowers.push(flower);
        const replacement = this.wall.pop();
        if (replacement !== undefined) player.hand.push(replacement);
      }
    }
  }

  private drawTileWithFlowers(seat: number): { tile: TileId; flowers: TileId[] } | null {
    if (this.wall.length === 0) {
      this.phase = 'over';
      return null;
    }
    const player = this.players[seat];
    if (!player) return null;

    const flowers: TileId[] = [];
    let tile = this.wall.pop();
    if (tile === undefined) {
      this.phase = 'over';
      return null;
    }

    while (isFlower(tile) && this.wall.length > 0) {
      flowers.push(tile);
      player.flowers.push(tile);
      tile = this.wall.pop()!;
    }

    if (isFlower(tile)) {
      player.flowers.push(tile);
      this.phase = 'over';
      return null;
    }

    player.hand.push(tile);
    player.hand.sort((a, b) => a - b);
    return { tile, flowers };
  }

  public draw(seat: number): { tile: TileId; flowers: TileId[] } | null {
    if (this.currentTurn !== seat || this.phase !== 'draw') return null;
    const res = this.drawTileWithFlowers(seat);
    if (res) {
      this.phase = 'discard';
    }
    return res;
  }

  public drawReplacement(seat: number): { tile: TileId; flowers: TileId[] } | null {
    return this.drawTileWithFlowers(seat);
  }

  public discard(seat: number, tile: TileId): {
    success: boolean;
    claims: { [seat: number]: ClaimOption[] };
  } {
    if (this.currentTurn !== seat || this.phase !== 'discard') {
      return { success: false, claims: {} };
    }
    const player = this.players[seat];
    if (!player) return { success: false, claims: {} };

    const idx = player.hand.indexOf(tile);
    if (idx === -1) return { success: false, claims: {} };

    player.hand.splice(idx, 1);
    player.discards.push(tile);
    this.lastDiscard = { seat, tile };
    this.turnNumber++;

    this.pendingClaims.clear();
    this.stagedClaims.clear();
    const claimsObj: { [s: number]: ClaimOption[] } = {};

    for (let s = 0; s < 4; s++) {
      if (s === seat || !this.players[s]) continue;
      const opponent = this.players[s]!;
      const opts = availableClaims(s, seat, tile, opponent.hand, opponent.melds.length);
      if (opts.length > 0) {
        this.pendingClaims.set(s, opts);
        claimsObj[s] = opts;
      }
    }

    if (this.pendingClaims.size > 0) {
      this.phase = 'claim';
    } else {
      this.phase = 'draw';
      this.currentTurn = (seat + 1) % 4;
    }

    return { success: true, claims: claimsObj };
  }

  private executeClaim(seat: number, kind: 'chi' | 'pon' | 'kan' | 'ron', choiceIndex = 0): {
    winner: number | null;
    isDraw?: boolean;
    fanSummary?: { totalFan: number; basePoints: number; items: any[] };
  } {
    const opts = this.pendingClaims.get(seat);
    if (!opts || !this.lastDiscard) return { winner: null };

    const matching = opts.filter((o) => o.kind === kind);
    const selected = matching[choiceIndex] || matching[0];
    if (!selected) return { winner: null };

    const discarder = this.lastDiscard.seat;
    const tile = this.lastDiscard.tile;

    if (kind === 'ron') {
      this.phase = 'over';
      this.winner = seat;
      const player = this.players[seat]!;
      player.hand.push(tile);
      player.hand.sort((a, b) => a - b);
      const fan = calculateFan(player, 'Ron', discarder, tile);
      const basePoints = fanToPoints(fan.totalFan);
      const shooterPay = basePoints * 2;
      this.players[discarder]!.score -= shooterPay;
      player.score += shooterPay;
      this.pendingClaims.clear();
      this.stagedClaims.clear();
      this.lastDiscard = null;
      return { winner: seat, fanSummary: { totalFan: fan.totalFan, basePoints, items: fan.items } };
    }

    const player = this.players[seat]!;
    const source = this.players[discarder]!;
    source.discards.pop();
    this.lastDiscard = null;
    this.pendingClaims.clear();
    this.stagedClaims.clear();

    for (const t of selected.consume) {
      const idx = player.hand.indexOf(t);
      if (idx !== -1) player.hand.splice(idx, 1);
    }

    player.melds.push({
      kind: selected.kind as 'chi' | 'pon' | 'kan',
      tiles: [...selected.tiles],
      from: discarder
    });

    this.currentTurn = seat;
    this.phase = 'discard';

    if (kind === 'kan') {
      const drawn = this.drawReplacement(seat);
      if (!drawn) {
        return { winner: null, isDraw: true };
      }
    }

    return { winner: null };
  }

  public claim(seat: number, kind: 'chi' | 'pon' | 'kan' | 'ron', choiceIndex = 0): {
    winner: number | null;
    staged?: boolean;
    isDraw?: boolean;
    fanSummary?: { totalFan: number; basePoints: number; items: any[] };
  } {
    const opts = this.pendingClaims.get(seat);
    if (!opts || !this.lastDiscard) return { winner: null };

    const matching = opts.filter((o) => o.kind === kind);
    const selected = matching[choiceIndex] || matching[0];
    if (!selected) return { winner: null };

    const myPri = claimPriority(kind);
    const hasHigher = Array.from(this.pendingClaims.entries()).some(([s, oList]) => {
      return s !== seat && oList.some((o) => claimPriority(o.kind) > myPri);
    });

    if (hasHigher) {
      this.stagedClaims.set(seat, { kind, choiceIndex });
      return { winner: null, staged: true };
    }

    return this.executeClaim(seat, kind, choiceIndex);
  }

  public passClaim(seat: number): {
    resolved: boolean;
    winner: number | null;
    isDraw?: boolean;
    fanSummary?: { totalFan: number; basePoints: number; items: any[] };
  } {
    this.pendingClaims.delete(seat);
    this.stagedClaims.delete(seat);

    if (this.pendingClaims.size === 0) {
      if (this.lastDiscard) {
        this.currentTurn = (this.lastDiscard.seat + 1) % 4;
        this.lastDiscard = null;
      }
      this.phase = 'draw';
      return { resolved: true, winner: null };
    }

    const sortedStaged = Array.from(this.stagedClaims.entries()).sort(
      (a, b) => claimPriority(b[1].kind) - claimPriority(a[1].kind)
    );

    for (const [stagedSeat, staged] of sortedStaged) {
      const stagedPri = claimPriority(staged.kind);
      const stillBlocked = Array.from(this.pendingClaims.entries()).some(
        ([s, opts]) => s !== stagedSeat && opts.some((o) => claimPriority(o.kind) > stagedPri)
      );
      if (!stillBlocked) {
        const exec = this.executeClaim(stagedSeat, staged.kind, staged.choiceIndex);
        return { resolved: true, ...exec };
      }
    }

    return { resolved: false, winner: null };
  }

  public tsumo(seat: number): {
    winner: number | null;
    fanSummary?: { totalFan: number; basePoints: number; items: any[] };
  } {
    if (this.currentTurn !== seat || this.phase !== 'discard') {
      return { winner: null };
    }
    const player = this.players[seat];
    if (!player) return { winner: null };

    if (!isWinningHand(player.hand, player.melds.length)) {
      return { winner: null };
    }

    this.phase = 'over';
    this.winner = seat;

    const fan = calculateFan(player, 'Tsumo', null, null);
    const basePoints = fanToPoints(fan.totalFan);

    for (let s = 0; s < 4; s++) {
      if (s !== seat && this.players[s]) {
        this.players[s]!.score -= basePoints;
        player.score += basePoints;
      }
    }

    return {
      winner: seat,
      fanSummary: { totalFan: fan.totalFan, basePoints, items: fan.items }
    };
  }

  public declareKong(seat: number, tile: TileId): { success: boolean; isDraw?: boolean } {
    if (this.currentTurn !== seat || this.phase !== 'discard') {
      return { success: false };
    }
    const player = this.players[seat];
    if (!player) return { success: false };

    // Case 1: Concealed Kong (4 identical tiles in hand)
    const count = player.hand.filter((t) => t === tile).length;
    if (count === 4) {
      player.hand = player.hand.filter((t) => t !== tile);
      player.melds.push({
        kind: 'kan',
        tiles: [tile, tile, tile, tile],
        from: seat
      });
      const rep = this.drawReplacement(seat);
      if (!rep) {
        return { success: true, isDraw: true };
      }
      return { success: true };
    }

    // Case 2: Promoted Kong (has open Pong of tile and 1 tile in hand)
    const existingPong = player.melds.find((m) => m.kind === 'pon' && m.tiles[0] === tile);
    const hasOneInHand = player.hand.includes(tile);
    if (existingPong && hasOneInHand) {
      const idx = player.hand.indexOf(tile);
      player.hand.splice(idx, 1);
      existingPong.kind = 'kan';
      existingPong.tiles.push(tile);
      const rep = this.drawReplacement(seat);
      if (!rep) {
        return { success: true, isDraw: true };
      }
      return { success: true };
    }

    return { success: false };
  }

  public getClientState(seat: number): ClientGameState | null {
    const player = this.players[seat];
    if (!player) return null;

    const opponents = [];
    for (let s = 0; s < 4; s++) {
      if (s === seat) continue;
      const opp = this.players[s];
      if (opp) {
        opponents.push({
          seat: s,
          name: opp.name,
          tileCount: opp.hand.length,
          flowers: [...opp.flowers],
          discards: [...opp.discards],
          melds: [...opp.melds],
          score: opp.score,
          isBot: opp.isBot
        });
      }
    }

    const pendingOpts = this.pendingClaims.get(seat);
    const pendingClaim = (pendingOpts && this.lastDiscard) ? {
      discarder: this.lastDiscard.seat,
      tile: this.lastDiscard.tile,
      options: pendingOpts
    } : null;

    const canTsumo = (
      this.currentTurn === seat &&
      this.phase === 'discard' &&
      isWinningHand(player.hand, player.melds.length)
    );

    const canKongTiles: TileId[] = [];
    if (this.currentTurn === seat && this.phase === 'discard') {
      const counts = countsFor(player.hand);
      for (let t = 0; t < 34; t++) {
        if (counts[t] === 4) canKongTiles.push(t);
        if (counts[t] >= 1 && player.melds.some((m) => m.kind === 'pon' && m.tiles[0] === t)) {
          canKongTiles.push(t);
        }
      }
    }

    return {
      roomCode: this.code,
      seat,
      wallCount: this.wall.length,
      currentTurn: this.currentTurn,
      phase: this.phase,
      myHand: [...player.hand],
      myFlowers: [...player.flowers],
      myMelds: [...player.melds],
      myScore: player.score,
      opponents,
      lastDiscard: this.lastDiscard,
      pendingClaim,
      turn: this.turnNumber,
      canTsumo,
      canKongTiles
    };
  }
}
