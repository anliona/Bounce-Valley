/* ============================================================
 * debug.js — 调试面板（开发模式）
 * 实时修改物理参数 / FPS / 坐标 / 快捷操作
 * 开关：` (反引号) 或 F3
 * ============================================================ */
window.BT = window.BT || {};

BT.DebugPanel = class {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.$ = (id) => document.getElementById(id);
    this._uiT = 0;

    /* 滑块 ↔ 配置双向绑定 */
    this.sliders = [
      ['dbgGravity', 'dbgGravityV', 'gravity'],
      ['dbgJump', 'dbgJumpV', 'jumpForce'],
      ['dbgSpeed', 'dbgSpeedV', 'maxMoveSpeed'],
      ['dbgFriction', 'dbgFrictionV', 'groundFriction'],
    ];
    for (const [sid, vid, key] of this.sliders) {
      const el = this.$(sid);
      el.value = BT.CFG.physics[key];
      this.$(vid).textContent = BT.CFG.physics[key];
      el.addEventListener('input', () => {
        BT.CFG.physics[key] = +el.value;
        this.$(vid).textContent = el.value;
      });
    }

    this.$('dbgRestart').addEventListener('click', () => this.game.restartLevel());
    this.$('dbgCheckpoint').addEventListener('click', () => this.teleportToCheckpoint());
    this.$('dbgUnlock').addEventListener('click', () => {
      BT.save.unlockAll();
      this.game.ui.toast('全部关卡已解锁');
    });
    this.$('dbgWin').addEventListener('click', () => {
      if (this.game.state === 'playing') this.game.levelComplete();
    });
  }

  toggle() {
    this.visible = !this.visible;
    this.$('debugPanel').classList.toggle('hidden', !this.visible);
  }

  teleportToCheckpoint() {
    const g = this.game;
    if (g.state !== 'playing' || !g.player) return;
    g.player.pos.x = g.player.respawnPoint.x;
    g.player.pos.y = g.player.respawnPoint.y;
    g.player.vel.x = g.player.vel.y = 0;
    g.camera.snapTo(g.player.pos.x, g.player.pos.y, g.level);
  }

  update(dt) {
    if (!this.visible) return;
    this._uiT -= dt;
    if (this._uiT > 0) return;
    this._uiT = 0.12;
    const g = this.game;
    this.$('dbgFps').textContent = Math.round(g.fps);
    this.$('dbgState').textContent = g.state;
    if (g.player) {
      this.$('dbgPos').textContent = `${Math.round(g.player.pos.x)}, ${Math.round(g.player.pos.y)}`;
    }
  }
};
