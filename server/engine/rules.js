'use strict';

const VARIANTS = { CLASSIC:'classic', HP:'hp', FLIP:'flip', MERCY:'mercy' };
const LIGHT_COLORS = ['red','blue','green','yellow'];
const DARK_COLORS  = ['pink','teal','orange','purple'];
const HP_HARRY_NUMS = new Set([2,6,9]);

function getSide(card, isLight) {
  if (card.variant === VARIANTS.FLIP) return isLight ? card.light : card.dark;
  return card;
}

function getType(card, isLight=true) {
  return getSide(card, isLight).type;
}

function getColor(card, isLight=true) {
  return getSide(card, isLight).color;
}

function getValue(card, isLight=true) {
  return getSide(card, isLight).value || 0;
}

function cardPoints(card, isLight=true) {
  const t = getType(card, isLight);
  if (t === 'number') return getValue(card, isLight);
  const pts = {
    draw2:20, reverse:20, skip:20, wild:50, wild4:50,
    voldemort:50,
    draw1:10, flip:20, wildDraw2:50,
    draw5:20, skipAll:30, wildDrawColor:60,
    draw4:20, discardAll:20, skipEveryone:20,
    wildRevDraw4:50, wildDraw6:50, wildDraw10:50, wildColorRoulette:50
  };
  return pts[t] || 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(variant) {
  let id = 0;
  const mk = (type, color, value, extra={}) => ({ id: id++, type, color, value, variant, ...extra });

  if (variant === VARIANTS.CLASSIC) {
    const cards = [];
    LIGHT_COLORS.forEach(c => {
      cards.push(mk('number', c, 0));
      for (let n = 1; n <= 9; n++) {
        cards.push(mk('number', c, n));
        cards.push(mk('number', c, n));
      }
      for (let i = 0; i < 2; i++) {
        cards.push(mk('draw2', c, 20));
        cards.push(mk('reverse', c, 20));
        cards.push(mk('skip', c, 20));
      }
    });
    for (let i = 0; i < 4; i++) {
      cards.push(mk('wild', 'wild', 50));
      cards.push(mk('wild4', 'wild', 50));
    }
    return shuffle(cards);
  }

  if (variant === VARIANTS.HP) {
    const cards = [];
    LIGHT_COLORS.forEach(c => {
      cards.push(mk('number', c, 0, { isHarry: HP_HARRY_NUMS.has(0) }));
      for (let n = 1; n <= 9; n++) {
        const h = { isHarry: HP_HARRY_NUMS.has(n) };
        cards.push(mk('number', c, n, h));
        cards.push(mk('number', c, n, h));
      }
      for (let i = 0; i < 2; i++) {
        cards.push(mk('draw2', c, 20));
        cards.push(mk('reverse', c, 20));
        cards.push(mk('skip', c, 20));
      }
    });
    for (let i = 0; i < 4; i++) {
      cards.push(mk('wild', 'wild', 50));
      cards.push(mk('wild4', 'wild', 50));
      cards.push(mk('voldemort', 'wild', 50));
    }
    return shuffle(cards);
  }

  if (variant === VARIANTS.FLIP) {
    const light = [];
    const dark = [];

    LIGHT_COLORS.forEach(c => {
      for (let n = 1; n <= 9; n++) {
        light.push({ type:'number', color:c, value:n });
        light.push({ type:'number', color:c, value:n });
      }
      for (let i = 0; i < 2; i++) {
        light.push({ type:'draw1', color:c, value:10 });
        light.push({ type:'reverse', color:c, value:20 });
        light.push({ type:'skip', color:c, value:20 });
        light.push({ type:'flip', color:c, value:20 });
      }
    });

    for (let i = 0; i < 4; i++) {
      light.push({ type:'wild', color:'wild', value:40 });
      light.push({ type:'wildDraw2', color:'wild', value:50 });
    }

    DARK_COLORS.forEach(c => {
      for (let n = 1; n <= 9; n++) {
        dark.push({ type:'number', color:c, value:n });
        dark.push({ type:'number', color:c, value:n });
      }
      for (let i = 0; i < 2; i++) {
        dark.push({ type:'draw5', color:c, value:20 });
        dark.push({ type:'reverse', color:c, value:20 });
        dark.push({ type:'skipAll', color:c, value:30 });
        dark.push({ type:'flip', color:c, value:20 });
      }
    });

    for (let i = 0; i < 4; i++) {
      dark.push({ type:'wild', color:'wild', value:40 });
      dark.push({ type:'wildDrawColor', color:'wild', value:60 });
    }

    const cards = [];
    const n = Math.min(light.length, dark.length);
    for (let i = 0; i < n; i++) {
      cards.push({ id: id++, variant: VARIANTS.FLIP, light: light[i], dark: dark[i] });
    }
    return shuffle(cards);
  }

  if (variant === VARIANTS.MERCY) {
    const cards = [];
    LIGHT_COLORS.forEach(c => {
      cards.push(mk('number', c, 0));
      for (let n = 1; n <= 9; n++) {
        cards.push(mk('number', c, n));
        cards.push(mk('number', c, n));
      }
      for (let i = 0; i < 3; i++) {
        cards.push(mk('draw2', c, 20));
        cards.push(mk('draw4', c, 20));
        cards.push(mk('skip', c, 20));
        cards.push(mk('reverse', c, 20));
        cards.push(mk('discardAll', c, 20));
        cards.push(mk('skipAll', c, 20));
      }
    });

    for (let i = 0; i < 4; i++) {
      cards.push(mk('wild', 'wild', 50));
      cards.push(mk('wildRevDraw4', 'wild', 50));
      cards.push(mk('wildDraw6', 'wild', 50));
      cards.push(mk('wildDraw10', 'wild', 50));
      cards.push(mk('wildColorRoulette', 'wild', 50));
    }
    return shuffle(cards);
  }

  throw new Error('Unknown variant: ' + variant);
}

function normalizeRules(input={}) {
  return {
    stacking: input.stacking ?? true,
    multiPlay: input.multiPlay ?? true,
    multiDraw: true, // House rule: draw until playable card is found
    allowVoluntaryDraw: false, // Always false unless explicitly enabled
    strictWild4: input.strictWild4 ?? true,
    allowStackMixing: input.allowStackMixing ?? false,
    mercy: input.mercy ?? true,
    sevensSwap: input.sevensSwap ?? false,
    zerosPass: input.zerosPass ?? false,
    houseRuleAllowSameColorMulti: true // Always enable house rule for same color multi-play
  };
}

module.exports = {
  VARIANTS,
  LIGHT_COLORS,
  DARK_COLORS,
  HP_HARRY_NUMS,
  getSide,
  getType,
  getColor,
  getValue,
  cardPoints,
  buildDeck,
  shuffle,
  normalizeRules
};