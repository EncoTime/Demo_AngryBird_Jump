/* ============================================================
 * art.js — 愤怒的小鸟风格 Canvas 美术（纯代码矢量绘制，无贴图）
 * 色板与造型规格见 reference/ART_SPEC.md
 * ============================================================ */
"use strict";

const PAL = {
  // 胖红
  red: "#d42b1e", redLight: "#f4684f", redDark: "#a81a12", redSpot: "#b02218",
  belly: "#f5d9a8", beakTop: "#f5a623", beakBottom: "#e8951a", beakLine: "#7a3b10",
  eyeWhite: "#ffffff", pupil: "#2a1a12", brow: "#33150b", tail: "#4a2418",
  outlineBird: "#3a150a",
  // 木
  wood: "#c98a3e", woodLight: "#d9a054", woodEdge: "#e8b87a", woodGrain: "#a96b2e",
  outlineWood: "#5c3a16", nail: "#4a2c10",
  // 冰
  ice: "#bfe3f0", iceEdge: "#e8f7fc", outlineIce: "#7fb8ce",
  // 石
  stone: "#b3ae9a", stoneLight: "#c9c4ae", stoneDark: "#8f8873", stoneCrack: "#6e6853",
  outlineStone: "#4a4638",
  // 金属
  metalLight: "#c6c9ce", metalDark: "#8f959c", outlineMetal: "#3e3e44",
  // 草
  grassLight: "#5fa84f", grass: "#4c9245", grassDark: "#3e7d3a",
  outlineGrass: "#2e5c12", dirt: "#b0762f", outlineDirt: "#5e3a18",
  // 天空
  skyTop: "#1e7bc4", skyMid: "#55a9de", skyBottom: "#8fd0ee",
  cloud: "#ffffff", cloudShade: "#dceff8",
};

/* 圆角矩形路径 */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const Art = {

  /* ---------------- 背景：天空 / 云 / 三层视差绿山 ---------------- */

  sky(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PAL.skyTop);
    g.addColorStop(0.7, PAL.skyMid);
    g.addColorStop(1, PAL.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },

  // 云：多圆拼合、平底、无描边；camY 向下滚动时云以 0.2 倍速向上掠过
  clouds(ctx, W, H, camY, t) {
    const defs = [
      { x: 70, y: 90, r: 20, s: 1.0 },
      { x: 330, y: 180, r: 15, s: 0.8 },
      { x: 180, y: 330, r: 24, s: 1.15 },
      { x: 410, y: 470, r: 14, s: 0.7 },
      { x: 90, y: 560, r: 18, s: 0.9 },
    ];
    const period = 720;
    ctx.fillStyle = PAL.cloud;
    for (const c of defs) {
      const yy = (((c.y - camY * 0.2) % period) + period) % period - 40;
      const xx = (c.x + Math.sin(t * 0.05 + c.r) * 8 + W) % (W + 60) - 30;
      this._cloud(ctx, xx, yy, c.r, c.s);
    }
  },

  _cloud(ctx, x, y, r, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(-r * 1.15, 0, r * 0.62, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.35, r, 0, Math.PI * 2);
    ctx.arc(r * 1.15, 0, r * 0.66, 0, Math.PI * 2);
    ctx.fill();
    // 底边阴影带（平底）
    ctx.fillStyle = PAL.cloudShade;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 1.55, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.cloud;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.28, r * 1.55, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // 三层绿山视差（远 0.1x / 中 0.25x / 近 0.4x），同相三档绿
  hills(ctx, W, H, camY) {
    const layers = [
      { color: PAL.grassLight, factor: 0.1, baseY: H * 0.62, period: 500, bumps: [140, 95, 155, 110, 130] },
      { color: PAL.grass, factor: 0.25, baseY: H * 0.74, period: 560, bumps: [110, 150, 85, 135, 100, 125] },
      { color: PAL.grassDark, factor: 0.4, baseY: H * 0.86, period: 620, bumps: [90, 125, 70, 110, 95] },
    ];
    for (const L of layers) {
      ctx.fillStyle = L.color;
      const phase = ((camY * L.factor) % L.period + L.period) % L.period;
      for (let k = -1; k <= Math.ceil(H / L.period) + 1; k++) {
        const rowY = L.baseY + k * L.period - phase;
        if (rowY < -L.period || rowY > H + 260) continue;
        // 一排相连的大半圆弧
        const n = L.bumps.length;
        const bw = W / (n - 1);
        ctx.beginPath();
        ctx.moveTo(-20, rowY);
        for (let i = 0; i < n; i++) {
          ctx.arc(i * bw, rowY, L.bumps[i], Math.PI, 0);
        }
        ctx.lineTo(W + 20, rowY + 400);
        ctx.lineTo(-20, rowY + 400);
        ctx.closePath();
        ctx.fill();
      }
    }
  },

  // 远空 V 形小鸟剪影
  farBirds(ctx, W, camY, t) {
    ctx.strokeStyle = "#1e5a8a";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    const defs = [{ x: 120, y: 150 }, { x: 300, y: 240 }];
    for (const d of defs) {
      const yy = ((d.y - camY * 0.15) % 700 + 700) % 700;
      const flap = Math.sin(t * 6 + d.x) * 2.5;
      ctx.beginPath();
      ctx.moveTo(d.x - 7, yy - flap);
      ctx.quadraticCurveTo(d.x - 3, yy + 2, d.x, yy);
      ctx.quadraticCurveTo(d.x + 3, yy + 2, d.x + 7, yy - flap);
      ctx.stroke();
    }
  },

  /* ---------------- 胖红（主角）----------------
   * b: { x, y (屏幕坐标), facing(1/-1), tilt, sx, sy(挤压缩放),
   *      blink(bool), dead(bool), flashT(受伤闪烁) }
   */
  bird(ctx, b, t) {
    const flick = b.flashT > 0 && Math.floor(t * 18) % 2 === 0;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.tilt || 0);
    ctx.scale((b.sx || 1) * (b.facing || 1), b.sy || 1);
    if (flick) ctx.globalAlpha = 0.45;

    const O = PAL.outlineBird;

    // --- 尾羽（3 根胶囊，身后左后方露出，9~10 点方向扇形） ---
    ctx.save();
    ctx.translate(-19, -1);
    ctx.rotate(-0.22);
    ctx.fillStyle = PAL.tail;
    ctx.strokeStyle = O;
    ctx.lineWidth = 1;
    for (const a of [-0.34, 0, 0.34]) {
      ctx.save();
      ctx.rotate(a);
      rr(ctx, -11.5, -2, 11.5, 4, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // --- 头羽（2 根，向左后倒） ---
    ctx.save();
    ctx.fillStyle = PAL.red;
    ctx.strokeStyle = O;
    ctx.lineWidth = 1;
    ctx.save();
    ctx.translate(-2.5, -21);
    ctx.rotate(-0.75);
    ctx.beginPath();
    ctx.ellipse(0, -3.6, 1.8, 4.4, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(1.2, -20.5);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, -2.8, 1.5, 3.4, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // --- 身体（椭圆 + 左上亮月牙 + 底部暗带 + 斑点 + 肚皮） ---
    const RX = 21, RY = 19;
    ctx.beginPath();
    ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
    ctx.fillStyle = PAL.red;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // 左上亮月牙
    ctx.fillStyle = PAL.redLight;
    ctx.beginPath();
    ctx.ellipse(-2.5, -3, RX * 0.95, RY * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.red;
    ctx.beginPath();
    ctx.ellipse(1.5, 2, RX * 0.95, RY * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    // 底部暗带（硬边）
    ctx.fillStyle = PAL.redDark;
    ctx.fillRect(-RX, RY * 0.62, RX * 2, RY);
    // 斑点
    ctx.fillStyle = PAL.redSpot;
    for (const s of [[-12, -2, 2.2], [7, -12, 1.8], [13, 5, 1.5]]) {
      ctx.beginPath();
      ctx.ellipse(s[0], s[1], s[2], s[2] * 0.8, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 肚皮
    ctx.fillStyle = PAL.belly;
    ctx.beginPath();
    ctx.ellipse(0.5, 10, 12.5, 8.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 身体描边
    ctx.beginPath();
    ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = O;
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- 喙（正面偏右） ---
    ctx.lineJoin = "round";
    ctx.fillStyle = PAL.beakTop;
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(3, 0.5);
    ctx.lineTo(16, 1.4);
    ctx.lineTo(16, 4.8);
    ctx.lineTo(3, 5.8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 下喙（微张）
    const jaw = b.dead ? 3.2 : 1.2;
    ctx.fillStyle = PAL.beakBottom;
    ctx.beginPath();
    ctx.moveTo(4, 5.9 + jaw);
    ctx.lineTo(14.5, 5.2 + jaw);
    ctx.lineTo(9, 9.6 + jaw * 1.8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 喙缝
    ctx.strokeStyle = PAL.beakLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, 5.85);
    ctx.lineTo(14.5, 5.15);
    ctx.stroke();

    // --- 眼睛 ---
    const eyes = [[-4.5, -5], [4.5, -4.5]];
    const blinkK = b.blink ? 0.18 : 1;
    for (const e of eyes) {
      ctx.beginPath();
      ctx.ellipse(e[0], e[1], 4.4, 5.4 * blinkK, 0, 0, Math.PI * 2);
      ctx.fillStyle = PAL.eyeWhite;
      ctx.fill();
      ctx.strokeStyle = O;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (b.dead) {
      // X 眼（加粗加大，确保小尺寸可辨）
      ctx.strokeStyle = PAL.pupil;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      for (const e of eyes) {
        ctx.beginPath();
        ctx.moveTo(e[0] - 3.2, e[1] - 3.4);
        ctx.lineTo(e[0] + 3.2, e[1] + 3.4);
        ctx.moveTo(e[0] + 3.2, e[1] - 3.4);
        ctx.lineTo(e[0] - 3.2, e[1] + 3.4);
        ctx.stroke();
      }
    } else if (!b.blink) {
      // 瞳孔 + 左上高光（看向面朝方向）
      for (const e of eyes) {
        ctx.fillStyle = PAL.pupil;
        rr(ctx, e[0] + 0.6, e[1] - 2.6, 3, 5.2, 1.5);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(e[0] + 0.4, e[1] - 1.6, 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e[0] - 0.6, e[1] - 2.7, 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- 怒眉（内倾 V，识别度核心） ---
    ctx.fillStyle = PAL.brow;
    ctx.strokeStyle = PAL.brow;
    const brows = [[-5.2, -8.6, 0.3], [5.2, -8.6, -0.3]];
    for (const br of brows) {
      ctx.save();
      ctx.translate(br[0], br[1]);
      ctx.rotate(br[2] * (b.dead ? 0.5 : 1.25));
      rr(ctx, -5.4, -1.9, 10.8, 3.8, 1.8);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  },

  /* ---------------- 平台 ----------------
   * sx, sy: 屏幕左上角；p: { type, w, h, dir, cracking, crackP, seed }
   * type: wood | ice | belt | spike | grass
   */
  platform(ctx, sx, sy, w, h, p, t) {
    if (p.type === "ice") return this._ice(ctx, sx, sy, w, h, p, t);
    if (p.type === "belt") return this._belt(ctx, sx, sy, w, h, p, t);
    if (p.type === "spike") return this._spike(ctx, sx, sy, w, h, p, t);
    if (p.type === "grass") return this._grass(ctx, sx, sy, w, h, p);
    return this._wood(ctx, sx, sy, w, h, true);
  },

  _wood(ctx, x, y, w, h, nails) {
    ctx.fillStyle = PAL.wood;
    rr(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.save();
    rr(ctx, x, y, w, h, 4);
    ctx.clip();
    // 上 1/3 亮带
    ctx.fillStyle = PAL.woodLight;
    ctx.fillRect(x, y, w, h * 0.34);
    // 顶缘高光线
    ctx.fillStyle = PAL.woodEdge;
    ctx.fillRect(x, y, w, 1.5);
    // 木纹（2 条微垂横线，两端缩进）
    ctx.strokeStyle = PAL.woodGrain;
    ctx.lineWidth = 1;
    const gy = [y + h * 0.58, y + h * 0.82];
    for (let i = 0; i < gy.length; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 6, gy[i]);
      ctx.quadraticCurveTo(x + w / 2, gy[i] + (i % 2 ? 1.6 : -1.6), x + w - 6, gy[i] + (i % 2 ? -0.6 : 1));
      ctx.stroke();
    }
    ctx.restore();
    // 钉子
    if (nails && w > 60) {
      ctx.fillStyle = PAL.nail;
      for (const nx of [x + 10, x + w - 10]) {
        ctx.beginPath();
        ctx.arc(nx, y + h / 2 + 1.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(nx - 0.5, y + h / 2 + 1, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.nail;
      }
    }
    ctx.strokeStyle = PAL.outlineWood;
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, h, 4);
    ctx.stroke();
  },

  _ice(ctx, x, y, w, h, p, t) {
    const jitter = p.cracking ? Math.sin(t * 55) * 1.1 : 0;
    x += jitter;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = PAL.ice;
    rr(ctx, x, y, w, h, 4);
    ctx.fill();
    // 左上大亮块（平行四边形）
    ctx.save();
    rr(ctx, x, y, w, h, 4);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * 1.6, y);
    ctx.lineTo(x + h * 0.9, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    // 斜高光条 ×2
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.32, y + 2.5);
    ctx.lineTo(x + w * 0.32 - h * 0.55, y + h - 2.5);
    ctx.moveTo(x + w * 0.42, y + 2.5);
    ctx.lineTo(x + w * 0.42 - h * 0.55, y + h - 2.5);
    ctx.stroke();
    ctx.restore();
    // 顶缘亮线
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.iceEdge;
    ctx.fillRect(x + 2, y, w - 4, 1.5);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = PAL.outlineIce;
    ctx.lineWidth = 1.6;
    rr(ctx, x, y, w, h, 4);
    ctx.stroke();
    // 破碎预警裂纹
    if (p.cracking) {
      ctx.strokeStyle = PAL.outlineIce;
      ctx.lineWidth = 1.4;
      const cx = x + w * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - 4, y);
      ctx.lineTo(cx - 9, y + h * 0.5);
      ctx.lineTo(cx - 3, y + h);
      ctx.moveTo(cx + 8, y);
      ctx.lineTo(cx + 3, y + h * 0.55);
      ctx.lineTo(cx + 10, y + h);
      ctx.stroke();
    }
    ctx.restore();
  },

  _belt(ctx, x, y, w, h, p, t) {
    ctx.fillStyle = PAL.stone;
    rr(ctx, x, y, w, h, 4);
    ctx.fill();
    ctx.save();
    rr(ctx, x, y, w, h, 4);
    ctx.clip();
    ctx.fillStyle = PAL.stoneLight;
    ctx.fillRect(x, y, w, h * 0.34);
    ctx.fillStyle = PAL.stoneDark;
    ctx.fillRect(x, y + h * 0.76, w, h * 0.24);
    // 裂缝
    ctx.strokeStyle = PAL.stoneCrack;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y);
    ctx.lineTo(x + w * 0.34, y + h * 0.4);
    ctx.lineTo(x + w * 0.26, y + h);
    ctx.moveTo(x + w * 0.72, y);
    ctx.lineTo(x + w * 0.66, y + h * 0.5);
    ctx.lineTo(x + w * 0.74, y + h);
    ctx.stroke();
    // 滚动箭头（chevron，指向移动方向；用深裂缝色保证对比度）
    const dir = p.dir || 1;
    const speed = 52;
    const spacing = 26;
    const off = ((t * speed * dir) % spacing + spacing) % spacing;
    ctx.strokeStyle = PAL.stoneCrack;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let cx = x - spacing + off; cx < x + w + spacing; cx += spacing) {
      ctx.beginPath();
      ctx.moveTo(cx - 4.5 * dir, y + 3);
      ctx.lineTo(cx + 4.5 * dir, y + h / 2);
      ctx.lineTo(cx - 4.5 * dir, y + h - 3);
      ctx.stroke();
    }
    ctx.restore();
    // 两端半圆端帽（朝外凸出）+ 中心滚轴
    ctx.strokeStyle = PAL.outlineStone;
    ctx.lineWidth = 2.5;
    for (const ex of [x, x + w]) {
      ctx.fillStyle = PAL.stoneDark;
      ctx.beginPath();
      // 左端帽取左侧半圆（顺时针 PI/2→PI→3PI/2），右端帽取右侧半圆（逆时针）
      ctx.arc(ex, y + h / 2, h / 2, Math.PI / 2, -Math.PI / 2, ex !== x);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PAL.stoneCrack;
      ctx.beginPath();
      ctx.arc(ex, y + h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    rr(ctx, x, y, w, h, 4);
    ctx.stroke();
  },

  _spike(ctx, x, y, w, h, p, t) {
    this._wood(ctx, x, y + 4, w, h - 4, false);
    // 金属托座
    ctx.fillStyle = PAL.outlineWood;
    ctx.fillRect(x, y + 2, w, 2.5);
    // 尖刺（等腰三角，左亮右暗，中线高光）
    const n = Math.max(2, Math.round(w / 13));
    const step = w / n;
    const sh = 7.5;
    for (let i = 0; i < n; i++) {
      const bx = x + i * step;
      const tipX = bx + step / 2;
      ctx.beginPath();
      ctx.moveTo(bx + 0.5, y + 3);
      ctx.lineTo(tipX, y + 3 - sh);
      ctx.lineTo(bx + step - 0.5, y + 3);
      ctx.closePath();
      ctx.fillStyle = PAL.metalLight;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = PAL.metalDark;
      ctx.fillRect(tipX, y - sh, step, sh + step);
      ctx.restore();
      ctx.strokeStyle = PAL.outlineMetal;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(tipX, y + 2 - sh);
      ctx.lineTo(tipX - 1.2, y + 2);
      ctx.stroke();
    }
  },

  _grass(ctx, x, y, w, h) {
    const dirtH = Math.min(10, h * 0.5);
    const grassH = h - dirtH;
    // 下层土
    ctx.fillStyle = PAL.dirt;
    rr(ctx, x, y + grassH - 2, w, dirtH + 2, 3);
    ctx.fill();
    ctx.strokeStyle = PAL.outlineDirt;
    ctx.lineWidth = 2;
    rr(ctx, x, y + grassH - 2, w, dirtH + 2, 3);
    ctx.stroke();
    // 土纹点
    ctx.fillStyle = "#9c6432";
    ctx.beginPath();
    ctx.arc(x + w * 0.25, y + grassH + dirtH * 0.5, 1.4, 0, Math.PI * 2);
    ctx.arc(x + w * 0.75, y + grassH + dirtH * 0.62, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // 上层草：连续圆弧起伏顶（4 段大弧，弧顶高低错落）
    const bump = grassH * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y + grassH);
    ctx.quadraticCurveTo(x + w * 0.10, y + grassH - bump * 1.9, x + w * 0.24, y + grassH - bump * 0.5);
    ctx.quadraticCurveTo(x + w * 0.37, y - bump * 0.4, x + w * 0.5, y + grassH - bump * 0.3);
    ctx.quadraticCurveTo(x + w * 0.63, y + grassH + bump * 0.5, x + w * 0.78, y + grassH - bump * 0.7);
    ctx.quadraticCurveTo(x + w * 0.9, y + grassH - bump * 2.1, x + w, y + grassH);
    ctx.closePath();
    ctx.fillStyle = PAL.grass;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // 受光亮带（顶部 1/3）+ 底部硬边暗带
    ctx.fillStyle = PAL.grassLight;
    ctx.fillRect(x, y - 2, w, grassH * 0.52);
    ctx.fillStyle = PAL.grassDark;
    ctx.fillRect(x, y + grassH - 2.2, w, 5);
    ctx.restore();
    ctx.strokeStyle = PAL.outlineGrass;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // 小草叶（细三角，尖端小圆）
    ctx.fillStyle = PAL.grass;
    for (const fx of [0.14, 0.42, 0.62, 0.88]) {
      const bx = x + w * fx;
      const by = y + grassH - bump * 1.3;
      ctx.beginPath();
      ctx.moveTo(bx - 1.6, by);
      ctx.lineTo(bx, by - 6);
      ctx.lineTo(bx + 1.6, by);
      ctx.closePath();
      ctx.fill();
    }
    // 小白花（安全/回血信号）
    for (const fx of [0.3, 0.72]) {
      const bx = x + w * fx;
      const by = y + grassH * 0.8;
      ctx.fillStyle = "#ffffff";
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(a) * 2, by + Math.sin(a) * 2, 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = PAL.beakTop;
      ctx.beginPath();
      ctx.arc(bx, by, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /* ---------------- 顶部尖刺天花板（石板 + 倒刺） ---------------- */
  ceiling(ctx, W) {
    const slabH = 26;
    const y0 = -6;
    // 石板
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(-4, y0, W + 8, slabH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-4, y0, W + 8, slabH);
    ctx.clip();
    ctx.fillStyle = PAL.stoneLight;
    ctx.fillRect(-4, y0, W + 8, slabH * 0.4);
    ctx.fillStyle = PAL.stoneDark;
    ctx.fillRect(-4, y0 + slabH * 0.78, W + 8, slabH);
    // 裂缝
    ctx.strokeStyle = PAL.stoneCrack;
    ctx.lineWidth = 1.5;
    for (const fx of [0.22, 0.55, 0.83]) {
      const cx = W * fx;
      ctx.beginPath();
      ctx.moveTo(cx, y0);
      ctx.lineTo(cx + 5, y0 + slabH * 0.45);
      ctx.lineTo(cx - 3, y0 + slabH);
      ctx.stroke();
    }
    ctx.restore();
    // 下缘描边（压迫感最粗）
    ctx.strokeStyle = PAL.outlineStone;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, y0 + slabH);
    ctx.lineTo(W + 4, y0 + slabH);
    ctx.stroke();
    // 倒挂金属尖刺
    const n = Math.ceil(W / 14);
    const sh = 9;
    for (let i = 0; i <= n; i++) {
      const bx = i * 14;
      const tipY = y0 + slabH + sh;
      ctx.beginPath();
      ctx.moveTo(bx - 3.2, y0 + slabH);
      ctx.lineTo(bx, tipY);
      ctx.lineTo(bx + 3.2, y0 + slabH);
      ctx.closePath();
      ctx.fillStyle = PAL.metalLight;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = PAL.metalDark;
      ctx.fillRect(bx, y0, 4, sh + 6);
      ctx.restore();
      ctx.strokeStyle = PAL.outlineMetal;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  },

  /* ---------------- 骑自行车的鹈鹕（顶部敌人，抡鱼） ----------------
   * p: { x, y(屏幕), facing(1/-1), spin(车轮转角), swingA(抡鱼角), lean(前倾), aiming(bool) }
   * 注意：鱼不在此函数内画（由 Art.fish 在屏幕空间画，避免镜像角出错）
   */
  pelican(ctx, p, t) {
    const O = PAL.outlineBird;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.facing, 1);
    ctx.rotate(p.lean || 0);

    const W1 = { x: -17, y: 20 }, W2 = { x: 17, y: 20 }; // 前后轮
    const CRANK = { x: 0, y: 14 };

    // ---- 车轮 ----
    const wheel = (c) => {
      ctx.fillStyle = "#3e3e44";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c6c9ce";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8f959c";
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        const a = p.spin + (k / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(c.x - Math.cos(a) * 6, c.y - Math.sin(a) * 6);
        ctx.lineTo(c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6);
        ctx.stroke();
      }
      ctx.fillStyle = "#3e3e44";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
      ctx.fill();
    };

    // ---- 车架（深色描边层 + 红色内芯） ----
    const seg = (x1, y1, x2, y2, w, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    const frameSeg = (x1, y1, x2, y2) => {
      seg(x1, y1, x2, y2, 5, "#96150d");
      seg(x1, y1, x2, y2, 2.6, PAL.red);
    };

    wheel(W1);
    frameSeg(W1.x, W1.y, -4, 4);       // 后轮→鞍座
    frameSeg(W1.x, W1.y, CRANK.x, CRANK.y);
    frameSeg(CRANK.x, CRANK.y, W2.x, W2.y);
    frameSeg(W2.x, W2.y, 15, -4);      // 前轮→车把
    frameSeg(-4, 4, -4, -2);           // 座杆
    frameSeg(-4, 4, 15, -4);           // 上管
    wheel(W2);
    // 车把 + 握把
    seg(15, -4, 17, -8, 4, "#3e3e44");
    seg(15, -4, 17, -8, 1.8, "#8f959c");
    // 鞍座
    ctx.fillStyle = PAL.tail;
    rr(ctx, -9, -5, 10, 4, 2);
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ---- 曲柄 + 踏板 + 腿 ----
    const pa = p.spin * 0.8;
    const pedal = (s) => {
      const px = CRANK.x + Math.cos(pa + (s > 0 ? 0 : Math.PI)) * 5;
      const py = CRANK.y + Math.sin(pa + (s > 0 ? 0 : Math.PI)) * 5;
      // 腿（橙）
      seg(-2, -8, px, py, 4.5, "#7a3b10");
      seg(-2, -8, px, py, 2.4, PAL.beakTop);
      // 踏板
      ctx.fillStyle = "#3e3e44";
      rr(ctx, px - 3.2, py - 1.4, 6.4, 2.8, 1.2);
      ctx.fill();
      return { px, py };
    };
    pedal(-1); // 远侧腿先画（被身体盖住一部分）
    pedal(1);

    // ---- 鹈鹕身体 ----
    // 尾羽
    ctx.fillStyle = "#e9e2d2";
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, -16);
    ctx.lineTo(-20, -19);
    ctx.lineTo(-19, -13);
    ctx.lineTo(-11, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 身体
    ctx.beginPath();
    ctx.ellipse(-1, -13, 13, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "#e9e2d2";
    ctx.fillRect(-14, -8, 28, 8); // 底部阴影带
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(-1, -13, 13, 10, 0, 0, Math.PI * 2);
    ctx.strokeStyle = O;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 脖子（两遍描法：粗深色 + 细白色）
    const neck = () => {
      ctx.beginPath();
      ctx.moveTo(5, -17);
      ctx.quadraticCurveTo(9, -22, 9.5, -28);
    };
    neck();
    ctx.strokeStyle = O;
    ctx.lineWidth = 8.5;
    ctx.lineCap = "round";
    ctx.stroke();
    neck();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5.5;
    ctx.stroke();
    // 头
    ctx.beginPath();
    ctx.arc(11, -31, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 大喙 + 喉囊（橙）
    ctx.beginPath();
    ctx.moveTo(14, -32.5);
    ctx.lineTo(30, -28.5);            // 上缘
    ctx.quadraticCurveTo(24, -20.5, 14.5, -26.5); // 囊
    ctx.closePath();
    ctx.fillStyle = PAL.beakTop;
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = PAL.beakBottom;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(15, -29.5);
    ctx.lineTo(29, -28);
    ctx.stroke();
    // 眼 + 怒眉（反派眉毛）
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(12.5, -33.5, 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = PAL.pupil;
    ctx.beginPath();
    ctx.arc(13.2, -33.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.brow;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(10, -37.6);
    ctx.lineTo(15.2, -36.4);
    ctx.stroke();

    // ---- 翅膀 A：扶车把 ----
    const wingA = () => {
      ctx.beginPath();
      ctx.moveTo(4, -16);
      ctx.quadraticCurveTo(12, -13, 16, -6);
    };
    wingA();
    ctx.strokeStyle = O;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    wingA();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.stroke();

    // ---- 翅膀 B：抡鱼的手臂（从肩(0,-18)摆出） ----
    const hx = Math.cos(p.swingA) * 16;
    const hy = -18 + Math.sin(p.swingA) * 16;
    const wingB = () => {
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(hx, hy);
    };
    wingB();
    ctx.strokeStyle = O;
    ctx.lineWidth = 5.5;
    ctx.stroke();
    wingB();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.2;
    ctx.stroke();
    // 手
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();

    // ---- 预警 "!!"（不随镜像翻转，在屏幕空间画） ----
    if (p.aiming) {
      const ex = p.x + p.facing * 11, ey = p.y - 46;
      ctx.save();
      ctx.font = "900 17px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeText("!!", ex, ey);
      ctx.fillStyle = PAL.red;
      ctx.fillText("!!", ex, ey);
      ctx.restore();
    }
  },

  /* 鱼（屏幕空间，rotation 为屏幕角；鱼头朝外） */
  fish(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const O = "#17548a";
    ctx.lineJoin = "round";
    // 尾鳍（在 -x 内侧）
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-14, -5);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fillStyle = "#1e7bc4";
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.5, 4.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#55a9de";
    ctx.fill();
    ctx.stroke();
    // 背鳍
    ctx.beginPath();
    ctx.moveTo(-3, -4.2);
    ctx.lineTo(0, -8);
    ctx.lineTo(3.5, -4);
    ctx.closePath();
    ctx.fillStyle = "#1e7bc4";
    ctx.fill();
    ctx.stroke();
    // 白肚
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 10.5, 4.8, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#e8f7fc";
    ctx.fillRect(-11, 1.2, 22, 5);
    ctx.restore();
    // 眼（+x 头端）
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(6, -1.2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.fillStyle = PAL.pupil;
    ctx.beginPath();
    ctx.arc(6.5, -1.2, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /* ---------------- 粒子素材 ---------------- */

  puff(ctx, x, y, r, life) {
    ctx.globalAlpha = Math.min(1, life * 1.6) * 0.75;
    ctx.fillStyle = "#e8dcc4";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y + r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.arc(x - r * 0.8, y + r * 0.3, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  shard(ctx, x, y, size, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.45);
    ctx.lineTo(size, -size * 0.7);
    ctx.lineTo(size * 0.75, size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  feather(ctx, x, y, rot, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = PAL.red;
    ctx.strokeStyle = PAL.outlineBird;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.2 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PAL.redDark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -4.6 * s);
    ctx.lineTo(0, 4.6 * s);
    ctx.stroke();
    ctx.restore();
  },

  heart(ctx, x, y, s, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PAL.red;
    ctx.strokeStyle = PAL.outlineBird;
    ctx.lineWidth = 0.9 / s;
    ctx.beginPath();
    ctx.moveTo(0, 3.2);
    ctx.bezierCurveTo(-4.6, -0.6, -2.6, -4.4, 0, -1.8);
    ctx.bezierCurveTo(2.6, -4.4, 4.6, -0.6, 0, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },
};

window.Art = Art;
window.PAL = PAL;
window.rr = rr;
