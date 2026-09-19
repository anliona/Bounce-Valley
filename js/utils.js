/* ============================================================
 * utils.js — 数学与通用工具函数
 * ============================================================ */
window.BT = window.BT || {};

BT.Utils = {
  TAU: Math.PI * 2,

  clamp(v, min, max) { return v < min ? min : (v > max ? max : v); },

  lerp(a, b, t) { return a + (b - a) * t; },

  /* 帧率无关的平滑趋近（用于摄像机等） */
  damp(a, b, rate, dt) { return a + (b - a) * (1 - Math.exp(-rate * dt)); },

  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  choice(arr) { return arr[(Math.random() * arr.length) | 0]; },

  dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },

  /* 确定性随机（mulberry32），用于装饰物生成，保证每帧一致 */
  seededRandom(seed) {
    let s = seed | 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; },

  /* 秒 -> "01:23.4" */
  fmtTime(sec) {
    if (sec == null) return '--:--.-';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const d = Math.floor((sec * 10) % 10);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + d;
  },

  /* 简单 AABB 相交 */
  aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  },

  /* 圆 vs 矩形相交 */
  circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
    const qx = BT.Utils.clamp(cx, rx, rx + rw);
    const qy = BT.Utils.clamp(cy, ry, ry + rh);
    return BT.Utils.dist2(cx, cy, qx, qy) <= r * r;
  },
};
