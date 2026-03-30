'use strict';

const { validateMove, isPlayableCard } = require('../validator');
const { advanceTurn, reshuffleIfNeeded } = require('../stateManager');

function giveCards(state, playerId, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    reshuffleIfNeeded(state);
    if (!state.deck.length) break;
    const card = state.deck.pop();
    state.hands[playerId].push(card);
    drawn.push(card);
  }
  return drawn;
}

function applyDraw(game, playerId) {
  const s = game.state;
  const rules = game.rules;

  const v = validateMove(playerId, { type:'draw' }, s, rules, { playerIds: game.playerIds, variant: game.variant });
  if (!v.ok) return { ok:false, error:v.error };

  if (v.penalty) {
    // Only draw the pendingDraw amount if there is a real penalty (from +2/+4/etc)
    const drawCount = s.pendingDraw > 0 ? s.pendingDraw : 1;
    const drawn = giveCards(s, playerId, drawCount);
    s.pendingDraw = 0;
    s.pendingDrawType = null;
    s.pendingDrawSource = null;
    // Penalty draw consumes turn; move to the next player exactly once.
    advanceTurn(s, game.playerIds, { skips:0 });
    return { ok:true, event:'drew', drawn:drawn.map(c => c.id), forced:true };
  }

  const top = s.discardPile[s.discardPile.length - 1];
  const hand = s.hands[playerId] || [];
  const drawn = [];
  let canPlay = null;

  const keepDrawing = !!rules.multiDraw;

  while (true) {
    reshuffleIfNeeded(s);
    if (!s.deck.length) break;

    const card = s.deck.pop();
    s.hands[playerId].push(card);
    drawn.push(card.id);

    if (isPlayableCard(card, top, s.currentColor, s.hands[playerId], rules, s.isLight)) {
      canPlay = card.id;
      break;
    }

    if (!keepDrawing) break;
  }

  if (canPlay) {
    s.awaitingDrawDecisionFor = playerId;
    s.drawnPlayableCardId = canPlay;
    return { ok:true, event:'drew', drawn, canPlay };
  }

  // Normal draw with no playable card ends current turn.
  advanceTurn(s, game.playerIds, { skips:0 });
  return { ok:true, event:'drew', drawn };
}

module.exports = { applyDraw, giveCards };