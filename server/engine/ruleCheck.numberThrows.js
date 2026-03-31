'use strict';

const { validateMove } = require('./validator');
const { normalizeRules } = require('./rules');

const rules = normalizeRules({
  stacking: true,
  multiPlay: true,
  multiDraw: true,
  allowVoluntaryDraw: false,
  strictWild4: true,
  allowStackMixing: false
});

function card(id, type, color, value = 0) {
  return { id, type, color, value, variant: 'classic' };
}

function mkState(hand, top, currentColor) {
  return {
    phase: 'play',
    currentPlayer: 'p1',
    isLight: true,
    hands: { p1: hand, p2: [] },
    discardPile: [top],
    currentColor,
    pendingDraw: 0,
    pendingDrawType: null,
    awaitingDrawDecisionFor: null,
    drawnPlayableCardId: null
  };
}

const tests = [
  {
    name: 'Single: same number different color',
    state: mkState([card(1, 'number', 'blue', 7)], card(99, 'number', 'red', 7), 'red'),
    move: { type: 'play', cardIds: [1] },
    want: true
  },
  {
    name: 'Single: same color different number',
    state: mkState([card(2, 'number', 'red', 3)], card(99, 'number', 'red', 7), 'red'),
    move: { type: 'play', cardIds: [2] },
    want: true
  },
  {
    name: 'Single: different color and number',
    state: mkState([card(3, 'number', 'blue', 3)], card(99, 'number', 'red', 7), 'red'),
    move: { type: 'play', cardIds: [3] },
    want: false
  },
  {
    name: 'Multi: same number across colors',
    state: mkState([card(4, 'number', 'red', 5), card(5, 'number', 'blue', 5)], card(99, 'number', 'yellow', 5), 'yellow'),
    move: { type: 'play', cardIds: [4, 5] },
    want: true
  },
  {
    name: 'Multi: mixed numbers same color (house rule)',
    state: mkState([card(6, 'number', 'green', 1), card(7, 'number', 'green', 9)], card(99, 'number', 'green', 3), 'green'),
    move: { type: 'play', cardIds: [6, 7] },
    want: true
  },
  {
    name: 'Multi: mixed number and color (invalid)',
    state: mkState([card(8, 'number', 'green', 1), card(9, 'number', 'blue', 9)], card(99, 'number', 'red', 3), 'red'),
    move: { type: 'play', cardIds: [8, 9] },
    want: false
  }
];

let failed = 0;
for (const t of tests) {
  const res = validateMove('p1', t.move, t.state, rules, { playerIds: ['p1', 'p2'], variant: 'classic' });
  const ok = !!res.ok;
  const pass = ok === t.want;
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${t.name}`);
  if (!pass) {
    failed++;
    console.log('  Result:', res);
  }
}

if (failed) {
  console.error(`\n${failed} number-throw check(s) failed.`);
  process.exit(1);
}

console.log('\nAll number-throw checks passed.');
