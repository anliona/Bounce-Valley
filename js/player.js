/* ============================================================
 * player.js — 玩家（红色弹力球）
 * · PlayerPhysics：重力/加速度/摩擦/惯性/弹跳/水中物理/斜坡
 * · PlayerController：输入处理（土狼时间/跳跃缓冲/可变跳高）
 * · 动画：squash & stretch / 滚动旋转 / 表情 / 死亡爆裂
 *   （动画仅影响绘制，不影响碰撞体）
 * ============================================================ */
window.BT = window.BT || {};

BT.Player = class {
  constructor(x, y) {
    this.spawnPoint = { x, y };
    this.respawnPoint = { x, y };

    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };

    /* 大小状态：sizeTween 1=普通 0=小球（平滑过渡） */
    this.sizeSmall = false;
    this.sizeTween = 1;

    this.onGround = false;
    this.coyote = 0;
    this.jumpBufferT = 0;
    this.jumpCut = false;
    this.groundPlatform = null;    // 正在乘坐的移动平台/箱子

    this.inWater = false;
    this.wasInWater = false;

    this.angle = 0;                // 滚动角度（仅视觉）
    this.squashX = 1; this.squashY = 1;
    this.dying = false; this.dieT = 0;
    this.facing = 1;
    this.blinkT = BT.Utils.rand(2, 4);
    this.blink = 0;
    this.dustT = 0;
  }

  /* 当前物理半径（大小过渡动画同步到碰撞体，始终为平滑圆形） */
  get radius() {
    const P = BT.CFG.player;
    return P.radiusSmall + (P.radiusNormal - P.radiusSmall) * this.sizeTween;
  }

  setSize(small) {
    this.sizeSmall = small;
  }

  updateSizeTween(dt) {
    const target = this.sizeSmall ? 0 : 1;
    this.sizeTween = BT.Utils.damp(this.sizeTween, target, 10, dt);
  }

  /* ================= 每物理步更新 ================= */
  step(dt, level, input) {
    if (this.dying) return;
    const P = BT.CFG.physics;
    this.updateSizeTween(dt);

    /* --- 0. 跟随乘坐的平台 / 箱子 --- */
    if (this.groundPlatform) {
      this.pos.x += this.groundPlatform.deltaX || 0;
      this.pos.y += this.groundPlatform.deltaY || 0;
    }

    /* --- 1. 水平输入 → 加速度 / 摩擦力 / 惯性 --- */
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const mult = this.sizeSmall ? BT.CFG.player.smallSpeedMult : 1;
    const cap = P.maxMoveSpeed * mult;
    if (dir !== 0) {
      const accel = P.moveAcceleration
        * (this.onGround ? 1 : P.airControl)
        * (this.inWater ? P.waterMoveControl : 1);
      this.vel.x += dir * accel * dt;
      /* 输入驱动的部分不超过上限（斜坡俯冲等惯性超速不受影响） */
      if (Math.sign(this.vel.x) === dir && Math.abs(this.vel.x) > cap) {
        this.vel.x = dir * cap;
      }
      this.facing = dir;
    } else {
      const fr = this.onGround ? P.groundFriction : P.airDrag;
      const s = Math.sign(this.vel.x);
      this.vel.x -= s * Math.min(Math.abs(this.vel.x), fr * dt);
    }

    /* --- 2. 重力 / 浮力（水中特化） --- */
    if (this.inWater) {
      this.vel.y += P.gravity * P.waterGravityScale * dt;
      if (!this.sizeSmall) this.vel.y -= P.waterBuoyancy * dt;   // 普通球上浮
      this.vel.y = BT.Utils.clamp(this.vel.y, -P.waterMaxRise,
        this.sizeSmall ? P.waterMaxSink : P.waterMaxRise * 0.6);
    } else {
      this.vel.y = Math.min(this.vel.y + P.gravity * dt, P.maxFallSpeed);
    }

    /* --- 3. 跳跃（缓冲 + 土狼时间 + 可变高度）/ 游泳 --- */
    if (input.jumpPressed()) this.jumpBufferT = P.jumpBufferTime;
    else this.jumpBufferT = Math.max(0, this.jumpBufferT - dt);

    if (this.inWater) {
      if (this.jumpBufferT > 0) {
        this.vel.y = -P.waterSwimImpulse * (this.sizeSmall ? 1.1 : 1);
        this.jumpBufferT = 0;
        BT.audio.sfx('splash');
        level.game.particles.splash(this.pos.x, this.pos.y - this.radius * 0.5, 5);
      }
    } else if (this.jumpBufferT > 0 && (this.onGround || this.coyote > 0)) {
      this.vel.y = -P.jumpForce * (this.sizeSmall ? BT.CFG.player.smallJumpMult : 1);
      this.onGround = false;
      this.coyote = 0;
      this.groundPlatform = null;
      this.jumpBufferT = 0;
      this.jumpCut = false;
      /* 拉伸动画 */
      this.squashY = 1.28; this.squashX = 0.8;
      BT.audio.sfx('jump');
      level.game.particles.dust(this.pos.x, this.pos.y + this.radius, 4);
    }
    /* 松开跳跃键截断（可变跳高） */
    if (!this.inWater && !input.jumpHeld && this.vel.y < -180 && !this.jumpCut) {
      this.vel.y *= P.jumpCutFactor;
      this.jumpCut = true;
    }

    /* --- 4. X 轴移动 + 碰撞 --- */
    this.pos.x += this.vel.x * dt;
    this.resolveAxis(level, 'x');

    /* --- 5. Y 轴移动 + 碰撞 --- */
    const prevBottom = this.pos.y + this.radius;
    this.pos.y += this.vel.y * dt;
    const wasGround = this.onGround;
    this.onGround = false;
    let contactPlat = this.resolveAxis(level, 'y', prevBottom);

    /* --- 6. 斜坡高度场吸附（自然滚上滚下） --- */
    let onSlope = false;
    let slopeDir = 0;
    for (const s of level.slopesNear(this.pos.x, this.pos.y, this.radius)) {
      if (this.pos.x < s.x - this.radius * 0.45 || this.pos.x > s.x + s.w + this.radius * 0.45) continue;
      const surfY = BT.Physics.slopeSurfaceY(s, this.pos.x);
      const pen = this.pos.y + this.radius - surfY;
      if (pen > 0 && pen < this.radius * 2.4) {
        /* 起跳上穿时不吸附 */
        if (!(this.vel.y < -150 && pen > this.radius * 1.3)) {
          this.pos.y = surfY - this.radius;
          if (this.vel.y > P.landBounceThreshold) {
            this.vel.y = -this.vel.y * P.landBounceRestitution;
            this.jumpCut = true;
          } else if (this.vel.y > 0) this.vel.y = 0;
          this.onGround = true;
          onSlope = true;
          slopeDir = s.dir;
        }
      }
    }
    /* 斜坡重力分量：沿坡面向低处加速（惯性滚动的来源） */
    if (onSlope) {
      const downhill = slopeDir === 1 ? -1 : 1;   // '/' 左低右高 → 下坡朝左
      this.vel.x += P.gravity * 0.8 * downhill * dt;
    }
    /* 超速衰减：俯冲动能缓慢流失，但足以撞碎可破坏块 */
    const over = Math.abs(this.vel.x) - cap;
    if (over > 0) this.vel.x -= Math.sign(this.vel.x) * Math.min(over, P.excessBleed * dt);
    this.vel.x = BT.Utils.clamp(this.vel.x, -P.softSpeedCap, P.softSpeedCap);

    /* --- 7. 乘坐支撑检测（移动平台 / 箱子） --- */
    let support = null;
    const candidates = level.platforms.concat(level.boxes);
    for (const c of candidates) {
      const top = c.y;
      if (this.pos.x + this.radius * 0.7 > c.x && this.pos.x - this.radius * 0.7 < c.x + c.w &&
          Math.abs(this.pos.y + this.radius - top) < 7 && this.vel.y >= -20) {
        support = c;
        this.onGround = true;
        break;
      }
    }
    this.groundPlatform = support;

    /* --- 8. 落地 / 土狼时间 / 滚动 --- */
    if (this.onGround) this.coyote = P.coyoteTime;
    else this.coyote = Math.max(0, this.coyote - dt);

    if (!wasGround && this.onGround && !onSlope) {
      /* 普通落地反馈在 resolveAxis 里已处理高速反弹，这里处理轻落地 */
      this.squashX = 1.16; this.squashY = 0.86;
    }
    /* 滚动角度由水平速度驱动 */
    this.angle += (this.vel.x / Math.max(12, this.radius)) * dt * (this.onGround ? 1 : 0.35);

    /* 高速滚动扬尘 */
    this.dustT -= dt;
    if (this.onGround && Math.abs(this.vel.x) > 380 && this.dustT <= 0 && !this.inWater) {
      this.dustT = 0.07;
      level.game.particles.dust(this.pos.x - Math.sign(this.vel.x) * 10, this.pos.y + this.radius, 1);
    }

    /* --- 9. 水体检测 --- */
    const waterRect = level.waterAt(this.pos.x, this.pos.y);
    this.inWater = !!waterRect;
    if (this.inWater && !this.wasInWater) {
      BT.audio.sfx('splash');
      level.game.particles.splash(this.pos.x, waterRect.y, 14);
      this.vel.x *= 0.6; this.vel.y *= 0.4;
    } else if (!this.inWater && this.wasInWater) {
      /* 冲出水面加速，帮助跃上岸 */
      if (this.vel.y < -80) this.vel.y *= P.waterExitBoost;
      level.game.particles.splash(this.pos.x, this.pos.y + this.radius * 0.4, 9);
    }
    this.wasInWater = this.inWater;

    /* squash 弹性回复 */
    this.squashX = BT.Utils.damp(this.squashX, 1, 14, dt);
    this.squashY = BT.Utils.damp(this.squashY, 1, 14, dt);

    /* 眨眼计时 */
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = BT.Utils.rand(2.2, 4.5); }
    this.blink = Math.max(0, this.blink - dt);

    /* 掉出世界 */
    if (this.pos.y > level.pixelHeight + 160) level.game.killPlayer();
  }

  /* ================= 分轴碰撞解析 =================
   * 只在对应主轴法线上修正位置，保证沿地面/墙面平滑滑动
   * 返回本轴接触到的载体（平台/箱子） */
  resolveAxis(level, phase, prevBottom = 0) {
    const P = BT.CFG.physics;
    const r = this.radius;
    let carrier = null;

    /* --- 实心矩形：地形网格 + 关闭的门 + 可破坏块 + 箱子 --- */
    for (const rect of level.solidsNear(this.pos.x, this.pos.y, r)) {
      /* 可破坏块：高速撞击直接粉碎 */
      if (rect.breakable) {
        const speed = phase === 'x' ? Math.abs(this.vel.x) : Math.abs(this.vel.y);
        if (speed >= BT.CFG.player.breakSpeed) {
          level.game.onBreakableHit(rect);
          continue;
        }
      }
      const hit = BT.Physics.circleVsRect(
        this.pos.x, this.pos.y, r, this.vel.x, this.vel.y, rect, phase);
      if (!hit) continue;
      const main = phase === 'x' ? Math.abs(hit.nx) >= Math.abs(hit.ny)
                                 : Math.abs(hit.ny) > Math.abs(hit.nx);
      if (!main) continue;

      /* 推箱子：接触侧面时把速度传给箱子 */
      if (rect.box && phase === 'x') {
        const pushDir = Math.sign(this.vel.x);
        if (pushDir !== 0 && !this.sizeSmall) {
          rect.box.push(pushDir, Math.abs(this.vel.x));
        } else {
          rect.box.push(0, 0);
        }
      }

      this.pos.x += hit.nx * hit.pen;
      this.pos.y += hit.ny * hit.pen;

      if (phase === 'x') {
        const into = Math.sign(this.vel.x) === -Math.sign(hit.nx);
        if (into) {
          if (Math.abs(this.vel.x) >= P.wallBounceMinSpeed && !rect.box) {
            /* 撞墙反弹 + 压扁动画 */
            this.vel.x = -this.vel.x * P.wallBounceRestitution;
            this.squashX = 0.72; this.squashY = 1.22;
            BT.audio.sfx('land');
          } else {
            this.vel.x = 0;
          }
        }
      } else {
        if (hit.top) {
          /* 落到顶面 */
          if (this.vel.y > P.landBounceThreshold) {
            /* 高速落地弹性反弹 */
            const impact = this.vel.y;
            this.vel.y = -impact * P.landBounceRestitution;
            this.jumpCut = true;   // 反弹冲量不再被截断
            this.squashX = 1.3; this.squashY = 0.72;
            BT.audio.sfx('bounce');
            level.game.particles.dust(this.pos.x, this.pos.y + r, 7);
          } else {
            if (this.vel.y > 260) {
              BT.audio.sfx('land');
              level.game.particles.dust(this.pos.x, this.pos.y + r, 5);
              this.squashX = 1 + Math.min(0.28, this.vel.y / 2600);
              this.squashY = 1 - Math.min(0.22, this.vel.y / 3400);
            }
            this.vel.y = 0;
          }
          this.onGround = true;
          if (rect.platform || rect.box) carrier = rect.platform || rect.box;
        } else {
          /* 顶到天花板 */
          if (this.vel.y < 0) this.vel.y = 40;
        }
      }
    }

    /* --- 单向平台：木平台 + 移动平台（仅下落时从上方落上） --- */
    if (phase === 'y' && this.vel.y >= 0) {
      for (const ow of level.oneWaysNear(this.pos.x, this.pos.y, r)) {
        if (prevBottom <= ow.y + 9 &&
            this.pos.y + r > ow.y && this.pos.y + r < ow.y + ow.h + 14 &&
            this.pos.x + r * 0.7 > ow.x && this.pos.x - r * 0.7 < ow.x + ow.w) {
          this.pos.y = ow.y - r;
          if (this.vel.y > 260) {
            BT.audio.sfx('land');
            level.game.particles.dust(this.pos.x, this.pos.y + r, 4);
          }
          if (this.vel.y > P.landBounceThreshold) {
            this.vel.y = -this.vel.y * P.landBounceRestitution;
          } else this.vel.y = 0;
          this.onGround = true;
          if (ow.platform) carrier = ow.platform;
        }
      }
    }
    return carrier;
  }

  /* ================= 死亡与重生 ================= */
  kill(game) {
    if (this.dying) return;
    this.dying = true;
    this.dieT = 0;
    BT.audio.sfx('death');
    /* 爆裂成红色粒子 */
    game.particles.burst(this.pos.x, this.pos.y,
      ['#e8402a', '#b32718', '#ff7a5c', '#ffd54a'], 26, 380, { size: 8 });
    game.camera.shake(8, 0.3);
  }

  respawn() {
    this.pos.x = this.respawnPoint.x;
    this.pos.y = this.respawnPoint.y;
    this.vel.x = this.vel.y = 0;
    this.dying = false;
    this.onGround = false;
    this.groundPlatform = null;
    this.inWater = this.wasInWater = false;
    this.squashX = this.squashY = 1;
    this.angle = 0;
    this.coyote = 0;
    this.jumpBufferT = 0;
  }

  /* ================= 绘制（含 squash & stretch / 表情） ================= */
  draw(ctx) {
    if (this.dying) return;
    const r = this.radius;

    /* контактная тень под шаром (заземление) */
    if (this.onGround && !this.inWater) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#04060a';
      ctx.beginPath();
      ctx.ellipse(this.pos.x, this.pos.y + r * 0.95, r * 0.92, r * 0.24, 0, 0, BT.Utils.TAU);
      ctx.fill();
      ctx.restore();
    }

    let sx = this.squashX, sy = this.squashY;

    /* 空中沿速度方向拉伸 */
    if (!this.onGround && !this.inWater) {
      const sp = Math.hypot(this.vel.x, this.vel.y);
      if (sp > 560) {
        const st = Math.min(0.2, (sp - 560) / 5200);
        if (Math.abs(this.vel.y) > Math.abs(this.vel.x)) { sy *= 1 + st; sx /= 1 + st * 0.8; }
        else { sx *= 1 + st; sy /= 1 + st * 0.8; }
      }
    }
    /* 水中轻微压扁漂动 */
    if (this.inWater) { sy *= 0.96 + Math.sin(performance.now() / 300) * 0.04; }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.scale(sx, sy);

    /* 球体 — Hollow Knight 式苍白陶瓷 + 冷光晕 */
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r);
    g.addColorStop(0, '#f7f3e6');
    g.addColorStop(0.5, '#e9e4d4');
    g.addColorStop(1, '#c6bda6');
    ctx.shadowColor = 'rgba(240, 236, 214, 0.5)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, BT.Utils.TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(14, 16, 24, 0.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, BT.Utils.TAU); ctx.stroke();

    /* 滚动斑点（表现旋转） */
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r - 2, 0, BT.Utils.TAU); ctx.clip();
    ctx.fillStyle = 'rgba(150, 140, 112, .3)';
    for (let i = 0; i < 3; i++) {
      const a = this.angle + i * (BT.Utils.TAU / 3);
      const rr = r * 0.62;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.22, 0, BT.Utils.TAU);
      ctx.fill();
    }
    ctx.restore();

    /* 水下浸没色调 */
    if (this.inWater) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#3a86c8';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, BT.Utils.TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* 眼睛（暗色空洞 + 微光，朝移动方向看） */
    const lookX = BT.Utils.clamp(this.vel.x / 420, -1, 1) * r * 0.16 + this.facing * r * 0.1;
    const lookY = BT.Utils.clamp(this.vel.y / 700, -1, 1) * r * 0.14;
    const eyeR = r * (this.sizeSmall ? 0.34 : 0.26);
    const eyeDX = r * 0.36, eyeDY = -r * 0.18;
    for (const side of [-1, 1]) {
      const ex = side * eyeDX + lookX * 0.5, ey = eyeDY + lookY * 0.5;
      ctx.fillStyle = '#14161d';
      const eh = this.blink > 0 ? eyeR * 0.18 : eyeR;
      ctx.beginPath(); ctx.ellipse(ex, ey, eyeR * 0.92, eh, 0, 0, BT.Utils.TAU); ctx.fill();
      if (this.blink <= 0) {
        ctx.fillStyle = '#e9eef2';
        ctx.beginPath(); ctx.arc(ex + lookX * 0.4 - eyeR * 0.18, ey + lookY * 0.4 - eyeR * 0.22, eyeR * 0.22, 0, BT.Utils.TAU); ctx.fill();
      }
    }
    /* 面颊 — 极淡的冷色 */
    ctx.fillStyle = 'rgba(120, 140, 175, .16)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.62, r * 0.14, r * 0.14, r * 0.09, 0, 0, BT.Utils.TAU);
      ctx.fill();
    }
    /* 嘴 */
    ctx.strokeStyle = '#14161d'; ctx.lineWidth = Math.max(1.6, r * 0.08); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(lookX * 0.4, r * 0.16, r * 0.2, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
};
