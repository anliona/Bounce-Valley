/* ============================================================
 * entities/hazards.js — 陷阱系统：
 * 尖刺 / 移动尖刺球 / 落石 / 能量激光
 * 所有危险物都有高对比度的视觉警示
 * ============================================================ */
window.BT = window.BT || {};

/* ---------------- 尖刺（地面） ---------------- */
BT.Spikes = class extends BT.Entity {
  constructor(cx, cy) {
    const T = BT.CFG.tile;
    super(cx * T, cy * T, T, T);
    this.killRect = { x: this.x + 5, y: this.y + 38, w: T - 10, h: 26 };
  }

  update(dt, game) {
    const p = game.player;
    const r = p.radius * 0.8;   // 判定略宽容
    if (BT.Utils.circleRectOverlap(p.pos.x, p.pos.y, r,
      this.killRect.x, this.killRect.y, this.killRect.w, this.killRect.h)) {
      game.killPlayer();
    }
  }

  draw(ctx, game) {
    const T = BT.CFG.tile;
    ctx.save();
    ctx.translate(this.x, this.y);
    /* 底座 */
    ctx.fillStyle = '#39404e';
    ctx.fillRect(0, T - 7, T, 7);
    /* 三根尖刺 */
    const g = ctx.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, '#eef3f8'); g.addColorStop(1, '#8b95a5');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#2c3340'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const bx = 8 + i * 20;
      ctx.beginPath();
      ctx.moveTo(bx, T - 6);
      ctx.lineTo(bx + 9, 16);
      ctx.lineTo(bx + 18, T - 6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
};

/* ---------------- 移动尖刺球（沿路径往返） ---------------- */
BT.SpikeBall = class extends BT.Entity {
  constructor(cx, cy, meta) {
    const T = BT.CFG.tile;
    const bx = cx * T + T / 2, by = cy * T + T / 2;
    super(bx - 26, by - 26, 52, 52);
    this.baseX = bx; this.baseY = by;
    this.ax = (meta.dx || 0) * T;
    this.ay = (meta.dy || 0) * T;
    this.period = meta.period || 3;
    this.t = (meta.phase || 0) * this.period;
    this.x0 = bx; this.y0 = by;
    this.r = 24;
  }

  update(dt, game) {
    this.t += dt;
    const k = 0.5 - 0.5 * Math.cos(BT.Utils.TAU * this.t / this.period);
    this.x0 = this.baseX + this.ax * k;
    this.y0 = this.baseY + this.ay * k;
    const p = game.player;
    const rr = this.r + p.radius * 0.82;
    if (BT.Utils.dist2(p.pos.x, p.pos.y, this.x0, this.y0) < rr * rr) {
      game.killPlayer();
    }
  }

  reset() { this.t = (this.phase0 || 0); }

  draw(ctx, game) {
    ctx.save();
    /* 路径虚线提示 */
    if (this.ax || this.ay) {
      ctx.strokeStyle = 'rgba(255,90,80,.22)';
      ctx.lineWidth = 3; ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.moveTo(this.baseX - this.ax / 2, this.baseY - this.ay / 2);
      ctx.lineTo(this.baseX + this.ax / 2, this.baseY + this.ay / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.translate(this.x0, this.y0);
    ctx.rotate(this.t * 2.2);
    /* 尖刺 */
    ctx.fillStyle = '#c9d2dd';
    ctx.strokeStyle = '#333a48'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const a = i * BT.Utils.TAU / 10;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.14) * 20, Math.sin(a - 0.14) * 20);
      ctx.lineTo(Math.cos(a) * 31, Math.sin(a) * 31);
      ctx.lineTo(Math.cos(a + 0.14) * 20, Math.sin(a + 0.14) * 20);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    /* 球体 */
    const g = ctx.createRadialGradient(-7, -8, 3, 0, 0, 23);
    g.addColorStop(0, '#5d6b80'); g.addColorStop(1, '#232b3a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, BT.Utils.TAU); ctx.fill();
    ctx.restore();
  }
};

/* ---------------- 能量激光（周期性开启 / 关闭） ---------------- */
BT.Laser = class extends BT.Entity {
  constructor(cx, cy, meta) {
    const T = BT.CFG.tile;
    const h = meta.h || 5;
    const bx = cx * T + T / 2;
    const top = (cy + 1 - h) * T;
    const bottom = (cy + 1) * T;
    super(bx - 14, top, 28, bottom - top);
    this.col = cx; this.row = cy;
    this.h = h;
    this.beamRect = { x: bx - 7, y: top + 10, w: 14, h: h * T - 20 };
    this.onTime = meta.on != null ? meta.on : 1.2;
    this.offTime = meta.off != null ? meta.off : 1.2;
    this.phase = meta.phase || 0;
    this.disabled = false;        // 被开关关闭
    this.id = null;
    this.warnAcc = 0;
  }

  get period() { return this.onTime + this.offTime; }

  state(t) {
    if (this.disabled) return 'off';
    const k = ((t + this.phase) % this.period + this.period) % this.period;
    if (k < this.onTime) return 'on';
    if (k > this.period - 0.4) return 'warn';
    return 'off';
  }

  activate(game) {
    this.disabled = true;
  }

  update(dt, game) {
    const st = this.state(game.level.time);
    if (st === 'on') {
      if (this._last !== 'on') game.audio.sfx('laser');
      const p = game.player;
      if (BT.Utils.circleRectOverlap(p.pos.x, p.pos.y, p.radius * 0.82,
        this.beamRect.x, this.beamRect.y, this.beamRect.w, this.beamRect.h)) {
        game.killPlayer();
      }
    }
    this._last = st;
  }

  draw(ctx, game) {
    const t = game.level.time;
    const st = this.state(t);
    ctx.save();
    /* 上下发射器 */
    for (const [ex, ey] of [[this.x + 14, this.beamRect.y - 4], [this.x + 14, this.beamRect.y + this.beamRect.h + 4]]) {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#465064';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = st === 'on' ? '#ff5a4a' : (st === 'warn' ? '#ffb05a' : '#7a8494');
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
    /* 光束 */
    if (st === 'on') {
      const flick = 0.85 + Math.sin(t * 40) * 0.15;
      ctx.globalAlpha = 0.35 * flick;
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(this.x + 4, this.beamRect.y - 6, 20, this.beamRect.h + 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd6d0';
      ctx.fillRect(this.x + 11, this.beamRect.y, 6, this.beamRect.h);
    } else if (st === 'warn') {
      const blink = Math.sin(t * 30) > 0;
      if (blink) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ffb05a';
        ctx.setLineDash([5, 9]); ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x + 14, this.beamRect.y);
        ctx.lineTo(this.x + 14, this.beamRect.y + this.beamRect.h);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
};

/* ---------------- 落石（进入区域后掉落） ---------------- */
BT.FallingRock = class extends BT.Entity {
  constructor(cx, cy, meta) {
    const T = BT.CFG.tile;
    super(cx * T, cy * T, T, T);
    this.spawnX = this.x + T / 2;
    this.spawnY = this.y + T / 2;
    /* 触发区：标记格下方左右各 1 格、向下 3 格 */
    this.trigger = { x: this.x - T, y: this.y, w: T * 3, h: T * 3 };
    this.warnDelay = meta.delay != null ? meta.delay : 0.35;
    this.respawnTime = meta.respawn != null ? meta.respawn : 3.5;
    this.cool = 0;
    this.warnT = 0;
    this.active = false;          // 岩石正在下落
    this.rockY = 0; this.rockVY = 0;
  }

  update(dt, game) {
    this.cool = Math.max(0, this.cool - dt);
    const p = game.player;

    if (!this.active && this.cool <= 0 && this.warnT <= 0) {
      if (BT.Utils.circleRectOverlap(p.pos.x, p.pos.y, p.radius,
        this.trigger.x, this.trigger.y, this.trigger.w, this.trigger.h)) {
        this.warnT = this.warnDelay;   // 预警：头顶碎石抖动
        game.audio.sfx('crumble');
      }
    }
    if (this.warnT > 0) {
      this.warnT -= dt;
      if (Math.random() < 0.5) {
        game.particles.emit({
          x: this.spawnX + BT.Utils.rand(-20, 20), y: this.spawnY + BT.Utils.rand(-6, 6),
          vx: BT.Utils.rand(-30, 30), vy: BT.Utils.rand(20, 70),
          size: 3, maxLife: 0.4, color: '#9a8f80', gravity: 300,
        });
      }
      if (this.warnT <= 0) {
        this.active = true;
        this.rockY = this.spawnY;
        this.rockVY = 60;
        game.audio.sfx('rock');
      }
    }

    if (this.active) {
      this.rockVY += BT.CFG.physics.gravity * 1.1 * dt;
      this.rockY += this.rockVY * dt;
      /* 命中玩家 */
      const rr = 24 + p.radius * 0.85;
      if (BT.Utils.dist2(p.pos.x, p.pos.y, this.spawnX, this.rockY) < rr * rr) {
        game.killPlayer();
      }
      /* 撞地碎裂 */
      const cellBelow = game.level.solidAtPoint(this.spawnX, this.rockY + 26);
      if (cellBelow) {
        this.active = false;
        this.cool = this.respawnTime;
        game.particles.burst(this.spawnX, this.rockY + 20, ['#8b8578', '#6e6a5e', '#a49e90'], 12, 240, { size: 8, shape: 'rect' });
        game.camera.shake(5, 0.18);
        game.audio.sfx('break');
      }
      if (this.rockY > game.level.pixelHeight + 200) { this.active = false; this.cool = this.respawnTime; }
    }
  }

  reset() { this.active = false; this.warnT = 0; this.cool = 0; }

  draw(ctx, game) {
    /* 顶部裂纹警示 */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,120,90,.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x + 14, this.y + 6); ctx.lineTo(this.x + 30, this.y + 22);
    ctx.lineTo(this.x + 22, this.y + 30); ctx.lineTo(this.x + 44, this.y + 48);
    ctx.stroke();
    /* 下落中的岩石 */
    if (this.active) {
      ctx.translate(this.spawnX, this.rockY);
      ctx.rotate(this.rockVY * 0.001);
      const g = ctx.createRadialGradient(-8, -8, 4, 0, 0, 26);
      g.addColorStop(0, '#a49e90'); g.addColorStop(1, '#5e5a50');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-24, -10); ctx.lineTo(-10, -24); ctx.lineTo(14, -20);
      ctx.lineTo(24, 2); ctx.lineTo(12, 22); ctx.lineTo(-14, 20);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3c3a32'; ctx.lineWidth = 2.5; ctx.stroke();
    }
    ctx.restore();
  }
};
