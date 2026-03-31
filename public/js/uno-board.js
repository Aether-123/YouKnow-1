// uno-board.js — High-performance UNO board renderer with 8-player polar layout
'use strict';

// ── Score Modal ───────────────────────────────────────────────────────────────
function renderScoreModal(scores, players, winnerId) {
  let modal = document.getElementById('score-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'score-modal';
    modal.innerHTML = `<div class="score-header">Scores <span id="score-collapse">⮟</span></div><div class="score-list"></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#score-collapse').onclick = () => modal.classList.toggle('collapsed');
  }
  const list = modal.querySelector('.score-list');
  list.innerHTML = '';
  players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'score-row' + (winnerId && p.id === winnerId ? ' winner' : '');
    row.innerHTML = `<span class="score-name">${p.name || p.id}</span><span class="score-val">${scores[p.id] || 0}</span>`;
    list.appendChild(row);
  });
}

// ── Card Art Helper ───────────────────────────────────────────────────────────
const CARD_ART_PATH = '/cards/classic/fronts/';
const CARD_MANIFEST = {
  red_0:'red_0.svg', red_1:['red_1_1.svg','red_1_2.svg'], red_2:['red_2_1.svg','red_2_2.svg'],
  red_3:['red_3_1.svg','red_3_2.svg'], red_4:['red_4_1.svg','red_4_2.svg'], red_5:['red_5_1.svg','red_5_2.svg'],
  red_6:['red_6_1.svg','red_6_2.svg'], red_7:['red_7_1.svg','red_7_2.svg'], red_8:['red_8_1.svg','red_8_2.svg'],
  red_9:['red_9_1.svg','red_9_2.svg'], red_skip:['red_skip_1.svg','red_skip_2.svg'],
  red_reverse:['red_reverse_1.svg','red_reverse_2.svg'], red_draw2:['red_draw2_1.svg','red_draw2_2.svg'],
  yellow_0:'yellow_0.svg', yellow_1:['yellow_1_1.svg','yellow_1_2.svg'], yellow_2:['yellow_2_1.svg','yellow_2_2.svg'],
  yellow_3:['yellow_3_1.svg','yellow_3_2.svg'], yellow_4:['yellow_4_1.svg','yellow_4_2.svg'], yellow_5:['yellow_5_1.svg','yellow_5_2.svg'],
  yellow_6:['yellow_6_1.svg','yellow_6_2.svg'], yellow_7:['yellow_7_1.svg','yellow_7_2.svg'], yellow_8:['yellow_8_1.svg','yellow_8_2.svg'],
  yellow_9:['yellow_9_1.svg','yellow_9_2.svg'], yellow_skip:['yellow_skip_1.svg','yellow_skip_2.svg'],
  yellow_reverse:['yellow_reverse_1.svg','yellow_reverse_2.svg'], yellow_draw2:['yellow_draw2_1.svg','yellow_draw2_2.svg'],
  green_0:'green_0.svg', green_1:['green_1_1.svg','green_1_2.svg'], green_2:['green_2_1.svg','green_2_2.svg'],
  green_3:['green_3_1.svg','green_3_2.svg'], green_4:['green_4_1.svg','green_4_2.svg'], green_5:['green_5_1.svg','green_5_2.svg'],
  green_6:['green_6_1.svg','green_6_2.svg'], green_7:['green_7_1.svg','green_7_2.svg'], green_8:['green_8_1.svg','green_8_2.svg'],
  green_9:['green_9_1.svg','green_9_2.svg'], green_skip:['green_skip_1.svg','green_skip_2.svg'],
  green_reverse:['green_reverse_1.svg','green_reverse_2.svg'], green_draw2:['green_draw2_1.svg','green_draw2_2.svg'],
  blue_0:'blue_0.svg', blue_1:['blue_1_1.svg','blue_1_2.svg'], blue_2:['blue_2_1.svg','blue_2_2.svg'],
  blue_3:['blue_3_1.svg','blue_3_2.svg'], blue_4:['blue_4_1.svg','blue_4_2.svg'], blue_5:['blue_5_1.svg','blue_5_2.svg'],
  blue_6:['blue_6_1.svg','blue_6_2.svg'], blue_7:['blue_7_1.svg','blue_7_2.svg'], blue_8:['blue_8_1.svg','blue_8_2.svg'],
  blue_9:['blue_9_1.svg','blue_9_2.svg'], blue_skip:['blue_skip_1.svg','blue_skip_2.svg'],
  blue_reverse:['blue_reverse_1.svg','blue_reverse_2.svg'], blue_draw2:['blue_draw2_1.svg','blue_draw2_2.svg'],
  wild_wild:['wild_1.svg','wild_2.svg','wild_3.svg','wild_4.svg'],
  wild_draw4:['wild_draw4_1.svg','wild_draw4_2.svg','wild_draw4_3.svg','wild_draw4_4.svg'],
  back:'../back/card_back.svg'
};

function getCardArtFilename(card, idx, gameState) {
  if (!gameState.variant || gameState.variant === 'classic') {
    if (card.back) return CARD_ART_PATH + CARD_MANIFEST['back'];
    let key = card.color + '_';
    if (card.type === 'number') key += card.value;
    else if (card.type === 'draw2' || card.type === '+2') key += 'draw2';
    else if (card.type === 'skip') key += 'skip';
    else if (card.type === 'reverse') key += 'reverse';
    else if (card.type === 'wild') key = 'wild_wild';
    else if (card.type === 'wild4' || card.type === 'wild_draw4') key = 'wild_draw4';
    else key += (card.type || card.value || 'unknown');
    const entry = CARD_MANIFEST[key];
    if (Array.isArray(entry)) return CARD_ART_PATH + entry[(idx || 0) % entry.length];
    return CARD_ART_PATH + (entry || CARD_MANIFEST['back']);
  }
  return typeof CR !== 'undefined' ? CR.getDataURL(card, gameState.isLight, gameState.variant, !card.back) : '';
}

// ── Polar Seat Position Calculator ────────────────────────────────────────────
// Returns {x, y, angle(deg)} for each player seat around an oval.
// Player 0 (me) is always at the bottom center.
function getSeatPos(seatIdx, totalSeats) {
  // Distribute seats evenly around an ellipse. Seat 0 = bottom (6 o'clock = 90°)
  const startAngle = Math.PI / 2; // 90deg = bottom
  const angleDeg = (seatIdx / totalSeats) * 360;
  const angleRad = startAngle + (seatIdx / totalSeats) * 2 * Math.PI;
  // Oval radii as % of viewport area - responsive via CSS variables
  const rx = 42; // horizontal % of world width
  const ry = 36; // vertical % of world height
  const x = 50 + rx * Math.cos(angleRad);   // % from left
  const y = 50 + ry * Math.sin(angleRad);   // % from top
  // Rotation: cards face inward toward center
  const rot = angleDeg; // pointing out means card top aims outward
  return { x, y, rot: angleDeg + 180 }; // +180 to flip inward
}

// ── DOM Bootstrapper: only runs ONCE ─────────────────────────────────────────
function ensureWorldDOM(world) {
  if (world.dataset.initialized) return;
  world.dataset.initialized = '1';
  world.innerHTML = `
    <div class="uno-table">
      <div class="table-underside"></div>
      <div class="table-felt-ring"></div>
      <div class="table-felt">
        <div class="table-watermark">UNO</div>
        <div class="table-arrow" id="board-direction-arrow">↻</div>
        <div class="discard-pile"><div class="pile-label">DISCARD</div><div class="discard-stack"></div></div>
        <div class="draw-pile"><div class="pile-label">DRAW</div><div class="draw-stack"></div></div>
      </div>
      <div class="table-leg leg1"></div>
      <div class="table-leg leg2"></div>
      <div class="table-leg leg3"></div>
      <div class="table-leg leg4"></div>
    </div>
    <div class="player-hands" id="board-player-hands"></div>
    <div class="hud-pill hud-turn" id="board-hud-turn"></div>
    <div class="hud-pill hud-timer" id="board-hud-timer"></div>
    <div class="hud-pill hud-wild-color" id="wild-color-pill" style="display:none"></div>
    <button class="uno-btn board-uno-btn" id="board-uno-btn" style="display:none"></button>
    <button class="draw-btn board-draw-btn" id="board-draw-btn" style="display:none"></button>
  `;
}

// ── Main Render Function ──────────────────────────────────────────────────────
window.renderUnoBoard = function(gameState, roomData, myId) {
  const CHEX = {red:'#E53935',blue:'#1565C0',green:'#2E7D32',yellow:'#F9A825',
                pink:'#C2185B',teal:'#00695C',orange:'#E64A19',purple:'#6A1B9A'};

  // Preload images for non-classic variants
  if (gameState.variant && gameState.variant !== 'classic' && !window._crPreloaded) {
    if (typeof CR !== 'undefined') {
      CR.preloadImages().then(() => {
        window._crPreloaded = true;
        if (CR.clearCache) CR.clearCache();
        window.renderUnoBoard(gameState, roomData, myId);
      });
    }
    return;
  }

  // Expose card art fn globally for hand renderer
  window.getUnoCardArt = (card, idx) => getCardArtFilename(card, idx, gameState);

  // Sound assets
  if (!window._unoSoundsLoaded) {
    window._unoSoundsLoaded = true;
    window._unoSoundUNO = new Audio('/sounds/uno.mp3');
    window._unoSoundCaught = new Audio('/sounds/caught.mp3');
  }

  const world = document.getElementById('uno-world');
  if (!world) return;

  // Bootstrap DOM structure once
  ensureWorldDOM(world);

  // ── Selection state ────────────────────────────────────────────────────────
  if (!window._unoBoardSelectedIds) window._unoBoardSelectedIds = [];
  const selectedIds = window._unoBoardSelectedIds;
  const prevState = window._unoBoardPrevState;

  // ── Direction Arrow ────────────────────────────────────────────────────────
  const arrowEl = document.getElementById('board-direction-arrow');
  if (arrowEl) arrowEl.textContent = (gameState.direction === -1) ? '↺' : '↻';

  // ── Wild Color Pill ────────────────────────────────────────────────────────
  const wildColorPill = document.getElementById('wild-color-pill');
  const discards = gameState.discardPile || [];
  const lastCard = discards[discards.length - 1];
  const wildTypes = ['wild','wild4','voldemort','wildDraw2','wildDrawColor','wildRevDraw4','wildDraw6','wildDraw10','wildColorRoulette'];
  if (lastCard && wildTypes.includes(lastCard.type) && gameState.currentColor) {
    wildColorPill.style.display = '';
    wildColorPill.textContent = `Color: ${gameState.currentColor.toUpperCase()}`;
    wildColorPill.style.background = CHEX[gameState.currentColor] || '#555';
    wildColorPill.style.color = '#fff';
    wildColorPill.style.fontWeight = 'bold';
    wildColorPill.style.boxShadow = `0 0 14px 3px ${CHEX[gameState.currentColor] || '#555'}88`;
  } else {
    wildColorPill.style.display = 'none';
  }

  // ── Player Hands (Polar Layout) ────────────────────────────────────────────
  const handsDiv = document.getElementById('board-player-hands');
  const players = roomData?.players || [];
  const isSpectator = !players.find(p => p.id === myId);
  const myIndex = players.findIndex(p => p.id === myId);
  // Seat zero = me, others in clockwise order
  const seatOrder = [];
  const base = myIndex >= 0 ? myIndex : 0;
  for (let i = 0; i < players.length; i++) seatOrder.push(players[(base + i) % players.length]);

  const totalSeats = seatOrder.length;

  // Build per-player hand sections using data-pid to avoid full rebuilds
  seatOrder.forEach((p, seatIdx) => {
    const hand = (gameState.hands && gameState.hands[p.id]) || [];
    const isMe = p.id === myId;
    const isCurrentPlayer = gameState.currentPlayer === p.id;
    const isDisconnected = !p.connected;

    const pid = `board-hand-${p.id.replace(/[^a-z0-9_-]/gi, '_')}`;
    let handDiv = document.getElementById(pid);
    if (!handDiv) {
      handDiv = document.createElement('div');
      handDiv.id = pid;
      handDiv.className = 'board-hand-zone';
      handsDiv.appendChild(handDiv);
    }

    // Position via polar coordinates
    const { x, y, rot } = getSeatPos(seatIdx, totalSeats);
    handDiv.style.left = x + '%';
    handDiv.style.top = y + '%';
    handDiv.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    handDiv.style.position = 'absolute';
    handDiv.style.display = 'flex';
    handDiv.style.flexDirection = 'row';
    handDiv.style.alignItems = 'center';
    handDiv.style.gap = isMe ? '3px' : '1px';
    handDiv.style.zIndex = isMe ? '200' : '100';  
    handDiv.style.pointerEvents = isMe ? 'auto' : 'none';
    handDiv.style.filter = isDisconnected ? 'grayscale(1) opacity(0.5)' : '';

    // For non-ME players: just show card-back count badges (fast render)
    if (!isMe) {
      // Opponent card backs - compact stack view
      handDiv.innerHTML = '';
      const countBadge = document.createElement('div');
      countBadge.className = 'opp-hand-badge' + (isCurrentPlayer ? ' opp-active' : '');
      const cardCount = hand.length || (gameState.handCounts?.[p.id] ?? 0);
      
      // Show a max of 8 mini card backs visually, then a count
      const visibleCount = Math.min(cardCount, 6);
      let backsHTML = '';
      for (let i = 0; i < visibleCount; i++) {
        const offset = i * 4;
        backsHTML += `<div class="mini-card-back" style="margin-left:${i > 0 ? '-10px' : '0'};z-index:${i}"></div>`;
      }
      countBadge.innerHTML = `
        <div class="opp-name-label${isCurrentPlayer ? ' active' : ''}">${p.name || 'P'+(seatIdx+1)}${isDisconnected ? ' ⚡' : ''}${isCurrentPlayer ? ' •' : ''}</div>
        <div class="opp-card-stack">${backsHTML}</div>
        <div class="opp-count-label">${cardCount} card${cardCount !== 1 ? 's' : ''}</div>
      `;
      handDiv.appendChild(countBadge);
      return;
    }

    // ── MY seat: just show a "You" label badge on the board; real cards are in #hand-scroll
    if (isMe) {
      handDiv.innerHTML = '';
      const myCardCount = hand.filter(c => !c.hidden).length;
      const badge = document.createElement('div');
      badge.className = 'opp-hand-badge' + (isCurrentPlayer ? ' opp-active' : '');
      badge.innerHTML = `
        <div class="opp-name-label${isCurrentPlayer ? ' active' : ''}">You ${isCurrentPlayer ? '• Your Turn' : ''}</div>
        <div class="opp-count-label">${myCardCount} card${myCardCount !== 1 ? 's' : ''}</div>
      `;
      handDiv.appendChild(badge);
      // Position my badge at the bottom
      handDiv.style.transform = 'translate(-50%, -50%)';
      handDiv.style.pointerEvents = 'none';
      return;
  });



  // Remove any stale player hand zones for players who left
  const allHandZones = handsDiv.querySelectorAll('.board-hand-zone');
  allHandZones.forEach(zone => {
    const zonePid = zone.id.replace('board-hand-', '');
    const stillHere = seatOrder.some(p => `board-hand-${p.id.replace(/[^a-z0-9_-]/gi, '_')}` === zone.id);
    if (!stillHere) zone.remove();
  });

  // ── Multi-play floating button ─────────────────────────────────────────────
  let playBtn = document.getElementById('multi-play-btn');
  if (!playBtn) {
    playBtn = document.createElement('button');
    playBtn.id = 'multi-play-btn';
    playBtn.className = 'uno-btn';
    playBtn.style.cssText = 'position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:350;display:none;';
    world.appendChild(playBtn);
  }
  if (gameState.rules?.multiPlay && selectedIds.length > 0 && gameState.currentPlayer === myId && gameState.phase === 'play') {
    playBtn.style.display = '';
    playBtn.textContent = selectedIds.length === 1 ? '▶ Play card' : `▶ Play ${selectedIds.length} cards`;
    playBtn.onclick = () => {
      if (window.submitPlay) window.submitPlay([...selectedIds], null, gameState, gameState.variant || 'classic');
      selectedIds.length = 0;
      window.renderUnoBoard(gameState, roomData, myId);
    };
  } else {
    playBtn.style.display = 'none';
  }

  // ── Draw Pile ─────────────────────────────────────────────────────────────
  const ds = world.querySelector('.draw-stack');
  if (ds) {
    const drawCount = gameState.drawPileCount || (gameState.drawPile ? gameState.drawPile.length : 8);
    const shownCount = Math.min(drawCount, 5); // Visual only: 5 cards max
    ds.innerHTML = '';
    for (let i = 0; i < shownCount; i++) {
      const el = document.createElement('div');
      el.className = 'uno-card flipped';
      el.style.transform = `translateZ(${i * 1.5}px) rotateZ(${(i % 3 - 1) * 1.2}deg)`;
      const img = document.createElement('img');
      img.src = getCardArtFilename({ back: true }, 0, gameState);
      img.style.cssText = 'width:100%;height:100%;display:block;';
      img.draggable = false;
      el.appendChild(img);
      if (i === shownCount - 1 && gameState.currentPlayer === myId && gameState.phase === 'play') {
        el.style.cursor = 'pointer';
        el.addEventListener('pointerup', () => { if (window.requestDrawFromStack) window.requestDrawFromStack(); });
      }
      ds.appendChild(el);
    }
  }

  // ── Discard Pile ──────────────────────────────────────────────────────────
  const dcs = world.querySelector('.discard-stack');
  if (dcs) {
    const prevDiscardIds = prevState?.discardPile?.map(c => c.id) || [];
    dcs.innerHTML = '';
    discards.slice(-4).forEach((card, i, arr) => {
      const el = document.createElement('div');
      el.className = 'uno-card faceup';
      const jitter = ((card.id || i) % 7 - 3) * 1.8;
      el.style.transform = `translateZ(${i * 1.5}px) rotateZ(${jitter}deg)`;
      const img = document.createElement('img');
      img.src = getCardArtFilename(card, card.id || i, gameState);
      img.style.cssText = 'width:100%;height:100%;display:block;';
      img.draggable = false;
      el.appendChild(img);
      if (!prevDiscardIds.includes(card.id) && i === arr.length - 1) {
        el.classList.add('animated-play');
      }
      dcs.appendChild(el);
    });
  }

  // ── HUD Updates ───────────────────────────────────────────────────────────
  const hudTurn = document.getElementById('board-hud-turn');
  const current = players.find(p => p.id === gameState.currentPlayer);
  if (hudTurn) hudTurn.textContent = current ? (current.id === myId ? '✦ Your Turn' : `✦ ${current.name}'s Turn`) : '';

  const timer = document.getElementById('board-hud-timer');
  const t = gameState.timer || 20;
  if (timer) {
    timer.textContent = t + 's';
    timer.style.color = t <= 5 ? '#E24B4A' : t <= 10 ? '#EF9F27' : '#FCDE5A';
    timer.style.borderColor = timer.style.color;
  }

  // ── UNO Button ────────────────────────────────────────────────────────────
  const unoBtn = document.getElementById('board-uno-btn');
  const myHand = (gameState.hands && gameState.hands[myId]) || [];
  const unoNeeded = gameState.currentPlayer === myId && myHand.length <= 2 && !(gameState.unoFlags?.[myId]);
  if (unoBtn) {
    unoBtn.style.display = unoNeeded && !isSpectator ? '' : 'none';
    unoBtn.textContent = '🃏 UNO!';
    unoBtn.onclick = unoNeeded ? () => {
      if (window.emit) window.emit('callUno', { actingAs: myId });
      unoBtn.classList.add('animated-uno');
      if (window._unoSoundUNO) { window._unoSoundUNO.currentTime = 0; window._unoSoundUNO.play().catch(() => {}); }
      setTimeout(() => unoBtn.classList.remove('animated-uno'), 1200);
    } : null;
  }

  // ── Draw Button ───────────────────────────────────────────────────────────
  const drawBtn = document.getElementById('board-draw-btn');
  const myTurnNow = gameState.currentPlayer === myId && gameState.phase === 'play';
  if (drawBtn && !isSpectator) {
    drawBtn.style.display = '';
    if (window.canPlayDrawn) {
      drawBtn.innerHTML = '<span>↷</span> Pass';
    } else if (gameState.pendingDraw > 0) {
      drawBtn.innerHTML = `<span>🂠</span> Draw +${gameState.pendingDraw}`;
    } else {
      drawBtn.innerHTML = '<span>🂠</span> Draw';
    }
    drawBtn.disabled = !myTurnNow;
    drawBtn.classList.toggle('disabled', !myTurnNow);
    drawBtn.onclick = myTurnNow ? () => { if (window.requestDrawFromStack) window.requestDrawFromStack(); } : null;
  } else if (drawBtn) {
    drawBtn.style.display = 'none';
  }

  // ── Score modal ───────────────────────────────────────────────────────────
  if (roomData?.scores && roomData?.players) {
    renderScoreModal(roomData.scores, roomData.players, gameState.winner);
  }

  // ── Caught-You buttons ────────────────────────────────────────────────────
  let caughtDiv = document.getElementById('board-caught-div');
  if (!caughtDiv) {
    caughtDiv = document.createElement('div');
    caughtDiv.id = 'board-caught-div';
    caughtDiv.style.cssText = 'position:absolute;left:50%;bottom:90px;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;z-index:400;';
    world.appendChild(caughtDiv);
  }
  if (gameState.phase === 'play' && !isSpectator) {
    caughtDiv.innerHTML = '';
    players.forEach(p => {
      if (p.id !== myId) {
        const cnt = gameState.handCounts?.[p.id] ?? (gameState.hands?.[p.id]?.length ?? 0);
        const flagged = !(gameState.unoFlags?.[p.id]);
        if (cnt === 1 && flagged) {
          const btn = document.createElement('button');
          btn.className = 'caught-btn';
          btn.textContent = `Caught ${p.name || 'Player'}!`;
          btn.addEventListener('pointerup', () => {
            if (window.emit) window.emit('catchUno', { targetId: p.id, actingAs: myId });
            btn.classList.add('animated-caught');
            if (window._unoSoundCaught) { window._unoSoundCaught.currentTime = 0; window._unoSoundCaught.play().catch(() => {}); }
            setTimeout(() => btn.classList.remove('animated-caught'), 1200);
          });
          caughtDiv.appendChild(btn);
        }
      }
    });
  } else {
    if (caughtDiv) caughtDiv.innerHTML = '';
  }

  // ── Spectator banner ──────────────────────────────────────────────────────
  let specBanner = document.getElementById('spectator-banner');
  if (isSpectator) {
    if (!specBanner) {
      specBanner = document.createElement('div');
      specBanner.id = 'spectator-banner';
      specBanner.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#FFD700;padding:6px 18px;border-radius:20px;font-size:13px;font-weight:700;letter-spacing:1px;z-index:500;';
      specBanner.textContent = '👁 Spectating';
      world.appendChild(specBanner);
    }
  } else {
    if (specBanner) specBanner.remove();
  }

  // Save previous state for animation diffing
  window._unoBoardPrevState = { hands: JSON.parse(JSON.stringify(gameState.hands || {})), discardPile: (gameState.discardPile || []).map(c => ({ id: c.id })) };
};
