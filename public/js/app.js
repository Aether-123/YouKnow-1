/* app.js — Main client: socket, UI, game flow */
(()=>{
'use strict';

// ── GLOBALS ────────────────────────────────────────────────────────────────
let socket, myId, roomCode, roomData, gameState;
let variant='classic', mode='online';
let ppSeat=0;        // Pass&Play: currently active seat
let selectedIds=[];  // Multi-play selection
let canPlayDrawn=null;
let sceneReady=false;
let suppressNextCardClick=false;

const VINFO={
  classic:{icon:'🃏',name:'Classic UNO',limit:500},
  hp:     {icon:'⚡',name:'Harry Potter UNO',limit:500},
  flip:   {icon:'⇅',name:'UNO Flip™',limit:500},
  mercy:  {icon:'💀',name:'Show \'Em No Mercy',limit:1000}
};
const CHEX={red:'#E53935',blue:'#1565C0',green:'#2E7D32',yellow:'#F9A825',
            pink:'#C2185B',teal:'#00695C',orange:'#E64A19',purple:'#6A1B9A'};

// ── DOM ────────────────────────────────────────────────────────────────────
const $ =id=>document.getElementById(id);
const qs=s=>document.querySelector(s);
const qsa=s=>document.querySelectorAll(s);
function show(el){if(typeof el==='string')el=$(el);if(el)el.classList.remove('hidden');}
function hide(el){if(typeof el==='string')el=$(el);if(el)el.classList.add('hidden');}
function showScreen(id){qsa('.screen').forEach(s=>s.classList.remove('active'));$(id)?.classList.add('active');}

// ── STATUS ────────────────────────────────────────────────────────────────
let statusTimer;
function setStatus(msg,cls='',ttl=5000){
  const el=$('status');
  el.textContent=msg; el.className='status '+(cls||'');
  clearTimeout(statusTimer);
  if(ttl<99999) statusTimer=setTimeout(()=>{el.textContent='';el.className='status';},ttl);
}

// ── SOCKET INIT ───────────────────────────────────────────────────────────
function connectSocket(){
  socket=io();
  socket.on('connect',()=>{ myId=socket.id; });
  socket.on('roomUpdate', onRoomUpdate);
  socket.on('gameEvent',  onGameEvent);
  socket.on('chat',       onChat);
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────
function initHome(){
  // Floating particles
  const p=$('particles');
  for(let i=0;i<45;i++){
    const d=document.createElement('div');
    const size=2+Math.random()*5;
    const col=Math.random()>.5?'255,63,87':'21,101,192';
    d.style.cssText=`position:absolute;width:${size}px;height:${size}px;border-radius:50%;
      background:rgba(${col},${.2+Math.random()*.5});
      left:${Math.random()*100}%;top:${Math.random()*100}%;
      animation:pfloat ${4+Math.random()*7}s ${Math.random()*5}s infinite alternate ease-in-out`;
    p.appendChild(d);
  }
  const sty=document.createElement('style');
  sty.textContent='@keyframes pfloat{from{transform:translateY(0)}to{transform:translateY(-24px)}}';
  document.head.appendChild(sty);

  qsa('.v-card').forEach(el=>{
    el.addEventListener('click',()=>{ variant=el.dataset.v; showSetup(); });
  });
}

// ── SETUP SCREEN ──────────────────────────────────────────────────────────
function showSetup(){
  const vi=VINFO[variant];
  $('setup-icon').textContent=vi.icon;
  $('setup-vtitle').textContent=vi.name;
  // Mercy-only rules
  ['mercy-row','sevens-row','zeros-row'].forEach(id=>{
    $(id).style.display=variant==='mercy'?'':'none';
  });
  showScreen('s-setup');
  setTimeout(()=>$('pname-input')?.focus(),180);
}

function getRules(){
  return {
    strictWild4: $('r-strict').checked,
    stacking:    $('r-stack').checked,
    multiPlay:   $('r-multi').checked,
    mercy:       $('r-mercy').checked,
    sevensSwap:  $('r-sevens').checked,
    zerosPass:   $('r-zeros').checked
  };
}

function setupPPPlayers(){
  const list=$('pp-list'); list.innerHTML='';
  ['Player 1','Player 2'].forEach((n,i)=>addPPRow(n,i===0));
}

function addPPRow(name='',first=false){
  const list=$('pp-list');
  const row=document.createElement('div'); row.className='pp-row';
  row.innerHTML=`<input class="s-input pp-name" placeholder="${name||'Player '+(list.children.length+1)}" value="${name}" maxlength="20">
    ${first?'':'<button class="pp-del" onclick="this.parentElement.remove()">✕</button>'}`;
  list.appendChild(row);
}

// ── LOBBY ─────────────────────────────────────────────────────────────────
function showLobby(code){
  roomCode=code;
  $('lcode').textContent=code;
  showScreen('s-lobby');
}

function onRoomUpdate(data){
  roomData=data;
  if(data.gameState) gameState=data.gameState;
  myId=data.myId||myId;
  mode=data.mode||mode;
  // Update UNO board on every game state update

  // Lobby
  if($('s-lobby').classList.contains('active')){
    renderLobby(data);
    if(data.status==='playing') startGameScreen();
  }
  // Game
  if($('s-game').classList.contains('active') && data.gameState){
    refreshHUD();
  }
}

function renderLobby(data){
  const vi=VINFO[data.variant]||VINFO.classic;
  $('lvbadge').textContent=vi.icon+' '+vi.name;
  $('lcode').textContent=data.code;
  const list=$('llist'); list.innerHTML='';
  data.players.forEach(p=>{
    const div=document.createElement('div'); div.className='lp';
    div.innerHTML=`<div class="lp-av">${(p.name||'?')[0].toUpperCase()}</div>
      <span class="lp-name">${p.name}</span>
      ${p.isHost?'<span class="lp-host">HOST</span>':''}
      ${!p.connected?'<span class="lp-disc">disconnected</span>':''}`;
    list.appendChild(div);
  });
  const amHost=data.players.find(p=>p.id===myId&&p.isHost);
  const enough=data.players.filter(p=>p.connected).length>=2;
  $('l-start').disabled=!amHost||!enough;
  $('l-hint').textContent=!amHost?'Waiting for host to start…':enough?`${data.players.length} players ready!`:'Need at least 2 players';
}

// ── GAME SCREEN INIT ──────────────────────────────────────────────────────
function startGameScreen(){
  showScreen('s-game');
  // Hide old canvas, show new uno board
  if ($('canvas-wrap')) $('canvas-wrap').style.display = 'none';
  if ($('uno-world')) $('uno-world').style.display = '';
  // Render the UNO board with real game state
  sceneReady=true;
  $('hud-vname').textContent=(VINFO[gameState?.variant||variant]||VINFO.classic).name;

  if(mode==='passplay') showPPBanner();
  else refreshHUD();
}

// ── GAME STATE → HUD ─────────────────────────────────────────────────────
function refreshHUD(){
  const gs=gameState; if(!gs||!sceneReady) return;
  const v=gs.variant||variant;
  const vi=VINFO[v]||VINFO.classic;
  $('hud-vname').textContent=vi.icon+' '+vi.name;

  // Render the new UNO board
  if (window.renderUnoBoard) {
    window.renderUnoBoard(gs, roomData, myId);
  }

  // Side badge
  const sb=$('side-badge');
  if(v==='flip'){show(sb);sb.textContent=gs.isLight?'☀ LIGHT':'🌙 DARK';sb.className='side-badge'+(gs.isLight?'':' dark');}
  else hide(sb);

  // Deck count
  $('deck-count').textContent=gs.deckCount??'?';

  // Color orb
  const orb=$('color-orb');
  const col=gs.currentColor||'red';
  orb.style.background=CHEX[col]||'#555';
  orb.style.boxShadow=`0 0 24px 8px ${(CHEX[col]||'#555')}66`;
  $('orb-lbl').textContent=col.toUpperCase();

  // Stack banner
  const sb2=$('stack-banner');
  if(gs.pendingDraw>0){show(sb2);$('stack-txt').textContent=`+${gs.pendingDraw} DRAW STACK`;}else hide(sb2);

  // Opponent labels
  renderOpponents(gs);

  // My hand
  const actId=getActingId();
  const myHand = gs.hands?.[actId] || gs.hands?.[myId] || [];
  renderHand(myHand,gs,v);

  // Buttons
  const myTurn=gs.currentPlayer===actId&&gs.phase==='play';
  const drawBtn=$('draw-btn');
  const hasPlayableInHand = myHand.some(c=>!c.hidden&&isPlayable(c,gs,v));
  const canDrawNow = !!(gs.pendingDraw>0 || canPlayDrawn || gs.rules?.allowVoluntaryDraw || !hasPlayableInHand);
  drawBtn.style.display=(myTurn&&canDrawNow)?'':'none';
  if(canPlayDrawn){
    drawBtn.innerHTML='<span>↷</span><span>Pass</span>';
  } else if(gs.pendingDraw>0){
    drawBtn.innerHTML=`<span>🂠</span><span>Draw +${gs.pendingDraw}</span>`;
  } else {
    drawBtn.innerHTML='<span>🂠</span><span>Draw</span>';
  }
  const hand=gs.hands?.[actId]||[];
  $('uno-btn').style.display=(hand.length===1&&!gs.unoFlags?.[actId])?'':'none';

  // Catch button
  const catchable=(roomData?.players||[]).filter(p=>p.id!==actId&&(gs.handCounts?.[p.id]??0)===1&&!gs.unoFlags?.[p.id]);
  $('catch-btn').style.display=catchable.length>0?'':'none';
  $('catch-btn').dataset.targets=JSON.stringify(catchable.map(p=>p.id));

  // Challenge button
  const top=gs.discardTop;
  const topT=top?(v==='flip'?(gs.isLight?top.light?.type:top.dark?.type):top.type):null;
  const chalTypes=['wild4','wildDraw2','wildDrawColor'];
  $('chal-btn').style.display=(myTurn&&chalTypes.includes(topT)&&gs.pendingDraw>0)?'':'none';

  // 3D scene: set discard
  if(top) S3D.setDiscard(top,gs.isLight,v);

  // Phase modals
  handlePhase(gs);

  // Status
  if(gs.phase==='end') return;
  if(gs.currentPlayer===actId) setStatus("🎯 Your turn!","g",99999);
  else setStatus(`⌛ ${playerName(gs.currentPlayer)}'s turn…`,"",99999);
}

function getActingId(){
  if(mode==='passplay'){
    const p=roomData?.players[ppSeat];
    return p?p.id:myId;
  }
  return myId;
}

function playerName(id){
  const p=(roomData?.players||[]).find(p=>p.id===id);
  return p?.name||id?.slice(0,6)||'?';
}

// ── OPPONENT LABELS ───────────────────────────────────────────────────────
const OPP_POS=[
  {top:'11%',left:'50%',transform:'translateX(-50%)'},
  {top:'38%',left:'4%', transform:'translateY(-50%)'},
  {top:'38%',right:'4%',transform:'translateY(-50%)'},
  {top:'18%',left:'18%'},
  {top:'18%',right:'18%'},
  {top:'58%',left:'4%', transform:'translateY(-50%)'},
  {top:'58%',right:'4%',transform:'translateY(-50%)'},
  {top:'14%',left:'34%'},
  {top:'14%',right:'34%'},
];

function renderOpponents(gs){
  const wrap=$('opp-wrap'); wrap.innerHTML='';
  const actId=getActingId();
  let pos=0;
  (roomData?.players||[]).forEach(p=>{
    if(p.id===actId) return;
    const position=OPP_POS[pos++]||{top:'25%',left:'50%'};
    const count=gs.handCounts?.[p.id]??0;
    const isActive=gs.currentPlayer===p.id;
    const isKO=gs.knockedOut?.includes(p.id);
    const hasUno=gs.unoFlags?.[p.id]&&count===1;
    const div=document.createElement('div');
    div.className=`opp${isActive?' my-turn':''}${isKO?' ko':''}`;
    Object.assign(div.style,position);
    div.innerHTML=`<span class="opp-name">${p.name}</span>
      <span class="opp-cnt">${count}</span>
      <span class="opp-cl">CARDS</span>
      ${hasUno?'<span class="uno-pip">UNO!</span>':''}
      ${isKO?'<span style="font-size:9px;color:#ff3f57">KNOCKED OUT</span>':''}`;
    if(hasUno){ div.style.cursor='pointer'; div.title='Click to catch!'; div.onclick=()=>emit('catchUno',{targetId:p.id}); }
    wrap.appendChild(div);
  });
}

// ── HAND RENDERING ────────────────────────────────────────────────────────
function renderHand(hand,gs,v){
  const container=$('hand-scroll');
  container.innerHTML='';
  const actId=getActingId();
  const myTurn=gs.currentPlayer===actId&&gs.phase==='play';

  hand.forEach(card=>{
    if(card.hidden) return;
    const wrap=document.createElement('div'); wrap.className='card-wrap';
    wrap.dataset.id=card.id;
    
    if (window.getUnoCardArt) {
      const img = document.createElement('img');
      img.src = window.getUnoCardArt(card, card.id || 0);
      img.width = 68;
      img.height = 96;
      img.style.display = 'block';
      img.draggable = false;
      wrap.appendChild(img);
    } else {
      const canvas=CR.getCanvas(card,gs.isLight??true,v,true,68,96);
      const cv=document.createElement('canvas');
      cv.width=canvas.width;
      cv.height=canvas.height;
      cv.getContext('2d').drawImage(canvas,0,0);
      wrap.appendChild(cv);
    }

    const playable=myTurn&&isPlayable(card,gs,v);
    const isSel=selectedIds.includes(card.id);
    const isDrawn=canPlayDrawn===card.id;

    if(!myTurn||(!playable&&!isDrawn)) wrap.classList.add('dim');
    if(isSel||isDrawn){wrap.classList.add('sel');const r=document.createElement('div');r.className='sel-ring';wrap.appendChild(r);}

    wrap.addEventListener('click',()=>{
      if(suppressNextCardClick){
        suppressNextCardClick=false;
        return;
      }
      onCardClick(card,wrap,gs,v);
    });

    // Double-click instantly throws a single card.
    wrap.addEventListener('dblclick',e=>{
      e.preventDefault();
      quickThrowCard(card,gs,v);
    });

    // Drag-up gesture throws card quickly (desktop + touch pointers).
    bindDragThrow(wrap,card,gs,v);
    container.appendChild(wrap);
  });

  // Multi-play confirm button
  const mb=$('multi-btn');
  if(selectedIds.length>1){
    show(mb); mb.textContent=`▶ Play ${selectedIds.length} cards`;
    mb.onclick=()=>submitPlay(selectedIds,null,gs,v);
  } else if(selectedIds.length===1){
    show(mb); mb.textContent='▶ Play card';
    mb.onclick=()=>submitPlay(selectedIds,null,gs,v);
  } else {
    hide(mb);
  }
}

function quickThrowCard(card,gs,v){
  const actId=getActingId();
  if(gs.currentPlayer!==actId||gs.phase!=='play') return;

  // If this card is part of a selected multi-set, throw the whole set.
  const throwIds=(selectedIds.length>1&&selectedIds.includes(card.id))?[...selectedIds]:[card.id];

  if(throwIds.length===1&&!isPlayable(card,gs,v) && canPlayDrawn!==card.id){
    setStatus('That card cannot be played right now.','w',1800);
    return;
  }

  selectedIds=[...throwIds];
  submitPlay(throwIds,null,gs,v);
}

function bindDragThrow(wrap,card,gs,v){
  let startX=0, startY=0, active=false, fired=false;

  wrap.addEventListener('pointerdown',e=>{
    active=true; fired=false;
    startX=e.clientX; startY=e.clientY;
  });

  wrap.addEventListener('pointermove',e=>{
    if(!active||fired) return;
    const dx=e.clientX-startX;
    const dy=e.clientY-startY;
    const upwardDrag=dy<-42 && Math.abs(dy)>Math.abs(dx)*1.15;
    if(upwardDrag){
      fired=true;
      suppressNextCardClick=true;
      quickThrowCard(card,gs,v);
      setTimeout(()=>{ suppressNextCardClick=false; },220);
    }
  });

  const end=()=>{ active=false; fired=false; };
  wrap.addEventListener('pointerup',end);
  wrap.addEventListener('pointercancel',end);
  wrap.addEventListener('pointerleave',()=>{ active=false; });
}

// ── PLAYABILITY CHECK (client-side) ──────────────────────────────────────
function isPlayable(card,gs,v){
  const top=gs.discardTop;
  const isLight=gs.isLight??true;
  const gt=c=>v==='flip'?(isLight?c.light?.type:c.dark?.type):c.type;
  const gc=c=>v==='flip'?(isLight?c.light?.color:c.dark?.color):c.color;
  const gv=c=>v==='flip'?(isLight?c.light?.value:c.dark?.value):c.value;
  const myT=gt(card),myC=gc(card),myV=gv(card);

  // Allow multi-play grouping: If cards are already selected, validate against the group!
  if (window.selectedIds && window.selectedIds.length > 0) {
    const actId = getActingId();
    const hand = gs.hands?.[actId] || gs.hands?.[myId] || [];
    
    const selectedCards = window.selectedIds.map(id => hand.find(c => c.id === id)).filter(Boolean);
    if (selectedCards.length > 0) {
      const first = selectedCards[0];
      const fT = gt(first), fC = gc(first), fV = gv(first);
      
      if (fT === 'number' && myT === 'number') {
        const currentlySameColor = selectedCards.every(c => gc(c) === fC);
        const currentlySameValue = selectedCards.every(c => gv(c) === fV);
        
        if (currentlySameColor && !currentlySameValue) {
          // Locked into 'same color' stack
          return myC === fC;
        } else if (currentlySameValue && !currentlySameColor) {
          // Locked into 'same value' stack
          return myV === fV;
        } else {
          // Currently only 1 card, or cards match BOTH (e.g. duplicate identical cards)
          return myC === fC || myV === fV;
        }
      } else if (fT !== 'number' && myT !== 'number') {
        return fT === myT; // Must be same action type
      }
      return false; // Cannot mix numbers and actions
    }
  }

  // Pending draw + no stacking → can't play
  if(gs.pendingDraw>0&&!gs.rules?.stacking) return false;

  // Wilds
  if(['wild','voldemort'].includes(myT)) return true;
  const restricted=['wild4','wildDraw2','wildDrawColor','wildRevDraw4','wildDraw6','wildDraw10','wildColorRoulette'];
  if(restricted.includes(myT)){
    if(gs.rules?.strictWild4){
      const actId=getActingId();
      const myHand=gs.hands?.[actId]||gs.hands?.[myId]||[];
      const hasMatchingColor=myHand.some(c=>!c.hidden&&c.id!==card.id&&gc(c)===gs.currentColor);
      if(hasMatchingColor) return false;
    }
    if(gs.pendingDraw>0&&gs.rules?.stacking){
      const dv={wild4:4,wildDraw2:2,wildRevDraw4:4,wildDraw6:6,wildDraw10:10};
      const req={draw1:1,draw2:2,draw4:4,draw5:5,wild4:4,wildDraw2:2,wildRevDraw4:4,wildDraw6:6,wildDraw10:10};
      const need=req[gs.pendingDrawSource]||0;
      const mine=dv[myT]||0;
      return mine>0 && (need===0 || mine>=need);
    }
    return true;
  }
  // Pending draw + stacking: must be draw card
  if(gs.pendingDraw>0&&gs.rules?.stacking){
    const dv={draw1:1,draw2:2,draw4:4,draw5:5};
    const req={draw1:1,draw2:2,draw4:4,draw5:5,wild4:4,wildDraw2:2,wildRevDraw4:4,wildDraw6:6,wildDraw10:10};
    const need=req[gs.pendingDrawSource]||0;
    const mine=dv[myT]||0;
    return mine>0 && (need===0 || mine>=need);
  }
  if(!top) return true;
  const topT=gt(top),topV=gv(top),cur=gs.currentColor;
  if(myC===cur) return true;
  if(myT!=='number'&&myT===topT) return true;
  if(myT==='number'&&topT==='number'&&myV===topV) return true;
  return false;
}

// ── CARD CLICK ────────────────────────────────────────────────────────────
function onCardClick(card,el,gs,v){
  const actId=getActingId();
  if(gs.currentPlayer!==actId||gs.phase!=='play') return;

  // If this is the drawable card, offer play/pass
  if(canPlayDrawn===card.id){ submitPlay([card.id],null,gs,v); return; }

  if(!isPlayable(card,gs,v)){ S3D.shake(card.id); el.classList.add('dim'); setTimeout(()=>el.classList.remove('dim'),400); return; }

  if(gs.rules?.multiPlay){
    const idx=selectedIds.indexOf(card.id);
    if(idx===-1) selectedIds.push(card.id); else selectedIds.splice(idx,1);
    renderHand(gs.hands?.[actId]||[],gs,v);
  } else {
    selectedIds=[card.id];
    submitPlay([card.id],null,gs,v);
  }
}

// ── SUBMIT PLAY ───────────────────────────────────────────────────────────
async function submitPlay(cardIds,color,gs,v){
  if(!gs||!cardIds.length) return;
  const actId=getActingId();
  const hand=gs.hands?.[actId]||[];
  const isLight=gs.isLight??true;
  const gt=c=>v==='flip'?(isLight?c.light?.type:c.dark?.type):c.type;
  const gc=c=>v==='flip'?(isLight?c.light?.color:c.dark?.color):c.color;
  const gv=c=>v==='flip'?(isLight?c.light?.value:c.dark?.value):c.value;
  const cards=cardIds.map(id=>hand.find(c=>c.id===id)).filter(Boolean);
  if(!cards.length) return;

  if(cards.length>1){
    const types=cards.map(gt);
    const colors=cards.map(gc);
    const vals=cards.map(gv);
    const sameColor=colors[0]!=='wild'&&colors.every(c=>c===colors[0]);
    const sameAction=types[0]!=='number'&&types.every(t=>t===types[0]);
    const sameNumber=types.every(t=>t==='number')&&vals.every(n=>n===vals[0]);
    // Allow: all numbers same color, OR all numbers same value, OR all same action
    const allNumber=types.every(t=>t==='number');
    if(!((allNumber&&sameColor)||(allNumber&&sameNumber)||(sameAction))){
      setStatus('Invalid multi-play: must be same number, same color, or same action.','w',2600);
      return;
    }
  }

  const wilds=['wild','wild4','voldemort','wildDraw2','wildDrawColor','wildRevDraw4','wildDraw6','wildDraw10','wildColorRoulette'];
  const hasWild=cards.some(c=>wilds.includes(gt(c)));

  if(hasWild&&!color){
    color=await pickColor(isLight,v);
    if(!color) return; // cancelled
  }

  selectedIds=[]; canPlayDrawn=null; hide($('multi-btn'));
  emit('playCards',{cardIds,chosenColor:color,actingAs:actId});
}

// Expose key functions for uno-board.js interactivity
window.submitPlay = submitPlay;
window.requestDrawFromStack = requestDrawFromStack;
window.emit = emit;

// ── PHASE MODALS ──────────────────────────────────────────────────────────
function handlePhase(gs){
  const actId=getActingId();
  if(gs.phase==='choose-color'&&gs.awaitingFrom===actId) openColorModal(gs);
  if(gs.phase==='choose-swap'&&gs.awaitingFrom===actId) openSwapModal(gs);
  if(gs.phase==='choose-roulette'&&gs.awaitingFrom===actId) openRouletteModal(gs);
}

function openColorModal(gs){
  const cols=gs.isLight===false?['pink','teal','orange','purple']:['red','blue','green','yellow'];
  openColorPicker('Choose a Color',cols,col=>{
    emit('chooseColor',{color:col,actingAs:getActingId()});
  });
}
function openRouletteModal(gs){
  const cols=gs.isLight===false?['pink','teal','orange','purple']:['red','blue','green','yellow'];
  openColorPicker('🎰 Wild Color Roulette — Pick a color (you\'ll draw until you get it!)',cols,col=>{
    emit('chooseRoulette',{color:col,actingAs:getActingId()});
  });
}
function openSwapModal(gs){
  const actId=getActingId();
  const list=$('swap-list'); list.innerHTML='';
  (roomData?.players||[]).filter(p=>p.id!==actId&&!gs.knockedOut?.includes(p.id)).forEach(p=>{
    const btn=document.createElement('button'); btn.className='swap-btn'; btn.textContent=p.name;
    btn.onclick=()=>{closeModal('swap-modal');emit('chooseSwap',{targetId:p.id,actingAs:actId});};
    list.appendChild(btn);
  });
  show('swap-modal');
}

function openColorPicker(title,cols,onPick){
  $('color-modal-title').textContent=title;
  const grid=$('color-grid'); grid.innerHTML='';
  cols.forEach(col=>{
    const btn=document.createElement('button'); btn.className='cbtn';
    btn.style.background=CHEX[col]||'#666'; btn.textContent=col.toUpperCase();
    btn.onclick=()=>{closeModal('color-modal');onPick(col);};
    grid.appendChild(btn);
  });
  show('color-modal');
}

function pickColor(isLight,v){
  return new Promise(res=>{
    const cols=v==='flip'&&!isLight?['pink','teal','orange','purple']:['red','blue','green','yellow'];
    $('color-modal-title').textContent='Choose a Color';
    const grid=$('color-grid'); grid.innerHTML='';
    cols.forEach(col=>{
      const btn=document.createElement('button'); btn.className='cbtn';
      btn.style.background=CHEX[col]||'#666'; btn.textContent=col.toUpperCase();
      btn.onclick=()=>{closeModal('color-modal');res(col);};
      grid.appendChild(btn);
    });
    show('color-modal');
  });
}

function closeModal(id){hide($(id));}

function requestDrawFromStack(){
  const gs=gameState;
  if(!gs) return;
  const actId=getActingId();
  const myTurn=gs.currentPlayer===actId&&gs.phase==='play';
  if(!myTurn) return;

  const v=gs.variant||variant;
  const myHand=gs.hands?.[actId]||gs.hands?.[myId]||[];
  const hasPlayable=myHand.some(c=>!c.hidden&&isPlayable(c,gs,v));

  if(canPlayDrawn){
    emit('pass',{actingAs:actId});
    canPlayDrawn=null;
    return;
  }

  if(gs.pendingDraw<=0 && !gs.rules?.allowVoluntaryDraw && hasPlayable){
    setStatus('You already have a playable card.','w',2400);
    return;
  }

  selectedIds=[];
  hide($('multi-btn'));
  canPlayDrawn=null;
  socket.emit('drawCards',{code:roomCode,actingAs:actId},res=>{
    if(res?.error) setStatus(res.error,'w',2600);
  });
}

// ── GAME EVENTS ───────────────────────────────────────────────────────────
function onGameEvent(data){
  if(data.gameState) gameState=data.gameState;
  myId=data.myId||myId;
  if(roomData?.mode) mode=roomData.mode;
  const gs=gameState; const rs=roomData;
  const v=gs?.variant||variant;

  // Server emits gameEvent to begin a round; ensure we leave lobby/setup when it arrives.
  if(gs && !$('s-game').classList.contains('active')) {
    if($('s-lobby').classList.contains('active') || $('s-setup').classList.contains('active')) {
      startGameScreen();
    }
  }

  switch(data.event){
    case 'roundStart': case 'played': case 'colorChosen': case 'swapped': case 'passed':
      canPlayDrawn=null; selectedIds=[];
      closeModal('color-modal'); closeModal('swap-modal'); closeModal('roulette-modal');
      break;
    case 'drew':
      if(data.data?.canPlay){ canPlayDrawn=data.data.canPlay; setStatus('✅ Drew a playable card — play or pass!','g',7000); }
      break;
    case 'unoCalled': setStatus(`🃏 UNO! ${playerName(data.data?.caller)} has 1 card!`,'uno',3500); break;
    case 'unoCaught': setStatus(`😱 ${playerName(data.data?.target)} caught! +2 cards!`,'w',3000); break;
    case 'challengeResult':
      if(data.data?.guilty) setStatus(`✅ Challenge success! ${playerName(data.data.target)} draws!`,'g',3000);
      else setStatus(`❌ Challenge failed! ${playerName(data.data.challenger)} draws extra!`,'w',3000);
      break;
    case 'flipped': setStatus(`⇅ FLIP! Now on ${gs.isLight?'LIGHT':'DARK'} side!`,'',3000); break;
    case 'rouletteResolved': setStatus(`🎰 Roulette: ${playerName(data.data?.target)} drew ${data.data?.drawn?.length??'?'} cards!`,'w',3000); break;
    case 'needColor': break;
    case 'needSwap': break;
    case 'needRoulette': break;
    case 'roundEnd':
      showRoundEnd(data.data); return;
  }

  if(data.data?.gameWon){ showGameEnd(data.data); return; }

  // Pass & Play: cover screen between turns
  if(mode==='passplay'&&gs?.phase==='play'){
    const curSeat=(rs?.players||[]).findIndex(p=>p.id===gs.currentPlayer);
    if(curSeat!==-1&&curSeat!==ppSeat) { ppSeat=curSeat; showPPCover(); return; }
  }

  if($('s-game').classList.contains('active')) refreshHUD();
}

// ── PASS & PLAY ───────────────────────────────────────────────────────────
function showPPBanner(){
  const p=(roomData?.players||[])[ppSeat];
  $('pp-pname').textContent=p?.name||`Player ${ppSeat+1}`;
  show('pp-banner'); hide('pp-cover'); hide('hand-area'); $('hud-actions').style.visibility='hidden';
  $('pp-ready').onclick=()=>{hide('pp-banner');show('hand-area');$('hud-actions').style.visibility='';refreshHUD();};
}
function showPPCover(){
  hide('hand-area'); $('hud-actions').style.visibility='hidden'; hide('pp-banner');
  show('pp-cover');
  setTimeout(()=>{ hide('pp-cover'); showPPBanner(); },2200);
}

// ── ROUND END ─────────────────────────────────────────────────────────────
function showRoundEnd(data){
  $('rend-title').textContent=`🎉 ${playerName(data?.winner)} wins the round!`;
  $('rend-pts').textContent=`+${data?.roundPoints||0} points`;
  const board=$('generic-board');
  board.innerHTML='';
  // Render all players' hands as rows of cards (generic board)
  const hands = data?.hands || [];
  hands.forEach((hand, idx) => {
    const row = document.createElement('div');
    row.className = 'board-row';
    const label = document.createElement('span');
    label.className = 'board-player-label';
    label.textContent = hand.name || `Player ${idx+1}`;
    row.appendChild(label);
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'board-cards';
    (hand.cards||[]).forEach(card => {
      if (window.getUnoCardArt) {
        const img = document.createElement('img');
        img.src = window.getUnoCardArt(card);
        img.className = 'board-card';
        img.width = 40; img.height = 56;
        cardsDiv.appendChild(img);
      } else {
        const cardEl = CR.getCanvas(card, true, hand.variant || 'classic', true, 40, 56);
        cardEl.className = 'board-card';
        cardsDiv.appendChild(cardEl);
      }
    });
    row.appendChild(cardsDiv);
    board.appendChild(row);
  });
  const amHost=(roomData?.players||[]).find(p=>p.id===myId&&p.isHost)||mode==='passplay';
  $('rend-next').style.display=amHost?'':'none';
  show('round-end-modal');
}

function showGameEnd(data){
  $('gend-title').textContent=`🏆 ${playerName(data?.winner)} is Champion!`;
  const list=$('final-list'); list.innerHTML='';
  const scores=data?.scores||gameState?.scores||{};
  [...(roomData?.players||[])].sort((a,b)=>(scores[b.id]||0)-(scores[a.id]||0)).forEach(p=>{
    const div=document.createElement('div'); div.className='final-row'+(p.id===data?.winner?' top':'');
    div.innerHTML=`<span>${p.name}</span><span style="font-family:monospace">${scores[p.id]||0} pts</span>`;
    list.appendChild(div);
  });
  hide('round-end-modal'); show('game-end-modal');
}

// ── RULES TEXT ────────────────────────────────────────────────────────────
const RULES_TEXT={
  classic:`<h3>Classic UNO</h3>Match the top discard card by color, number, or symbol. Draw from the deck if you can't play. Yell "UNO!" when you have 1 card left or draw 2 cards penalty.<br><br>Win limit: <b>500 points</b>
    <h3>Action Cards</h3>
    <b>Skip (⊘)</b>: Next player loses their turn. Multiple skips stack — 2 skips = 2 players skipped.<br>
    <b>Reverse (↺)</b>: Reverses direction. In 2-player acts as skip. Two reverses = no change.<br>
    <b>Draw Two (+2)</b>: Next player draws 2 and loses turn. Stackable! If opponent plays another +2, the draw adds up.<br>
    <b>Wild (W)</b>: Choose any color to continue.<br>
    <b>Wild Draw Four (W+4)</b>: Choose color + next player draws 4 and loses turn. Challenge if you suspect foul play!
    <h3>Multi-Play Rule</h3>You may play multiple cards of the same color, same type, or same number in one turn. Their effects all stack!`,
  hp:`<h3>Harry Potter UNO</h3>All Classic UNO rules apply plus the Voldemort card. Win limit: <b>500 points</b>
    <h3>Voldemort Card (🐍)</h3>
    When played, discard ALL cards in your hand that show Harry Potter's image — numbers <b>2, 6, and 9</b>. The color of the last Harry card discarded becomes the active color. If you have no Harry cards, it acts as a regular Wild card (choose any color). You can go out by playing Voldemort if all remaining cards are Harry cards — but yell UNO first!`,
  flip:`<h3>UNO Flip™</h3>Starts on the Light Side. A Flip card flips the entire deck — discard, draw pile, and all hands — to the Dark Side (and back). Win limit: <b>500 points</b>
    <h3>Light Side Cards</h3><b>Draw One (+1)</b>: Next draws 1, loses turn.<br><b>Reverse</b>: Reverses direction.<br><b>Skip</b>: Next loses turn.<br><b>Flip (⇅)</b>: Everything flips!<br><b>Wild</b>: Choose color.<br><b>Wild Draw Two (W+2)</b>: Choose color + next draws 2.
    <h3>Dark Side Cards (Brutal!)</h3><b>Draw Five (+5)</b>: Next draws 5, loses turn.<br><b>Reverse</b>: Reverses direction.<br><b>Skip Everyone</b>: ALL others skip, you go again.<br><b>Flip (⇅)</b>: Flips back to Light Side.<br><b>Wild</b>: Choose color.<br><b>Wild Draw Color (W+C)</b>: Choose color, next player draws until they get that color!`,
  mercy:`<h3>Show 'Em No Mercy</h3>Classic rules plus brutal new cards and special rules. Win limit: <b>1000 points</b>. Knockout bonus: <b>+250 pts per player knocked out</b> (via 25-card mercy rule).
    <h3>Color Action Cards</h3><b>Draw 2 / Draw 4</b>: Force next player to draw 2 or 4 cards.<br><b>Skip</b>: Next loses turn.<br><b>Reverse</b>: Reverses direction.<br><b>Discard All</b>: Discard all cards of matching color from your hand.<br><b>Skip Everyone</b>: All others skip.
    <h3>Wild Cards</h3><b>Wild Reverse Draw 4 (W↺+4)</b>: Reverse direction + next draws 4.<br><b>Wild Draw 6 (W+6)</b>: Next draws 6 and loses turn.<br><b>Wild Draw 10 (W+10)</b>: Next draws 10 and loses turn!<br><b>Wild Color Roulette (W🎰)</b>: Next player picks a color, then draws until they get one of that color!
    <h3>Special Rules</h3><b>Draw Until Playable</b>: You must draw from the deck until you get a card you can play.<br><b>Stacking</b>: Stack draw cards of equal or higher value onto each other. The final player must take all!<br><b>Mercy Rule</b>: 25 or more cards in hand = knocked out of the round.<br><b>7's Swap</b>: Playing a 7 lets you swap hands with any other player.<br><b>0's Pass</b>: Playing a 0 passes all hands in the direction of play.`
};

// ── SOCKET EMIT ───────────────────────────────────────────────────────────
function emit(ev,data={}){
  socket.emit(ev,{code:roomCode,...data});
}

// ── CHAT ──────────────────────────────────────────────────────────────────
function onChat(data){
  const msgs=$('chat-msgs');
  const d=document.createElement('div'); d.className='chat-msg';
  d.innerHTML=`<span class="chat-name">${data.name}:</span>${data.message}`;
  msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight;
}
function sendChat(){
  const input=$('chat-in'); const msg=input.value.trim(); if(!msg) return;
  const name=(roomData?.players||[]).find(p=>p.id===myId)?.name||'You';
  socket.emit('chat',{code:roomCode,message:msg,name}); input.value='';
}

// ── BUTTON BINDINGS ───────────────────────────────────────────────────────
function bindAll(){
  // Home
  qsa('.v-card').forEach(el=>el.addEventListener('click',()=>{variant=el.dataset.v;showSetup();}));
  $('back-home').onclick=()=>showScreen('s-home');
  $('back-setup').onclick=()=>showScreen('s-home');

  // Mode tabs
  qsa('.mode-tab').forEach(btn=>{
    btn.onclick=()=>{
      qsa('.mode-tab').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
      mode=btn.dataset.m;
      if(mode==='online'){show('online-opts');hide('pp-opts');}
      else{hide('online-opts');show('pp-opts');setupPPPlayers();}
    };
  });

  // Rules toggle
  $('rules-toggle').onclick=()=>{
    const p=$('rules-panel'); const isHid=p.classList.toggle('hidden');
    $('rules-toggle').querySelector('.rarr').textContent=isHid?'▼':'▲';
  };

  // Create room
  $('btn-create').onclick=async()=>{
    const name=($('pname-input').value||'Host').trim();
    if(!name){alert('Enter your name');return;}
    socket.emit('createRoom',{playerName:name,variant,rules:getRules(),mode:'online'},res=>{
      if(res.error){alert(res.error);return;}
      roomCode=res.code; showLobby(res.code);
    });
  };

  // Join room
  $('btn-join').onclick=async()=>{
    const name=($('pname-input').value||'Player').trim();
    const code=($('join-code').value||'').trim().toUpperCase();
    if(!name){alert('Enter your name');return;}
    if(!code||code.length!==5){alert('Enter a 5-letter room code');return;}
    socket.emit('joinRoom',{playerName:name,code},res=>{
      if(res.error){alert(res.error);return;}
      roomCode=res.code; showLobby(res.code);
    });
  };

  // Pass & Play add player
  $('btn-add-pp').onclick=()=>{
    if($('pp-list').children.length>=10){alert('Max 10 players');return;}
    addPPRow('',false);
  };

  // Pass & Play start
  $('btn-start-pp').onclick=()=>{
    const names=Array.from(qsa('.pp-name')).map(i=>i.value.trim()).filter(Boolean);
    if(names.length<2){alert('Need at least 2 players!');return;}
    mode='passplay'; ppSeat=0;
    socket.emit('createRoom',{playerName:names[0],variant,rules:getRules(),mode:'passplay'},res=>{
      if(res.error){alert(res.error);return;}
      roomCode=res.code;
      // Add other players
      let chain=Promise.resolve();
      for(let i=1;i<names.length;i++){
        const n=names[i];
        chain=chain.then(()=>new Promise(r=>socket.emit('addPassPlayer',{code:res.code,playerName:n},r)));
      }
      chain.then(()=>{
        socket.emit('startGame',{code:res.code},r=>{
          if(r.error){alert(r.error);return;}
        });
      });
    });
  };

  // Lobby
  $('l-start').onclick=()=>{ socket.emit('startGame',{code:roomCode},r=>{if(r?.error)alert(r.error);}); };
  $('l-copy').onclick=()=>{ navigator.clipboard?.writeText(roomCode).catch(()=>{}); $('l-copy').textContent='✓'; setTimeout(()=>$('l-copy').textContent='📋',1500); };
  $('l-leave').onclick=()=>{ if(confirm('Leave lobby?')) showScreen('s-setup'); };

  // Game buttons
  $('draw-btn').onclick=requestDrawFromStack;
  $('uno-btn').onclick=()=>{ emit('callUno',{actingAs:getActingId()}); };
  $('catch-btn').onclick=()=>{ const targets=JSON.parse($('catch-btn').dataset.targets||'[]'); if(targets[0]) emit('catchUno',{targetId:targets[0],actingAs:getActingId()}); };
  $('chal-btn').onclick=()=>{ show('chal-modal'); };
  $('chal-yes').onclick=()=>{
    hide('chal-modal');
    emit('challenge',{actingAs:getActingId()});
  };
  $('chal-no').onclick=()=>hide('chal-modal');

  // Menu
  $('menu-btn').onclick=()=>show('menu-modal');
  $('menu-close').onclick=()=>hide('menu-modal');
  $('menu-rules').onclick=()=>{
    $('rules-body').innerHTML=RULES_TEXT[gameState?.variant||variant]||RULES_TEXT.classic;
    hide('menu-modal'); show('rules-modal');
  };
  $('rules-close').onclick=()=>hide('rules-modal');
  $('menu-leave').onclick=()=>{ if(confirm('Leave game?')){S3D.destroy();sceneReady=false;hide('menu-modal');showScreen('s-home');} };

  // Round end
  $('rend-next').onclick=()=>{ hide('round-end-modal'); emit('nextRound'); };

  // Game end
  $('gend-rematch').onclick=()=>{ hide('game-end-modal'); emit('nextRound'); };
  $('gend-menu').onclick=()=>{ S3D.destroy();sceneReady=false;hide('game-end-modal');showScreen('s-home'); };

  // Chat
  $('chat-tog').onclick=()=>$('chat-body').classList.toggle('open');
  $('chat-send').onclick=sendChat;
  $('chat-in').onkeydown=e=>{if(e.key==='Enter')sendChat();};
}

// ── BOOTSTRAP ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  connectSocket();
  initHome();
  bindAll();
  showScreen('s-home');
});

})();
