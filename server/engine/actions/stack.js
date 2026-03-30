'use strict';

const { validateMove } = require('../validator');

function validateStackMove(game, playerId, cardIds, chosenColor) {
  return validateMove(
    playerId,
    { type:'stack', cardIds, chosenColor },
    game.state,
    game.rules,
    { playerIds: game.playerIds, variant: game.variant }
  );
}

module.exports = { validateStackMove };