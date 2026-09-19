/* ============================================================
 * physics.js — 2D 物理/碰撞辅助
 * · 圆 vs 矩形：分轴解析（X 轴处理侧碰，Y 轴处理落地/天花板）
 *   采用"最小穿透轴"判定，保证沿地面/墙面滑动时不卡角
 * · 斜坡：高度场吸附（滚上滚下自然流畅）
 * ============================================================ */
window.BT = window.BT || {};

BT.Physics = {
  /* 圆 vs 矩形，phase: 'x' | 'y'
   * 返回 { nx, ny, pen, top } 命中信息；未命中返回 null
   * 调用方负责根据法线修正位置与速度 */
  circleVsRect(cx, cy, r, vx, vy, rect, phase) {
    const qx = BT.Utils.clamp(cx, rect.x, rect.x + rect.w);
    const qy = BT.Utils.clamp(cy, rect.y, rect.y + rect.h);
    let dx = cx - qx, dy = cy - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;

    let nx, ny, pen;
    if (d2 < 1e-9) {
      /* 圆心在矩形内部：按当前轴推出去 */
      if (phase === 'x') {
        nx = vx > 0 ? -1 : 1; ny = 0;
        pen = r + (nx > 0 ? cx - rect.x : rect.x + rect.w - cx);
      } else {
        ny = vy > 0 ? -1 : 1; nx = 0;
        pen = r + (ny > 0 ? cy - rect.y : rect.y + rect.h - cy);
      }
      return { nx, ny, pen, top: ny < -0.5 };
    }
    const d = Math.sqrt(d2);
    nx = dx / d; ny = dy / d;
    pen = r - d;
    return { nx, ny, pen, top: ny < -0.5 };
  },

  /* 斜坡表面高度（斜坡定义见 level.js 的 makeSlope） */
  slopeSurfaceY(slope, cx) {
    const t = BT.Utils.clamp((cx - slope.x) / slope.w, 0, 1);
    return slope.dir === 1
      ? slope.y + slope.h * (1 - t)     // '/' 左低右高
      : slope.y + slope.h * t;          // '\' 左高右低
  },

  /* 斜坡角度（用于球滚动姿态） */
  slopeAngle(slope) {
    return slope.dir === 1 ? -Math.atan2(slope.h, slope.w) : Math.atan2(slope.h, slope.w);
  },
};
