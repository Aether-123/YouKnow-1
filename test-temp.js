const { UnoGame } = require('./server/gameEngine');

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log('Testing Normalization...');
  
  // Test 1: No Mercy Knockout
  console.log('Test 1: No Mercy 25-card Knockout');
  const g1 = new UnoGame('room1', ['p1', 'p2', 'p3'], { variant: 'mercy' });
  g1.startRound();
  
  // Give p1 25 cards
  g1.state.hands['p1'] = new Array(25).fill(null).map((_, i) => ({ id: 1000+i, type: 'number', color: 'red', value: i%10 }));
  
  // Force a call to _checkMercy (which gets called on play or draw)
  g1._checkMercy();
  assert(g1.state.knockedOut.includes('p1'), 'p1 should be knocked out');
  assert(g1.state.hands['p1'].length === 0, 'p1 hand should be empty');
  console.log(' - Mercy Knockout works!');

  // Test 2: Voldemort HP discard
  console.log('Test 2: Harry Potter Voldemort');
  const g2 = new UnoGame('room2', ['p1', 'p2'], { variant: 'hp' });
  g2.startRound();
  
  g2.state.currentPlayer = 'p1';
  g2.state.hands['p1'] = [
    { id: 101, type: 'voldemort' },
    { id: 102, type: 'number', color: 'red', value: 2 }, // Harry 2
    { id: 103, type: 'number', color: 'blue', value: 6 }, // Harry 6
    { id: 104, type: 'number', color: 'yellow', value: 9 }, // Harry 9
    { id: 105, type: 'number', color: 'green', value: 3 } // Non-harry
  ];
  
  // Make top card red 1 so we can play voldemort (wilds can be played anytime usually)
  g2.state.discardPile = [{ id: 99, type: 'number', color: 'red', value: 1 }];
  g2.state.currentColor = 'red';
  
  const res = g2.playCards('p1', [101], 'blue'); // play validly
  assert(res.ok, 'Voldemort play failed: ' + res.error);
  assert(g2.state.hands['p1'].length === 1, 'Only non-Harry card should remain');
  assert(g2.state.hands['p1'][0].id === 105, 'Remaining card should be 105 (green 3)');
  console.log(' - Voldemort Discard works!');
  
  console.log('ALL TESTS PASSED.');
}

runTests().catch(console.error);
