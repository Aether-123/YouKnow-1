'use strict';

const { validateMove, getDrawCount, getDrawType, isWild } = require('../validator');
const { getType, getColor } = require('../rules');
const { advanceTurn, peekNextPlayer } = require('../stateManager');
const { giveCards } = require('./draw');

function applyPlay(game, playerId, cardIds, chosenColor) {
  const s = game.state;
  const rules = game.rules;

  const result = validateMove(
    playerId,
    { type:'play', cardIds, chosenColor },
    s,
    rules,
    { playerIds: game.playerIds, variant: game.variant }
  );

  if (!result.ok) return { ok:false, error:result.error };

  const cards = result.cards;
  const hand = s.hands[playerId];

  const prevColor = s.currentColor;

  for (const card of cards) {
    const idx = hand.findIndex(c => c.id === card.id);
    if (idx !== -1) hand.splice(idx, 1);
    s.discardPile.push(card);
  }

  s.awaitingDrawDecisionFor = null;
  s.drawnPlayableCardId = null;

  const fx = {
    skips: 0,
    reverses: 0,
    drawTotal: 0,
    drawType: null,
    challengedCardOwner: null,
    prevColor
  };

  for (const card of cards) {
    const t = getType(card, s.isLight);
    const c = getColor(card, s.isLight);

    if (!isWild(t)) s.currentColor = c;

    if (t === 'skip') fx.skips += 1;
    if (t === 'reverse') fx.reverses += 1;
    if (t === 'draw2' || t === 'wildDraw2' || t === 'wild4' || t === 'wildRevDraw4' || t === 'draw4') {
      fx.drawTotal += getDrawCount(t);
      fx.drawType = fx.drawType || getDrawType(t);
      fx.challengedCardOwner = playerId;
    }
  }

  const last = cards[cards.length - 1];
  const lastType = getType(last, s.isLight);
  if (isWild(lastType)) s.currentColor = chosenColor;

  if (hand.length === 0) {
    return game.endRound(playerId);
  }

  // Apply draw effects
  if (fx.drawTotal > 0) {
    if (rules.stacking && fx.drawType) {
      s.pendingDraw += fx.drawTotal;
      s.pendingDrawType = fx.drawType;
      s.pendingDrawSource = lastType;
      s.awaitingData.prevColor = prevColor;
      if (fx.drawType === '+4') s.awaitingData.challengeTarget = playerId;
      advanceTurn(s, game.playerIds, { reverses:fx.reverses, skips:fx.skips });
      return { ok:true, event:'played' };
    }

    const victim = peekNextPlayer(s, game.playerIds, playerId, { reverses:fx.reverses });
    giveCards(s, victim, fx.drawTotal);
    advanceTurn(s, game.playerIds, { reverses:fx.reverses, skips:(fx.skips || 0) + 1 });
    return { ok:true, event:'played' };
  }

  advanceTurn(s, game.playerIds, { reverses:fx.reverses, skips:fx.skips });
  return { ok:true, event:'played' };
}

module.exports = { applyPlay };