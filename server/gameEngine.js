'use strict';

const {
  VARIANTS,
  LIGHT_COLORS,
  DARK_COLORS,
  HP_HARRY_NUMS,
  getType,
  getColor,
  getValue,
  getSide,
  cardPoints,
  buildDeck,
  normalizeRules
} = require('./engine/rules');

const { validateMove } = require('./engine/validator');
const { applyPlay } = require('./engine/actions/play');
const { applyDraw, giveCards } = require('./engine/actions/draw');
const { applyStartCard, reshuffleIfNeeded, advanceTurn } = require('./engine/stateManager');
const { calculateScore } = require('./engine/scoring');

class UnoGame {
  constructor(variant, playerIds, rules={}) {
    this.variant = variant || VARIANTS.CLASSIC;
    this.playerIds = [...playerIds];
    this.rules = normalizeRules(rules);
    this.scores = {};
    this.round = 0;
    this.state = null;

    this.playerIds.forEach(pid => {
      this.scores[pid] = 0;
    });
  }

  startRound() {
    this.round++;
    const deck = buildDeck(this.variant);
    const hands = {};

    this.playerIds.forEach(pid => {
      hands[pid] = [];
    });

    for (let i = 0; i < 7; i++) {
      this.playerIds.forEach(pid => {
        hands[pid].push(deck.pop());
      });
    }

    const blockedStart = new Set(['wild4','wildDraw2','wildDrawColor','wildRevDraw4','wildDraw6','wildDraw10','wildColorRoulette']);
    let topCard = deck.pop();
    while (blockedStart.has(getType(topCard, true))) {
      deck.unshift(topCard);
      topCard = deck.pop();
    }

    this.state = {
      deck,
      drawPile: deck,
      hands,
      discardPile: [topCard],
      currentPlayer: this.playerIds[0],
      currentColor: getColor(topCard, true),
      direction: 1,
      isLight: true,
      pendingDraw: 0,
      pendingDrawType: null,
      pendingDrawSource: null,
      awaitingDrawDecisionFor: null,
      drawnPlayableCardId: null,
      phase: 'play',
      awaitingFrom: null,
      awaitingData: {},
      knockedOut: [],
      unoFlags: Object.fromEntries(this.playerIds.map(pid => [pid, false])),
      log: []
    };

    applyStartCard(this.state, this.playerIds);
    return this._ok('roundStart');
  }

  playCards(playerId, cardIds, chosenColor=null) {
    const res = applyPlay(this, playerId, cardIds, chosenColor);
    if (!res.ok) return this._err(res.error);

    // UNO flag reset
    if ((this.state.hands[playerId] || []).length === 1) {
      this.state.unoFlags[playerId] = false;
    }

    // Check for round end (player has no cards)
    if ((this.state.hands[playerId] || []).length === 0) {
      // Calculate score from all other hands
      const opponentHands = Object.entries(this.state.hands)
        .filter(([pid]) => pid !== playerId)
        .map(([_, hand]) => hand);
      const roundScore = calculateScore(opponentHands);
      this.scores[playerId] = (this.scores[playerId] || 0) + roundScore;
      this.state.lastRoundWinner = playerId;
      this.state.lastRoundScore = roundScore;
      // Check for 500+ points
      if (this.scores[playerId] >= (this.rules.targetScore || 500)) {
        this.state.gameOver = true;
        this.state.winner = playerId;
        return this._ok('gameOver', { winner: playerId, score: this.scores[playerId] });
      }
      // Otherwise, start next round
      this.startRound();
      return this._ok('roundEnd', { winner: playerId, score: this.scores[playerId], roundPoints: roundScore });
    }

    if (this._checkMercy()) return this._ok('mercyWin', { winner: this.state.winner });
    return this._ok(res.event || 'played');
  }

  drawCards(playerId) {
    const res = applyDraw(this, playerId);
    if (!res.ok) return this._err(res.error);
    if (this._checkMercy()) return this._ok('mercyWin', { winner: this.state.winner });
    return this._ok(res.event || 'drew', {
      drawn: res.drawn,
      canPlay: res.canPlay,
      forced: res.forced,
      knocked: res.knocked
    });
  }

  // Client still calls this. Wild colors are now explicit in playCards;
  // this is retained for backward compatibility.
  chooseColor(playerId, color) {
    const s = this.state;
    if (s.phase !== 'choose-color') return this._err('No pending color choice');
    if (s.awaitingFrom !== playerId) return this._err('Not your turn to choose');
    const valid = s.isLight ? LIGHT_COLORS : DARK_COLORS;
    if (!valid.includes(color)) return this._err('Invalid color');

    s.currentColor = color;
    s.phase = 'play';
    s.awaitingFrom = null;
    return this._ok('colorChosen');
  }

  chooseSwap() {
    return this._err('Swap is not available in this ruleset flow');
  }

  chooseRoulette() {
    return this._err('Roulette is not available in this ruleset flow');
  }

  pass(playerId) {
    const s = this.state;
    if (s.currentPlayer !== playerId) return this._err('Not your turn');
    if (s.awaitingDrawDecisionFor !== playerId) return this._err('Pass is only allowed after drawing a playable card');

    s.awaitingDrawDecisionFor = null;
    s.drawnPlayableCardId = null;
    // Passing after draw ends turn and moves to next player.
    advanceTurn(s, this.playerIds, { skips: 0 });
    return this._ok('passed');
  }

  callUno(playerId) {
    const hand = this.state.hands[playerId] || [];
    if (hand.length !== 1) return this._err('Need exactly 1 card');
    this.state.unoFlags[playerId] = true;
    return this._ok('unoCalled', { caller: playerId });
  }

  _checkMercy() {
    if (!this.rules.mercy) return false;
    const s = this.state;
    let newKO = false;
    for (const p of this.playerIds) {
      if (!s.knockedOut.includes(p) && s.hands[p].length >= 25) {
        s.knockedOut.push(p);
        s.hands[p].forEach(c => s.discardPile.unshift(c));
        s.hands[p] = [];
        newKO = true;
      }
    }
    if (newKO) {
      const alive = this.playerIds.filter(p => !s.knockedOut.includes(p));
      if (alive.length === 1) {
        this.endRound(alive[0]);
        return true;
      }
    }
    return false;
  }

  catchUno(callerId, targetId) {
    const s = this.state;
    if (!s.hands[targetId] || s.hands[targetId].length !== 1) return this._err('Target does not have 1 card');
    if (s.unoFlags[targetId]) return this._err('Target already called UNO');
    // Penalty: draw 4 cards for not saying UNO
    giveCards(s, targetId, 4);
    return this._ok('unoCaught', { caller: callerId, target: targetId });
  }

  challenge(challengerId, targetId) {
    const s = this.state;
    const top = s.discardPile[s.discardPile.length - 1];
    const t = getType(top, s.isLight);
    if (!['wild4','voldemort','wildDraw2','wildDrawColor'].includes(t)) return this._err('Top card is not challengeable');
    if (!s.pendingDraw) return this._err('No active draw penalty to challenge');

    const expected = s.awaitingData.challengeTarget;
    if (!expected) return this._err('No active challenge target');
    if (targetId && targetId !== expected) return this._err('Invalid challenge target');

    const prevColor = s.awaitingData.prevColor || s.currentColor;
    const hadColor = (s.hands[expected] || []).some(c => getColor(c, s.isLight) === prevColor);

    if (hadColor) {
      const penalty = s.pendingDraw;
      giveCards(s, expected, penalty);
      s.pendingDraw = 0;
      s.pendingDrawType = null;
      s.pendingDrawSource = null;
      s.awaitingData = {};
      // Challenger keeps turn.
      s.currentPlayer = challengerId;
      return this._ok('challengeResult', { guilty: true, target: expected, drew: penalty });
    }

    const penalty = s.pendingDraw + 2;
    giveCards(s, challengerId, penalty);
    s.pendingDraw = 0;
    s.pendingDrawType = null;
    s.pendingDrawSource = null;
    s.awaitingData = {};
    // Failed challenge: challenger loses turn; move to next player once.
    advanceTurn(s, this.playerIds, { skips: 0 });
    if (this._checkMercy()) return this._ok('mercyWin', { winner: this.state.winner });
    return this._ok('challengeResult', { guilty: false, challenger: challengerId, drew: penalty });
  }

  nextRound() {
    return this.startRound();
  }

  endRound(winnerId) {
    const s = this.state;
    s.phase = 'end';

    let points = 0;
    this.playerIds.forEach(pid => {
      if (pid === winnerId) return;
      (s.hands[pid] || []).forEach(card => {
        points += cardPoints(card, s.isLight);
      });
    });

    this.scores[winnerId] = (this.scores[winnerId] || 0) + points;
    const winLimit = this.variant === VARIANTS.MERCY ? 1000 : 500;
    const gameWon = this.scores[winnerId] >= winLimit;

    return this._ok('roundEnd', {
      winner: winnerId,
      roundPoints: points,
      scores: { ...this.scores },
      gameWon,
      winLimit
    });
  }

  _ok(event, extra={}) {
    return { ok:true, event, ...extra, state: this._fullState() };
  }

  _err(error) {
    return { ok:false, error };
  }

  _fullState() {
    const s = this.state;
    return {
      variant: this.variant,
      round: this.round,
      scores: { ...this.scores },
      currentPlayer: s.currentPlayer,
      currentColor: s.currentColor,
      topCard: s.discardPile[s.discardPile.length - 1] || null,
      discardTop: s.discardPile[s.discardPile.length - 1] || null,
      direction: s.direction,
      isLight: s.isLight,
      pendingDraw: s.pendingDraw,
      pendingDrawType: s.pendingDrawType,
      pendingDrawSource: s.pendingDrawSource,
      awaitingDrawDecisionFor: s.awaitingDrawDecisionFor,
      drawnPlayableCardId: s.drawnPlayableCardId,
      knockedOut: [...s.knockedOut],
      unoFlags: { ...s.unoFlags },
      phase: s.phase,
      awaitingFrom: s.awaitingFrom,
      deckCount: s.deck.length,
      hands: s.hands,
      playerIds: this.playerIds,
      rules: this.rules,
      drawPile: s.deck,
      discardPile: s.discardPile,
      log: s.log.slice(-5)
    };
  }

  playerView(playerId) {
    const full = this._fullState();
    const view = { ...full, hands: {}, handCounts: {} };

    this.playerIds.forEach(pid => {
      const hand = full.hands[pid] || [];
      view.handCounts[pid] = hand.length;
      view.hands[pid] = pid === playerId ? hand : hand.map(() => ({ hidden:true }));
    });

    return view;
  }
}

module.exports = {
  UnoGame,
  VARIANTS,
  LIGHT_COLORS,
  DARK_COLORS,
  HP_HARRY_NUMS,
  getType,
  getColor,
  getValue,
  getSide,
  validateMove,
  buildDeck,
  reshuffleIfNeeded
};