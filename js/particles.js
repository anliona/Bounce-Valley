/* ============================================================
 * particles.js — 粒子系统
 * 落地尘土 / 死亡爆裂 / 破坏碎屑 / 收集闪光 / 水花 / 彩带
 * ============================================================ */
window.BT = window.BT || {};

BT.ParticleSystem = class {
  constructor(max = 420) {
    this.list = [];
    this.max = max;
  }

  clear() { this.list.length = 0; }

  emit(o) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      x: o.x, y: o.y,
      vx: o.vx || 0, vy: o.vy || 0,
      life: 0, maxLife: o.maxLife || 0.6,
      size: o.size || 6,
      color: o.color || '#fff',
      gravity: o.gravity != null ? o.gravity : 900,
      drag: o.drag != null ? o.drag : 1.5,
      shape: o.shape || 'circle',      // circle | spark | rect
      rot: o.rot || 0, vr: o.vr || 0,
      fade: o.fade !== false,
      glow: o.glow || false,
    });
  }

  /* 通用爆发 */
  burst(x, y, color, count, speed, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * BT.Utils.TAU;
      const s = speed * (0.35 + Math.random() * 0.75);
      this.emit(Object.assign({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.25,
        size: opts.size || (4 + Math.random() * 6),
        maxLife: opts.maxLife || (0.4 + Math.random() * 0.45),
        color: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color,
        shape: opts.shape || 'circle',
      }, opts.extra || {}));
    }
  }

  dust(x, y, n = 5, color = 'rgba(220, 215, 200, 0.8)') {
    for (let i = 0; i < n; i++) {
      this.emit({
        x: x + BT.Utils.rand(-10, 10), y: y + BT.Utils.rand(-4, 2),
        vx: BT.Utils.rand(-70, 70), vy: BT.Utils.rand(-90, -15),
        size: BT.Utils.rand(3, 7), maxLife: BT.Utils.rand(0.25, 0.5),
        color, gravity: 250, drag: 2.5,
      });
    }
  }

  splash(x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      this.emit({
        x: x + BT.Utils.rand(-14, 14), y,
        vx: BT.Utils.rand(-160, 160), vy: BT.Utils.rand(-330, -80),
        size: BT.Utils.rand(3, 7), maxLife: BT.Utils.rand(0.3, 0.6),
        color: 'rgba(140, 205, 245, 0.9)', gravity: 1200,
      });
    }
  }

  sparkle(x, y, color = '#ffe27a') {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * BT.Utils.TAU;
      const s = BT.Utils.rand(40, 190);
      this.emit({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        size: BT.Utils.rand(2.5, 5.5), maxLife: BT.Utils.rand(0.25, 0.55),
        color, gravity: 160, shape: 'spark', glow: true,
      });
    }
  }

  confetti(x, y) {
    const colors = ['#ff6b57', '#ffd54a', '#5ec24e', '#5ee6ff', '#c792ea', '#ff8fab'];
    for (let i = 0; i < 46; i++) {
      this.emit({
        x: x + BT.Utils.rand(-60, 60), y: y + BT.Utils.rand(-30, 10),
        vx: BT.Utils.rand(-260, 260), vy: BT.Utils.rand(-520, -160),
        size: BT.Utils.rand(5, 9), maxLife: BT.Utils.rand(0.8, 1.6),
        color: BT.Utils.choice(colors), gravity: 700, drag: 1.2,
        shape: 'rect', rot: Math.random() * BT.Utils.TAU, vr: BT.Utils.rand(-9, 9),
      });
    }
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life += dt;
      if (p.life >= p.maxLife) { l.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = p.fade ? 1 - t : 1;
      ctx.fillStyle = p.color;
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, BT.Utils.TAU);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-p.size * 2, -p.size * 0.35, p.size * 4, p.size * 0.7);
      } else { // rect
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      }
      ctx.restore();
    }
  }
};
