import assert from 'node:assert/strict';
import {
  isWinningHand,
  possibleChi,
  availableClaims,
  isFlower,
  calculateFan,
  fanToPoints
} from '../dist/game/rules.js';
import { MahjongRoom } from '../dist/game/room.js';

assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,31,27,27], 0), true, '4 melds and a pair win');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,32,27,27], 0), false, 'incomplete hand fails');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,27,27], 1), true, 'open meld counted correctly');
assert.equal(possibleChi([18,20],19).length, 1, 'Chi within one suit');
assert.equal(possibleChi([8,10],9).length, 0, 'Chi cannot cross suit boundary');
assert.equal(possibleChi([27,28],29).length, 0, 'Chi cannot use honors');

const handWithPon = [31,31,0,1,2,4,5,6,18,19,20,27,28];
assert.equal(availableClaims(0, 3, 31, handWithPon, 0).some((v) => v.kind === 'pon'), true, 'Pon from opponent');
const handWithChi = [18,20,0,1,2,4,5,6,9,10,11,27,28];
assert.equal(availableClaims(0, 3, 19, handWithChi, 0).some((v) => v.kind === 'chi'), true, 'Chi from preceding seat');
assert.equal(availableClaims(0, 2, 19, handWithChi, 0).some((v) => v.kind === 'chi'), false, 'No Chi from other seats');

assert.equal(isFlower(34), true, 'Tile 34 is Plum flower');
assert.equal(isFlower(41), true, 'Tile 41 is Winter season');
assert.equal(isFlower(33), false, 'Tile 33 is White Dragon');
assert.equal(isFlower(0), false, 'Tile 0 is 1 Wan');

const mockPlayerPingHu = {
  id: 'test',
  name: 'Tester',
  seat: 0,
  hand: [0,1,2,3,4,5,9,10,11,18,19,20,21,21],
  flowers: [],
  discards: [],
  melds: [],
  score: 10000,
  isReady: true,
  isBot: false
};
const pingHu = calculateFan(mockPlayerPingHu, 'Ron', 1, 21);
assert.equal(pingHu.items.some((it) => it.name.includes('Ping Hu')), true, 'Ping Hu detected');

const mockPlayerDuiDui = {
  id: 'test',
  name: 'Tester',
  seat: 0,
  hand: [0,0,0,9,9,9,18,18,18,31,31,31,27,27],
  flowers: [],
  discards: [],
  melds: [],
  score: 10000,
  isReady: true,
  isBot: false
};
const duiDui = calculateFan(mockPlayerDuiDui, 'Ron', 1, 27);
assert.equal(duiDui.items.some((it) => it.name.includes('Dui Dui Hu')), true, 'Dui Dui Hu detected');
assert.equal(duiDui.items.some((it) => it.name.includes('Naga Merah')), true, 'Red dragon pung detected');

assert.equal(fanToPoints(1), 40);
assert.equal(fanToPoints(3), 160);
assert.equal(fanToPoints(7), 960);

// Test P0: Kan claim and replacement draw
const testRoom = new MahjongRoom('TEST');
testRoom.addPlayer('p0', 'Player 0');
testRoom.addPlayer('p1', 'Player 1');
testRoom.addPlayer('p2', 'Player 2');
testRoom.addPlayer('p3', 'Player 3');
testRoom.startGame();

// Setup Player 0 with three Red Dragons (tile 31) and 10 other tiles (total 13)
testRoom.players[0].hand = [31, 31, 31, 0, 1, 2, 4, 5, 6, 9, 10, 11, 20];
testRoom.players[1].hand = [31, 7, 8, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24];
testRoom.currentTurn = 1;
testRoom.phase = 'discard';

// Player 1 discards tile 31
const discardRes = testRoom.discard(1, 31);
assert.equal(discardRes.success, true, 'Player 1 discarded tile 31');
assert.equal(testRoom.phase, 'claim', 'Room entered claim phase');

// Player 0 claims Kan
const claimRes = testRoom.claim(0, 'kan');
assert.equal(claimRes.winner, null, 'Kan claim has no immediate winner');
assert.equal(testRoom.players[0].melds.length, 1, 'Player 0 has 1 meld');
assert.equal(testRoom.players[0].melds[0].kind, 'kan', 'Meld is a Kan');
assert.equal(testRoom.players[0].hand.length, 11, 'Hand has 11 tiles (10 + 1 replacement tile)');
assert.equal(testRoom.phase, 'discard', 'Room phase is discard after Kan replacement drawn');

// Player 0 discards 1 tile
const p0Discard = testRoom.discard(0, testRoom.players[0].hand[0]);
assert.equal(p0Discard.success, true, 'Player 0 can discard after Kan');
assert.equal(testRoom.players[0].hand.length, 10, 'Hand now has 10 tiles left with 1 open Kan meld');

// Test P0: Wall exhaustion (Ronde seri / Exhaustive Draw)
testRoom.wall = [];
testRoom.currentTurn = 2;
testRoom.phase = 'draw';
const drawWhenEmpty = testRoom.draw(2);
assert.equal(drawWhenEmpty, null, 'Draw on empty wall returns null');
assert.equal(testRoom.phase, 'over', 'Exhausted wall sets room phase to over');

// Test P1: Tsumo (Menang Draw Sendiri & Payout 3 Lawan Bayar Rata)
const tsumoRoom = new MahjongRoom('TSUM');
tsumoRoom.addPlayer('p0', 'Player 0');
tsumoRoom.addPlayer('p1', 'Player 1');
tsumoRoom.addPlayer('p2', 'Player 2');
tsumoRoom.addPlayer('p3', 'Player 3');
tsumoRoom.startGame();

// Berikan Player 0 tangan menang lengkap 14 ubin (4 melds + 1 pair)
tsumoRoom.players[0].hand = [0,1,2, 3,4,5, 9,10,11, 18,19,20, 27,27];
tsumoRoom.currentTurn = 0;
tsumoRoom.phase = 'discard';

const clientState = tsumoRoom.getClientState(0);
assert.equal(clientState.canTsumo, true, 'Player 0 canTsumo is true with complete 14-tile hand');

const tsumoRes = tsumoRoom.tsumo(0);
assert.equal(tsumoRes.winner, 0, 'Player 0 wins by Tsumo');
assert.equal(tsumoRoom.phase, 'over', 'Phase changed to over after Tsumo');
// Hitung skor: Tiap lawan harus berkurang basePoints, dan Player 0 bertambah 3 * basePoints
const basePts = tsumoRes.fanSummary.basePoints;
assert.equal(tsumoRoom.players[1].score, 10000 - basePts, 'Opponent 1 pays basePoints');
assert.equal(tsumoRoom.players[2].score, 10000 - basePts, 'Opponent 2 pays basePoints');
assert.equal(tsumoRoom.players[3].score, 10000 - basePts, 'Opponent 3 pays basePoints');
assert.equal(tsumoRoom.players[0].score, 10000 + 3 * basePts, 'Winner receives 3 * basePoints');

// Test P1: Hirarki Prioritas Klaim (Ron > Pon > Chi)
const prioRoom = new MahjongRoom('PRIO');
prioRoom.addPlayer('p0', 'Player 0');
prioRoom.addPlayer('p1', 'Player 1');
prioRoom.addPlayer('p2', 'Player 2');
prioRoom.addPlayer('p3', 'Player 3');
prioRoom.startGame();

// Player 0 discards 2 Wan (tile 1)
prioRoom.players[0].hand = [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
// Player 1 can Chi (has 1 Wan & 3 Wan)
prioRoom.players[1].hand = [0, 2, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21];
// Player 2 can Pon (has two 2 Wan)
prioRoom.players[2].hand = [1, 1, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21];
// Player 3 can Ron (waiting on 2 Wan to complete hand)
prioRoom.players[3].hand = [0, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 27, 27];

prioRoom.currentTurn = 0;
prioRoom.phase = 'discard';
prioRoom.discard(0, 1);
assert.equal(prioRoom.phase, 'claim', 'Discard tile 1 entered claim phase');

// Kasus 1: Player 1 klik Chi lebih cepat dari Player 3. Karena Player 3 bisa Ron, Chi harus di-stage.
const chiAttempt = prioRoom.claim(1, 'chi');
assert.equal(chiAttempt.staged, true, 'Chi is staged because higher priority options exist');
assert.equal(prioRoom.phase, 'claim', 'Still in claim phase waiting for higher priority resolution');

// Player 3 klik Ron -> Ron langsung menang mengabaikan Chi!
const ronAttempt = prioRoom.claim(3, 'ron');
assert.equal(ronAttempt.winner, 3, 'Player 3 wins by Ron with highest priority');
assert.equal(prioRoom.phase, 'over', 'Game over after Ron executes');

// Kasus 2: Chi ter-eksekusi otomatis saat Pon pass
const prioRoom2 = new MahjongRoom('PRI2');
prioRoom2.addPlayer('p0', 'Player 0');
prioRoom2.addPlayer('p1', 'Player 1');
prioRoom2.addPlayer('p2', 'Player 2');
prioRoom2.addPlayer('p3', 'Player 3');
prioRoom2.startGame();

prioRoom2.players[0].hand = [1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
prioRoom2.players[1].hand = [0, 2, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21]; // Can Chi tile 1
prioRoom2.players[2].hand = [1, 1, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21]; // Can Pon tile 1
prioRoom2.players[3].hand = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]; // No claim

prioRoom2.currentTurn = 0;
prioRoom2.phase = 'discard';
prioRoom2.discard(0, 1);

// Player 1 klik Chi -> di-stage karena Player 2 punya Pon
const chiAttempt2 = prioRoom2.claim(1, 'chi');
assert.equal(chiAttempt2.staged, true, 'Chi is staged waiting for Pon decision');

// Player 2 klik Pass -> Chi milik Player 1 otomatis dieksekusi!
const passRes = prioRoom2.passClaim(2);
assert.equal(passRes.resolved, true, 'Staged Chi automatically executed when Pon passed');
assert.equal(prioRoom2.players[1].melds.length, 1, 'Player 1 got the Chi meld');
assert.equal(prioRoom2.currentTurn, 1, 'Current turn is now Player 1');
assert.equal(prioRoom2.phase, 'discard', 'Player 1 is now in discard phase');

console.log('MahjongIn-Server unit tests passed successfully!');
