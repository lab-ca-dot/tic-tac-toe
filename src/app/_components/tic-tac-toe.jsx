'use client'

import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import styles from './tic-tac-toe.module.scss';

// Socket.IO クライアントを初期化
// pathは API Route: `/pages/api/socket.jsx` に一致させる
const socket = io({
  path: '/api/socketio',
});

export default function TicTacToe() {
  // 3x3の空のボードを初期化（すべて''）
  const emptyBoard = Array(3).fill(null).map(() => Array(3).fill(''));

  // プレイヤー名、記号、ゲーム状態の管理
  const [name, setName] = useState(''); // 自分の名前
  const [playerSymbol, setPlayerSymbol] = useState(null); // '〇' or '×'
  const [opponentName, setOpponentName] = useState(''); // 相手の名前
  const [isGameStarted, setIsGameStarted] = useState(false); // ゲームが始まったかどうか

  // ゲーム進行に関する状態
  const [board, setBoard] = useState(emptyBoard); // ボードの状態
  const [currentPlayer, setCurrentPlayer] = useState('〇'); // 現在のプレイヤー（〇 or ×）
  const [winner, setWinner] = useState(null); // 勝者が決まったときに使う

  // Socket.IO 通信イベントの設定
  useEffect(() => {
    fetch('/api/socket'); // API Route を有効化

    // サーバーから 'joined' イベントを受け取る
    socket.on('joined', ({ symbol, opponent }) => {
      setPlayerSymbol(symbol);
      setOpponentName(opponent);
      setIsGameStarted(true);
    });

    // 他プレイヤーの手を反映
    socket.on('update', ({ row, col, mark }) => {
      setBoard((prev) => {
        const newBoard = prev.map((r) => [...r]);
        newBoard[row][col] = mark;
        return newBoard;
      });
      setCurrentPlayer((prev) => (prev === '〇' ? '×' : '〇'));
    });

    // サーバーからのリセット通知を受け取る
    socket.on('reset', () => {
      setBoard(emptyBoard);
      setWinner(null);
      setCurrentPlayer('〇');
      setIsGameStarted(false);
      setPlayerSymbol(null);
      setOpponentName('');
    });
  }, []);

  // プレイヤーが参加ボタンを押したときの処理
  const handleJoin = () => {
    if (name) {
      socket.emit('join', { name });
    }
  };

  // マスをクリックしたときの処理
  const handleClick = (row, col) => {
    // マスが埋まっている or 勝敗決定済み or 自分のターンでない場合は無視
    if (board[row][col] !== '' || winner || currentPlayer !== playerSymbol) return;

    // 手を反映
    const newBoard = board.map((r) => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    // 勝敗チェック
    const w = checkWinner(newBoard);
    if (w) {
      setWinner(w); // 勝者がいればセット
    } else if (newBoard.flat().every(cell => cell !== '')) {
      setWinner('引き分け'); // 全マス埋まっているが勝者なし
    } else {
      setCurrentPlayer(currentPlayer === '〇' ? '×' : '〇'); // プレイヤー交代
    }

    // サーバーに手を通知
    socket.emit('move', { row, col, mark: currentPlayer });
  };

  // 「リセット」ボタンが押されたときの処理
  const handleReset = () => {
    socket.emit('reset');
  };

  // 勝者をチェックする関数
  const checkWinner = (b) => {
    const lines = [
      [[0, 0], [0, 1], [0, 2]],
      [[1, 0], [1, 1], [1, 2]],
      [[2, 0], [2, 1], [2, 2]],
      [[0, 0], [1, 0], [2, 0]],
      [[0, 1], [1, 1], [2, 1]],
      [[0, 2], [1, 2], [2, 2]],
      [[0, 0], [1, 1], [2, 2]],
      [[0, 2], [1, 1], [2, 0]],
    ];

    for (const [a, b1, c] of lines) {
      if (
        b[a[0]][a[1]] &&
        b[a[0]][a[1]] === b[b1[0]][b1[1]] &&
        b[a[0]][a[1]] === b[c[0]][c[1]]
      ) {
        return b[a[0]][a[1]];
      }
    }

    return null;
  };

  // ゲーム未開始時の画面
  if (!isGameStarted) {
    return (
      <div className={styles.startScreen}>
        <h2>あなたの名前を入力して参加</h2>
        <input
          type="text"
          placeholder="あなたの名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handleJoin}>参加する</button>
      </div>
    );
  }

  // ゲーム画面
  return (
    <div className={styles.wrapper}>
      <h2 className={styles.turnDisplay}>
        {winner
          ? winner === '引き分け'
            ? '引き分け！'
            : `${winner === playerSymbol ? name : opponentName}の勝ち！`
          : `次の手: ${currentPlayer === playerSymbol ? name : opponentName}`}
      </h2>

      <div className={styles.board}>
        {/* 3x3のマスをループで表示 */}
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleClick(rowIndex, colIndex)}
              className={`${styles.cell} ${
                cell === '〇' ? styles.circle : cell === '×' ? styles.cross : ''
              }`}
            >
              {cell}
            </button>
          ))
        )}
      </div>

      <button onClick={handleReset} className={styles.reset}>
        リセット
      </button>
    </div>
  );
}
