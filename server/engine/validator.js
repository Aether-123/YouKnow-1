'use strict';

const { getType, getColor, getValue } = require('./rules');

function getDrawType(type) {
  if (type === 'draw2' || type === 'wildDraw2') return '+2';
  if (type === 'wild4' || type === 'wildRevDraw4' || type === 'draw4' || type === 'voldemort') return '+4';
  return null;
}

function getDrawCount(type) {
  const map = {
    draw1: 1,
    draw2: 2,
    draw4: 4,
    draw5: 5,
    wild4: 4,
    voldemort: 4,
    wildDraw2: 2,
    wildRevDraw4: 4,
    wildDraw6: 6,
    wildDraw10: 10
  };
  return map[type] || 0;
}

function isWild(type) {
  return ['wild','wild4','voldemort','wildDraw2','wildDrawColor','wildRevDraw4','wildDraw6','wildDraw10','wildColorRoulette'].includes(type);
}

function isAction(type) {
  return type !== 'number';
}

function isPlayableCard(card, topCard, currentColor, hand, rules, isLight=true) {
  if (!topCard) return true;

  const type = getType(card, isLight);
  const color = getColor(card, isLight);
  const value = getValue(card, isLight);

  const topType = getType(topCard, isLight);
  const topValue = getValue(topCard, isLight);

  if (isWild(type)) {
    if (type === 'wild4' && rules.strictWild4) {
      const hasColor = hand.some(h => h.id !== card.id && getColor(h, isLight) === currentColor);
      return !hasColor;
    }
    return true;
  }

  if (color === currentColor) return true;
  if (type !== 'number' && topType !== 'number' && type === topType) return true;
  if (type === 'number' && topType === 'number' && value === topValue) return true;
  return false;
}

function getCardsByIds(hand, ids) {
  const cards = ids.map(id => hand.find(c => c.id === id));
  if (cards.some(c => !c)) return null;
  return cards;
}

function validateStack(playerId, move, gameState, rules, context) {
  const hand = gameState.hands[playerId] || [];
  const cards = getCardsByIds(hand, move.cardIds || []);
  if (!cards || !cards.length) return { ok:false, error:'No valid stack cards selected' };

  const types = cards.map(c => getType(c, gameState.isLight));
  const isNumber = types.every(t => t === 'number');
  const isAllAction = types.every(t => t !== 'number');
  if (!(isNumber || isAllAction)) {
    return { ok:false, error:'Cannot mix number and action cards in a multi-card play.' };
  }
  // If all action, must be same type AND color
  if (isAllAction) {
    if (!types.every(t => t === types[0])) {
      return { ok:false, error:'All action cards played together must be the same type.' };
    }
    const colors = cards.map(c => getColor(c, gameState.isLight));
    if (!colors.every(c => c === colors[0])) {
      return { ok:false, error:'All action cards played together must be the same color.' };
    }
  }
  // If all number, must be same value
  if (isNumber && !cards.every(c => getValue(c, gameState.isLight) === getValue(cards[0], gameState.isLight))) {
    return { ok:false, error:'All number cards played together must have the same value.' };
  }
  // Draw stacking logic (for penalty situations)
  const drawTypes = types.map(getDrawType);
  if (gameState.pendingDrawType) {
    if (drawTypes.some(t => !t)) return { ok:false, error:'Only draw cards can be played under penalty' };
    if (!drawTypes.every(t => t === drawTypes[0])) return { ok:false, error:'All stack cards must be same draw type' };
    const pendingType = gameState.pendingDrawType;
    if (!rules.allowStackMixing && pendingType && drawTypes[0] !== pendingType) {
      return { ok:false, error:`Stacking must match pending type (${pendingType})` };
    }
  }

  const top = gameState.discardPile[gameState.discardPile.length - 1];
  if (!isPlayableCard(cards[0], top, gameState.currentColor, hand, rules, gameState.isLight)) {
    return { ok:false, error:'Stack card is not playable on top discard' };
  }

  const total = types.reduce((sum, t) => sum + getDrawCount(t), 0);
  if (total <= 0) return { ok:false, error:'Invalid draw stack' };

  return { ok:true, cards, drawType: drawTypes[0], drawTotal: total };
}

function validatePlay(playerId, move, gameState, rules, context) {
  if (gameState.phase !== 'play') return { ok:false, error:'Not in play phase' };
  if (gameState.currentPlayer !== playerId) return { ok:false, error:'Not your turn' };

  const hand = gameState.hands[playerId] || [];
  const cardIds = move.cardIds || [];
  if (!cardIds.length) return { ok:false, error:'No cards selected' };

  if (gameState.awaitingDrawDecisionFor === playerId) {
    if (cardIds.length !== 1 || cardIds[0] !== gameState.drawnPlayableCardId) {
      return { ok:false, error:'Only the first playable drawn card can be played now' };
    }
  }

  const cards = getCardsByIds(hand, cardIds);
  if (!cards) return { ok:false, error:'Card not in hand' };

  if (gameState.pendingDraw > 0) {
    return validateStack(playerId, move, gameState, rules, context);
  }

  if (cards.length > 1) {
    if (!rules.multiPlay) return { ok:false, error:'Multi-play is disabled' };

    const types = cards.map(c => getType(c, gameState.isLight));
    const colors = cards.map(c => getColor(c, gameState.isLight));
    const values = cards.map(c => getValue(c, gameState.isLight));
    const isAllNumber = types.every(t => t === 'number');
    const isAllAction = types.every(t => t !== 'number');
    if (!(isAllNumber || isAllAction)) {
      return { ok:false, error:'Cannot play number and action cards together.' };
    }
    if (isAllNumber) {
      // House rule: allow mixed numbers if all colors match
      if (!values.every(v => v === values[0])) {
        if (!(rules.houseRuleAllowSameColorMulti && colors.every(c => c === colors[0]))) {
          return { ok:false, error:'All number cards played together must have the same value, unless all are the same color (house rule).' };
        }
      }
      // If all numbers, either all same value (classic) or all same color (house rule)
      if (!values.every(v => v === values[0]) && !(rules.houseRuleAllowSameColorMulti && colors.every(c => c === colors[0]))) {
        return { ok:false, error:'All number cards played together must have the same value, unless all are the same color (house rule).' };
      }
    } else if (isAllAction) {
      if (!types.every(t => t === types[0])) {
        return { ok:false, error:'All action cards played together must be the same type.' };
      }
      // Allow mixed colors for same action
      if (getDrawType(types[0])) {
        const drawTotal = types.reduce((sum, t) => sum + getDrawCount(t), 0);
        return { ok:true, cards, drawType:getDrawType(types[0]), drawTotal };
      }
    }
  }

  // Atomic full set validation against evolving top and color
  let simTop = gameState.discardPile[gameState.discardPile.length - 1];
  let simColor = gameState.currentColor;
  for (const card of cards) {
    if (!isPlayableCard(card, simTop, simColor, hand, rules, gameState.isLight)) {
      return { ok:false, error:'One or more cards are not playable' };
    }
    const t = getType(card, gameState.isLight);
    const c = getColor(card, gameState.isLight);
    if (!isWild(t)) simColor = c;
    simTop = card;
  }

  const last = cards[cards.length - 1];
  const lastType = getType(last, gameState.isLight);
  if (isWild(lastType) && !move.chosenColor) {
    return { ok:false, error:'Wild requires explicit chosen color' };
  }

  if (lastType === 'wild4' && rules.strictWild4) {
    const selected = new Set(cards.map(c => c.id));
    const hasColor = hand.some(c => !selected.has(c.id) && getColor(c, gameState.isLight) === gameState.currentColor);
    if (hasColor) return { ok:false, error:'Wild +4 not allowed while holding current color' };
  }

  return { ok:true, cards, drawType:null, drawTotal:0 };
}

function validateDraw(playerId, move, gameState, rules, context) {
  if (gameState.phase !== 'play') return { ok:false, error:'Not in play phase' };
  if (gameState.currentPlayer !== playerId) return { ok:false, error:'Not your turn' };

  if (gameState.pendingDraw > 0) {
    return { ok:true, penalty:true };
  }

  if (gameState.awaitingDrawDecisionFor === playerId) {
    return { ok:false, error:'Play the drawn card or pass' };
  }

  if (!rules.allowVoluntaryDraw) {
    const top = gameState.discardPile[gameState.discardPile.length - 1];
    const hand = gameState.hands[playerId] || [];
    const hasPlayable = hand.some(c => isPlayableCard(c, top, gameState.currentColor, hand, rules, gameState.isLight));
    if (hasPlayable) return { ok:false, error:'You already have a playable card' };
  }

  return { ok:true, penalty:false };
}

function validateMove(playerId, move, gameState, rules, context={}) {
  if (!move || !move.type) return { ok:false, error:'Invalid move payload' };
  if (move.type === 'play') return validatePlay(playerId, move, gameState, rules, context);
  if (move.type === 'draw') return validateDraw(playerId, move, gameState, rules, context);
  if (move.type === 'stack') return validateStack(playerId, move, gameState, rules, context);
  return { ok:false, error:`Unsupported move type: ${move.type}` };
}

module.exports = {
  validateMove,
  validatePlay,
  validateDraw,
  validateStack,
  isPlayableCard,
  isWild,
  isAction,
  getDrawType,
  getDrawCount
};