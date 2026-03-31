'use strict';
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const { UnoGame } = require('./gameEngine');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ─── ROOMS ───────────────────────────────────────────────────────────────────
const rooms = new Map(); // code → Room
const disconnectTimers = new Map(); // socketId → timeoutId

function genCode() {
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code=Array.from({length:5},()=>c[Math.floor(Math.random()*c.length)]).join(''); }
  while(rooms.has(code));
  return code;
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p=>p.id===socketId)) return room;
  }
  return null;
}

// ─── BROADCAST ───────────────────────────────────────────────────────────────
function broadcastRoom(room) {
  room.players.forEach(p => {
    const sock = io.sockets.sockets.get(p.id);
    if (!sock) return;
    const gs = room.game ? room.game.playerView(p.id) : null;
    sock.emit('roomUpdate', {
      code:    room.code,
      mode:    room.mode,
      variant: room.variant,
      status:  room.status,
      players: room.players.map(q=>({id:q.id,name:q.name,seat:q.seat,isHost:q.isHost,connected:q.connected})),
      gameState: gs,
      myId:    p.id
    });
  });
}

function broadcastEvent(room, event, data={}) {
  room.players.forEach(p => {
    const sock = io.sockets.sockets.get(p.id);
    if (!sock) return;
    const gs = room.game ? room.game.playerView(p.id) : null;
    sock.emit('gameEvent', { event, data, gameState: gs, myId: p.id });
  });
}

// ─── SOCKET HANDLERS ─────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);

  // CREATE ROOM
  socket.on('createRoom', ({playerName, variant, rules, mode}, cb) => {
    const code = genCode();
    const room = {
      code, variant, rules, mode: mode||'online', status:'lobby',
      players:[{id:socket.id, name:playerName||'Host', seat:0, isHost:true, connected:true}],
      game: null, createdAt: Date.now()
    };
    rooms.set(code, room);
    socket.join(code);
    if(cb) cb({ok:true, code});
    broadcastRoom(room);
  });

  // JOIN ROOM
  socket.on('joinRoom', ({code, playerName}, cb) => {
    const room = rooms.get(code?.toUpperCase());
    if(!room) { if(cb) cb({error:'Room not found'}); return; }
    // If game already started, join as spectator
    if(room.status!=='lobby') {
      if(cb) cb({ok:true, spectator:true, code:code.toUpperCase()});
      // Add to spectators list if not already
      if (!room.spectators) room.spectators = [];
      if (!room.spectators.find(s=>s.id===socket.id)) {
        room.spectators.push({id:socket.id, name:playerName||'Spectator'});
      }
      socket.join(code.toUpperCase());
      broadcastRoom(room);
      return;
    }
    if(room.players.length>=10) { if(cb) cb({error:'Room is full (max 10)'}); return; }
    if(room.players.find(p=>p.id===socket.id)) { if(cb) cb({error:'Already in room'}); return; }
    const seat=room.players.length;
    room.players.push({id:socket.id,name:playerName||`Player ${seat+1}`,seat,isHost:false,connected:true});
    socket.join(code.toUpperCase());
    if(cb) cb({ok:true,code:code.toUpperCase()});
    broadcastRoom(room);
  });

  // ADD PASS-PLAY PLAYER (same socket, different seat)
  socket.on('addPassPlayer', ({code, playerName}, cb) => {
    const room = rooms.get(code);
    if(!room) { if(cb) cb({error:'Room not found'}); return; }
    if(room.players.length>=10) { if(cb) cb({error:'Max 10 players'}); return; }
    const seat=room.players.length;
    room.players.push({id:socket.id+'_'+seat,name:playerName||`Player ${seat+1}`,seat,isHost:false,connected:true});
    if(cb) cb({ok:true});
    broadcastRoom(room);
  });

  // START GAME
  socket.on('startGame', ({code}, cb) => {
    const room = rooms.get(code);
    if(!room) { if(cb) cb({error:'Room not found'}); return; }
    if(!room.players.find(p=>p.id===socket.id&&p.isHost)) { if(cb) cb({error:'Only host can start'}); return; }
    if(room.players.length<2) { if(cb) cb({error:'Need at least 2 players'}); return; }
    if(room.status!=='lobby') { if(cb) cb({error:'Already started'}); return; }

    const playerIds=room.players.map(p=>p.id);
    room.game = new UnoGame(room.variant, playerIds, room.rules);
    room.status='playing';
    const result=room.game.startRound();
    if(cb) cb({ok:true});
    broadcastEvent(room, result.event, {roundPoints:0, scores:result.state.scores});
  });

  // ── GAME ACTIONS ──────────────────────────────────────────────────────────

  function getRoom(code, cb) {
    const room=rooms.get(code);
    if(!room||!room.game){ if(cb)cb({error:'No active game'}); return null; }
    return room;
  }

  socket.on('playCards', ({code, cardIds, chosenColor, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const pid=actingAs||socket.id;
    const result=room.game.playCards(pid,cardIds,chosenColor);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room, result.event, {
      winner:result.winner, roundPoints:result.roundPoints,
      scores:result.scores, gameWon:result.gameWon
    });
  });

  socket.on('chooseColor', ({code, color, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.chooseColor(actingAs||socket.id, color);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room, result.event, {drawn:result.drawn});
  });

  socket.on('chooseSwap', ({code, targetId, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.chooseSwap(actingAs||socket.id, targetId);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room, result.event, {});
  });

  socket.on('chooseRoulette', ({code, color, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.chooseRoulette(actingAs||socket.id, color);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room, result.event, {drawn:result.drawn, target:result.target});
  });

  socket.on('drawCards', ({code, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.drawCards(actingAs||socket.id);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true, canPlay:result.canPlay, drawn:result.drawn});
    broadcastEvent(room, result.event||'drew', {
      drawn:result.drawn, canPlay:result.canPlay,
      forced:result.forced, knocked:result.knocked
    });
  });

  socket.on('pass', ({code, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.pass(actingAs||socket.id);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room,'passed',{});
  });

  socket.on('callUno', ({code, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.callUno(actingAs||socket.id);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room,'unoCalled',{caller:actingAs||socket.id});
  });

  socket.on('catchUno', ({code, targetId, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.catchUno(actingAs||socket.id, targetId);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room,'unoCaught',{caller:actingAs||socket.id,target:targetId});
  });

  socket.on('challenge', ({code, targetId, actingAs}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.challenge(actingAs||socket.id, targetId);
    if(!result.ok){ if(cb)cb({error:result.error}); return; }
    if(cb) cb({ok:true});
    broadcastEvent(room,'challengeResult',{
      guilty:result.guilty, target:result.target,
      challenger:result.challenger, drew:result.drew
    });
  });

  socket.on('nextRound', ({code}, cb) => {
    const room=getRoom(code,cb); if(!room) return;
    const result=room.game.nextRound();
    if(cb) cb({ok:true});
    broadcastEvent(room, result.event, {scores:result.state.scores});
  });

  socket.on('playAgain', ({code}, cb) => {
    const room = rooms.get(code);
    if (!room) return;
    room.status = 'lobby';
    room.game = null;
    if (cb) cb({ok: true});
    broadcastRoom(room);
  });

  // CHAT
  socket.on('chat', ({code, message, name}) => {
    const room=rooms.get(code); if(!room) return;
    io.to(code).emit('chat',{name:name||'?',message:(message||'').slice(0,200),ts:Date.now()});
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const room=getRoomBySocket(socket.id);
    if(!room) return;
    const player=room.players.find(p=>p.id===socket.id);
    if(player) player.connected=false;
    // Start 2-minute grace timer
    if (player && room.status !== 'lobby') {
      const timer = setTimeout(() => {
        // After 2 minutes, move to spectators if not reconnected
        const idx = room.players.findIndex(p=>p.id===socket.id);
        if(idx !== -1) {
          if (!room.spectators) room.spectators = [];
          room.spectators.push({id:player.id, name:player.name||'Spectator'});
          room.players.splice(idx,1);
        }
        broadcastRoom(room);
      }, 2*60*1000);
      disconnectTimers.set(socket.id, timer);
    }
    if(room.status==='lobby') {
      room.players=room.players.filter(p=>p.id!==socket.id);
      room.players.forEach((p,i)=>{p.seat=i;});
      if(room.players.length>0&&!room.players.find(p=>p.isHost)) room.players[0].isHost=true;
      if(room.players.length===0) { rooms.delete(room.code); return; }
    }
    broadcastRoom(room);
  });

  // RECONNECT (clear timer if player returns)
  socket.on('reconnectPlayer', ({code}, cb) => {
    const room = rooms.get(code);
    if (!room) { if(cb)cb({error:'Room not found'}); return; }
    const player = room.players.find(p=>p.id===socket.id);
    if (player) player.connected = true;
    if (disconnectTimers.has(socket.id)) {
      clearTimeout(disconnectTimers.get(socket.id));
      disconnectTimers.delete(socket.id);
    }
    broadcastRoom(room);
    if(cb)cb({ok:true});
  });
});

// Cleanup old rooms every hour
setInterval(()=>{
  const now=Date.now();
  for(const[code,room] of rooms) {
    if(now-room.createdAt > 4*60*60*1000) rooms.delete(code);
  }
}, 60*60*1000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🃏  UNO 3D Multiplayer  →  http://localhost:${PORT}\n`);
  console.log('   Variants: Classic · Harry Potter · UNO Flip · Show Em No Mercy');
  console.log('   Modes:    Online Multiplayer · Pass & Play\n');
});
