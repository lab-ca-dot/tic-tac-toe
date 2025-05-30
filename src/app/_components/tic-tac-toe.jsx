'use client'

import { useEffect, useState } from 'react';
import pusherClient from '../lib/pusher';
import styles from './tic-tac-toe.module.scss';

export default function TicTacToe() {
  // 3x3の空のボードを初期化（すべて''）
  const emptyBoard = Array(3).fill(null).map(() => Array(3).fill(''));

  // プレイヤー名、記号、ゲーム状態の管理
  const [name, setName] = useState(''); // 自分の名前
  const [playerSymbol, setPlayerSymbol] = useState(null); // '〇' or '×'
  const [opponentName, setOpponentName] = useState(''); // 相手の名前
  const [isGameStarted, setIsGameStarted] = useState(false); // ゲームが始まったかどうか
  const [isWaiting, setIsWaiting] = useState(false);

  // ゲーム進行に関する状態
  const [board, setBoard] = useState(emptyBoard); // ボードの状態
  const [currentPlayer, setCurrentPlayer] = useState('〇'); // 現在のプレイヤー（〇 or ×）
  const [winner, setWinner] = useState(null); // 勝者が決まったときに使う

  // 満員かどうか
  const [isFull, setIsFull] = useState(false);

  // 通信イベントの設定
  useEffect(() => {
    if (!name) return;

    const channel = pusherClient.subscribe('game-channel');

    if (!name) return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
    // プレイヤー参加通知を受け取る
    channel.bind('join', ({ player1, player2 }) => {
      console.log('[JOIN] 自分:', name);
      console.log('[JOIN] 受信したプレイヤー:', player1?.name, player2?.name);

      // どちらにも自分の名前がなければ → 満員と判断
      if (player1?.name !== name && player2?.name !== name) {
        setIsFull(true);
        return;
      }

      // 自分が player1 か player2 かを判断
      if (player1?.name === name) {
        setPlayerSymbol('〇');
        setOpponentName(player2?.name || '（未参加）');
      } else if (player2?.name === name) {
        setPlayerSymbol('×');
        setOpponentName(player1?.name || '（未参加）');
      }

      setIsGameStarted(true);
    });

    // 相手の手を反映
    channel.bind('move', ({ row, col, mark }) => {
      setBoard((prev) => {
        const newBoard = prev.map((r) => [...r]);
        newBoard[row][col] = mark;
        return newBoard;
      });
      // ここで currentPlayer を次に交代する
      setCurrentPlayer((prev) => (prev === '〇' ? '×' : '〇'));
    });

    // ゲームリセットを受け取る
    channel.bind('reset', () => {
      setBoard(emptyBoard);
      setWinner(null);
      setCurrentPlayer('〇');
      setIsGameStarted(false);
      setPlayerSymbol(null);
      setOpponentName('');
    });


    // ゲーム終了を受け取る
    channel.bind('end', ({ winner }) => {
      setWinner(winner);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [name]); // ← nameを依存に追加！

  // プレイヤーが参加ボタンを押したときの処理
  const handleJoin = async () => {

    //名前がない、もしくは満員なら何も返さない
    if (!name || isFull) return;

    setIsWaiting(true); // ローディング状態を表示したければ

    // 現在の参加者数を把握する手段がないので、強制的に全員が `join` イベントを出して、
    // Pusher 経由でそれぞれのクライアントに「あなたは〇です」「あなたは×です」を伝える方式に。
    await fetch('/api/pusher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'game-channel',
        event: 'join',
        data: { name },
      }),
    });

    // 名前をuseStateに反映（useEffectでnameが依存になるため）
    //setName(name);

    // 10秒以内にjoinイベントを受け取ればゲームが始まる
    setTimeout(() => {
      setIsWaiting(false); // タイムアウトしたら待機解除（オプション）
    }, 10000);

  };

  // マスをクリックしたときの処理
  const handleClick = async (row, col) => {

    // 現在の this プレイヤーのマークが currentPlayer でなければ処理しない
    if (board[row][col] !== '' || winner || currentPlayer !== playerSymbol) return;

    // 手をローカルに反映（UI表示のため）※ただし currentPlayer の更新はしない
    const newBoard = board.map((r) => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);

    // 勝敗チェック
    const w = checkWinner(newBoard);
    if (w) {
      setWinner(w); // 勝者がいればセット

      // 相手にも勝者を伝える
      await fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'game-channel',
          event: 'end',
          data: { winner: w },
        }),
      });

    } else if (newBoard.flat().every(cell => cell !== '')) {
      setWinner('引き分け'); // 全マス埋まっているが勝者なし

      // 引き分けも相手に通知
      await fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'game-channel',
          event: 'end',
          data: { winner: '引き分け' },
        }),
      });

    }

    // サーバーに手を通知
    await fetch('/api/pusher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'game-channel',
        event: 'move',
        data: { row, col, mark: currentPlayer },
      }),
    });
  };

  // 「リセット」ボタンが押されたときの処理
  const handleReset = async () => {
    await fetch('/api/pusher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'game-channel',
        event: 'reset',
        data: {},
      }),
    });
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
    let waitingContent;
    if (isFull ) {
      waitingContent = <h2>ほかの人がプレイ中です。しばらくお待ちください。...</h2>;
    } else if (isWaiting) {
      waitingContent = <h2>相手が参加するのを待っています...</h2>;
    } else {
      waitingContent = (
        <>
          <h2>あなたの名前を入力して参加</h2>
          <input
            type="text"
            placeholder="あなたの名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={handleJoin}>参加する</button>
        </>
      );
    }

    return (
      <div className={styles.startScreen}>
        {waitingContent}
      </div>
    );
  }

  // ゲーム画面
  return (
    <div className={styles.wrapper}>
      <h2 className={`${styles.turnDisplay} ${
        currentPlayer === playerSymbol ? styles.myTurn : ''
      }`}>
          {winner
            ? winner === '引き分け'
              ? '引き分け！'
              : `あなたの${winner === playerSymbol ? '勝ち!!' : "負け..." || '???'}`
            : `次の手: ${currentPlayer === playerSymbol ? name : opponentName || '???'}さん`}
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
      <p className={styles.playerRole}>
        {name}さんは<strong className={`${
                playerSymbol === '〇' ? styles.circle : playerSymbol === '×' ? styles.cross : ''
              }`}>{playerSymbol}</strong>です
      </p>
      <button onClick={handleReset} className={styles.reset}>
        リセット
      </button>
    </div>
  );
}
