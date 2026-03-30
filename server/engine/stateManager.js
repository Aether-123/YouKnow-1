'use strict';

const { getType, getColor, shuffle } = require('./rules');

function nextActiveIndex(playerIds, knockedOut, fromIdx, dir) {
  const n = playerIds.length;
  let idx = (fromIdx + dir + n) % n;
  let guard = 0;
  while (knockedOut.includes(playerIds[idx]) && guard < n) {
    idx = (idx + dir + n) % n;
    guard++;
  }
  return idx;
}

function peekNextPlayer(state, playerIds, fromPlayerId, fx={}) {
  let dir = state.direction;
  const reverses = fx.reverses || 0;
  for (let i = 0; i < reverses; i++) dir *= -1;
  const fromIdx = playerIds.indexOf(fromPlayerId);
  const nextIdx = nextActiveIndex(playerIds, state.knockedOut, fromIdx, dir);
  return playerIds[nextIdx];
}

function advanceTurn(state, playerIds, fx={}) {
  state.awaitingDrawDecisionFor = null;
  state.drawnPlayableCardId = null;

  const reverses = fx.reverses || 0;
  for (let i = 0; i < reverses; i++) {
    state.direction *= -1;
    // In 2-player, reverse should keep the turn with the same player (acts as skip/self-turn)
    if (playerIds.length === 2) {
      // Do NOT add a skip; just return without advancing
      return;
    }
    // For >2 players, reverse acts as direction change
  }

  let idx = nextActiveIndex(playerIds, state.knockedOut, playerIds.indexOf(state.currentPlayer), state.direction);
  const skips = fx.skips || 0;
  for (let i = 0; i < skips; i++) {
    idx = nextActiveIndex(playerIds, state.knockedOut, idx, state.direction);
  }

  state.currentPlayer = playerIds[idx];
}

function reshuffleIfNeeded(state) {
  if (state.deck.length > 0) return;
  if (state.discardPile.length <= 1) return;

  const top = state.discardPile.pop();
  state.deck = shuffle(state.discardPile);
  state.discardPile = [top];
}

function applyStartCard(state, playerIds) {
  const top = state.discardPile[state.discardPile.length - 1];
  const topType = getType(top, true);

  if (topType === 'skip') {
    const next = nextActiveIndex(playerIds, state.knockedOut, 0, state.direction);
    state.currentPlayer = playerIds[next];
  }

  if (topType === 'reverse') {
    state.direction = -1;
    if (playerIds.length === 2) state.currentPlayer = playerIds[1];
    else state.currentPlayer = playerIds[playerIds.length - 1];
  }

  if (topType === 'draw2') {
    const victim = state.currentPlayer;
    for (let i = 0; i < 2; i++) {
      reshuffleIfNeeded(state);
      if (!state.deck.length) break;
      state.hands[victim].push(state.deck.pop());
    }
    const next = nextActiveIndex(playerIds, state.knockedOut, 0, state.direction);
    state.currentPlayer = playerIds[next];
  }

  if (topType === 'wild') {
    state.currentColor = getColor(top, true);
  }
}

module.exports = {
  nextActiveIndex,
  peekNextPlayer,
  advanceTurn,
  reshuffleIfNeeded,
  applyStartCard
};