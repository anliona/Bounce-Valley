/* ============================================================
 * background.js — Hollow Knight «Слёзы Горожан / Greenpath»
 * ЯРКОЕ светящееся небо-витраж + тёмные силуэты:
 * готические арки, лианы с листвой, кусты, передний план.
 * ============================================================ */
window.BT = window.BT || {};

BT.Background = class {
  constructor(themeKey, seed) {
    this.themeKey = themeKey;
    this.th = BT.CFG.themes[themeKey];
    this.W = 2048; this.H = 1200;
    this.rng = BT.Utils.seededRandom(seed || this.th.parallaxSeed);

    /* свечение неба по теме (яркий центр между арками) */
    this.GLOWS = {
      forest: { inner: '#eaf3f8', mid: '#9fbdda', edge: '#1c2b3d' },
      cave:   { inner: '#e6def4', mid: '#9688bd', edge: '#151021' },
      ruins:  { inner: '#e2ebf4', mid: '#93acc8', edge: '#141d28' },
    }[themeKey];

    this.build();
  }

  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* мягкое пятно свечения */
  glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /* ============================================================
     НЕБО: вертикальный градиент + радиальное «окно» света
     + затемнение углов. Печётся один раз в canvas 960x540.
     ============================================================ */
  buildSky() {
    const G = this.GLOWS;
    this.skyC = this.makeCanvas(960, 540);
    const s = this.skyC.getContext('2d');

    const v = s.createLinearGradient(0, 0, 0, 540);
    v.addColorStop(0, G.edge);
    v.addColorStop(0.55, G.mid);
    v.addColorStop(1, G.edge);
    s.fillStyle = v;
    s.fillRect(0, 0, 960, 540);

    /* яркое световое окно в центре */
    const r = s.createRadialGradient(480, 285, 30, 480, 285, 470);
    r.addColorStop(0, G.inner);
    r.addColorStop(0.45, G.mid);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = r;
    s.fillRect(0, 0, 960, 540);

    /* угловое затемнение (глубина) */
    const c1 = s.createRadialGradient(480, 270, 240, 480, 270, 640);
    c1.addColorStop(0, 'rgba(0,0,0,0)');
    c1.addColorStop(1, 'rgba(4,6,12,0.75)');
    s.fillStyle = c1;
    s.fillRect(0, 0, 960, 540);
  }

  /* ============================================================
     Готическая колоннада-арки (силуэт).
     count — число пролётов; dark — цвет силуэта.
     ============================================================ */
  arches(ctx, W, H, color, count, vineColor) {
    const aw = W / count;
    const pw = aw * 0.13;            // половина ширины колонны
    const spring = H * 0.46;         // высота, с которой начинается арка
    const base = H * 0.92;
    const archR = aw / 2 - pw * 0.4;

    /* тёмная масса над арками */
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, spring - archR * 0.9);

    /* пролёты арок */
    ctx.lineWidth = pw * 1.5;
    for (let i = 0; i < count; i++) {
      const cx = i * aw + aw / 2;
      /* клинья над аркой */
      ctx.beginPath();
      ctx.moveTo(cx - archR - pw * 1.2, spring - archR * 0.86);
      ctx.lineTo(cx, spring - archR * 1.25);
      ctx.lineTo(cx + archR + pw * 1.2, spring - archR * 0.86);
      ctx.lineTo(cx + archR + pw * 1.2, spring);
      ctx.lineTo(cx - archR - pw * 1.2, spring);
      ctx.closePath();
      ctx.fill();
      /* сама дуга (кольцо) */
      ctx.beginPath();
      ctx.arc(cx, spring, archR, Math.PI, 0);
      ctx.stroke();
      /* резные кольца по дуге */
      for (let k = 1; k < 4; k++) {
        const a = Math.PI + (k / 4) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * archR, spring + Math.sin(a) * archR, pw * 0.42, 0, BT.Utils.TAU);
        ctx.fill();
      }
    }

    /* колонны с капителями и базами */
    for (let i = 0; i <= count; i++) {
      const cx = i * aw;
      ctx.fillRect(cx - pw, spring, pw * 2, base - spring);
      ctx.fillRect(cx - pw * 1.55, spring - 16, pw * 3.1, 18);   // капитель
      for (let k = 0; k < 3; k++) {                              // резные кольца
        ctx.fillRect(cx - pw * 1.2, spring + 50 + k * 64, pw * 2.4, 7);
      }
      ctx.fillRect(cx - pw * 1.35, base - 12, pw * 2.7, 14);     // база
    }

    /* лианы с листвой, свисающие с арок */
    for (let i = 0; i < count; i++) {
      const cx = i * aw + aw / 2;
      const n = 2 + (this.rng() * 2 | 0);
      for (let k = 0; k < n; k++) {
        const vx = cx + (this.rng() - 0.5) * aw * 0.7;
        const vlen = H * (0.14 + this.rng() * 0.22);
        this.leafVine(ctx, vx, spring - archR * 0.7, vlen, vineColor || color);
      }
    }
    /* кусты у подножия колонн */
    for (let i = 0; i <= count; i++) {
      this.leafBush(ctx, i * aw + (this.rng() - 0.5) * 30, base - 6, 40 + this.rng() * 30, vineColor || color);
    }
  }

  /* лиана: цепочка листовых гроздьев */
  leafVine(ctx, x, topY, len, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.quadraticCurveTo(x + (this.rng() - 0.5) * 24, topY + len * 0.5, x + (this.rng() - 0.5) * 10, topY + len);
    ctx.stroke();
    ctx.fillStyle = color;
    const clumps = Math.floor(len / 26);
    for (let j = 0; j < clumps; j++) {
      const yy = topY + 10 + j * (len / clumps) + this.rng() * 8;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(
          x + (this.rng() - 0.5) * 26,
          yy + k * 5,
          7 + this.rng() * 7, 5 + this.rng() * 4,
          0, 0, BT.Utils.TAU
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* куст: гроздь мелких листьев-эллипсов */
  leafBush(ctx, x, baseY, size, color) {
    ctx.fillStyle = color;
    for (let k = 0; k < 14; k++) {
      ctx.beginPath();
      ctx.ellipse(
        x + (this.rng() - 0.5) * size,
        baseY - this.rng() * size * 0.55,
        9 + this.rng() * 11, 6 + this.rng() * 7,
        0, 0, BT.Utils.TAU
      );
      ctx.fill();
    }
  }

  build() {
    const th = this.th;
    this.buildSky();

    /* ---- Layer 2: дальний план (лёгкие силуэты за арками) ---- */
    this.farC = this.makeCanvas(this.W, this.H);
    const f = this.farC.getContext('2d');
    const farCol = this.hexMix ? this.hexMix(th.farLayer, this.GLOWS.mid, 0.35) : th.farLayer;
    if (this.themeKey === 'forest') {
      this.ridge(f, this.W, this.H * 0.66, 170, farCol, 6);
      this.trees(f, farCol, this.H * 0.7, 90, 20);
    } else if (this.themeKey === 'cave') {
      this.ridge(f, this.W, this.H * 0.6, 240, farCol, 8);
      this.stalactites(f, farCol);
    } else {
      this.domes(f);
      this.columns(f, farCol);
    }
    /* дальние светящиеся споры/окна */
    for (let i = 0; i < 20; i++) {
      this.glow(f, this.rng() * this.W, this.H * (0.3 + this.rng() * 0.45), 18 + this.rng() * 26, th.accent, 0.16);
    }

    /* ---- Layer 3: СРЕДНИЙ ПЛАН — готическая колоннада ---- */
    this.midC = this.makeCanvas(this.W, this.H);
    const m = this.midC.getContext('2d');
    const midDark = th.groundEdge;   // почти чёрный силуэт
    this.arches(m, this.W, this.H, midDark, 4, th.nearLayer);
    /* редкие грибы-светлячки в лесу */
    if (this.themeKey === 'forest') {
      for (let i = 0; i < 8; i++) {
        this.glow(m, this.rng() * this.W, this.H * (0.8 + this.rng() * 0.12), 30, th.accent, 0.14);
      }
    }
    if (this.themeKey === 'cave') {
      for (let i = 0; i < 10; i++) {
        this.crystalCluster(m, this.rng() * this.W, this.H * (0.55 + this.rng() * 0.3), 14 + this.rng() * 20, th.accent, 0.4);
      }
    }

    /* ---- ПЕРЕДНИЙ план: тёмные кусты + лианы ---- */
    this.nearC = this.makeCanvas(this.W, this.H);
    const n = this.nearC.getContext('2d');
    n.fillStyle = th.nearLayer;
    /* органические комья вдоль низа */
    for (let x = -80; x < this.W + 160; x += 120 + this.rng() * 140) {
      n.beginPath();
      n.ellipse(x, this.H + 30, 150 + this.rng() * 110, 70 + this.rng() * 80, 0, 0, BT.Utils.TAU);
      n.fill();
    }
    /* ПЛОТНЫЕ ТЁМНЫЕ КУСТЫ */
    for (let x = -60; x < this.W + 120; x += 80 + this.rng() * 120) {
      const baseY = this.H - 14 - this.rng() * 34;
      this.leafBush(n, x + 40, baseY, 90 + this.rng() * 90, th.nearLayer);
      /* травяные силуэты */
      n.strokeStyle = th.nearLayer;
      n.lineWidth = 2.6;
      for (let gCount = 0; gCount < 6; gCount++) {
        const gx = x + this.rng() * 160 - 30;
        const gh = 22 + this.rng() * 34;
        n.beginPath();
        n.moveTo(gx, baseY + 6);
        n.quadraticCurveTo(gx + (this.rng() * 12 - 6), baseY - gh * 0.55, gx + (this.rng() * 16 - 8), baseY - gh);
        n.stroke();
      }
    }
    /* свисающее сверху: лианы с листвой / сталактиты / цепи */
    if (this.themeKey === 'cave') {
      n.fillStyle = th.nearLayer;
      for (let x = 0; x < this.W; x += 50 + this.rng() * 90) {
        const len = 90 + this.rng() * 220, w = 20 + this.rng() * 36;
        n.beginPath();
        n.moveTo(x - w, 0);
        n.lineTo(x + w, 0);
        n.lineTo(x + this.rng() * w - w / 2, len);
        n.closePath(); n.fill();
      }
    } else {
      for (let x = 30; x < this.W; x += 60 + this.rng() * 100) {
        this.leafVine(n, x, 0, 80 + this.rng() * 200, th.nearLayer);
      }
    }

    /* ---- 浮尘粒子 ---- */
    this.motes = [];
    for (let i = 0; i < 36; i++) {
      this.motes.push({
        x: this.rng(), y: this.rng(),
        s: 1 + this.rng() * 2.2,
        depth: 0.3 + this.rng() * 0.7,
        drift: 4 + this.rng() * 10,
        rise: 5 + this.rng() * 14,
        tw: 0.8 + this.rng() * 1.6,
        ph: this.rng() * BT.Utils.TAU,
        base: 0.14 + this.rng() * 0.3,
        color: this.themeKey === 'cave' ? '#b8dcf0' : this.themeKey === 'ruins' ? '#c4d8ee' : '#dceef8',
      });
    }
  }

  /* смешивание hex-цветов */
  hexMix(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
    const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* гроздь кристаллов с гранями и свечением */
  crystalCluster(ctx, x, y, size, color, alpha) {
    ctx.save();
    this.glow(ctx, x, y, size * 2.4, color, alpha * 0.5);
    ctx.globalAlpha = Math.min(1, alpha + 0.25);
    const shards = 3 + (this.rng() * 2 | 0);
    for (let i = 0; i < shards; i++) {
      const a = -Math.PI / 2 + (i - shards / 2) * 0.4 + this.rng() * 0.2;
      const len = size * (0.6 + this.rng() * 0.6);
      const w = size * 0.22;
      const tipX = x + Math.cos(a) * len, tipY = y + Math.sin(a) * len;
      const px = Math.cos(a + Math.PI / 2) * w, py = Math.sin(a + Math.PI / 2) * w;
      ctx.beginPath();
      ctx.moveTo(x - px, y - py);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(x + px, y + py);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - px * 0.4, y - py * 0.4);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* 山脊剪影 */
  ridge(ctx, W, baseY, amp, color, steps) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    let y = baseY;
    for (let x = 0; x <= W; x += W / steps) {
      y = baseY - this.rng() * amp;
      ctx.lineTo(x, y);
      ctx.lineTo(x + W / steps / 2, baseY - amp * 0.4 - this.rng() * amp * 0.4);
    }
    ctx.lineTo(W, this.H);
    ctx.closePath(); ctx.fill();
  }

  /* 遗迹穹顶 */
  domes(ctx) {
    ctx.fillStyle = this.th.midLayer;
    for (let i = 0; i < 4; i++) {
      const x = this.rng() * this.W, r = 60 + this.rng() * 90, y = this.H * 0.62;
      ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - r, y, r * 2, this.H - y);
    }
  }

  /* 远树 */
  trees(ctx, color, baseY, h, w) {
    ctx.fillStyle = color;
    for (let x = 20; x < this.W; x += 40 + this.rng() * 55) {
      const hh = h * (0.6 + this.rng() * 0.8);
      const ww = w * (0.7 + this.rng() * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + ww / 2, baseY - hh);
      ctx.lineTo(x + ww, baseY);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(x + ww / 2 - 3, baseY - 12, 6, 14);
    }
  }

  /* 钟乳石 */
  stalactites(ctx, color) {
    ctx.fillStyle = color;
    for (let x = 30; x < this.W; x += 60 + this.rng() * 90) {
      const len = 70 + this.rng() * 200;
      const w = 24 + this.rng() * 40;
      ctx.beginPath();
      ctx.moveTo(x - w, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x, len);
      ctx.closePath(); ctx.fill();
    }
  }

  /* 神庙柱廊 */
  columns(ctx, color) {
    ctx.fillStyle = color;
    for (let x = 60; x < this.W; x += 170 + this.rng() * 80) {
      const w = 34 + this.rng() * 20, h = 340 + this.rng() * 220, y = this.H - h;
      ctx.fillRect(x, y, w, h);
      ctx.fillRect(x - 10, y, w + 20, 22);
      ctx.fillRect(x - 8, this.H - 26, w + 16, 26);
    }
  }

  /* ---------- основной фон (до мира) ---------- */
  draw(ctx, cam, viewW, viewH, time) {
    /* небо-витраж со свечением */
    ctx.drawImage(this.skyC, 0, 0, 960, 540, 0, 0, viewW, viewH);

    this.tileLayer(ctx, this.farC, cam.x * 0.12, cam.y * 0.05, viewW);
    this.tileLayer(ctx, this.midC, cam.x * 0.3, cam.y * 0.12, viewW);

    /* лёгкий туман у земли */
    for (let i = 0; i < 2; i++) {
      const y = viewH * (0.62 + i * 0.18) + Math.sin(time * 0.3 + i * 2.1) * 14;
      const a = 0.03 + i * 0.015;
      const g = ctx.createLinearGradient(0, y - 40, 0, y + 60);
      g.addColorStop(0, 'rgba(210, 228, 244, 0)');
      g.addColorStop(0.5, `rgba(210, 228, 244, ${a})`);
      g.addColorStop(1, 'rgba(210, 228, 244, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 40, viewW, 100);
    }

    /* 浮尘 */
    for (const m of this.motes) {
      const spanW = viewW + 60, spanH = viewH + 60;
      const px = ((((m.x * viewW) - cam.x * 0.22 * m.depth + time * m.drift) % spanW) + spanW) % spanW - 30;
      const py = ((((m.y * viewH) - time * m.rise - cam.y * 0.15 * m.depth) % spanH) + spanH) % spanH - 30;
      ctx.globalAlpha = m.base * (0.55 + 0.45 * Math.sin(time * m.tw + m.ph));
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(px, py, m.s, 0, BT.Utils.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- передний план (после мира и игрока) ---------- */
  drawForeground(ctx, cam, viewW, viewH, time) {
    ctx.save();
    ctx.globalAlpha = 0.94;
    this.tileLayer(ctx, this.nearC, cam.x * 1.25, cam.y * 0.6 + 40, viewW);
    ctx.restore();

    /* дождь в руинах */
    if (this.themeKey === 'ruins') {
      ctx.strokeStyle = 'rgba(168, 200, 232, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const sx = (((i * 97.31 + time * 300) % (viewW + 60)) + (viewW + 60)) % (viewW + 60) - 30;
        const sy = (((i * 173.77 + time * 950) % (viewH + 80)) + (viewH + 80)) % (viewH + 80) - 40;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 3, sy + 15);
      }
      ctx.stroke();
    }
  }

  tileLayer(ctx, canvas, offX, offY, viewW) {
    const x = -(((offX % this.W) + this.W) % this.W);
    const y = -BT.Utils.clamp(offY, -140, 140);
    ctx.drawImage(canvas, x, y);
    if (x + this.W < viewW) ctx.drawImage(canvas, x + this.W, y);
    if (x > 0) ctx.drawImage(canvas, x - this.W, y);
  }
};
