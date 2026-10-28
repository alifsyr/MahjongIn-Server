import { createServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { MahjongRoom } from './game/room.js';

const PORT = Number(process.env.PORT) || 3001;
const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'MahjongIn-Server' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MahjongIn Multiplayer Game Server is running.\n');
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms: Map<string, MahjongRoom> = new Map();
const socketToRoom: Map<string, { roomCode: string; seat: number }> = new Map();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcastRoomState(room: MahjongRoom) {
  for (let s = 0; s < 4; s++) {
    const player = room.players[s];
    if (player && !player.isBot) {
      const state = room.getClientState(s);
      io.to(player.id).emit('game:state', state);
    }
  }
}

io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('room:create', ({ name }: { name: string }) => {
    let code = generateRoomCode();
    while (rooms.has(code)) code = generateRoomCode();

    const room = new MahjongRoom(code);
    const seat = room.addPlayer(socket.id, name || 'Pemain 1');
    if (seat === null) {
      socket.emit('error', 'Gagal membuat room.');
      return;
    }

    const sessionToken = room.players[seat]?.sessionToken;
    rooms.set(code, room);
    socketToRoom.set(socket.id, { roomCode: code, seat });
    socket.join(code);
    console.log(`[Room] Created ${code} by ${name} (Seat ${seat})`);

    socket.emit('room:joined', { roomCode: code, seat, sessionToken });
    broadcastRoomState(room);
  });

  socket.on('room:join', ({ roomCode, name, sessionToken }: { roomCode: string; name: string; sessionToken?: string }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('error', `Room ${code} tidak ditemukan.`);
      return;
    }

    // Cek reconnect dengan sessionToken
    if (sessionToken) {
      const reconnectedSeat = room.reconnectPlayer(socket.id, sessionToken);
      if (reconnectedSeat !== null) {
        socketToRoom.set(socket.id, { roomCode: code, seat: reconnectedSeat });
        socket.join(code);
        console.log(`[Room] Player reconnected to ${code} as Seat ${reconnectedSeat}`);
        socket.emit('room:joined', { roomCode: code, seat: reconnectedSeat, sessionToken });
        broadcastRoomState(room);
        scheduleBotAction(room);
        return;
      }
    }

    const seat = room.addPlayer(socket.id, name || 'Pemain');
    if (seat === null) {
      socket.emit('error', `Room ${code} sudah penuh (4 pemain).`);
      return;
    }

    const playerToken = room.players[seat]?.sessionToken;
    socketToRoom.set(socket.id, { roomCode: code, seat });
    socket.join(code);
    console.log(`[Room] ${name} joined ${code} as Seat ${seat}`);

    socket.emit('room:joined', { roomCode: code, seat, sessionToken: playerToken });
    broadcastRoomState(room);
  });

  socket.on('room:reconnect', ({ roomCode, sessionToken }: { roomCode: string; sessionToken: string }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('error', `Room ${code} tidak ditemukan.`);
      return;
    }

    const reconnectedSeat = room.reconnectPlayer(socket.id, sessionToken);
    if (reconnectedSeat === null) {
      socket.emit('error', 'Sesi tidak valid atau telah berakhir.');
      return;
    }

    socketToRoom.set(socket.id, { roomCode: code, seat: reconnectedSeat });
    socket.join(code);
    console.log(`[Room] Player reconnected to ${code} as Seat ${reconnectedSeat}`);
    socket.emit('room:joined', { roomCode: code, seat: reconnectedSeat, sessionToken });
    broadcastRoomState(room);
    scheduleBotAction(room);
  });

  socket.on('room:fill-bots', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    room.fillBots();
    broadcastRoomState(room);
    scheduleBotAction(room);
  });

  socket.on('game:start', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    room.startGame();
    console.log(`[Game] Started in room ${room.code}`);
    broadcastRoomState(room);
    scheduleBotAction(room);
  });

  socket.on('game:draw', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    room.draw(session.seat);
    broadcastRoomState(room);

    if (room.phase === 'over' && room.winner === null) {
      io.to(room.code).emit('game:over', {
        winner: null,
        isDraw: true
      });
    } else {
      scheduleBotAction(room);
    }
  });

  socket.on('game:discard', ({ tile }: { tile: number }) => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    const result = room.discard(session.seat, tile);
    if (result.success) {
      broadcastRoomState(room);
      scheduleBotAction(room);
    }
  });

  socket.on('game:claim', ({ kind, index }: { kind: 'chi' | 'pon' | 'kan' | 'ron'; index?: number }) => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    const result = room.claim(session.seat, kind, index || 0);
    broadcastRoomState(room);
    if (result.winner !== null && result.fanSummary) {
      io.to(room.code).emit('game:over', {
        winner: result.winner,
        fanSummary: result.fanSummary
      });
    } else if (result.isDraw || (room.phase === 'over' && room.winner === null)) {
      io.to(room.code).emit('game:over', {
        winner: null,
        isDraw: true
      });
    } else {
      scheduleBotAction(room);
    }
  });

  socket.on('game:pass', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    const result = room.passClaim(session.seat);
    broadcastRoomState(room);
    if (result && result.winner !== null && result.fanSummary) {
      io.to(room.code).emit('game:over', {
        winner: result.winner,
        fanSummary: result.fanSummary
      });
    } else if (result && (result.isDraw || (room.phase === 'over' && room.winner === null))) {
      io.to(room.code).emit('game:over', {
        winner: null,
        isDraw: true
      });
    } else {
      scheduleBotAction(room);
    }
  });

  socket.on('game:tsumo', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    const result = room.tsumo(session.seat);
    if (result.winner !== null && result.fanSummary) {
      broadcastRoomState(room);
      io.to(room.code).emit('game:over', {
        winner: result.winner,
        fanSummary: result.fanSummary,
        isTsumo: true
      });
    }
  });

  socket.on('game:kong', ({ tile }: { tile: number }) => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    const result = room.declareKong(session.seat, tile);
    if (result.success) {
      broadcastRoomState(room);
      if (result.isDraw || (room.phase === 'over' && room.winner === null)) {
        io.to(room.code).emit('game:over', {
          winner: null,
          isDraw: true
        });
      } else {
        scheduleBotAction(room);
      }
    }
  });

  socket.on('disconnect', () => {
    const session = socketToRoom.get(socket.id);
    if (session) {
      const room = rooms.get(session.roomCode);
      if (room) {
        room.removePlayer(socket.id);
        if (room.players.every((p) => p === null || p.isBot)) {
          if (roomBotTimers.has(session.roomCode)) {
            clearTimeout(roomBotTimers.get(session.roomCode)!);
            roomBotTimers.delete(session.roomCode);
          }
          rooms.delete(session.roomCode);
          console.log(`[Room] Cleaned empty room ${session.roomCode}`);
        } else {
          broadcastRoomState(room);
        }
      }
      socketToRoom.delete(socket.id);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

const roomBotTimers: Map<string, NodeJS.Timeout> = new Map();

function chooseBotDiscard(hand: number[]): number {
  const counts = new Map<number, number>();
  for (const t of hand) counts.set(t, (counts.get(t) || 0) + 1);

  // Buang ubin honor yang berdiri sendiri (27..33)
  const isolatedHonors = hand.filter((t) => t >= 27 && t < 34 && counts.get(t) === 1);
  if (isolatedHonors.length > 0) {
    return isolatedHonors[0];
  }

  // Jika tidak ada, buang ubin terakhir dari tangan
  return hand[hand.length - 1];
}

function scheduleBotAction(room: MahjongRoom) {
  if (roomBotTimers.has(room.code)) {
    clearTimeout(roomBotTimers.get(room.code)!);
    roomBotTimers.delete(room.code);
  }

  if (room.phase === 'over' || room.phase === 'waiting') return;

  let needsAction = false;
  if (room.phase === 'claim') {
    for (const [seat] of room.pendingClaims.entries()) {
      if (room.players[seat]?.isBot) {
        needsAction = true;
        break;
      }
    }
  } else if (room.phase === 'draw' || room.phase === 'discard') {
    if (room.players[room.currentTurn]?.isBot) {
      needsAction = true;
    }
  }

  if (!needsAction) return;

  const timer = setTimeout(() => {
    roomBotTimers.delete(room.code);
    runBotStep(room);
  }, 600);
  roomBotTimers.set(room.code, timer);
}

function runBotStep(room: MahjongRoom) {
  if (room.phase === 'over' || room.phase === 'waiting') return;

  // 1. Respon bot jika ada claim
  if (room.phase === 'claim') {
    for (const [seat] of Array.from(room.pendingClaims.entries())) {
      const p = room.players[seat];
      if (!p || !p.isBot) continue;

      const opts = room.pendingClaims.get(seat);
      if (!opts) continue;

      if (opts.some((o) => o.kind === 'ron')) {
        const res = room.claim(seat, 'ron');
        broadcastRoomState(room);
        if (res.winner !== null && res.fanSummary) {
          io.to(room.code).emit('game:over', {
            winner: res.winner,
            fanSummary: res.fanSummary
          });
          return;
        }
      } else {
        const res = room.passClaim(seat);
        broadcastRoomState(room);
        if (res.winner !== null && res.fanSummary) {
          io.to(room.code).emit('game:over', {
            winner: res.winner,
            fanSummary: res.fanSummary
          });
          return;
        }
      }
    }
    broadcastRoomState(room);
    scheduleBotAction(room);
    return;
  }

  // 2. Giliran bot draw atau discard
  const curr = room.players[room.currentTurn];
  if (!curr || !curr.isBot) return;

  if (room.phase === 'draw') {
    room.draw(room.currentTurn);
    broadcastRoomState(room);
    if ((room.phase as string) === 'over' && room.winner === null) {
      io.to(room.code).emit('game:over', {
        winner: null,
        isDraw: true
      });
      return;
    }
    scheduleBotAction(room);
  } else if (room.phase === 'discard') {
    const tsumoRes = room.tsumo(room.currentTurn);
    if (tsumoRes.winner !== null && tsumoRes.fanSummary) {
      broadcastRoomState(room);
      io.to(room.code).emit('game:over', {
        winner: tsumoRes.winner,
        fanSummary: tsumoRes.fanSummary,
        isTsumo: true
      });
      return;
    }

    const tileToDiscard = chooseBotDiscard(curr.hand);
    const discardRes = room.discard(room.currentTurn, tileToDiscard);
    if (discardRes.success) {
      broadcastRoomState(room);
    }
    scheduleBotAction(room);
  }
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`MahjongIn-Server listening on port ${PORT}`);

  // Prevent Render free-tier spin down when idle.
  const isProduction = process.env.NODE_ENV === 'production';
  const serverUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || 'https://mahjongin-server.onrender.com';

  if (isProduction && serverUrl) {
    const PING_INTERVAL_MS = 10 * 60 * 1000;
    console.log(`[Keep-Alive] Scheduler aktif untuk ${serverUrl} (interval: 10 menit)`);
    setInterval(async () => {
      try {
        const res = await fetch(`${serverUrl}/health`);
        console.log(`[Keep-Alive] Ping ${serverUrl}/health - status: ${res.status}`);
      } catch (err: any) {
        console.warn(`[Keep-Alive] Ping error:`, err?.message || err);
      }
    }, PING_INTERVAL_MS);
  }
});
