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

console.log('MahjongIn-Server unit tests passed successfully!');
