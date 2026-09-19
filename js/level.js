/* ============================================================
 * level.js — 关卡系统
 * · 解析 ASCII 分块地图（chunk 拼接）为地形网格 + 实体
 * · 提供空间查询：solidsNear / oneWaysNear / slopesNear / waterAt
 * · 实体编排：preUpdate（平台/箱子/门）→ 玩家 → postUpdate（传感器/陷阱）
 * · 瓦片渲染（按主题着色 + 装饰），水体前景渲染
 *
 * 地图字符图例见 config.js 底部注释。
 * 标记类实体（M/m/r/L/S）按"从上到下、从左到右"扫描顺序
 * 消耗关卡定义中的 meta 数组。
 * ============================================================ */
window.BT = window.BT || {};

/* 网格单元类型（'W'/'D'/'F' 为解析期哨兵，加载完成后清理为 EMPTY） */
const CELL = { EMPTY: 0, SOLID: 1, BREAKABLE: 2, HIDDEN: 3, WATER_MARK: 'W', DOOR_MARK: 'D', FILLABLE: 'F' };

BT.Level = class {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.themeKey = def.theme;
    this.theme = BT.CFG.themes[def.theme];
    this.T = BT.CFG.tile;
    this.time = 0;
    this.game = null;                    // 由 GameManager 注入
    this.decoRng = BT.Utils.seededRandom(def.decoSeed || 777);

    this.grid = [];                      // rows x cols
    this.cols = 0; this.rows = def.rows;

    this.slopes = [];
    this.oneWays = [];                   // 静态单向平台（木平台）
    this.spikes = [];
    this.waterRects = [];
    this.cellWater = [];                 // cell -> water rect 引用

    this.orbs = [];
    this.checkpoints = [];
    this.pads = [];
    this.devices = [];
    this.boxes = [];
    this.platforms = [];
    this.switches = [];
    this.doors = [];
    this.spikeballs = [];
    this.lasers = [];
    this.rocks = [];
    this.hints = [];
    this.exit = null;
    this.spawnPoint = { x: 100, y: 100 };
    this.breakEnts = new Map();          // "c,r" -> Breakable 实体

    this.objectsById = {};

    this._solidsScratch = [];
    this._oneWayScratch = [];
    this._slopeScratch = [];

    this.parse(def);
    this.totalOrbs = this.orbs.length;
  }

  /* ================= 地图解析 ================= */
  parse(def) {
    const T = this.T;
    const chunks = def.chunks.map(raw =>
      raw.split('\n').map(l => l.replace(/\r/g, '')).filter(l => l.length > 0));

    /* 每个补足到 rows 行（缺行补在顶部），行宽补齐 */
    let colBase = 0;
    for (const lines of chunks) {
      while (lines.length < this.rows) lines.unshift('');
      const width = Math.max(...lines.map(l => l.length));
      for (let r = 0; r < this.rows; r++) {
        const line = (lines[r] || '').padEnd(width, '.');
        if (!this.grid[r]) this.grid[r] = new Array(0);
        for (let c = 0; c < width; c++) {
          const col = colBase + c;
          this.setCellRaw(r, col, line[c]);
        }
      }
      colBase += width;
    }
    this.cols = colBase;
    this.pixelWidth = this.cols * T;
    this.pixelHeight = this.rows * T;

    /* meta 队列 */
    const q = {
      platforms: (def.platforms || []).slice(),
      spikeballs: (def.spikeballs || []).slice(),
      rocks: (def.rocks || []).slice(),
      lasers: (def.lasers || []).slice(),
      switches: (def.switches || []).slice(),
    };

    const doorCells = [];   // 待分组
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ch = this.grid[r][c];
        const wx = c * T, wy = r * T;
        switch (ch) {
          case '#': this.grid[r][c] = CELL.SOLID; break;
          case 'b': {
            this.grid[r][c] = CELL.BREAKABLE;
            const ent = new BT.Breakable(c, r);
            this.breakEnts.set(c + ',' + r, ent);
            break;
          }
          case 'h': this.grid[r][c] = CELL.HIDDEN; break;
          case '=': this.grid[r][c] = CELL.EMPTY;
            this.oneWays.push({ x: wx, y: wy, w: T, h: 16 }); break;
          case '/': this.grid[r][c] = CELL.EMPTY;
            this.slopes.push({ x: wx, y: wy, w: T, h: T, dir: 1 }); break;
          case '\\': this.grid[r][c] = CELL.EMPTY;
            this.slopes.push({ x: wx, y: wy, w: T, h: T, dir: 2 }); break;
          case '^': this.grid[r][c] = CELL.EMPTY; this.spikes.push(new BT.Spikes(c, r)); break;
          case 'o': this.grid[r][c] = CELL.FILLABLE; this.orbs.push(new BT.Collectible(wx + T / 2, wy + T / 2)); break;
          case 'C': this.grid[r][c] = CELL.FILLABLE; this.checkpoints.push(new BT.Checkpoint(wx + T / 2, wy + T / 2)); break;
          case 'E': this.grid[r][c] = CELL.FILLABLE; this.exit = new BT.ExitPortal(c, r); break;
          case 'B': this.grid[r][c] = CELL.FILLABLE; this.pads.push(new BT.BouncePad(c, r)); break;
          case 'W': this.grid[r][c] = CELL.WATER_MARK; break;
          case 'P': this.grid[r][c] = CELL.FILLABLE;
            this.spawnPoint = { x: wx + T / 2, y: wy + T / 2 }; break;
          case 's': this.grid[r][c] = CELL.FILLABLE; this.devices.push(new BT.SizeDevice(c, r, 'shrink')); break;
          case 'i': this.grid[r][c] = CELL.FILLABLE; this.devices.push(new BT.SizeDevice(c, r, 'inflate')); break;
          case 'X': this.grid[r][c] = CELL.FILLABLE; this.boxes.push(new BT.PushBox(c, r)); break;
          case 'M': { this.grid[r][c] = CELL.FILLABLE;
            const meta = q.platforms.shift() || {};
            this.platforms.push(new BT.MovingPlatform(c, r, meta)); break; }
          case 'm': { this.grid[r][c] = CELL.FILLABLE;
            const meta = q.spikeballs.shift() || {};
            this.spikeballs.push(new BT.SpikeBall(c, r, meta)); break; }
          case 'r': { this.grid[r][c] = CELL.FILLABLE;
            const meta = q.rocks.shift() || {};
            this.rocks.push(new BT.FallingRock(c, r, meta)); break; }
          case 'L': { this.grid[r][c] = CELL.FILLABLE;
            const meta = q.lasers.shift() || {};
            const laser = new BT.Laser(c, r, meta);
            laser.id = 'laser' + this.lasers.length;
            this.lasers.push(laser); break; }
          case 'S': { this.grid[r][c] = CELL.FILLABLE;
            const sw = new BT.Switch(c, r, q.switches.shift() || {});
            sw.id = 'switch' + this.switches.length;
            this.switches.push(sw); break; }
          case 'D': this.grid[r][c] = CELL.DOOR_MARK; doorCells.push([c, r]); break;
          default: this.grid[r][c] = CELL.EMPTY;
        }
      }
    }

    /* 门块连通分组 */
    const visited = new Set();
    let doorIdx = 0;
    for (const [c, r] of doorCells) {
      const key = c + ',' + r;
      if (visited.has(key)) continue;
      const cells = [];
      const stack = [[c, r]];
      visited.add(key);
      while (stack.length) {
        const [cc, rr] = stack.pop();
        cells.push([cc, rr]);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = cc + dc, nr = rr + dr;
          const nk = nc + ',' + nr;
          if (!visited.has(nk) && this.cellChar(nc, nr) === CELL.DOOR_MARK) {
            visited.add(nk);
            stack.push([nc, nr]);
          }
        }
      }
      const door = new BT.Door(cells);
      door.id = 'door' + doorIdx++;
      this.doors.push(door);
      for (const [cc, rr] of cells) this.grid[rr][cc] = CELL.EMPTY;
    }

    /* 水体中的实体标记格补全为水：
     * 同一行中被水体两侧夹住、长度 ≤3 的标记段（开关/装置/能量球等）
     * 视为浸没在水中（实体保留，仅格子弹水） */
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        if (this.grid[r][c] === CELL.FILLABLE) {
          let c2 = c;
          while (c2 < this.cols && this.grid[r][c2] === CELL.FILLABLE) c2++;
          const leftWater = c > 0 && this.grid[r][c - 1] === CELL.WATER_MARK;
          const rightWater = c2 < this.cols && this.grid[r][c2] === CELL.WATER_MARK;
          if (leftWater && rightWater && c2 - c <= 3) {
            for (let i = c; i < c2; i++) this.grid[r][i] = CELL.WATER_MARK;
          }
          c = c2;
        } else c++;
      }
    }

    /* 水体按行合并为矩形 */
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        if (this.grid[r][c] === CELL.WATER_MARK) {
          let c2 = c;
          while (c2 < this.cols && this.grid[r][c2] === CELL.WATER_MARK) c2++;
          const rect = { x: c * T, y: r * T, w: (c2 - c) * T, h: T };
          this.waterRects.push(rect);
          for (let i = c; i < c2; i++) {
            if (!this.cellWater[r]) this.cellWater[r] = [];
            this.cellWater[r][i] = rect;
          }
          c = c2;
        } else c++;
      }
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const v = this.grid[r][c];
        if (v === CELL.WATER_MARK || v === CELL.DOOR_MARK || v === CELL.FILLABLE) this.grid[r][c] = CELL.EMPTY;
      }
    }
    /* 注册可寻址对象 */
    for (const d of this.doors) this.objectsById[d.id] = d;
    for (const l of this.lasers) this.objectsById[l.id] = l;

    /* 提示牌 */
    for (const h of (def.hints || [])) {
      this.hints.push(new BT.HintSign(h.c * T + T / 2, (h.r + 1) * T, h.text));
    }
  }

  setCellRaw(r, c, ch) { while (this.grid.length <= r) this.grid.push([]); this.grid[r][c] = ch; }

  cellChar(c, r) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return CELL.EMPTY;
    return this.grid[r][c];
  }

  /* 网格是否实心（含可破坏块；不含隐藏块/斜坡/水） */
  solidAtPoint(x, y) {
    const c = Math.floor(x / this.T), r = Math.floor(y / this.T);
    const v = this.cellChar(c, r);
    return v === CELL.SOLID || v === CELL.BREAKABLE;
  }

  breakCell(c, r) {
    this.grid[r][c] = CELL.EMPTY;
    this.breakEnts.delete(c + ',' + r);
  }

  /* ================= 空间查询 ================= */
  solidsNear(x, y, rad) {
    const out = this._solidsScratch;
    out.length = 0;
    const T = this.T;
    const c0 = Math.floor((x - rad - 2) / T), c1 = Math.floor((x + rad + 2) / T);
    const r0 = Math.floor((y - rad - 2) / T), r1 = Math.floor((y + rad + 2) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const v = this.cellChar(c, r);
        if (v === CELL.SOLID || v === CELL.BREAKABLE) {
          out.push({ x: c * T, y: r * T, w: T, h: T, breakable: v === CELL.BREAKABLE,
            breakEnt: v === CELL.BREAKABLE ? this.breakEnts.get(c + ',' + r) : null });
        }
      }
    }
    for (const d of this.doors) {
      if (!d.isOpen) {
        const sr = d.solidRect;
        if (sr.h > 2 && BT.Utils.aabbOverlap(x - rad, y - rad, rad * 2, rad * 2, sr.x, sr.y, sr.w, sr.h)) {
          out.push({ x: sr.x, y: sr.y, w: sr.w, h: sr.h, door: d });
        }
      }
    }
    for (const b of this.boxes) {
      if (BT.Utils.aabbOverlap(x - rad, y - rad, rad * 2, rad * 2, b.x, b.y, b.w, b.h)) {
        out.push({ x: b.x, y: b.y, w: b.w, h: b.h, box: b });
      }
    }
    return out;
  }

  oneWaysNear(x, y, rad) {
    const out = this._oneWayScratch;
    out.length = 0;
    for (const o of this.oneWays) {
      if (BT.Utils.aabbOverlap(x - rad - 8, y - rad, rad * 2 + 16, rad * 2, o.x, o.y, o.w, o.h)) out.push(o);
    }
    for (const p of this.platforms) {
      if (BT.Utils.aabbOverlap(x - rad - 8, y - rad, rad * 2 + 16, rad * 2, p.x, p.y, p.w, p.h)) {
        out.push({ x: p.x, y: p.y, w: p.w, h: p.h, platform: p });
      }
    }
    return out;
  }

  slopesNear(x, y, rad) {
    const out = this._slopeScratch;
    out.length = 0;
    for (const s of this.slopes) {
      if (x + rad > s.x - 8 && x - rad < s.x + s.w + 8 && y + rad > s.y - 8 && y - rad < s.y + s.h + 8) out.push(s);
    }
    return out;
  }

  waterAt(x, y) {
    const r = Math.floor(y / this.T), c = Math.floor(x / this.T);
    if (r < 0 || r >= this.rows) return null;
    return (this.cellWater[r] && this.cellWater[r][c]) || null;
  }

  /* ================= 更新 ================= */
  /* 阶段一：平台 / 箱子 / 门（在玩家移动前，计算 delta） */
  preUpdate(dt) {
    this.time += dt;
    for (const p of this.platforms) p.update(dt);
    for (const b of this.boxes) b.step(dt, this);
    for (const d of this.doors) d.update(dt, this.game);
  }

  /* 阶段二：传感器与触发器（玩家移动后） */
  postUpdate(dt, game) {
    for (const o of this.orbs) o.update(dt, game);
    for (const c of this.checkpoints) c.update(dt, game);
    for (const p of this.pads) p.update(dt, game);
    for (const d of this.devices) d.update(dt, game);
    for (const s of this.switches) s.update(dt, game);
    for (const sp of this.spikes) sp.update(dt, game);
    for (const sb of this.spikeballs) sb.update(dt, game);
    for (const l of this.lasers) l.update(dt, game);
    for (const rk of this.rocks) rk.update(dt, game);
    if (this.exit) this.exit.update(dt, game);
  }

  /* 死亡重生：重置平台 / 箱子 / 落石（门与开关保持已激活状态） */
  resetForRespawn() {
    for (const p of this.platforms) p.reset();
    for (const b of this.boxes) b.reset();
    for (const r of this.rocks) r.reset();
  }

  /* 确定性装饰随机数（同格每次绘制结果一致，避免闪烁） */
  decoRand(c, r, k = 0) {
    const s = Math.sin(c * 127.1 + r * 311.7 + k * 74.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /* ================= 渲染 ================= */
  drawWorld(ctx, cam, game) {
    const T = this.T;
    const c0 = Math.max(0, Math.floor(cam.viewX / T));
    const c1 = Math.min(this.cols - 1, Math.floor(cam.viewRight / T));
    const r0 = Math.max(0, Math.floor(cam.viewY / T));
    const r1 = Math.min(this.rows - 1, Math.floor(cam.viewBottom / T));

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const v = this.grid[r][c];
        if (v === CELL.SOLID || v === CELL.HIDDEN) {
          this.drawGroundCell(ctx, c, r, v === CELL.HIDDEN);
        } else if (v === CELL.BREAKABLE) {
          this.drawBreakableCell(ctx, c, r);
        }
      }
    }
    /* 斜坡 */
    for (const s of this.slopes) {
      if (s.x + s.w < cam.viewX || s.x > cam.viewRight || s.y + s.h < cam.viewY || s.y > cam.viewBottom) continue;
      this.drawSlope(ctx, s);
    }
    /* 单向木平台 */
    for (const o of this.oneWays) {
      if (o.x + o.w < cam.viewX || o.x > cam.viewRight) continue;
      this.drawPlank(ctx, o);
    }

    /* 普通实体（玩家之下） */
    for (const h of this.hints) h.draw(ctx, game);
    for (const c of this.checkpoints) c.draw(ctx, game);
    for (const p of this.platforms) p.draw(ctx, game);
    for (const b of this.boxes) b.draw(ctx, game);
    for (const p of this.pads) p.draw(ctx, game);
    for (const d of this.devices) d.draw(ctx, game);
    for (const s of this.switches) s.draw(ctx, game);
    for (const o of this.orbs) o.draw(ctx, game);
    if (this.exit) this.exit.draw(ctx, game);
    for (const rk of this.rocks) rk.draw(ctx, game);
  }

  /* 玩家之上：门、尖刺、尖刺球、激光、水体 */
  drawFront(ctx, cam, game) {
    for (const d of this.doors) d.draw(ctx, game);
    for (const sp of this.spikes) sp.draw(ctx, game);
    for (const sb of this.spikeballs) sb.draw(ctx, game);
    for (const l of this.lasers) l.draw(ctx, game);
    this.drawWater(ctx, cam, game);
  }

  /* плавный переход между двумя hex-цветами (натуральность грунта) */
  hexLerp(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16));
    const pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
    return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')';
  }

  /* ---------- 瓦片绘制（Hollow Knight 式细节） ---------- */
  drawGroundCell(ctx, c, r, hidden) {
    const T = this.T;
    const x = c * T, y = r * T;
    const th = this.theme;
    const covered = (cc, rr) => {
      const v = this.cellChar(cc, rr);
      return v === CELL.SOLID || v === CELL.BREAKABLE || v === CELL.HIDDEN;
    };
    const topE = !covered(c, r - 1);
    const botE = !covered(c, r + 1);
    const leftE = !covered(c - 1, r);
    const rightE = !covered(c + 1, r);

    /* 1. 主体：连续的深度过渡（无横向条带）+ лёгкий шум */
    const depth = BT.Utils.clamp(((r % 4) / 3) * 0.8 + (this.decoRand(c, r, 30) - 0.5) * 0.12, 0, 1);
    ctx.fillStyle = this.hexLerp(th.ground, th.groundDark, depth);
    ctx.fillRect(x, y, T, T);

    /* 2. 内部纹理（按主题，确定性生成） */
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, T, T); ctx.clip();
    if (this.themeKey === 'forest') {
      /* 蜿蜒的土层纹 + 小石子 */
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const yy = y + 12 + i * 16 + this.decoRand(c, r, i) * 10;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.quadraticCurveTo(x + T / 2, yy + (this.decoRand(c, r, i + 4) - 0.5) * 12, x + T, yy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(x + 8 + this.decoRand(c, r, i + 8) * (T - 16), y + 20 + this.decoRand(c, r, i + 12) * (T - 30), 2.2, 0, BT.Utils.TAU);
        ctx.fill();
      }
    } else if (this.themeKey === 'cave') {
      /* 岩石裂缝 + 亮斑 */
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 2; i++) {
        const sx = x + 6 + this.decoRand(c, r, i) * (T - 12);
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx + (this.decoRand(c, r, i + 3) - 0.5) * 14, y + T * 0.5);
        ctx.lineTo(sx + (this.decoRand(c, r, i + 6) - 0.5) * 10, y + T);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(x + this.decoRand(c, r, i + 9) * T, y + this.decoRand(c, r, i + 13) * T, 1.6, 0, BT.Utils.TAU);
        ctx.fill();
      }
    } else {
      /* 遗迹：砖缝砌工 */
      ctx.strokeStyle = 'rgba(0,0,0,0.20)';
      ctx.lineWidth = 1.6;
      for (let yy = y + 21; yy < y + T; yy += 21) {
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + T, yy); ctx.stroke();
      }
      const off = (r % 2) * 21;
      let row = 0;
      for (let yy = y; yy < y + T; yy += 21, row++) {
        const bx = x + ((off + row * 10) % T);
        ctx.beginPath();
        ctx.moveTo(bx, Math.max(y, yy));
        ctx.lineTo(bx, Math.min(y + T, yy + 21));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x + 3, y + 3, T - 6, 8);
    }
    ctx.restore();

    /* 3. 顶帽：暴露的顶面 */
    if (topE) {
      const g = ctx.createLinearGradient(0, y, 0, y + 24);
      g.addColorStop(0, th.capLight);
      g.addColorStop(1, th.cap);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, T, 18);
      ctx.fillStyle = th.capDark;
      if (this.themeKey === 'forest') {
        /* 圆润苔藓边缘 + 草叶 */
        for (let i = 0; i < 4; i++) {
          const gx = x + 4 + i * (T / 4) + (this.decoRand(c * 4 + i, r, 5) * 6 - 2);
          ctx.beginPath();
          ctx.arc(gx, y + 18, 5.5, 0, Math.PI);
          ctx.fill();
        }
        ctx.strokeStyle = th.capDark;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 6; i++) {
          const bx = x + 5 + i * (T / 6) + (this.decoRand(c, r, i + 6) * 6 - 3);
          const h2 = 5 + this.decoRand(c, r, i + 10) * 7;
          ctx.beginPath();
          ctx.moveTo(bx, y + 1);
          ctx.quadraticCurveTo(bx + 2, y - h2 * 0.6, bx + (this.decoRand(c, r, i) > 0.5 ? 3 : -3), y - h2);
          ctx.stroke();
        }
      } else if (this.themeKey === 'cave') {
        ctx.fillRect(x, y + 18, T, 3);
        /* 锯齿状岩缘 */
        ctx.fillStyle = th.capLight;
        for (let i = 0; i < 4; i++) {
          const tx = x + 4 + i * (T / 4) + this.decoRand(c, r, i) * 6;
          ctx.beginPath();
          ctx.moveTo(tx - 3, y + 2);
          ctx.lineTo(tx, y - 3 - this.decoRand(c, r, i + 2) * 3);
          ctx.lineTo(tx + 3, y + 2);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        ctx.fillRect(x, y + 18, T, 3);
        /* 石雕檐口凹槽 */
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 6 + i * (T / 3), y + 20, T / 5, 3);
      }
      /* 顶缘轮廓光 */
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(x, y, T, 2);
    }

    /* 4. 侧边 / 底边 */
    ctx.fillStyle = th.groundEdge;
    if (leftE) ctx.fillRect(x, y, 3, T);
    if (rightE) ctx.fillRect(x + T - 3, y, 3, T);
    if (botE) ctx.fillRect(x, y + T - 4, T, 4);

    /* 5. 表面发光道具（仅暴露顶面，稀疏点缀） */
    if (topE && !hidden) {
      if (this.themeKey === 'forest' && this.decoRand(c, r, 20) < 0.16) {
        const mx = x + 10 + this.decoRand(c, r, 21) * (T - 20);
        const mh = 8 + this.decoRand(c, r, 22) * 8;
        ctx.fillStyle = 'rgba(207, 230, 216, 0.85)';
        ctx.fillRect(mx - 1.5, y - mh, 3, mh);
        ctx.fillStyle = th.accent;
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.ellipse(mx, y - mh, 6, 3.4, 0, Math.PI, 0); ctx.fill();
        ctx.globalAlpha = 0.15;
        ctx.beginPath(); ctx.arc(mx, y - mh, 12, 0, BT.Utils.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (this.themeKey === 'cave' && this.decoRand(c, r, 20) < 0.14) {
        this.crystalAt(ctx, x + 12 + this.decoRand(c, r, 21) * (T - 24), y, 6 + this.decoRand(c, r, 22) * 6, th.accent);
      } else if (this.themeKey === 'ruins' && this.decoRand(c, r, 20) < 0.12) {
        const bx = x + 12 + this.decoRand(c, r, 21) * (T - 24);
        ctx.fillStyle = th.stone;
        ctx.fillRect(bx - 7, y - 12, 14, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(bx - 7, y - 12, 14, 3);
      }
    }

    /* 6. 隐藏通道的裂纹提示 */
    if (hidden) {
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 8); ctx.lineTo(x + 30, y + 26);
      ctx.lineTo(x + 22, y + 40); ctx.lineTo(x + 44, y + 56);
      ctx.stroke();
    }
  }

  /* 小水晶簇（洞穴地表装饰） */
  crystalAt(ctx, x, y, size, color) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y - size * 0.4, size * 1.7, 0, BT.Utils.TAU); ctx.fill();
    ctx.globalAlpha = 1;
    for (const [dx, ln, wd] of [[-4, size * 0.8, 3.2], [2, size * 1.15, 4]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + dx - wd, y);
      ctx.lineTo(x + dx, y - ln);
      ctx.lineTo(x + dx + wd, y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + dx - wd * 0.3, y - ln * 0.2);
      ctx.lineTo(x + dx, y - ln);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBreakableCell(ctx, c, r) {
    const T = this.T;
    const x = c * T, y = r * T;
    const th = this.theme;
    ctx.fillStyle = th.stone;
    ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = th.groundEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
    /* 裂纹 */
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 26, y + 28);
    ctx.lineTo(x + 16, y + 46); ctx.lineTo(x + 34, y + 60);
    ctx.moveTo(x + 26, y + 28); ctx.lineTo(x + 50, y + 22);
    ctx.moveTo(x + 26, y + 28); ctx.lineTo(x + 46, y + 44);
    ctx.stroke();
  }

  drawSlope(ctx, s) {
    const th = this.theme;
    ctx.beginPath();
    if (s.dir === 1) {
      ctx.moveTo(s.x, s.y + s.h);
      ctx.lineTo(s.x + s.w, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
    } else {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      ctx.lineTo(s.x, s.y + s.h);
    }
    ctx.closePath();
    ctx.fillStyle = th.ground;
    ctx.fill();
    /* 沿斜面的顶帽 */
    ctx.strokeStyle = th.cap;
    ctx.lineWidth = 14;
    ctx.beginPath();
    if (s.dir === 1) { ctx.moveTo(s.x, s.y + s.h - 2); ctx.lineTo(s.x + s.w, s.y + 2); }
    else { ctx.moveTo(s.x, s.y + 2); ctx.lineTo(s.x + s.w, s.y + s.h - 2); }
    ctx.stroke();
    ctx.strokeStyle = th.capLight;
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (s.dir === 1) { ctx.moveTo(s.x, s.y + s.h - 4); ctx.lineTo(s.x + s.w, s.y); }
    else { ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.w, s.y + s.h - 4); }
    ctx.stroke();
    /* 草叶沿斜面（森林主题） */
    if (this.themeKey === 'forest') {
      ctx.strokeStyle = th.capDark;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const t = 0.12 + i * 0.19;
        const sx = s.x + s.w * t;
        const sy = BT.Physics.slopeSurfaceY(s, sx);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 2, sy - 5, sx + (i % 2 ? 3 : -3), sy - 8);
        ctx.stroke();
      }
    }
  }

  drawPlank(ctx, o) {
    const th = this.theme;
    const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    g.addColorStop(0, th.wood);
    g.addColorStop(1, th.woodDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(o.x, o.y, o.w, o.h, 5) : ctx.rect(o.x, o.y, o.w, o.h);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    /* 木纹 */
    ctx.strokeStyle = 'rgba(0,0,0,.15)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      const px = o.x + (o.w / 3) * i;
      ctx.beginPath(); ctx.moveTo(px, o.y + 2); ctx.lineTo(px, o.y + o.h - 2); ctx.stroke();
    }
  }

  /* ---------- 水体前景 ---------- */
  drawWater(ctx, cam, game) {
    const T = this.T;
    for (const w of this.waterRects) {
      if (w.x + w.w < cam.viewX || w.x > cam.viewRight || w.y + w.h < cam.viewY || w.y > cam.viewBottom) continue;
      /* 渐变水体 */
      const g = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
      g.addColorStop(0, 'rgba(64, 170, 235, .5)');
      g.addColorStop(1, 'rgba(30, 110, 190, .62)');
      ctx.fillStyle = g;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      /* 水面波浪（仅当上方不是水） */
      const aboveWater = this.waterAt(w.x + 2, w.y - T * 0.5);
      if (!aboveWater) {
        ctx.strokeStyle = 'rgba(235, 250, 255, .8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x <= w.w; x += 8) {
          const y = w.y + 3 + Math.sin((w.x + x) * 0.05 + this.time * 3) * 3;
          if (x === 0) ctx.moveTo(w.x + x, y);
          else ctx.lineTo(w.x + x, y);
        }
        ctx.stroke();
      }
      /* 气泡 */
      if (Math.random() < 0.02) {
        game.particles.emit({
          x: w.x + Math.random() * w.w, y: w.y + w.h - 6,
          vx: 0, vy: -40 - Math.random() * 40,
          size: 2 + Math.random() * 3, maxLife: 1.2,
          color: 'rgba(220,245,255,.7)', gravity: -60, drag: 0.5,
        });
      }
    }
  }
};
