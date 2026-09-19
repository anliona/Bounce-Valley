/* ============================================================
 * camera.js — 平滑跟随摄像机
 * Smooth Follow + LookAhead（水平前瞻 + 下落偏移）+ 边界钳制 + 轻微震屏
 * ============================================================ */
window.BT = window.BT || {};

BT.CameraController = class {
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = 0; this.y = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.initialized = false;
  }

  /* 立即对准目标（关卡开始 / 重生时使用，避免长距离漂移） */
  snapTo(x, y, level) {
    this.x = this.clampX(x - this.viewW / 2, level);
    this.y = this.clampY(y - this.viewH / 2, level);
    this.initialized = true;
  }

  clampX(x, level) {
    const maxX = level.pixelWidth - this.viewW;
    return maxX <= 0 ? maxX / 2 : BT.Utils.clamp(x, 0, maxX);
  }

  clampY(y, level) {
    const maxY = level.pixelHeight - this.viewH;
    return maxY <= 0 ? maxY / 2 : BT.Utils.clamp(y, 0, maxY);
  }

  update(dt, player, level) {
    const C = BT.CFG.camera;
    /* 目标点：玩家 + 速度前瞻 */
    const laX = BT.Utils.clamp(player.vel.x * C.lookAhead, -C.lookAheadMax, C.lookAheadMax);
    const laY = player.vel.y > 200
      ? BT.Utils.clamp(player.vel.y * C.fallLook, 0, C.fallLookMax)
      : 0;
    const tx = player.pos.x + laX - this.viewW / 2;
    const ty = player.pos.y + 40 + laY - this.viewH / 2;

    this.x = BT.Utils.damp(this.x, this.clampX(tx, level), C.smoothness, dt);
    this.y = BT.Utils.damp(this.y, this.clampY(ty, level), C.smoothness, dt);

    /* 震屏衰减（只在死亡/落石等时刻轻微触发） */
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeT) / this.shakeDur;
      this.shakeX = BT.Utils.rand(-m, m);
      this.shakeY = BT.Utils.rand(-m, m);
    } else { this.shakeX = this.shakeY = 0; }
  }

  shake(mag, dur) {
    this.shakeMag = mag; this.shakeDur = dur; this.shakeT = dur;
  }

  /* 应用世界变换（含缩放） */
  apply(ctx) {
    const z = BT.CFG.view.zoom;
    ctx.setTransform(z, 0, 0, z, -(this.x + this.shakeX) * z, -(this.y + this.shakeY) * z);
  }

  /* 可视世界范围（供关卡裁剪绘制） */
  get viewX() { return this.x - 80; }
  get viewY() { return this.y - 80; }
  get viewRight() { return this.x + this.viewW + 80; }
  get viewBottom() { return this.y + this.viewH + 80; }
};
