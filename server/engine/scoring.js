// Classic UNO scoring logic

function getCardValue(card) {
  if (!card || typeof card !== 'object' || !card.type) throw new Error('Invalid card object');
  switch (card.type) {
    case 'number':
      if (typeof card.value !== 'number') throw new Error('Number card missing value');
      return card.value;
    case 'skip':
    case 'reverse':
    case 'draw2':
      return 20;
    case 'wild':
    case 'wild4':
      return 50;
    default:
      throw new Error('Unknown card type: ' + card.type);
  }
}

function calculateScore(opponentHands) {
  if (!Array.isArray(opponentHands)) throw new Error('Invalid hands array');
  let total = 0;
  for (const hand of opponentHands) {
    if (!Array.isArray(hand)) throw new Error('Invalid hand');
    for (const card of hand) {
      total += getCardValue(card);
    }
  }
  return total;
}

module.exports = { getCardValue, calculateScore };
