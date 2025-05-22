import TicTacToe from './_components/tic-tac-toe';
import styles from "./page.module.scss";

export const metadata = {
  title: '三目並べ - Lab-Ca.Games',
  description: '〇×ゲームで遊ぼう！',
}

export default function Page() {
  return (
    <main className={styles.main}>
      <h1 className={styles.h1}>三目並べ</h1>
      <TicTacToe />
    </main>
  )
}