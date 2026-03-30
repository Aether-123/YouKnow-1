// Score Modal UI
function renderScoreModal(scores, players, winnerId = null) {
  let modal = document.getElementById('score-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'score-modal';
    modal.innerHTML = `<div class="score-header">Scores <span id="score-collapse">⮟</span></div><div class="score-list"></div>`;
    document.body.appendChild(modal);
    // Collapse/expand logic
    modal.querySelector('#score-collapse').onclick = () => {
      modal.classList.toggle('collapsed');
    };
  }
    // Tabs for each player
    const tabs = modal.querySelector('.score-tabs');
    tabs.innerHTML = '';
    players.forEach((p, idx) => {
      const tab = document.createElement('div');
      tab.className = 'score-tab';
      tab.textContent = p.name || `P${idx+1}`;
      tab.title = `Score: ${scores[p.id] || 0}`;
      tabs.appendChild(tab);
    });
    // Score list
    const list = modal.querySelector('.score-list');
  list.innerHTML = '';
  players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'score-row' + (winnerId && p.id === winnerId ? ' winner' : '');
    row.innerHTML = `<span class="score-name">${p.name || p.id}</span><span class="score-val">${scores[p.id] || 0}</span>`;
    list.appendChild(row);
  });
  if (winnerId) {
    const winMsg = document.createElement('div');
    winMsg.className = 'score-winner-msg';
    winMsg.textContent = `${players.find(p=>p.id===winnerId)?.name || winnerId} wins!`;
    list.appendChild(winMsg);
  }
}
// uno-board.js — Renders the UNO board scene and handles card hover/UNO button

// uno-board.js now only exports a renderUnoBoard function for dynamic game state rendering.
window.renderUnoBoard = function(gameState, roomData, myId) {
  // Sound assets (UNO and Caught You)
  if (!window._unoSoundsLoaded) {
    window._unoSoundsLoaded = true;
    window._unoSoundUNO = new Audio('/sounds/uno.mp3');
    window._unoSoundCaught = new Audio('/sounds/caught.mp3');
  }
  // Track previous game state for animation diffing
  if (!window._unoBoardPrevState) window._unoBoardPrevState = null;
  const prevState = window._unoBoardPrevState;
  // Track selected cards for multi-play (board-local, not global)
  if (!window._unoBoardSelectedIds) window._unoBoardSelectedIds = [];
  const selectedIds = window._unoBoardSelectedIds;
  const COLORS = {
    red:   '#E24B4A',
    blue:  '#2244cc',
    green: '#22aa44',
    yellow:'#EF9F27',
    wild:  '#13134a',
    black: '#13134a'
  };
  // Card art config
  const CARD_ART_PATH = '/cards/classic/fronts/';
  const CARD_MANIFEST = {
    // Red
    red_0: "red_0.svg",
    red_1: ["red_1_1.svg", "red_1_2.svg"],
    red_2: ["red_2_1.svg", "red_2_2.svg"],
    red_3: ["red_3_1.svg", "red_3_2.svg"],
    red_4: ["red_4_1.svg", "red_4_2.svg"],
    red_5: ["red_5_1.svg", "red_5_2.svg"],
    red_6: ["red_6_1.svg", "red_6_2.svg"],
    red_7: ["red_7_1.svg", "red_7_2.svg"],
    red_8: ["red_8_1.svg", "red_8_2.svg"],
    red_9: ["red_9_1.svg", "red_9_2.svg"],
    red_skip: ["red_skip_1.svg", "red_skip_2.svg"],
    red_reverse: ["red_reverse_1.svg", "red_reverse_2.svg"],
    red_draw2: ["red_draw2_1.svg", "red_draw2_2.svg"],
    // Yellow
    yellow_0: "yellow_0.svg",
    yellow_1: ["yellow_1_1.svg", "yellow_1_2.svg"],
    yellow_2: ["yellow_2_1.svg", "yellow_2_2.svg"],
    yellow_3: ["yellow_3_1.svg", "yellow_3_2.svg"],
    yellow_4: ["yellow_4_1.svg", "yellow_4_2.svg"],
    yellow_5: ["yellow_5_1.svg", "yellow_5_2.svg"],
    yellow_6: ["yellow_6_1.svg", "yellow_6_2.svg"],
    yellow_7: ["yellow_7_1.svg", "yellow_7_2.svg"],
    yellow_8: ["yellow_8_1.svg", "yellow_8_2.svg"],
    yellow_9: ["yellow_9_1.svg", "yellow_9_2.svg"],
    yellow_skip: ["yellow_skip_1.svg", "yellow_skip_2.svg"],
    yellow_reverse: ["yellow_reverse_1.svg", "yellow_reverse_2.svg"],
    yellow_draw2: ["yellow_draw2_1.svg", "yellow_draw2_2.svg"],
    // Green
    green_0: "green_0.svg",
    green_1: ["green_1_1.svg", "green_1_2.svg"],
    green_2: ["green_2_1.svg", "green_2_2.svg"],
    green_3: ["green_3_1.svg", "green_3_2.svg"],
    green_4: ["green_4_1.svg", "green_4_2.svg"],
    green_5: ["green_5_1.svg", "green_5_2.svg"],
    green_6: ["green_6_1.svg", "green_6_2.svg"],
    green_7: ["green_7_1.svg", "green_7_2.svg"],
    green_8: ["green_8_1.svg", "green_8_2.svg"],
    green_9: ["green_9_1.svg", "green_9_2.svg"],
    green_skip: ["green_skip_1.svg", "green_skip_2.svg"],
    green_reverse: ["green_reverse_1.svg", "green_reverse_2.svg"],
    green_draw2: ["green_draw2_1.svg", "green_draw2_2.svg"],
    // Blue
    blue_0: "blue_0.svg",
    blue_1: ["blue_1_1.svg", "blue_1_2.svg"],
    blue_2: ["blue_2_1.svg", "blue_2_2.svg"],
    blue_3: ["blue_3_1.svg", "blue_3_2.svg"],
    blue_4: ["blue_4_1.svg", "blue_4_2.svg"],
    blue_5: ["blue_5_1.svg", "blue_5_2.svg"],
    blue_6: ["blue_6_1.svg", "blue_6_2.svg"],
    blue_7: ["blue_7_1.svg", "blue_7_2.svg"],
    blue_8: ["blue_8_1.svg", "blue_8_2.svg"],
    blue_9: ["blue_9_1.svg", "blue_9_2.svg"],
    blue_skip: ["blue_skip_1.svg", "blue_skip_2.svg"],
    blue_reverse: ["blue_reverse_1.svg", "blue_reverse_2.svg"],
    blue_draw2: ["blue_draw2_1.svg", "blue_draw2_2.svg"],
    // Wilds
    wild_wild: ["wild_1.svg", "wild_2.svg", "wild_3.svg", "wild_4.svg"],
    wild_draw4: ["wild_draw4_1.svg", "wild_draw4_2.svg", "wild_draw4_3.svg", "wild_draw4_4.svg"],
    back: "../back/card_back.svg"
  };
  function getCardArtFilename(card, idx=0) {
    if (card.back) return CARD_MANIFEST['back'];
    let key = card.color + '_';
    if (card.type === 'number') key += card.value;
    else if (card.type === 'draw2' || card.type === '+2') key += 'draw2';
    else if (card.type === 'skip') key += 'skip';
    else if (card.type === 'reverse') key += 'reverse';
    else if (card.type === 'wild') key = 'wild_wild';
    else if (card.type === 'wild4') key = 'wild_draw4';
    else key += card.type || card.value || 'unknown';
    const entry = CARD_MANIFEST[key];
    if (Array.isArray(entry)) {
      // Use idx to pick which duplicate art to use (for now, just use i % n)
      return entry[idx % entry.length];
    }
    return entry || CARD_MANIFEST['back'];
  }
  function makeCard(card, opts={}) {
    const el = document.createElement('div');
    el.className = 'uno-card' + (opts.faceup ? ' faceup' : '') + (opts.flipped ? ' flipped' : '');
    el.style.transform = opts.transform || '';
    const img = document.createElement('img');
    img.draggable = false;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.display = 'block';
    img.src = CARD_ART_PATH + getCardArtFilename(card);
    el.appendChild(img);
    return el;
  }

  // Clear and build board
  const world = document.getElementById('uno-world');
  if (!world) return;
  // Table and piles
  world.innerHTML = `
    <div class="uno-table">
      <div class="table-underside"></div>
      <div class="table-felt-ring"></div>
      <div class="table-felt">
        <div class="table-watermark">UNO</div>
        <div class="table-arrow">↻</div>
        <div class="discard-pile"><div class="pile-label">DISCARD</div><div class="discard-stack"></div></div>
        <div class="draw-pile"><div class="pile-label">DRAW</div><div class="draw-stack"></div></div>
      </div>
      <div class="table-leg leg1"></div>
      <div class="table-leg leg2"></div>
      <div class="table-leg leg3"></div>
      <div class="table-leg leg4"></div>
    </div>
    <div class="player-hands"></div>
    <div class="hud-pill hud-turn"></div>
    <div class="hud-pill hud-timer"></div>
    <div class="hud-pill hud-hint">Hover your cards to lift them</div>
    <div class="hud-pill hud-wild-color" id="wild-color-pill" style="display:none"></div>
    <button class="uno-btn board-uno-btn" style="display:none; position:absolute; right:38px; bottom:38px;"></button>
    <button class="draw-btn board-draw-btn" style="display:none !important; position:absolute; left:38px; bottom:38px;"></button>
  `;

  // Player hands (all around the table)
  const handsDiv = world.querySelector('.player-hands');
  const players = roomData?.players || [];
  const myIndex = players.findIndex(p=>p.id===myId);
  // Arrange players: me at bottom, others clockwise
  const seatOrder = [];
  for(let i=0;i<players.length;i++) seatOrder.push(players[(myIndex+i)%players.length]);
  seatOrder.forEach((p, idx) => {
    const hand = (gameState.hands && gameState.hands[p.id]) || [];
    const isMe = p.id === myId;
    const handDiv = document.createElement('div');
    handDiv.className = 'hand-row';
    handDiv.style.position = 'absolute';
    // Positioning: bottom, top, left, right, then diagonals if >4
    if(idx===0) { handDiv.style.left='50%'; handDiv.style.top='calc(50% + 248px)'; handDiv.style.transform='translateX(-50%)'; handDiv.style.flexDirection='row'; }
    else if(idx===1) { handDiv.style.left='50%'; handDiv.style.top='calc(50% - 268px)'; handDiv.style.transform='translateX(-50%) rotateZ(180deg)'; handDiv.style.flexDirection='row'; }
    else if(idx===2) { handDiv.style.left='calc(50% - 286px)'; handDiv.style.top='50%'; handDiv.style.transform='translateY(-50%) rotateZ(90deg)'; handDiv.style.flexDirection='column'; }
    else if(idx===3) { handDiv.style.left='calc(50% + 250px)'; handDiv.style.top='50%'; handDiv.style.transform='translateY(-50%) rotateZ(-90deg)'; handDiv.style.flexDirection='column'; }
    else { handDiv.style.display='none'; }
    handDiv.style.gap = '8px';
    // Player label
    const label = document.createElement('div');
    label.textContent = p.name || `Player ${idx+1}`;
    label.style.fontSize = '12px';
    label.style.color = isMe ? '#fff' : '#FCDE5A';
    label.style.textAlign = 'center';
    label.style.marginBottom = '2px';
    handDiv.appendChild(label);
    // Cards
    // For animation: get previous hand for this player
    let prevHand = [];
    if (prevState && prevState.hands && prevState.hands[p.id]) {
      prevHand = prevState.hands[p.id].map(c => c.id);
    }
    hand.forEach((card, i) => {
      if(isMe && !card.hidden) {
        const el = makeCard(card, {faceup:true, transform:'translateZ(5px)'});
        // Add selection highlight if selected
        if (selectedIds.includes(card.id)) {
          el.classList.add('selected');
          el.style.boxShadow = '0 0 0 3px #FCDE5A, 0 2px 8px #0006';
        }
        // Animate draw: card is new in hand
        if (prevHand && !prevHand.includes(card.id)) {
          el.classList.add('animated-draw');
        }
        // Add click handler for multi-play selection or single play
        if (gameState.currentPlayer === myId && gameState.phase === 'play') {
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => {
            if (gameState.rules && gameState.rules.multiPlay) {
              const idx = selectedIds.indexOf(card.id);
              if (idx === -1) selectedIds.push(card.id); else selectedIds.splice(idx, 1);
              window.renderUnoBoard(gameState, roomData, myId); // re-render for highlight
            } else {
              selectedIds.length = 0;
              if (window.submitPlay) window.submitPlay([card.id], null, gameState, gameState.variant || 'classic');
            }
          });
        }
        handDiv.appendChild(el);
      } else {
        // For other players, show card back, but animate draw if new
        const el = makeCard({back:true},{flipped:true});
        if (prevHand && !prevHand.includes(card.id)) {
          el.classList.add('animated-draw');
        }
        handDiv.appendChild(el);
      }
    });
    handsDiv.appendChild(handDiv);
  });

  // Multi-play floating button (bottom center)
  let playBtn = document.getElementById('multi-play-btn');
  if (playBtn) playBtn.remove();
  if (gameState.rules && gameState.rules.multiPlay && selectedIds.length > 0 && gameState.currentPlayer === myId && gameState.phase === 'play') {
    playBtn = document.createElement('button');
    playBtn.id = 'multi-play-btn';
    playBtn.className = 'uno-btn';
    playBtn.style.position = 'absolute';
    playBtn.style.left = '50%';
    playBtn.style.bottom = '38px';
    playBtn.style.transform = 'translateX(-50%)';
    playBtn.style.zIndex = 350;
    playBtn.textContent = selectedIds.length === 1 ? '▶ Play card' : `▶ Play ${selectedIds.length} cards`;
    playBtn.onclick = () => {
      if (window.submitPlay) window.submitPlay([...selectedIds], null, gameState, gameState.variant || 'classic');
      selectedIds.length = 0;
      window.renderUnoBoard(gameState, roomData, myId);
    };
    world.appendChild(playBtn);
  }

  // Draw pile (center)
  const ds = world.querySelector('.draw-stack');
  const drawCount = gameState.drawPile ? gameState.drawPile.length : (gameState.drawPileCount || 8);
  for(let i=0;i<drawCount;i++) {
    const el = makeCard({back:true},{flipped:true});
    el.style.transform = `translateZ(${i*1.5}px) rotateZ(${(Math.random()-0.5)*2}deg)`;
    // Only top card is clickable for draw
    if (i === drawCount - 1 && gameState.currentPlayer === myId && gameState.phase === 'play') {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        if (window.requestDrawFromStack) window.requestDrawFromStack();
      });
    }
    ds.appendChild(el);
  }

  // Discard pile (center)
  const dcs = world.querySelector('.discard-stack');
  const discards = gameState.discardPile || [];
  // Animate play: highlight the most recent card(s) played
  const prevDiscards = prevState && prevState.discardPile ? prevState.discardPile.map(c=>c.id) : [];
  discards.slice(-3).forEach((card, i) => {
    const el = makeCard(card, {faceup:true});
    el.style.transform = `translateZ(${i*1.5}px) rotateZ(${(Math.random()-0.5)*18}deg)`;
    // If this card is new on the pile, animate play
    if (prevDiscards && !prevDiscards.includes(card.id) && i === discards.length-1-i) {
      el.classList.add('animated-play');
    }
    dcs.appendChild(el);
  });

  // HUD: turn indicator
  const hudTurn = world.querySelector('.hud-turn');
  const current = players.find(p=>p.id===gameState.currentPlayer);
  hudTurn.textContent = current ? (current.id===myId ? '✦ Your Turn' : `✦ ${current.name}'s Turn`) : '';

  // HUD: timer (simulate or use gameState.timer)
  const timer = world.querySelector('.hud-timer');
  let t = gameState.timer || 20;
  timer.textContent = t+'s';
  if(t<=5) timer.style.color = timer.style.borderColor = '#E24B4A';
  else if(t<=10) timer.style.color = timer.style.borderColor = '#EF9F27';
  else timer.style.color = timer.style.borderColor = '#FCDE5A';

  // UNO button (bottom right, on board)
    // Show chosen color after wild card
    const wildColorPill = world.querySelector('#wild-color-pill');
    const lastCard = discards[discards.length-1];
    const wildTypes = ['wild','wild4','wildDraw2','wildDrawColor','wildRevDraw4','wildDraw6','wildDraw10','wildColorRoulette'];
    if (lastCard && wildTypes.includes(lastCard.type) && gameState.currentColor) {
      wildColorPill.style.display = '';
      wildColorPill.textContent = `Wild Color: ${gameState.currentColor.toUpperCase()}`;
      wildColorPill.style.background = (CHEX && CHEX[gameState.currentColor]) || '#555';
      wildColorPill.style.color = '#fff';
      wildColorPill.style.fontWeight = 'bold';
      wildColorPill.style.boxShadow = `0 0 12px 2px ${(CHEX && CHEX[gameState.currentColor]) || '#555'}88`;
    } else {
      wildColorPill.style.display = 'none';
    }
  const unoBtn = world.querySelector('.board-uno-btn');
  const myHand = (gameState.hands && gameState.hands[myId]) || [];
  const unoNeeded = (gameState.currentPlayer === myId && myHand.length === 1 && !(gameState.unoFlags && gameState.unoFlags[myId]));
  unoBtn.style.display = unoNeeded ? '' : 'none';
  unoBtn.textContent = '🃏 UNO!';
  if (unoNeeded) {
    unoBtn.onclick = () => {
      if (window.emit) window.emit('callUno', { actingAs: myId });
      // Animate and play UNO sound
      unoBtn.classList.add('animated-uno');
      if (window._unoSoundUNO) { window._unoSoundUNO.currentTime = 0; window._unoSoundUNO.play(); }
      setTimeout(() => unoBtn.classList.remove('animated-uno'), 1200);
    };
  } else {
    unoBtn.onclick = null;
  }

  // Draw button (bottom left, always visible)
  const drawBtn = world.querySelector('.board-draw-btn');
  // Logic matches app.js refreshHUD
  const myTurn = gameState.currentPlayer === myId && gameState.phase === 'play';
  const hasPlayableInHand = myHand.some(c=>!c.hidden&&(
    (window.isPlayable ? window.isPlayable(c, gameState, gameState.variant || 'classic') : true)
  ));
  const canDrawNow = !!(gameState.pendingDraw>0 || window.canPlayDrawn || gameState.rules?.allowVoluntaryDraw || !hasPlayableInHand);
  drawBtn.style.display = '';
  if(window.canPlayDrawn){
    drawBtn.innerHTML = '<span>↷</span> Pass';
  } else if(gameState.pendingDraw>0){
    drawBtn.innerHTML = `<span>🂠</span> Draw +${gameState.pendingDraw}`;
  } else {
    drawBtn.innerHTML = '<span>🂠</span> Draw';
  }
  if (myTurn && canDrawNow) {
    drawBtn.disabled = false;
    drawBtn.classList.remove('disabled');
    drawBtn.onclick = () => {
      // Always call requestDrawFromStack, which emits the drawCards event
      if (window.requestDrawFromStack) window.requestDrawFromStack();
    };
  } else {
    drawBtn.disabled = true;
    drawBtn.classList.add('disabled');
    drawBtn.onclick = null;
  }

  // Caught You buttons for all other players (bottom center, stacked)
  let caughtBtns = document.querySelectorAll('.caught-btn');
  caughtBtns.forEach(btn => btn.remove());
  if (gameState.phase === 'play') {
    const caughtDiv = document.createElement('div');
    caughtDiv.style.position = 'absolute';
    caughtDiv.style.left = '50%';
    caughtDiv.style.bottom = '90px';
    caughtDiv.style.transform = 'translateX(-50%)';
    caughtDiv.style.display = 'flex';
    caughtDiv.style.flexDirection = 'column';
    caughtDiv.style.gap = '8px';
    const players = roomData?.players || [];
    players.forEach((p) => {
      if (p.id !== myId && p.id !== gameState.currentPlayer) {
        const btn = document.createElement('button');
        btn.className = 'caught-btn';
        btn.textContent = `Caught You (${p.name || 'Player'})`;
        btn.style.margin = '2px auto';
        btn.onclick = () => {
          if (window.emit) window.emit('caughtUno', { target: p.id, actingAs: myId });
          // Animate and play sound
          btn.classList.add('animated-caught');
          if (window._unoSoundCaught) { window._unoSoundCaught.currentTime = 0; window._unoSoundCaught.play(); }
          setTimeout(() => btn.classList.remove('animated-caught'), 1200);
        };
        caughtDiv.appendChild(btn);
      }
    });
    world.appendChild(caughtDiv);
  }
  // Score modal (top left)
  if (roomData && roomData.scores && roomData.players) {
    renderScoreModal(roomData.scores, roomData.players, gameState.winner);
  }
  // Save current state for next diff
  window._unoBoardPrevState = JSON.parse(JSON.stringify(gameState));
};
