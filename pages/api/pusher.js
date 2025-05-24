import Pusher from 'pusher';

const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

// グローバルで参加者を保持
let players = [];

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { event, channel, data } = req.body;

    if (event === 'join') {

      // まだ登録されていないなら追加
      if (!players.find(p => p.name === data.name)) {
        players.push(data);
      }

      // 両者が揃ったら通知
      if (players.length === 2) {
        await pusherServer.trigger(channel, 'join', {
          player1: players[0],
          player2: players[1],
        });
      }

      return res.status(200).json({ success: true });
    }

    if (event === 'reset') {
      players = []; // リセット時に初期化
    }

    // それ以外のイベント（move, reset）はそのまま中継
    await pusherServer.trigger(channel, event, data);
    return res.status(200).json({ success: true });
  } else {
    //res.status(405).end();
  }
    res.status(405).end();
}