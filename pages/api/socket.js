// pages/api/socket.js
import { Server } from 'socket.io';

let players = {};

export default function handler(req, res) {
  if (res.socket.server.io) {
    console.log('✅ Socket.IO is already running');
    res.end();
    return;
  }

  console.log('🚀 Initializing Socket.IO...');

  const io = new Server(res.socket.server, {
    path: '/api/socketio',
    addTrailingSlash: false,
  });

  res.socket.server.io = io;

  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('join', ({ name }) => {
      const symbol = Object.keys(players).length === 0 ? '〇' : '×';
      players[symbol] = { id: socket.id, name };
      socket.emit('joined', {
        symbol,
        opponent: players[symbol === '〇' ? '×' : '〇']?.name || '',
      });
      socket.broadcast.emit('joined', {
        symbol: symbol === '〇' ? '×' : '〇',
        opponent: name,
      });
    });

    socket.on('move', (data) => {
      socket.broadcast.emit('update', data);
    });

    socket.on('reset', () => {
      players = {};
      io.emit('reset');
    });

    socket.on('disconnect', () => {
      players = {};
      io.emit('reset');
    });
  });

  res.end();
}