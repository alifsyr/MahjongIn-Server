import assert from 'node:assert/strict';
import {
  isWinningHand,
  possibleChi,
  availableClaims,
  isFlower,
  calculateFan,
  fanToPoints
} from '../dist/game/rules.js';

// Base 4 melds + 1 pair
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,31,27,27], 0), true, '4 melds and a pair win');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,31,31,32,27,27], 0), false, 'incomplete hand fails');
assert.equal(isWinningHand([0,1,2,9,10,11,18,19,20,27,27], 1), true, 'open meld counted correctly');
assert.equal(possibleChi([18,20],19).length, 1, 'Chi within one suit');
assert.equal(possibleChi([8,10],9).length, 0, 'Chi cannot cross suit boundary');
assert.equal(possibleChi([27,28],29).length, 0, 'Chi cannot use honors');

// Claims
const handWithPon = [31,31,0,1,2,4,5,6,18,19,20,27,28];
assert.equal(availableClaims(0, 3, 31, handWithPon, 0).some((v) => v.kind === 'pon'), true, 'Pon from opponent');
const handWithChi = [18,20,0,1,2,4,5,6,9,10,11,27,28];
assert.equal(availableClaims(0, 3, 19, handWithChi, 0).some((v) => v.kind === 'chi'), true, 'Chi from preceding seat');
assert.equal(availableClaims(0, 2, 19, handWithChi, 0).some((v) => v.kind === 'chi'), false, 'No Chi from other seats');

// Flower detection (144 tiles)
assert.equal(isFlower(34), true, 'Tile 34 is Plum flower');
assert.equal(isFlower(41), true, 'Tile 41 is Winter season');
assert.equal(isFlower(33), false, 'Tile 33 is White Dragon');
assert.equal(isFlower(0), false, 'Tile 0 is 1 Wan');

// Fan calculation: Ping Hu
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

// Fan calculation: Dui Dui Hu
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

// Points conversion
assert.equal(fanToPoints(1), 40);
assert.equal(fanToPoints(3), 160);
assert.equal(fanToPoints(7), 960);

console.log('MahjongIn-Server unit tests passed successfully!');
