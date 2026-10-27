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

    rooms.set(code, room);
    socketToRoom.set(socket.id, { roomCode: code, seat });
    socket.join(code);
    console.log(`[Room] Created ${code} by ${name} (Seat ${seat})`);

    socket.emit('room:joined', { roomCode: code, seat });
    broadcastRoomState(room);
  });

  socket.on('room:join', ({ roomCode, name }: { roomCode: string; name: string }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('error', `Room ${code} tidak ditemukan.`);
      return;
    }

    const seat = room.addPlayer(socket.id, name || 'Pemain');
    if (seat === null) {
      socket.emit('error', `Room ${code} sudah penuh (4 pemain).`);
      return;
    }

    socketToRoom.set(socket.id, { roomCode: code, seat });
    socket.join(code);
    console.log(`[Room] ${name} joined ${code} as Seat ${seat}`);

    socket.emit('room:joined', { roomCode: code, seat });
    broadcastRoomState(room);
  });

  socket.on('room:fill-bots', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    room.fillBots();
    broadcastRoomState(room);
  });

  socket.on('game:start', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    room.startGame();
    console.log(`[Game] Started in room ${room.code}`);
    broadcastRoomState(room);
  });

  socket.on('game:draw', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    const result = room.draw(session.seat);
    if (result) {
      broadcastRoomState(room);
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
    }
  });

  socket.on('game:pass', () => {
    const session = socketToRoom.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.roomCode);
    if (!room) return;

    room.passClaim(session.seat);
    broadcastRoomState(room);
  });

  socket.on('disconnect', () => {
    const session = socketToRoom.get(socket.id);
    if (session) {
      const room = rooms.get(session.roomCode);
      if (room) {
        room.removePlayer(socket.id);
        if (room.players.every((p) => p === null || p.isBot)) {
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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`MahjongIn-Server listening on port ${PORT}`);
});
