/* ============================================================
 * entities/mechanisms.js — 机关系统：
 * 移动平台 / 开关 / 门
 * ============================================================ */
window.BT = window.BT || {};

/* ---------------- 移动平台（单向：可从下方穿过，站上后跟随） ---------------- */
BT.MovingPlatform = class extends BT.Entity {
  constructor(cx, cy, meta) {
    const T = BT.CFG.tile;
    const w = (meta.w || 2) * T;
    super(cx * T, cy * T, w, 18);
    this.baseX = this.x; this.baseY = this.y;
    this.ax = (meta.dx || 0) * T;      // 水平振幅（格）
    this.ay = (meta.dy || 0) * T;      // 垂直振幅（格）
    this.period = meta.period || 4;
    this.phase = meta.phase || 0;
    this.t = 0;
    this.deltaX = 0; this.deltaY = 0;
    this.carrier = true;
  }

  update(dt) {
    this.t += dt;
    const k = 0.5 - 0.5 * Math.cos(BT.Utils.TAU * (this.t / this.period + this.phase));
    const nx = this.baseX + this.ax * k;
    const ny = this.baseY + this.ay * k;
    this.deltaX = nx - this.x;
    this.deltaY = ny - this.y;
    this.x = nx; this.y = ny;
  }

  reset() {
    this.t = 0;
    this.x = this.baseX; this.y = this.baseY;
    this.deltaX = this.deltaY = 0;
  }

  /* 顶面矩形（供单向碰撞与"乘坐"检测） */
  get topRect() { return { x: this.x, y: this.y, w: this.w, h: this.h, platform: this }; }

  draw(ctx, game) {
    const th = game.level.theme;
    /* 轨道虚线 */
    if (this.ax || this.ay) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 3; ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(this.baseX + this.w / 2, this.baseY + 9);
      ctx.lineTo(this.baseX + this.ax + this.w / 2, this.baseY + this.ay + 9);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    const g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
    g.addColorStop(0, th.wood); g.addColorStop(1, th.woodDark);
    ctx.fillStyle = g;
    this._rr(ctx, this.x, this.y, this.w, this.h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2.5;
    this._rr(ctx, this.x, this.y, this.w, this.h, 8); ctx.stroke();
    /* 铆钉 */
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    for (let i = 0; i < 3; i++) {
      const bx = this.x + 12 + i * (this.w - 24) / 2;
      ctx.beginPath(); ctx.arc(bx, this.y + this.h / 2, 2.5, 0, BT.Utils.TAU); ctx.fill();
    }
    ctx.restore();
  }

  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

/* ---------------- 开关（触碰后永久激活，驱动门/关闭陷阱） ---------------- */
BT.Switch = class extends BT.Entity {
  constructor(cx, cy, meta) {
    super(cx * BT.CFG.tile, cy * BT.CFG.tile, 64, 64);
    this.baseX = this.x + 32; this.baseY = this.y + 60;
    /* meta: { targets: ['door0', ...] } */
    this.targets = (meta && meta.targets) ? meta.targets.slice() : [];
    this.latched = false;
    this.id = null;                   // 由 level 分配
  }

  update(dt, game) {
    if (this.latched) return;
    const level = game.level;
    let hit = false;
    /* 玩家触碰 */
    const p = game.player;
    if (BT.Utils.dist2(p.pos.x, p.pos.y, this.baseX, this.baseY - 14) < 50 * 50) hit = true;
    /* 箱子压住 */
    if (!hit) {
      for (const b of level.boxes) {
        if (BT.Utils.aabbOverlap(b.x, b.y, b.w, b.h, this.x + 6, this.y + 34, 52, 30)) { hit = true; break; }
      }
    }
    if (hit) {
      this.latched = true;
      game.audio.sfx('switch');
      game.particles.sparkle(this.baseX, this.baseY - 20, '#7dff9e');
      /* 激活所有目标 */
      for (const id of this.targets) {
        const obj = level.objectsById[id];
        if (obj && obj.activate) obj.activate(game);
      }
    }
  }

  draw(ctx, game) {
    const on = this.latched;
    const color = on ? '#58e07a' : '#ff6b57';
    ctx.save();
    ctx.translate(this.baseX, this.baseY);
    /* 底座 */
    ctx.fillStyle = '#3a4454';
    this._rr(ctx, -22, -12, 44, 12, 4); ctx.fill();
    /* 按钮圆顶 */
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -12, 16, Math.PI, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -12, 16, Math.PI, 0);
    ctx.closePath(); ctx.stroke();
    /* 高光 + 激活光柱 */
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(-5, -20, 4, 6, -0.4, 0, BT.Utils.TAU); ctx.fill();
    if (on) {
      ctx.globalAlpha = 0.14 + Math.sin(game.level.time * 4) * 0.05;
      ctx.fillStyle = '#7dff9e';
      ctx.fillRect(-30, -240, 60, 228);
    }
    ctx.restore();
  }

  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

/* ---------------- 门（默认关闭，开关激活后升起打开） ---------------- */
BT.Door = class extends BT.Entity {
  constructor(cells) {
    /* cells: 门块格子数组，合并为包围盒 */
    const T = BT.CFG.tile;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [c, r] of cells) {
      minX = Math.min(minX, c * T); minY = Math.min(minY, r * T);
      maxX = Math.max(maxX, (c + 1) * T); maxY = Math.max(maxY, (r + 1) * T);
    }
    super(minX, minY, maxX - minX, maxY - minY);
    this.openT = 0;          // 0 关闭 → 1 完全打开
    this.opening = false;
    this.carrier = false;
    this.solidWhenClosed = true;
  }

  get isOpen() { return this.openT > 0.55; }

  activate(game) {
    if (this.opening) return;
    this.opening = true;
    game.audio.sfx('door');
    game.camera.shake(3, 0.3);
  }

  reset() { this.openT = 0; this.opening = false; }

  update(dt, game) {
    if (this.opening && this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt / 0.7);
      if (Math.random() < 0.3) {
        game.particles.dust(this.x + BT.Utils.rand(0, this.w), this.y + this.h, 1, 'rgba(200,200,200,.6)');
      }
    }
  }

  /* 碰撞矩形（升起后按比例缩短） */
  get solidRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h * (1 - this.openT) };
  }

  draw(ctx, game) {
    if (this.openT >= 1) return;
    const th = game.level.theme;
    const h = this.h * (1 - this.openT);
    const y = this.y;
    ctx.save();
    const g = ctx.createLinearGradient(this.x, y, this.x + this.w, y);
    g.addColorStop(0, th.groundDark); g.addColorStop(0.5, th.ground); g.addColorStop(1, th.groundDark);
    ctx.fillStyle = g;
    ctx.fillRect(this.x, y, this.w, h);
    ctx.strokeStyle = th.groundEdge; ctx.lineWidth = 4;
    ctx.strokeRect(this.x, y, this.w, h);
    /* 横向纹路 */
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3;
    for (let yy = y + 24; yy < y + h - 8; yy += 30) {
      ctx.beginPath(); ctx.moveTo(this.x + 6, yy); ctx.lineTo(this.x + this.w - 6, yy); ctx.stroke();
    }
    /* 符文（激活后变绿） */
    if (h > 40) {
      const cy = y + h / 2;
      ctx.fillStyle = this.opening ? '#58e07a' : '#ff9a5c';
      ctx.globalAlpha = 0.85 + Math.sin(game.level.time * 5) * 0.15;
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, cy, 8, 0, BT.Utils.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.x + this.w / 2, cy); ctx.lineTo(this.x + this.w / 2, cy - 10); ctx.stroke();
    }
    ctx.restore();
  }
};
