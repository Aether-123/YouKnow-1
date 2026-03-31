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
    const v = card.value;

    if (!isWild(t)) s.currentColor = c;

    if (t === 'skip') fx.skips += 1;
    if (t === 'reverse') fx.reverses += 1;
    if (t === 'flip') s.isLight = !s.isLight;
    if (t === 'skipAll' || t === 'skipEveryone') fx.skips += game.playerIds.length - 1;

    // Zeroes Pass Custom Rule
    if (t === 'number' && v === 0 && rules.zerosPass) {
      const pCount = game.playerIds.length;
      if (pCount > 1) {
        const offset = s.direction === 1 ? -1 : 1; 
        const newHands = {};
        for (let i = 0; i < pCount; i++) {
          const fromIdx = (i + offset + pCount) % pCount;
          newHands[game.playerIds[i]] = [...s.hands[game.playerIds[fromIdx]]];
        }
        s.hands = newHands;
      }
    }

    if (t === 'discardAll') {
      const remainingColor = isWild(t) ? s.currentColor : c;
      const handToClean = s.hands[playerId];
      const matchingCards = [...handToClean].filter(hc => !cardIds.includes(hc.id) && getColor(hc, s.isLight) === remainingColor);
      matchingCards.forEach(mc => {
        const i = handToClean.findIndex(hc => hc.id === mc.id);
        if (i !== -1) handToClean.splice(i, 1);
        s.discardPile.push(mc);
      });
    }

    if (['draw1','draw2','draw4','draw5','wildDraw2','wild4','voldemort','wildRevDraw4','wildDraw6','wildDraw10'].includes(t)) {
      if (t === 'wildRevDraw4') fx.reverses += 1;
      fx.drawTotal += getDrawCount(t);
      fx.drawType = fx.drawType || getDrawType(t);
      fx.challengedCardOwner = playerId;
    }

    if (t === 'wildDrawColor' || t === 'wildColorRoulette') {
      const victim = peekNextPlayer(s, game.playerIds, playerId, { reverses:fx.reverses, skips:fx.skips });
      
      if (t === 'wildDrawColor') {
        // Must choose a color first; then victim draws cards of that color
        s.awaitingData.wildDrawColorTarget = victim;
        s.phase = 'choose-color';
        s.awaitingFrom = playerId;
      } else {
        // Roulette: current player chooses a color; everyone else draws until hitting that color
        s.phase = 'choose-roulette';
        s.awaitingFrom = playerId;
      }
    }

    // Voldemort custom rule (Harry Potter)
    if (t === 'voldemort' || t === 'wildHarryPotter') {
      const handToClean = s.hands[playerId];
      const harryCards = [...handToClean].filter(hc => rules.HP_HARRY_NUMS && rules.HP_HARRY_NUMS.includes(hc.value));
      harryCards.forEach(mc => {
        const i = handToClean.findIndex(hc => hc.id === mc.id);
        if (i !== -1) handToClean.splice(i, 1);
        s.discardPile.push(mc);
      });
    }

    // Sevens Swap
    if (t === 'number' && v === 7 && rules.sevensSwap) {
      s.phase = 'choose-swap';
      s.awaitingFrom = playerId;
    }
  }

  const last = cards[cards.length - 1];
  const lastType = getType(last, s.isLight);
  // For non-wildDrawColor/roulette wilds, set color immediately from chosenColor
  if (isWild(lastType) && lastType !== 'wildDrawColor' && lastType !== 'wildColorRoulette') {
    s.currentColor = chosenColor;
  }

  if (hand.length === 0) {
    return game.endRound(playerId);
  }

  // If awaiting a choice (color/swap/roulette), don't advance turn yet — the choice handler will
  const awaitingChoice = ['choose-color', 'choose-swap', 'choose-roulette'].includes(s.phase);
  if (awaitingChoice) return { ok:true, event:'played' };

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