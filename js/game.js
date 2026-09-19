/* ============================================================
 * game.js — 游戏主管理器（GameManager）
 * 状态机（菜单/游戏/暂停/通关）+ 固定物理步长主循环 + 渲染管线
 * ============================================================ */
window.BT = window.BT || {};

BT.GameManager = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.input = BT.input;
    this.audio = BT.audio;
    this.save = BT.save;

    const V = BT.CFG.view;
    this.camera = new BT.CameraController(V.width / V.zoom, V.height / V.zoom);
    this.particles = new BT.ParticleSystem();
    this.ui = new BT.UIManager(this);
    this.debug = new BT.DebugPanel(this);

    this.state = 'splash';         // menu | splash | playing | paused | complete
    this.splashT = 0;
    this.level = null;
    this.player = null;
    this.background = null;
    this.levelIndex = 0;

    this.orbCount = 0;
    this.deaths = 0;
    this.timer = 0;
    this.dieT = 0;
    this.acc = 0;
    this.lastT = 0;
    this.fps = 60;
    this._fpsAcc = 0; this._fpsN = 0;
    this._hudT = 0;
    this._musicTheme = null;
    this._audioReady = false;
  }

  start() {
    this.ui.showScreen('main');
    this.ui.showHUD(false);
    this.lastT = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* 音频解锁后（首次交互）开始播放菜单/关卡音乐 */
  onAudioUnlocked() {
    this._audioReady = true;
    this.setMusic(this.state === 'playing' || this.state === 'paused'
      ? this.level.themeKey : 'forest');
  }

  setMusic(theme) {
    if (this._musicTheme === theme) return;
    this._musicTheme = theme;
    this.audio.startMusic(theme);
  }

  /* ================= 主循环 ================= */
  loop(t) {
    const dt = Math.min((t - this.lastT) / 1000, 0.06);
    this.lastT = t;
    /* FPS 统计 */
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc >= 0.5) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }

    this.update(dt);
    this.render();
    this.debug.update(dt);
    this.input.endFrame();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  update(dt) {
    if (this.input.debugPressed()) this.debug.toggle();

    switch (this.state) {
      case 'splash':
        /* Заставка: любая клавиша/клик пропускает, иначе авто-переход */
        this.splashT += dt;
        if (this.splashT > 5.2 || this.input.pressed.size > 0) this.leaveSplash();
        break;

      case 'menu':
        break;

      case 'playing': {
        if (this.input.pausePressed()) { this.pause(); break; }
        if (this.input.restartPressed()) { this.restartLevel(); break; }
        /* 固定物理步长 */
        this.acc += dt;
        let steps = 0;
        while (this.acc >= BT.CFG.fixedStep && steps < 5) {
          this.stepWorld(BT.CFG.fixedStep);
          this.acc -= BT.CFG.fixedStep;
          steps++;
        }
        if (steps >= 5) this.acc = 0;    // 卡顿保护，避免死亡螺旋
        this.camera.update(dt, this.player, this.level);
        this.particles.update(dt);
        /* HUD 节流刷新 */
        this._hudT -= dt;
        if (this._hudT <= 0) { this._hudT = 0.1; this.ui.updateHUD(); }
        break;
      }

      case 'paused':
        if (this.input.pausePressed()) this.resume();
        break;

      case 'complete':
        this.particles.update(dt);       // 彩带继续飘落
        break;
    }
  }

  /* 一个物理步：平台/箱子 → 玩家 → 传感器与陷阱 */
  stepWorld(dt) {
    this.timer += dt;
    this.level.preUpdate(dt);
    this.player.step(dt, this.level, this.input);
    this.level.postUpdate(dt, this);
    if (this.player.dying) {
      this.dieT += dt;
      if (this.dieT >= 0.7) this.respawnPlayer();
    }
  }

  /* Выход из заставки в главное меню */
  leaveSplash() {
    if (this.state !== 'splash') return;
    this.splashT = 0;
    this.ui.hideSplash();
    this.state = 'menu';
    this.ui.showScreen('main');
  }

  /* ================= 关卡流程 ================= */
  startLevel(index) {
    this.loadLevel(index);
    this.ui.showScreen(null);
    this.ui.showHUD(true);
    this.ui.updateHUD();
    this.ui.toast(`LEVEL ${index + 1} — ${this.level.name}`, 2600);
  }

  loadLevel(index) {
    this.levelIndex = index;
    const def = BT.LEVELS[index];

    this.level = new BT.Level(def);
    this.level.game = this;
    this.player = new BT.Player(this.level.spawnPoint.x, this.level.spawnPoint.y);
    this.background = new BT.Background(def.theme, def.decoSeed);

    this.camera.snapTo(this.player.pos.x, this.player.pos.y, this.level);
    this.particles.clear();

    this.orbCount = 0;
    this.deaths = 0;
    this.timer = 0;
    this.dieT = 0;
    this.acc = 0;

    this.state = 'playing';
    if (this._audioReady) this.setMusic(def.theme);
  }

  restartLevel() {
    this.loadLevel(this.levelIndex);
    this.ui.showScreen(null);
    this.ui.showHUD(true);
    this.ui.toast('重新开始！', 1500);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showScreen('pause');
    this.ui.updateTouchVisible();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.updateTouchVisible();
  }

  toMenu() {
    this.state = 'menu';
    this.ui.showScreen('main');
    this.ui.showHUD(false);
    if (this._audioReady) this.setMusic('forest');
  }

  nextLevel() {
    if (this.levelIndex + 1 < BT.LEVELS.length) {
      this.startLevel(this.levelIndex + 1);
    } else {
      this.toMenu();
    }
  }

  respawnPlayer() {
    this.dieT = 0;
    this.player.respawn();
    this.level.resetForRespawn();
    this.camera.snapTo(this.player.pos.x, this.player.pos.y, this.level);
    this.particles.burst(this.player.pos.x, this.player.pos.y, ['#ffffff', '#bfe3ff'], 10, 150, { size: 5, maxLife: 0.4 });
  }

  /* ================= 事件回调（由实体调用） ================= */
  killPlayer() {
    if (!this.player || this.player.dying || this.state !== 'playing') return;
    this.player.kill(this);
    this.deaths++;
  }

  onOrbCollected(orb) {
    this.orbCount++;
    this.audio.sfx('orb');
    this.particles.sparkle(orb.cx, orb.cy, '#ffe27a');
    this.ui.updateHUD();
  }

  onCheckpoint(cp) {
    this.player.respawnPoint = { x: cp.baseX, y: cp.baseY - 56 };
    this.audio.sfx('checkpoint');
    this.particles.sparkle(cp.baseX, cp.baseY - 60, '#7dff9e');
    this.ui.toast('✔ 检查点已激活', 1600);
  }

  onBreakableHit(rect) {
    if (rect.breakEnt) rect.breakEnt.smash(this);
  }

  levelComplete() {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    this.audio.sfx('win');
    this.particles.confetti(this.player.pos.x, this.player.pos.y);

    const id = this.levelIndex + 1;
    const newRecord = this.save.recordResult(id, this.orbCount, this.level.totalOrbs, this.timer);
    this.ui.showLevelComplete({
      levelId: id,
      name: this.level.name,
      time: this.timer,
      orbs: this.orbCount,
      total: this.level.totalOrbs,
      deaths: this.deaths,
      newRecord,
      hasNext: id < BT.LEVELS.length,
    });
  }

  /* ================= 渲染 ================= */
  render() {
    const ctx = this.ctx;
    const V = BT.CFG.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, V.width, V.height);

    if (!this.level) return;

    /* 视差背景（屏幕空间） */
    this.background.draw(ctx, this.camera, V.width, V.height, this.level.time);

    /* 世界 */
    this.camera.apply(ctx);
    this.level.drawWorld(ctx, this.camera, this);
    this.player.draw(ctx);
    this.level.drawFront(ctx, this.camera, this);
    this.particles.draw(ctx);

    /* 前景剪影层 + 主题天气（屏幕空间，在世界上方） */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.background.drawForeground(ctx, this.camera, V.width, V.height, this.level.time);
    if (this.player.inWater && !this.player.dying) {
      ctx.fillStyle = 'rgba(40, 120, 200, .16)';
      ctx.fillRect(0, 0, V.width, V.height);
    }
    if (this.player.dying && this.dieT < 0.25) {
      ctx.fillStyle = `rgba(200, 30, 20, ${(0.25 - this.dieT) * 1.2})`;
      ctx.fillRect(0, 0, V.width, V.height);
    }
  }
};
