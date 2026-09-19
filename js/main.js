/* ============================================================
 * main.js — 启动入口
 * ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new BT.GameManager(canvas);
  window.BT.game = game;                    // 控制台调试入口

  /* 首次任意输入时解锁 WebAudio（浏览器自动播放策略） */
  BT.input.onFirstInput = () => {
    BT.audio.unlock();
    game.onAudioUnlocked();
  };

  /* 运行时错误提示（开发辅助） */
  window.__errs = [];
  window.addEventListener('error', (e) => {
    const msg = e.message || (e.error && e.error.message) || 'unknown error';
    window.__errs.push(msg);
    const el = document.getElementById('errToast');
    el.textContent = '⚠ ' + msg;
    el.classList.remove('hidden');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hidden'), 6000);
  });

  game.start();
});
