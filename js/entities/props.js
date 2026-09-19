/* ============================================================
 * entities/props.js — 场景实体：能量球 / 检查点 / 弹跳平台 /
 * 可破坏块 / 大小装置 / 可推箱子 / 出口传送门 / 提示牌
 * ============================================================ */
window.BT = window.BT || {};

/* 实体基类 */
BT.Entity = class {
  constructor(x, y, w = 0, h = 0) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.alive = true;
  }
  update(dt, game) {}
  draw(ctx, game) {}
};

/* ---------------- 能量球（收集物） ---------------- */
BT.Collectible = class extends BT.Entity {
  constructor(x, y) {
    super(x - 16, y - 16, 32, 32);
    this.cx = x; this.cy = y;
    this.collected = false;
    this.phase = Math.random() * BT.Utils.TAU;
  }

  update(dt, game) {
    if (this.collected) return;
    const p = game.player;
    const bobY = this.cy + Math.sin(game.level.time * 3 + this.phase) * 5;
    const r = p.radius * 0.9 + 14;
    if (BT.Utils.dist2(p.pos.x, p.pos.y, this.cx, bobY) < r * r) {
      this.collected = true;
      game.onOrbCollected(this);
    }
  }

  draw(ctx, game) {
    if (this.collected) return;
    const t = game.level.time * 3 + this.phase;
    const y = this.cy + Math.sin(t) * 5;
    const pulse = 1 + Math.sin(t * 2) * 0.12;
    ctx.save();
    ctx.translate(this.cx, y);
    /* 光晕 */
    ctx.globalAlpha = 0.28 + Math.sin(t * 2) * 0.08;
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, BT.Utils.TAU); ctx.fill();
    ctx.globalAlpha = 1;
    /* 球体 */
    const g = ctx.createRadialGradient(-5, -6, 2, 0, 0, 15);
    g.addColorStop(0, '#fff7d6');
    g.addColorStop(0.45, '#ffd54a');
    g.addColorStop(1, '#f09a2e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 14 * pulse, 0, BT.Utils.TAU); ctx.fill();
    /* 高光 */
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(-4.5, -5.5, 3.2, 0, BT.Utils.TAU); ctx.fill();
    ctx.restore();
  }
};

/* ---------------- 检查点 ---------------- */
BT.Checkpoint = class extends BT.Entity {
  constructor(cx, cy) {
    /* cx,cy 为标记格中心；旗杆立于格底 */
    super(cx - 32, cy - 32, 64, 64);
    this.baseX = cx;
    this.baseY = cy + 32;
    this.active = false;
    this.animT = 0;
  }

  update(dt, game) {
    this.animT += dt;
    if (this.active) return;
    const p = game.player;
    if (BT.Utils.dist2(p.pos.x, p.pos.y, this.x + 32, this.y + 32) < 62 * 62) {
      this.active = true;
      game.onCheckpoint(this);
    }
  }

  draw(ctx, game) {
    const t = this.animT;
    ctx.save();
    ctx.translate(this.baseX, this.baseY);
    /* 杆 */
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(-3, -78, 6, 78);
    ctx.beginPath(); ctx.arc(0, -80, 5, 0, BT.Utils.TAU);
    ctx.fillStyle = this.active ? this.themeAccent(game) : '#9a9a9a';
    ctx.fill();
    /* 旗 */
    const wave = Math.sin(t * (this.active ? 6 : 2)) * 5;
    ctx.fillStyle = this.active ? '#58e07a' : '#8a8a95';
    ctx.beginPath();
    ctx.moveTo(3, -74);
    ctx.quadraticCurveTo(26, -70 + wave, 40, -58 + wave);
    ctx.quadraticCurveTo(24, -52 + wave * 0.5, 3, -46);
    ctx.closePath(); ctx.fill();
    /* 底座 + 激活光环 */
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, 2, 16, 5, 0, 0, BT.Utils.TAU); ctx.fill();
    if (this.active) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.15;
      ctx.strokeStyle = '#58e07a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -40, 34 + Math.sin(t * 3) * 4, 0, BT.Utils.TAU); ctx.stroke();
    }
    ctx.restore();
  }

  themeAccent(game) { return game.level.theme.accent; }
};

/* ---------------- 弹跳平台 ---------------- */
BT.BouncePad = class extends BT.Entity {
  constructor(cx, cy) {
    const T = BT.CFG.tile;
    super(cx * T + 4, cy * T + T - 20, 56, 20);
    this.squashT = 0;
    this.cool = 0;
  }

  update(dt, game) {
    this.squashT = Math.max(0, this.squashT - dt * 5);
    this.cool = Math.max(0, this.cool - dt);
    const p = game.player;
    if (this.cool > 0) return;
    /* 球从上方落到踏板时触发 */
    if (p.vel.y > -50 &&
        p.pos.y + p.radius > this.y - 6 && p.pos.y < this.y + this.h &&
        p.pos.x > this.x - p.radius * 0.6 && p.pos.x < this.x + this.w + p.radius * 0.6) {
      const P = BT.CFG.physics;
      p.vel.y = -P.bouncePadForce * (p.sizeSmall ? 1.08 : 1);
      p.onGround = false; p.groundPlatform = null;
      p.jumpCut = true;   // 弹跳板冲量不受"松键截断"影响
      this.squashT = 1; this.cool = 0.12;
      game.audio.sfx('bounce');
      game.particles.dust(this.x + this.w / 2, this.y, 6, 'rgba(180,230,255,.9)');
      game.camera.shake(3, 0.12);
    }
  }

  draw(ctx, game) {
    const sq = 1 - this.squashT * 0.55;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h);
    /* 底座 */
    ctx.fillStyle = '#3a4454';
    this.roundRect(ctx, -this.w / 2, -8, this.w, 8, 3); ctx.fill();
    /* 弹簧面 */
    const h = 14 * sq + 4;
    const g = ctx.createLinearGradient(0, -8 - h, 0, -8);
    g.addColorStop(0, '#8fd8ff'); g.addColorStop(1, '#3f9fd8');
    ctx.fillStyle = g;
    this.roundRect(ctx, -this.w / 2, -8 - h, this.w, h + 2, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
    this.roundRect(ctx, -this.w / 2, -8 - h, this.w, h + 2, 7); ctx.stroke();
    /* 向上箭头提示 */
    ctx.globalAlpha = 0.75 + Math.sin(game.level.time * 5) * 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -14 - h - 10); ctx.lineTo(-8, -2 - h - 10); ctx.lineTo(8, -2 - h - 10);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

/* ---------------- 可破坏块 ---------------- */
BT.Breakable = class extends BT.Entity {
  constructor(cx, cy) {
    const T = BT.CFG.tile;
    super(cx * T, cy * T, T, T);
    this.cx = cx; this.cy = cy;
    this.broken = false;
  }

  /* 由玩家撞击触发（物理层检测速度），见 level.js */
  smash(game) {
    if (this.broken) return;
    this.broken = true;
    game.level.breakCell(this.cx, this.cy);
    game.audio.sfx('break');
    const cols = [game.level.theme.ground, game.level.theme.groundDark, game.level.theme.cap];
    game.particles.burst(this.x + 32, this.y + 32, cols, 14, 260, { size: 9, shape: 'rect' });
    game.camera.shake(4, 0.15);
  }

  draw(ctx, game) { /* 由关卡瓦片层绘制裂纹块 */ }
};

/* ---------------- 球体大小装置（缩小 / 恢复） ---------------- */
BT.SizeDevice = class extends BT.Entity {
  constructor(cx, cy, kind) {
    super(cx * BT.CFG.tile, cy * BT.CFG.tile, 64, 64);
    this.cx = cx; this.cy = cy;
    this.kind = kind;              // 'shrink' | 'inflate'
    this.cool = 0;
    this.pulse = Math.random() * BT.Utils.TAU;
  }

  update(dt, game) {
    this.cool = Math.max(0, this.cool - dt);
    this.pulse += dt;
    if (this.cool > 0) return;
    const p = game.player;
    const wantSmall = this.kind === 'shrink';
    if (p.sizeSmall === wantSmall) return;
    if (BT.Utils.dist2(p.pos.x, p.pos.y, this.x + 32, this.y + 32) < 52 * 52) {
      p.setSize(wantSmall);
      this.cool = 0.6;
      game.audio.sfx(this.kind === 'shrink' ? 'shrink' : 'inflate');
      game.particles.burst(p.pos.x, p.pos.y,
        this.kind === 'shrink' ? ['#7ee7ff', '#d0f6ff'] : ['#ffb36b', '#ffe0b3'],
        12, 180, { size: 5, glow: true });
    }
  }

  draw(ctx, game) {
    const cx = this.x + 32, cy = this.y + 26;
    const accent = this.kind === 'shrink' ? '#7ee7ff' : '#ffb36b';
    ctx.save();
    /* 机座 */
    ctx.fillStyle = '#465064';
    this._rr(ctx, this.x + 8, this.y + 12, 48, 52, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    this._rr(ctx, this.x + 8, this.y + 12, 48, 52, 10); ctx.stroke();
    /* 发光窗口 */
    const pr = 15 + Math.sin(this.pulse * 3) * 2.5;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.25 + Math.sin(this.pulse * 3) * 0.1;
    ctx.beginPath(); ctx.arc(cx, cy, pr + 8, 0, BT.Utils.TAU); ctx.fill();
    ctx.globalAlpha = 1;
    /* 窗内示意球（大/小） */
    ctx.fillStyle = '#e8402a';
    const r = this.kind === 'shrink' ? 7 : 13;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, BT.Utils.TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, BT.Utils.TAU); ctx.fill();
    /* 底部箭头：缩小向内，恢复向外 */
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const ay = this.y + 56;
    if (this.kind === 'shrink') {
      ctx.beginPath(); ctx.moveTo(cx - 8, ay - 6); ctx.lineTo(cx, ay); ctx.lineTo(cx + 8, ay - 6); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 8, ay); ctx.lineTo(cx, ay - 6); ctx.lineTo(cx + 8, ay); ctx.stroke();
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

/* ---------------- 可推箱子 ---------------- */
BT.PushBox = class extends BT.Entity {
  constructor(cx, cy) {
    const T = BT.CFG.tile;
    super(cx * T + 2, cy * T + 8, 60, 56);
    this.initX = this.x; this.initY = this.y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.pushedT = 0;
    this.deltaX = 0; this.deltaY = 0;   // 供玩家"乘坐"时跟随
  }

  /* 死亡重生时复位 */
  reset() {
    this.x = this.initX; this.y = this.initY;
    this.vx = this.vy = 0;
    this.deltaX = this.deltaY = 0;
    this.pushedT = 0;
    this.onGround = false;
  }

  /* 被玩家水平推动（由 player.js 调用） */
  push(dirX, speed) {
    if (speed <= 0) return;
    const P = BT.CFG.player;
    this.vx = BT.Utils.clamp(dirX * speed, -P.pushMaxSpeed, P.pushMaxSpeed);
    this.pushedT = 0.18;
  }

  step(dt, level) {
    const P = BT.CFG.physics;
    this.pushedT = Math.max(0, this.pushedT - dt);
    /* 重力 */
    this.vy = Math.min(this.vy + P.gravity * dt, P.maxFallSpeed);

    const oldX = this.x, oldY = this.y;

    /* Y 轴移动与碰撞（跳过自身） */
    this.y += this.vy * dt;
    this.onGround = false;
    for (const r of level.solidsNear(this.x + this.w / 2, this.y + this.h / 2, 40)) {
      if (r.box === this) continue;
      if (BT.Utils.aabbOverlap(this.x, this.y, this.w, this.h, r.x, r.y, r.w, r.h)) {
        if (this.vy >= 0 && this.y + this.h - r.y < 30) {
          this.y = r.y - this.h; this.vy = 0; this.onGround = true;
        } else if (this.vy < 0 && r.y + r.h - this.y < 30) {
          this.y = r.y + r.h; this.vy = 0;
        }
      }
    }

    /* X 轴移动与碰撞（跳过自身） */
    this.x += this.vx * dt;
    for (const r of level.solidsNear(this.x + this.w / 2, this.y + this.h / 2, 40)) {
      if (r.box === this) continue;
      if (BT.Utils.aabbOverlap(this.x, this.y, this.w, this.h, r.x, r.y, r.w, r.h)) {
        if (this.vx > 0) this.x = r.x - this.w;
        else if (this.vx < 0) this.x = r.x + r.w;
        this.vx = 0;
      }
    }

    /* 地面摩擦 */
    if (this.onGround && this.pushedT <= 0) {
      const s = Math.sign(this.vx);
      this.vx -= s * Math.min(Math.abs(this.vx), 900 * dt);
    }

    this.deltaX = this.x - oldX;
    this.deltaY = this.y - oldY;
  }

  draw(ctx, game) {
    ctx.save();
    /* 阴影 */
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(this.x + this.w / 2, this.y + this.h + 3, this.w / 2, 5, 0, 0, BT.Utils.TAU); ctx.fill();
    /* 箱体 */
    const th = game.level.theme;
    const g = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
    g.addColorStop(0, th.wood); g.addColorStop(1, th.woodDark);
    ctx.fillStyle = g;
    this._rr(ctx, this.x, this.y, this.w, this.h, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3;
    this._rr(ctx, this.x, this.y, this.w, this.h, 7); ctx.stroke();
    /* 交叉木板纹 */
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(this.x + 6, this.y + 6); ctx.lineTo(this.x + this.w - 6, this.y + this.h - 6);
    ctx.moveTo(this.x + this.w - 6, this.y + 6); ctx.lineTo(this.x + 6, this.y + this.h - 6);
    ctx.stroke();
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

/* ---------------- 关卡出口（发光传送门） ---------------- */
BT.ExitPortal = class extends BT.Entity {
  constructor(cx, cy) {
    const T = BT.CFG.tile;
    super(cx * T, cy * T - T, T, T * 2);
    this.cx = cx * T + T / 2;
    this.cy = cy * T;                 // 传送门中心（跨度两格）
    this.done = false;
  }

  update(dt, game) {
    if (this.done) return;
    const p = game.player;
    if (BT.Utils.dist2(p.pos.x, p.pos.y, this.cx, this.cy) < 58 * 58) {
      this.done = true;
      game.levelComplete();
    }
  }

  draw(ctx, game) {
    const t = game.level.time;
    const accent = game.level.theme.accent;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    /* 外发光 */
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 86);
    glow.addColorStop(0, accent + 'cc');
    glow.addColorStop(0.5, accent + '44');
    glow.addColorStop(1, accent + '00');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 86, 0, BT.Utils.TAU); ctx.fill();
    /* 双层旋转圆环 */
    for (let k = 0; k < 2; k++) {
      const R = 42 - k * 10;
      const rot = t * (k ? -1.6 : 1.3) + k * 1.7;
      ctx.strokeStyle = k ? '#ffffff' : accent;
      ctx.lineWidth = 5 - k * 1.5;
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, R, rot + i * (BT.Utils.TAU / 3), rot + i * (BT.Utils.TAU / 3) + 1.5);
        ctx.stroke();
      }
    }
    /* 中心漩涡 */
    ctx.globalAlpha = 0.9;
    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.6, accent);
    core.addColorStop(1, accent + '00');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, 26 + Math.sin(t * 4) * 3, 0, BT.Utils.TAU); ctx.fill();
    /* 环绕粒子 */
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + i * (BT.Utils.TAU / 5);
      const rr = 30 + Math.sin(t * 3 + i) * 8;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.7, 3, 0, BT.Utils.TAU); ctx.fill();
    }
    /* 底座 */
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, 78, 40, 9, 0, 0, BT.Utils.TAU); ctx.fill();
    ctx.restore();
  }
};

/* ---------------- 提示牌 ---------------- */
BT.HintSign = class extends BT.Entity {
  constructor(x, y, text) {
    super(x - 30, y - 90, 60, 90);
    this.baseX = x; this.baseY = y;
    this.text = text;
  }

  draw(ctx, game) {
    const th = game.level.theme;
    ctx.save();
    ctx.translate(this.baseX, this.baseY);
    /* 牌面 */
    ctx.fillStyle = th.woodDark;
    ctx.fillRect(-4, -46, 8, 46);
    ctx.font = '700 15px "Segoe UI", "Microsoft YaHei", sans-serif';
    const words = this.text;
    ctx.textAlign = 'center';
    /* 自适应分行（每行 ≤ 8 字） */
    const lines = [];
    let cur = '';
    for (const ch of words) {
      cur += ch;
      if (cur.length >= 8) { lines.push(cur); cur = ''; }
    }
    if (cur) lines.push(cur);
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 26;
    const h = lines.length * 20 + 14;
    ctx.fillStyle = th.wood;
    this._rr(ctx, -w / 2, -46 - h, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3;
    this._rr(ctx, -w / 2, -46 - h, w, h, 8); ctx.stroke();
    ctx.fillStyle = '#3a2a18';
    lines.forEach((l, i) => ctx.fillText(l, 0, -46 - h + 22 + i * 20));
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
