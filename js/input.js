/* ============================================================
 * input.js — 输入管理（键盘 + 触屏按钮）
 * 提供连续状态（按住）与边沿状态（本帧刚按下）
 * ============================================================ */
window.BT = window.BT || {};

BT.InputManager = class {
  constructor() {
    this.keys = new Set();          // 当前按住的键
    this.pressed = new Set();       // 本帧刚按下的键（边沿）
    this.touch = { left: false, right: false, jump: false };
    this.touchJumpEdge = false;     // 触屏跳跃键边沿
    this.onFirstInput = null;       // 首次任意输入（用于解锁音频）

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.touch.left = this.touch.right = this.touch.jump = false; });
  }

  onKey(e, down) {
    const code = e.code;
    if (down) {
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    } else {
      this.keys.delete(code);
    }
    /* 阻止方向键/空格滚动页面 */
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
    if (this.onFirstInput && down) { const f = this.onFirstInput; this.onFirstInput = null; f(); }
  }

  /* -------- 连续状态 -------- */
  get left()  { return this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touch.left; }
  get right() { return this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touch.right; }
  get jumpHeld() { return this.keys.has('Space') || this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touch.jump; }

  /* -------- 边沿状态（每帧由 game.endFrame() 清空） -------- */
  jumpPressed() {
    return this.pressed.has('Space') || this.pressed.has('KeyW') || this.pressed.has('ArrowUp') || this.touchJumpEdge;
  }
  pausePressed() { return this.pressed.has('Escape'); }
  restartPressed() { return this.pressed.has('KeyR'); }
  debugPressed() { return this.pressed.has('Backquote') || this.pressed.has('F3'); }

  endFrame() { this.pressed.clear(); this.touchJumpEdge = false; }

  /* -------- 触屏按钮绑定 -------- */
  bindTouch() {
    const hold = (el, name) => {
      const set = (v) => (e) => {
        e.preventDefault();
        this.touch[name] = v;
        el.classList.toggle('pressed', v);
        if (v && this.onFirstInput) { const f = this.onFirstInput; this.onFirstInput = null; f(); }
      };
      el.addEventListener('pointerdown', set(true));
      el.addEventListener('pointerup', set(false));
      el.addEventListener('pointercancel', set(false));
      el.addEventListener('pointerleave', set(false));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold(document.getElementById('tcLeft'), 'left');
    hold(document.getElementById('tcRight'), 'right');

    const jumpEl = document.getElementById('tcJump');
    jumpEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.touch.jump = true; this.touchJumpEdge = true;
      jumpEl.classList.add('pressed');
      if (this.onFirstInput) { const f = this.onFirstInput; this.onFirstInput = null; f(); }
    });
    const up = (e) => { e.preventDefault(); this.touch.jump = false; jumpEl.classList.remove('pressed'); };
    jumpEl.addEventListener('pointerup', up);
    jumpEl.addEventListener('pointercancel', up);
    jumpEl.addEventListener('pointerleave', up);
    jumpEl.addEventListener('contextmenu', (e) => e.preventDefault());
  }
};

BT.input = new BT.InputManager();
