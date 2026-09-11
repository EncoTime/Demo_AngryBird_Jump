/* ============================================================
 * game.js — 是男人就下100层 · 愤怒的小鸟版
 * 玩法：只能左右移动，靠平台缝隙不断下坠；
 *       顶部尖刺天花板持续下压，被顶到快速扣血；
 *       下到第 100 层获胜。
 * ============================================================ */
"use strict";

(function () {

  /* ---------- 常量 ---------- */
  const W = 480, H = 640;
  const GRAVITY = 2300;        // 重力
  const MAX_FALL = 780;        // 最大落速
  const ACCEL = 3000;          // 水平加速
  const MAX_SPEED = 350;       // 水平最大速度
  const FRICTION = 2400;       // 地面摩擦
  const PLAT_H = 16;           // 平台高
  const BIRD_RX = 11;          // 碰撞半宽（比视觉略小，手感宽容）
  const BIRD_RY = 18;          // 碰撞半高（脚底 = y + 18）
  const HP_MAX = 10;
  const SPIKE_DMG = 2;         // 钉板单次伤害
  const CEIL_DPS = 14;         // 天花板每秒伤害
  const BELT_TARGET = 190;     // 传送带推动的稳定速度
  const ICE_CRACK_T = 0.45;    // 冰板踩碎延时
  const WIN_FLOOR = 100;
  const PELICAN_AT = 5;        // 开局 5 秒后鹈鹕从顶部冲出
  const PATROL_Y = 118;        // 鹈鹕巡逻的屏幕高度

  /* ---------- DOM ---------- */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const elFloor = document.getElementById("floorNum");
  const elHearts = document.getElementById("hearts");
  const elOvStart = document.getElementById("ovStart");
  const elOvWin = document.getElementById("ovWin");
  const elOvLose = document.getElementById("ovLose");
  const elLoseFloor = document.getElementById("loseFloor");
  const elLoseHint = document.getElementById("loseHint");

  // 高分屏适配
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  /* ---------- 音效（WebAudio 合成，无音频文件） ---------- */
  const Sfx = {
    ac: null, muted: false,
    ensure() {
      if (!this.ac) {
        try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { this.ac = null; }
      }
      if (this.ac && this.ac.state === "suspended") this.ac.resume();
      return this.ac;
    },
    tone(f0, f1, dur, type, vol, delay) {
      const ac = this.ensure();
      if (!ac || this.muted) return;
      const t0 = ac.currentTime + (delay || 0);
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    noise(dur, vol, delay, freq) {
      const ac = this.ensure();
      if (!ac || this.muted) return;
      const t0 = ac.currentTime + (delay || 0);
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const g = ac.createGain();
      g.gain.value = vol;
      const f = ac.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = freq || 900;
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t0);
    },
    land() { this.tone(150, 62, 0.09, "triangle", 0.4); },
    tick() { this.tone(640, 660, 0.05, "sine", 0.18); },
    bounce() { this.tone(170, 430, 0.13, "sine", 0.32); },
    hurt() { this.tone(330, 130, 0.18, "square", 0.22); this.noise(0.09, 0.2); },
    crack() { this.tone(1300, 800, 0.05, "square", 0.12); },
    shatter() { this.noise(0.24, 0.42); this.tone(950, 300, 0.16, "sine", 0.2); },
    heal() { this.tone(660, 660, 0.09, "sine", 0.26); this.tone(880, 880, 0.13, "sine", 0.26, 0.09); },
    win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, "triangle", 0.3, i * 0.13)); },
    lose() { [392, 311, 233].forEach((f, i) => this.tone(f, f * 0.97, 0.22, "triangle", 0.3, i * 0.17)); },
    horn() { this.tone(392, 392, 0.13, "square", 0.2); this.tone(523, 523, 0.15, "square", 0.2, 0.14); },
    whoosh() { this.noise(0.22, 0.3, 0, 500); },
    fishHit() { this.tone(720, 140, 0.3, "sawtooth", 0.3); this.noise(0.18, 0.35, 0, 400); },
    powerup() { [660, 880, 1100].forEach((f, i) => this.tone(f, f, 0.1, "square", 0.2, i * 0.07)); },
    bait() { this.tone(420, 110, 0.32, "sawtooth", 0.24); this.tone(300, 85, 0.36, "square", 0.18, 0.1); },
    crash() { this.noise(0.3, 0.5, 0, 300); this.tone(140, 55, 0.28, "square", 0.3); this.tone(900, 300, 0.15, "sine", 0.15); },
  };

  /* ---------- 游戏状态 ---------- */
  const G = {
    state: "start",          // start | playing | win | lose
    freeze: false,           // 调试：冻结物理
    platforms: [],           // {x, y(世界), w, h, type, row, dir, cracking, crackT, healed}
    particles: [],
    bird: null,
    camY: 0,
    maxRow: 0,               // 已落到的最大行号（0 起）
    floor: 1,                // 层数显示 = maxRow + 1
    hp: HP_MAX,
    nextRowY: 0,             // 下一行平台的世界 y
    rowCount: 0,
    pelicans: [],            // 骑车抡鱼的鹈鹕（可多只，有寿命）
    nextPelicanAt: 5,        // 下一次自动派出鹈鹕的 roundT
    roundT: 0,               // 本局已进行时间（秒）
    invBuffT: 0,             // 无敌 buff 剩余秒数
    slowT: 0,                // 缓速 buff 剩余秒数（大幅降低强制滚动）
    hasteT: 0,               // 加速 debuff 剩余秒数（大幅提升强制滚动，与缓速互斥）
    sparkT: 0,               // 无敌特效粒子节拍
    fishSparkT: 0,           // 无敌挡鱼特效节拍
    noPelican: false,        // 调试：禁用鹈鹕
    deathCause: "",
    hurtFlash: 0,            // 受击红闪
    invT: 0,                 // 无敌帧
    spikeTickT: 0,           // 钉板持续伤害节拍
    overlayTimer: null,
    animT: 0,
    shownFloor: -1,
    shownHp: -1,
  };

  const keys = { left: false, right: false };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- 魔性 buff 广告（两侧从底部升起，顶部消失，无限循环） ---------- */
  const BUFFS = [
    { id: "inv3",  kind: "inv",  dur: 3,  w: 30, name: "无敌3秒",  theme: "gold",
      words: "钉板随便踩｜天花板随便顶｜大鱼抡飞也不疼｜真男人都说好" },
    { id: "inv5",  kind: "inv",  dur: 5,  w: 18, name: "无敌5秒",  theme: "gold",
      words: "五秒真男人｜钉板当床睡｜天花板当帽戴｜鹈鹕见了绕道走" },
    { id: "inv10", kind: "inv",  dur: 10, w: 8,  name: "无敌10秒", theme: "gold",
      words: "十秒无敌装｜横着走都行｜闭眼下十层｜亲友团强烈推荐" },
    { id: "slow3", kind: "slow", dur: 3,  w: 22, name: "缓速3秒",  theme: "blue",
      words: "天花板急刹车｜地图慢下来｜从容挑缝隙｜下100层神器" },
    { id: "slow5", kind: "slow", dur: 5,  w: 22, name: "缓速5秒",  theme: "blue",
      words: "五秒慢动作｜钉板看清楚｜传送带不慌｜老司机必备" },
    { id: "haste1", kind: "haste", dur: 1, w: 8, name: "加速1秒", theme: "trap",
      words: "地图狂飙｜天花板俯冲｜手滑专属｜点了就刺激" },
    { id: "haste2", kind: "haste", dur: 2, w: 6, name: "加速2秒", theme: "trap",
      words: "二倍狂飙｜天旋地转｜真男人不怕快｜怕快勿点" },
    { id: "haste3", kind: "haste", dur: 3, w: 4, name: "加速3秒", theme: "trap",
      words: "三秒地狱｜天花板贴脸｜后悔药没得卖｜慎点慎点" },
    { id: "peli1", kind: "pelican", count: 1, w: 8, name: "鹈鹕+1", theme: "trap",
      words: "空降增援｜骑车大军｜鱼多力量大｜怕鱼勿点" },
    { id: "peli2", kind: "pelican", count: 2, w: 5, name: "鹈鹕+2", theme: "trap",
      words: "双倍巡逻｜左右夹击｜鱼贯而入｜手滑必看" },
    { id: "peli3", kind: "pelican", count: 3, w: 3, name: "鹈鹕+3", theme: "trap",
      words: "鹈鹕海啸｜满天大鱼｜神仙难救｜极限挑战" },
  ];
  const AD_SPEED = 88;                 // 上升速度 px/s
  const AD_SPAWN_MIN = 2.8, AD_SPAWN_MAX = 5.5; // 生成间隔
  const AD_GAP = 218;                  // 同侧两张广告的最小升起间距（防重叠）

  const ads = {
    L: { el: document.getElementById("adColL"), list: [], next: 0.8 },
    R: { el: document.getElementById("adColR"), list: [], next: 1.6 },
  };

  function pickBuff() {
    let sum = 0;
    for (const b of BUFFS) sum += b.w;
    let r = Math.random() * sum;
    for (const b of BUFFS) { r -= b.w; if (r <= 0) return b; }
    return BUFFS[0];
  }

  function spawnAd(side, forcedBuff, forcedY) {
    const a = ads[side];
    // 最下面一张需已升起足够距离，避免重叠
    if (forcedBuff === undefined && a.list.some(ad => ad.y < AD_GAP)) return;
    const b = forcedBuff || pickBuff();
    const float = document.createElement("div");
    float.className = "ad-float";
    const mWord = { inv: "无敌!无敌!", slow: "缓速!缓速!", haste: "加速!加速!", pelican: "鹈鹕!鹈鹕!" }[b.kind] || "";
    const mTxt = mWord + "点击就送!手慢无!";
    const topTxt = { inv: "【神装福利】", slow: "【小编推荐】", haste: "【神秘大奖·慎点】", pelican: "【神秘大奖·慎点】" }[b.kind] || "【福利】";
    float.innerHTML = `
      <div class="ad-card theme-${b.theme}">
        <div class="ad-top">${topTxt}·点一下</div>
        <div class="ad-name">${b.name.replace(/(\d+)/, '<span class="n">$1</span>')}</div>
        <div class="ad-burst">点我!</div>
        <div class="ad-count">仅剩 <b>7</b> 秒</div>
        <div class="ad-words">${b.words}</div>
        <div class="ad-marquee"><span>${mTxt}${mTxt}</span></div>
      </div>`;
    a.el.appendChild(float);
    const ad = { el: float, buff: b, y: forcedY !== undefined ? forcedY : -(float.offsetHeight || 215) - 4, dead: false };
    ad.el.style.bottom = ad.y + "px";
    float.addEventListener("click", () => claimAd(ad));
    a.list.push(ad);
    return ad;
  }

  function claimAd(ad) {
    if (G.state !== "playing" || ad.dead) return;
    ad.dead = true;
    const b = ad.buff;
    if (b.kind === "inv") {
      G.invBuffT = Math.max(G.invBuffT, b.dur);
      Sfx.ensure(); Sfx.powerup();
      burst("shard", G.bird.x, G.bird.y, 8, { speed: 150, up: 110, color: "#f5a623" });
    } else if (b.kind === "slow") {
      G.slowT = Math.max(G.slowT, b.dur);
      G.hasteT = 0; // 与加速互斥
      Sfx.ensure(); Sfx.powerup();
      burst("shard", G.bird.x, G.bird.y, 8, { speed: 150, up: 110, color: "#55a9de" });
    } else if (b.kind === "haste") {
      G.hasteT = Math.max(G.hasteT, b.dur);
      G.slowT = 0; // 与缓速互斥
      Sfx.ensure(); Sfx.bait();
      burst("shard", G.bird.x, G.bird.y, 8, { speed: 190, up: 130, color: "#d42b1e" });
    } else if (b.kind === "pelican") {
      spawnPelicans(b.count || 1);
      Sfx.ensure(); Sfx.bait();
      burst("feather", G.bird.x, G.bird.y - 40, 6, { speed: 140, up: 90, life: 0.7 });
    }
    ad.el.classList.add("claimed");
    setTimeout(() => ad.el.remove(), 400);
  }

  function updateAds(dt) {
    for (const side of ["L", "R"]) {
      const a = ads[side];
      const colH = a.el.clientHeight || 640;
      a.next -= dt;
      if (a.next <= 0) { spawnAd(side); a.next = rand(AD_SPAWN_MIN, AD_SPAWN_MAX); }
      for (let i = a.list.length - 1; i >= 0; i--) {
        const ad = a.list[i];
        if (ad.dead) { a.list.splice(i, 1); continue; }
        ad.y += AD_SPEED * dt;
        ad.el.style.bottom = ad.y + "px";
        // 倒计时 = 升到顶部消失的剩余秒数
        const left = Math.max(0, Math.ceil((colH - ad.y) / AD_SPEED));
        if (left !== ad.lastLeft) {
          ad.lastLeft = left;
          const bEl = ad.el.querySelector(".ad-count b");
          if (bEl) bEl.textContent = String(left);
        }
        if (ad.y >= colH) { // 升到顶部：没被点，消失
          ad.el.remove();
          a.list.splice(i, 1);
        }
      }
    }
  }

  function adsReset() {
    for (const side of ["L", "R"]) {
      const a = ads[side];
      a.list.forEach(ad => ad.el.remove());
      a.list = [];
      a.next = side === "L" ? 0.8 : 1.6;
    }
  }

  /* ---------- 平台生成 ---------- */

  // 按深度返回各类型权重
  function typeWeights(row) {
    const d = clamp(row / 99, 0, 1);
    return {
      wood:   1.0 - d * 0.55,
      ice:    row < 12 ? 0 : 0.08 + d * 0.18,
      belt:   row < 6  ? 0 : 0.05 + d * 0.14,
      spike:  row < 18 ? 0 : 0.04 + Math.pow(d, 1.4) * 0.5,
      grass:  row < 4  ? 0 : 0.055,
    };
  }

  function pickType(row) {
    const w = typeWeights(row);
    let sum = 0;
    for (const k in w) sum += w[k];
    let r = Math.random() * sum;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return "wood";
  }

  function spawnRow(row, y) {
    const d = clamp(row / 99, 0, 1);
    const mkPlat = (type, w, x) => ({
      x, y, w, h: type === "grass" ? 20 : PLAT_H, type, row,
      dir: Math.random() < 0.5 ? -1 : 1,
      cracking: false, crackT: 0, healed: false,
    });
    const width = () => rand(lerp(118, 70, d), lerp(140, 96, d));

    if (row <= 2) {
      // 起步：单块宽木板
      const w = 190;
      G.platforms.push(mkPlat("wood", w, rand(10, W - 10 - w)));
      return;
    }

    const two = Math.random() < 0.34;
    if (!two) {
      const w = width();
      G.platforms.push(mkPlat(pickType(row), w, rand(8, W - 8 - w)));
      return;
    }
    // 双平台：保证板间/板侧至少 76px 通道
    const w1 = width() * 0.8, w2 = width() * 0.8;
    for (let tries = 0; tries < 24; tries++) {
      const x1 = rand(8, W * 0.55 - w1 * 0.4);
      const gap = rand(76, W - 130 - w1 - w2);
      const x2 = x1 + w1 + gap;
      if (x2 + w2 <= W - 8 && x2 - (x1 + w1) >= 76) {
        G.platforms.push(mkPlat(pickType(row), w1, x1));
        G.platforms.push(mkPlat(pickType(row), w2, x2));
        return;
      }
    }
    const w = width();
    G.platforms.push(mkPlat(pickType(row), w, rand(8, W - 8 - w)));
  }

  function ensureRows() {
    while (G.nextRowY < G.camY + H + 180) {
      spawnRow(G.rowCount, G.nextRowY);
      const d = clamp(G.rowCount / 99, 0, 1);
      G.rowCount++;
      G.nextRowY += rand(lerp(112, 94, d), lerp(132, 112, d));
    }
  }

  function pruneRows() {
    G.platforms = G.platforms.filter(p => p.y + p.h > G.camY - 90);
  }

  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------- 粒子 ---------- */
  function burst(kind, x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, (opts && opts.speed) || 170);
      G.particles.push({
        kind,
        x, y,
        vx: Math.cos(a) * sp * rand(0.4, 1),
        vy: Math.sin(a) * sp * rand(0.4, 1) - (opts && opts.up || 0),
        rot: rand(0, Math.PI * 2),
        vr: rand(-6, 6),
        size: rand((opts && opts.sMin) || 2, (opts && opts.sMax) || 4.5),
        life: rand(0.35, (opts && opts.life) || 0.7),
        maxLife: 1,
        color: opts && opts.color,
      });
      G.particles[G.particles.length - 1].maxLife = G.particles[G.particles.length - 1].life;
    }
  }

  /* ---------- 初始化 / 重置 ---------- */
  function reset() {
    G.platforms = [];
    G.particles = [];
    G.pelicans = [];
    G.nextPelicanAt = PELICAN_AT;
    G.roundT = 0;
    G.invBuffT = 0;
    G.slowT = 0;
    G.hasteT = 0;
    G.fishSparkT = 0;
    adsReset();
    G.maxRow = 0;
    G.floor = 1;
    G.hp = HP_MAX;
    G.rowCount = 0;
    G.deathCause = "";
    G.hurtFlash = 0;
    G.invT = 0;
    G.spikeTickT = 0;
    G.shownFloor = -1;
    G.shownHp = -1;
    if (G.overlayTimer) { clearTimeout(G.overlayTimer); G.overlayTimer = null; }

    // 第一行（起步木板）；先定相机再生成，避免用上一局残留 camY 过量生成
    const startY = 320;
    G.camY = startY - BIRD_RY - 280;
    G.nextRowY = startY;
    ensureRows();

    const p0 = G.platforms[0];
    G.bird = {
      x: p0.x + p0.w / 2, y: p0.y - BIRD_RY,
      vx: 0, vy: 0,
      onGround: true, ground: p0,
      facing: 1, squash: 0, blinkT: rand(1, 3),
    };
    G.camY = G.bird.y - 280;
    updateHUD(true);
  }

  // 调试：直接从第 n 层开局（生成 0..n-1 行，站在第 n-1 行上）
  function fastForwardTo(n) {
    n = clamp(n, 1, 99);
    // 先重新生成所有行
    G.platforms = [];
    G.rowCount = 0;
    G.camY = 0;
    G.nextRowY = 320;
    ensureRows();
    while (G.rowCount < n) {
      spawnRow(G.rowCount, G.nextRowY);
      const d = clamp(G.rowCount / 99, 0, 1);
      G.rowCount++;
      G.nextRowY += rand(lerp(112, 94, d), lerp(132, 112, d));
    }
    const rowPlats = G.platforms.filter(p => p.row === n - 1);
    const p = rowPlats[0] || G.platforms[G.platforms.length - 1];
    G.bird.x = p.x + p.w / 2;
    G.bird.y = p.y - BIRD_RY;
    G.bird.vx = 0; G.bird.vy = 0;
    G.bird.onGround = true; G.bird.ground = p;
    G.maxRow = n - 1;
    G.floor = n;
    ensureRows();
    G.camY = G.bird.y - 280;
    pruneRows();
    updateHUD(true);
  }

  function showOverlay(which) {
    elOvStart.classList.add("hidden");
    elOvWin.classList.add("hidden");
    elOvLose.classList.add("hidden");
    if (which === "start") elOvStart.classList.remove("hidden");
    if (which === "win") elOvWin.classList.remove("hidden");
    if (which === "lose") elOvLose.classList.remove("hidden");
  }

  // 重置并立刻开局（重置按钮 / R 键 / 再来一局）
  function restart() {
    Sfx.ensure();
    reset();
    G.state = "playing";
    showOverlay(null);
  }

  function startGame() {
    Sfx.ensure();
    G.state = "playing";
    showOverlay(null);
  }

  function win() {
    if (G.state !== "playing") return;
    G.state = "win";
    Sfx.win();
    // 彩带
    const colors = ["#d42b1e", "#f5a623", "#5fa84f", "#55a9de", "#f5d9a8"];
    for (let i = 0; i < 40; i++) {
      G.particles.push({
        kind: "confetti",
        x: rand(0, W), y: G.bird.y - rand(60, 240),
        vx: rand(-40, 40), vy: rand(30, 120),
        rot: rand(0, Math.PI * 2), vr: rand(-8, 8),
        size: rand(3, 5.5), life: rand(1.2, 2.2), maxLife: 2.2,
        color: colors[i % colors.length],
      });
    }
    G.overlayTimer = setTimeout(() => { if (G.state === "win") showOverlay("win"); }, 900);
  }

  function die(cause) {
    if (G.state !== "playing") return;
    G.state = "lose";
    G.deathCause = cause;
    G.hp = 0;
    updateHUD(true);
    Sfx.lose();
    if (cause === "fish") Sfx.fishHit();
    burst("feather", G.bird.x, G.bird.y - 6, 14, { speed: 240, up: 140, life: 1.0 });
    elLoseFloor.textContent = String(G.floor);
    elLoseHint.textContent = {
      ceiling: "天花板追上来了——别停，往下跳！",
      spike: "钉板太伤了——躲开它们再下！",
      fish: "被大鱼抡飞了！小心骑车的鹈鹕！",
    }[cause] || "再试一次，别停下！";
    G.overlayTimer = setTimeout(() => { if (G.state === "lose") showOverlay("lose"); }, 800);
  }

  /* ---------- 鹈鹕（开局 5 秒后从顶部冲出；世界空间实体，会被天花板压死，自行车越骑越慢并在 2~5 秒散架） ---------- */
  const MAX_PELICANS = 6;

  // 散架寿命：2s:3s:4s:5s = 4:3:2:1
  function pickPelicanLife() {
    const r = Math.random() * 10;
    if (r < 4) return 2;
    if (r < 7) return 3;
    if (r < 9) return 4;
    return 5;
  }

  function spawnPelican(x) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const p = {
      x: x !== undefined ? x : W / 2 + rand(-70, 70),
      wy: G.camY - 70,       // 世界坐标 y（屏幕 y 每帧派生到 p.y）
      y: -70,
      vx: 230 * dir,         // 起步很快，随后按寿命衰减
      facing: dir, state: "enter",
      spin: 0, lastX: 0,
      swingA: rand(0, Math.PI * 2), swingW: 3.6,
      timer: 0, aimT: 0, diveT: 0,
      tx: 0, twy: 0, lean: 0, aiming: false,
      nextDive: rand(0.7, 1.8),
      life: pickPelicanLife(),
      age: 0,                // 已骑行秒数（进入 patrol 后开始计）
    };
    p.lastX = p.x;
    G.pelicans.push(p);
    Sfx.horn();
    return p;
  }

  // debuff：一次召唤 n 只（不超过上限；入场上高度错开，避免同帧扎堆）
  function spawnPelicans(n) {
    let c = 0;
    for (let k = 0; k < n && G.pelicans.length < MAX_PELICANS; k++) {
      const p = spawnPelican(rand(60, W - 60));
      p.wy -= rand(0, 160);
      c++;
    }
    return c;
  }

  // 鹈鹕死亡（散架/被压）：撞碎粒子 + 音效；不影响小鸟（粒子均为世界坐标）
  function killPelican(p, cause) {
    const idx = G.pelicans.indexOf(p);
    if (idx < 0) return;
    G.pelicans.splice(idx, 1);
    const wy = p.wy;
    burst("shard", p.x - 17, wy + 20, 3, { speed: 230, up: 200, sMin: 3, sMax: 4.5, color: "#3e3e44", life: 0.9 });
    burst("shard", p.x + 17, wy + 20, 3, { speed: 230, up: 200, sMin: 3, sMax: 4.5, color: "#3e3e44", life: 0.9 });
    burst("shard", p.x, wy, 5, { speed: 260, up: 220, sMin: 2.5, sMax: 4.5, color: "#d42b1e", life: 0.9 });
    burst("feather", p.x, wy - 10, 10, { speed: 230, up: 180, life: 1.1 });
    burst("shard", p.x, wy - 6, 4, { speed: 200, up: 150, sMin: 2, sMax: 3.5, color: "#55a9de", life: 0.9 });
    burst("puff", p.x, wy + 24, 6, { speed: 100, life: 0.6 });
    // 整条大鱼脱手甩飞（可读的鱼形）
    G.particles.push({
      kind: "fishdrop",
      x: p.x, y: wy - 18,
      vx: rand(-160, 160) + p.facing * 90, vy: -rand(260, 360),
      rot: rand(0, Math.PI * 2), vr: rand(-9, 9),
      size: 1, life: 1.3, maxLife: 1.3,
    });
    Sfx.crash();
  }

  function updatePelican(p, dt) {
    const b = G.bird;
    const ceilBottom = G.camY + 34;

    // 骑行寿命：越骑越慢，寿命一到自行车散架
    if (p.state !== "enter") {
      p.age += dt;
      if (p.age >= p.life) { killPelican(p, "bike"); return; }
    }
    const decay = clamp(p.age / p.life, 0, 1);      // 0 起步 → 1 濒散架
    const rideSpd = 230 - 175 * decay;              // 230 → 55 px/s

    switch (p.state) {
      case "enter": // 从顶部冲下来
        p.wy += 560 * dt;
        p.x += p.vx * dt * 0.6;
        if (p.wy - G.camY >= PATROL_Y) { p.state = "patrol"; }
        break;
      case "patrol": { // 左右巡逻（速度随寿命衰减），边缘转向
        p.vx = Math.sign(p.vx || 1) * rideSpd;
        p.x += p.vx * dt;
        if (p.x < 36) { p.x = 36; p.vx = Math.abs(p.vx); }
        if (p.x > W - 36) { p.x = W - 36; p.vx = -Math.abs(p.vx); }
        p.facing = p.vx >= 0 ? 1 : -1;
        p.wy += Math.sin(G.animT * 3.2) * 4 * dt; // 轻微起伏
        p.timer += dt;
        if (p.timer >= p.nextDive) {
          p.state = "aim"; p.aimT = 0; p.aiming = true;
          p.facing = (b.x >= p.x) ? 1 : -1;
        }
        break;
      }
      case "aim": // 刹车 + "!!" 预警，抡速加快
        p.aimT += dt;
        p.vx *= Math.max(0, 1 - 8 * dt);
        p.x += p.vx * dt;
        p.swingW = 6.5;
        if (p.aimT >= 0.55) {
          p.state = "dive"; p.aiming = false; p.swingW = 5.2;
          p.tx = b.x; p.twy = Math.min(b.y, G.camY + H - 150);
          p.diveT = 0;
          Sfx.whoosh();
        }
        break;
      case "dive": { // 朝预警时的小鸟位置直冲（世界坐标）
        p.diveT += dt;
        const sy = p.wy - G.camY;
        const dx = p.tx - p.x, dy = p.twy - p.wy;
        const dist = Math.hypot(dx, dy) || 1;
        p.x += (dx / dist) * 470 * dt;
        p.wy += (dy / dist) * 470 * dt;
        if (Math.abs(dx) > 14) p.facing = dx >= 0 ? 1 : -1;
        p.lean = Math.min(0.35, 0.1 + Math.abs(dy) / (Math.abs(dx) + 80) * 0.45);
        if (dist < 26 || p.diveT > 1.8 || sy > H - 140) {
          p.state = "return"; p.lean = 0; p.timer = 0;
          p.nextDive = rand(3.2, 5.2); p.swingW = 3.6;
        }
        break;
      }
      case "return": // 骑回顶部巡逻带（世界坐标）
        p.wy -= 430 * dt;
        p.x += clamp(W / 2 - p.x, -70, 70) * dt;
        if (p.wy - G.camY <= PATROL_Y) { p.state = "patrol"; }
        break;
    }

    // 顶部尖刺压死（enter 冲入阶段豁免）
    if (p.state !== "enter" && p.wy - 38 < ceilBottom) {
      killPelican(p, "ceiling");
      return;
    }

    // 车轮转动跟随实际水平位移（转向正确）
    p.spin += (p.x - p.lastX) / 10 + (p.state === "enter" ? 14 * dt : 0);
    p.lastX = p.x;
    p.swingA += p.swingW * dt;
    p.y = p.wy - G.camY; // 派生屏幕坐标（绘制/碰撞用）
  }

  // 鱼的屏幕位置（绘制与碰撞共用；肩部在鹈鹕本地 (0,-18)，半径 29）
  function fishPose(p) {
    const c = Math.cos(p.swingA), s = Math.sin(p.swingA);
    return {
      cx: p.x + p.facing * c * 29,
      cy: p.y - 18 + s * 29,
      ang: Math.atan2(s, p.facing * c),
    };
  }

  function checkFishHit() {
    if (!G.pelicans.length) return false;
    const b = G.bird, bsy = b.y - G.camY;
    if (bsy < -30 || bsy > H + 30) return false;
    for (const p of G.pelicans) {
      const c = Math.cos(p.swingA), s = Math.sin(p.swingA);
      // 鱼身两段圆：中部(半径29, r11) + 鱼头(半径38, r7)
      for (const seg2 of [[29, 11], [38, 7]]) {
        const fx = p.x + p.facing * c * seg2[0];
        const fy = p.y - 18 + s * seg2[0];
        if (Math.hypot(fx - b.x, fy - bsy) < seg2[1] + 13) return true;
      }
    }
    return false;
  }

  /* ---------- 物理步进 ---------- */
  function step(dt) {
    const b = G.bird;
    // 天花板强制下压速度：缓速×0.25 / 加速×2.2（互斥）
    const scroll = Math.min(26 + G.floor * 1.15, 132) *
      (G.slowT > 0 ? 0.25 : 1) * (G.hasteT > 0 ? 2.2 : 1);

    // 水平输入
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const onBelt = b.onGround && b.ground && b.ground.type === "belt" && !b.ground.dead;
    if (dir !== 0) {
      b.vx += dir * ACCEL * (b.onGround ? 1 : 0.82) * dt;
      b.facing = dir;
      // 在传送带上跑动时受到带的顺/逆向助推
      if (onBelt) b.vx += b.ground.dir * 320 * dt;
    } else if (b.onGround && !onBelt) {
      const f = FRICTION * dt;
      b.vx = Math.abs(b.vx) <= f ? 0 : b.vx - Math.sign(b.vx) * f;
    } else if (!b.onGround) {
      const f = FRICTION * 0.25 * dt;
      b.vx = Math.abs(b.vx) <= f ? 0 : b.vx - Math.sign(b.vx) * f;
    }
    // 传送带推力：无输入站在带上时，速度平滑趋向带的推速
    if (onBelt && dir === 0) {
      const target = b.ground.dir * BELT_TARGET;
      const dv = clamp(target - b.vx, -1100 * dt, 1100 * dt);
      b.vx += dv;
      b.facing = b.ground.dir;
    }
    b.vx = clamp(b.vx, -MAX_SPEED * 1.25, MAX_SPEED * 1.25);

    // 垂直
    b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
    const prevFeet = b.y + BIRD_RY;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 撞墙
    if (b.x < BIRD_RX + 2) { b.x = BIRD_RX + 2; b.vx *= -0.25; }
    if (b.x > W - BIRD_RX - 2) { b.x = W - BIRD_RX - 2; b.vx *= -0.25; }

    // 单向平台碰撞（下落时从上方落到板面）
    if (b.vy >= 0) {
      const feet = b.y + BIRD_RY;
      for (const p of G.platforms) {
        if (p.dead) continue;
        if (b.x + BIRD_RX - 2 > p.x && b.x - BIRD_RX + 2 < p.x + p.w &&
            prevFeet <= p.y + 4 && feet >= p.y) {
          land(p);
          break;
        }
      }
    }

    // 站台检查（走出边缘 / 板消失）
    if (b.onGround) {
      const p = b.ground;
      const still = p && !p.dead &&
        b.x + BIRD_RX - 2 > p.x && b.x - BIRD_RX + 2 < p.x + p.w;
      if (!still) { b.onGround = false; b.ground = null; }
      else {
        b.y = p.y - BIRD_RY;
        b.vy = 0;
        // 钉板持续伤害节拍
        if (p.type === "spike") {
          G.spikeTickT -= dt;
          if (G.spikeTickT <= 0 && G.invT <= 0) {
            damage(SPIKE_DMG, "spike");
            G.spikeTickT = 0.8;
          }
        }
      }
    }

    // 摄像机：强制下压 + 跟随
    G.camY += scroll * dt;
    if (b.y - 280 > G.camY) G.camY = b.y - 280;

    // 天花板尖刺
    const ceilBottom = G.camY + 34;
    if (b.y - BIRD_RY < ceilBottom) {
      b.y = ceilBottom + BIRD_RY;
      if (b.vy < 0) b.vy = 0;
      if (G.invBuffT <= 0) { // 无敌期间免疫天花板伤害
        G.hp -= CEIL_DPS * dt;
        G.hurtFlash = Math.max(G.hurtFlash, 0.35);
        if (G.hp <= 0) { die("ceiling"); return; }
      }
    }

    // 冰板碎裂计时
    for (const p of G.platforms) {
      if (p.cracking && !p.dead) {
        p.crackT -= dt;
        if (p.crackT <= 0) {
          p.dead = true;
          burst("shard", p.x + p.w / 2, p.y + PLAT_H / 2, 10, {
            speed: 190, up: 110, sMin: 2.5, sMax: 5, color: "#bfe3f0",
          });
          Sfx.shatter();
        }
      }
    }

    // 计时器
    if (G.invT > 0) G.invT -= dt;
    if (G.hurtFlash > 0) G.hurtFlash -= dt;
    if (b.squash > 0) b.squash = Math.max(0, b.squash - dt / 0.14);
    b.blinkT -= dt;
    if (b.blinkT < -0.13) b.blinkT = rand(2.2, 4);

    // 生成 / 回收
    ensureRows();
    pruneRows();

    // 鹈鹕：开局 5 秒后从顶部冲出，寿命尽了/被压死了就隔几秒再派一只；被抡着的鱼碰到即输（无敌期间免疫）
    G.roundT += dt;
    if (!G.noPelican && G.pelicans.length === 0 && G.roundT >= G.nextPelicanAt) {
      spawnPelican();
      G.nextPelicanAt = G.roundT + rand(4, 8);
    }
    for (const pl of G.pelicans) updatePelican(pl, dt);
    if (checkFishHit()) {
      if (G.invBuffT > 0) {
        if (G.fishSparkT <= 0) {
          G.fishSparkT = 0.5;
          burst("shard", G.bird.x, G.bird.y, 6, { speed: 160, up: 100, color: "#f5a623" });
          Sfx.bounce();
        }
      } else { die("fish"); return; }
    }
    G.fishSparkT = Math.max(0, G.fishSparkT - dt);

    // buff 计时 + 无敌金色火花
    if (G.invBuffT > 0) {
      G.invBuffT -= dt;
      G.sparkT -= dt;
      if (G.sparkT <= 0) {
        G.sparkT = 0.13;
        G.particles.push({
          kind: "shard", x: b.x + rand(-22, 22), y: b.y + rand(-22, 22),
          vx: rand(-20, 20), vy: -rand(30, 80),
          rot: rand(0, 6), vr: rand(-4, 4),
          size: rand(1.6, 2.8), life: 0.5, maxLife: 0.5, color: "#ffd34e",
        });
      }
    }
    if (G.slowT > 0) G.slowT -= dt;
    if (G.hasteT > 0) G.hasteT -= dt;

    // 粒子
    updateParticles(dt);

    updateHUD(false);
  }

  function land(p) {
    const b = G.bird;
    b.y = p.y - BIRD_RY;
    b.vy = 0;
    b.onGround = true;
    b.ground = p;
    b.squash = 1;

    switch (p.type) {
      case "wood":
        burst("puff", b.x, p.y, 4, { speed: 60, life: 0.4 });
        Sfx.land();
        if (G.hp < HP_MAX) G.hp = Math.min(HP_MAX, G.hp + 0.5);
        break;
      case "grass":
        burst("puff", b.x, p.y, 4, { speed: 60, life: 0.4 });
        Sfx.land();
        if (!p.healed) {
          p.healed = true;
          G.hp = Math.min(HP_MAX, G.hp + 3);
          burst("heart", b.x, b.y - 20, 4, { speed: 40, up: 90, life: 0.9 });
          Sfx.heal();
        }
        break;
      case "ice":
        Sfx.land();
        if (!p.cracking) { p.cracking = true; p.crackT = ICE_CRACK_T; Sfx.crack(); }
        break;
      case "belt":
        burst("puff", b.x, p.y, 3, { speed: 50, life: 0.35 });
        Sfx.land();
        break;
      case "spike":
        if (G.invT <= 0) {
          damage(SPIKE_DMG, "spike");
          G.spikeTickT = 0.8;
        }
        break;
    }

    // 计层：落到更深处的新行
    if (p.row > G.maxRow) {
      G.maxRow = p.row;
      G.floor = G.maxRow + 1;
      Sfx.tick();
      if (G.floor >= WIN_FLOOR) { G.floor = WIN_FLOOR; win(); }
    }
  }

  function damage(v, cause) {
    if (G.invBuffT > 0) return; // 无敌 buff：免疫一切伤害
    G.hp -= v;
    G.invT = 0.9;
    G.hurtFlash = 0.4;
    Sfx.hurt();
    burst("feather", G.bird.x, G.bird.y - 6, 5, { speed: 160, up: 80, life: 0.8 });
    if (G.hp <= 0) die(cause);
  }

  function updateParticles(dt) {
    for (const pt of G.particles) {
      pt.life -= dt;
      switch (pt.kind) {
        case "puff":
          pt.y -= 26 * dt; pt.x += pt.vx * dt * 0.3;
          break;
        case "feather":
          pt.vy += 240 * dt;
          pt.vy = Math.min(pt.vy, 70);
          pt.x += pt.vx * dt + Math.sin(pt.life * 9) * 22 * dt;
          pt.y += pt.vy * dt;
          pt.rot += pt.vr * dt * 0.4;
          break;
        case "heart":
          pt.y -= 70 * dt;
          pt.x += Math.sin(pt.life * 7) * 18 * dt;
          break;
        case "shard":
          pt.vy += 900 * dt;
          pt.x += pt.vx * dt; pt.y += pt.vy * dt;
          pt.rot += pt.vr * dt;
          break;
        case "confetti":
          pt.vy += 60 * dt;
          pt.x += pt.vx * dt + Math.sin(pt.life * 5) * 30 * dt;
          pt.y += pt.vy * dt;
          pt.rot += pt.vr * dt;
          break;
        case "fishdrop": // 脱手甩飞的大鱼
          pt.vy += 1100 * dt;
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.rot += pt.vr * dt;
          break;
      }
    }
    G.particles = G.particles.filter(p => p.life > 0);
  }

  /* ---------- HUD ---------- */
  function buildHearts() {
    elHearts.innerHTML = "";
    for (let i = 0; i < HP_MAX; i++) {
      const s = document.createElement("span");
      s.className = "heart";
      s.textContent = "♥";
      elHearts.appendChild(s);
    }
  }

  function updateHUD(force) {
    const fl = G.floor, hp = Math.max(0, Math.ceil(G.hp));
    if (force || fl !== G.shownFloor) { elFloor.textContent = String(fl); G.shownFloor = fl; }
    if (force || hp !== G.shownHp) {
      const kids = elHearts.children;
      for (let i = 0; i < kids.length; i++) {
        kids[i].classList.toggle("off", i >= hp);
      }
      G.shownHp = hp;
    }
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const t = G.animT;
    if (document.body.dataset.state !== G.state) document.body.dataset.state = G.state;
    ctx.clearRect(0, 0, W, H);
    Art.sky(ctx, W, H);
    Art.clouds(ctx, W, H, G.camY, t);
    Art.farBirds(ctx, W, G.camY, t);
    Art.hills(ctx, W, H, G.camY);

    // 平台
    for (const p of G.platforms) {
      if (p.dead) continue;
      const sy = p.y - G.camY;
      if (sy < -30 || sy > H + 30) continue;
      Art.platform(ctx, p.x, sy, p.w, p.h, p, t);
    }

    // 粒子（在鸟后面画碎片/彩带之外的心心等？统一画在鸟前面更醒目）
    const b = G.bird;
    const bsy = b.y - G.camY;
    const dead = G.state === "lose";
    const stretch = clamp(Math.abs(b.vy) / 1600, 0, 0.16);
    const sq = b.squash;

    // 天花板（先画：平台从板下滚过）
    Art.ceiling(ctx, W);

    Art.bird(ctx, {
      x: b.x, y: bsy,
      facing: b.facing,
      tilt: clamp(b.vx * 0.0006, -0.2, 0.2) * b.facing,
      sx: (1 - stretch * 0.45) * (1 + sq * 0.3),
      sy: (1 + stretch) * (1 - sq * 0.3),
      blink: b.blinkT < 0,
      dead,
      flashT: G.invT,
    }, t);

    // 无敌护盾环（旋转金色虚线圈）
    if (G.invBuffT > 0) {
      ctx.save();
      ctx.translate(b.x, bsy);
      ctx.rotate(G.animT * 2.4);
      ctx.strokeStyle = "#ffd34e";
      ctx.lineWidth = 3.5;
      ctx.setLineDash([11, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // buff 状态角标（左上角）
    let chipY = 50;
    const chip = (txt, fill) => {
      ctx.font = "900 13px 'Segoe UI', 'Microsoft YaHei', sans-serif";
      const cw = ctx.measureText(txt).width + 18;
      rr(ctx, 10, chipY, cw, 22, 9);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "#3a150a";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(txt, 19, chipY + 12);
      chipY += 28;
    };
    if (G.invBuffT > 0) chip(`无敌 ${G.invBuffT.toFixed(1)}s`, "#f5a623");
    if (G.slowT > 0) chip(`缓速 ${G.slowT.toFixed(1)}s`, "#1e7bc4");
    if (G.hasteT > 0) chip(`加速 ${G.hasteT.toFixed(1)}s`, "#d42b1e");
    ctx.textBaseline = "alphabetic";

    // 鹈鹕们 + 各自抡着的鱼（先画全部鹈鹕再画全部鱼，避免鱼被后画的车轮遮挡）
    for (const p of G.pelicans) Art.pelican(ctx, p, t);
    for (const p of G.pelicans) {
      const f = fishPose(p);
      Art.fish(ctx, f.cx, f.cy, f.ang);
    }

    // 粒子
    for (const pt of G.particles) {
      const k = pt.life / pt.maxLife;
      const sy = pt.y - G.camY;
      switch (pt.kind) {
        case "puff": Art.puff(ctx, pt.x, sy, pt.size * (1.6 - k * 0.6), k); break;
        case "shard": case "confetti": Art.shard(ctx, pt.x, sy, pt.size, pt.rot, pt.color); break;
        case "feather": Art.feather(ctx, pt.x, sy, pt.rot, 1.05); break;
        case "heart": Art.heart(ctx, pt.x, sy, 0.9, Math.min(1, k * 2)); break;
        case "fishdrop":
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 3);
          Art.fish(ctx, pt.x, sy, pt.rot);
          ctx.restore();
          break;
      }
    }

    // 受伤红闪
    if (G.hurtFlash > 0) {
      ctx.fillStyle = `rgba(212, 43, 30, ${clamp(G.hurtFlash, 0, 0.4) * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------- 主循环 ---------- */
  let last = performance.now();
  let acc = 0;
  const DT = 1 / 120;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (!G.freeze) {
      G.animT += dt;
      if (G.state === "playing") {
        acc += dt;
        while (acc >= DT) { step(DT); acc -= DT; if (G.state !== "playing") { acc = 0; break; } }
        updateAds(dt);
      } else {
        updateParticles(dt);
        if (G.bird && G.bird.squash > 0) G.bird.squash = Math.max(0, G.bird.squash - dt / 0.14);
      }
    }
    render();
  }

  /* ---------- 输入 ---------- */
  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(k)) e.preventDefault();
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = true;
    if (k === "ArrowRight" || k === "d" || k === "D") keys.right = true;
    if (k === "r" || k === "R") restart();
    if (k === "m" || k === "M") toggleMute();
    if ((k === " " || k === "Enter") && G.state === "start") startGame();
    if ((k === " " || k === "Enter") && (G.state === "win" || G.state === "lose")) restart();
    Sfx.ensure();
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
  });

  // 触屏：按住画布左右半边
  const wrap = document.getElementById("canvasWrap");
  function touchAt(clientX) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    keys.left = x < r.width / 2;
    keys.right = !keys.left;
  }
  wrap.addEventListener("pointerdown", (e) => {
    if (G.state === "start") { startGame(); return; }
    touchAt(e.clientX);
  });
  window.addEventListener("pointerup", () => { keys.left = false; keys.right = false; });
  window.addEventListener("pointercancel", () => { keys.left = false; keys.right = false; });

  document.getElementById("btnStart").addEventListener("click", startGame);
  document.getElementById("btnAgain").addEventListener("click", restart);
  document.getElementById("btnAgain2").addEventListener("click", restart);
  document.getElementById("btnReset").addEventListener("click", restart);

  const btnMute = document.getElementById("btnMute");
  function toggleMute() {
    Sfx.muted = !Sfx.muted;
    btnMute.textContent = Sfx.muted ? "🔇" : "🔊";
  }
  btnMute.addEventListener("click", toggleMute);

  /* ---------- 调试参数 ----------
   * ?floor=97             从第 97 层直接开局（快速验证胜利）
   * ?debug=stage&floor=70 渲染第 70 层的进行中画面（冻结物理，供截图）
   * ?debug=pelican        立即出生鹈鹕（pf=-1 朝左；freeze=1 冻结供截图）
   * ?debug=lose&floor=37  直接渲染失败画面
   * ?debug=win            直接渲染胜利画面
   */
  function applyDebugParams() {
    const q = new URLSearchParams(location.search);
    if (q.get("nopelican") === "1") G.noPelican = true;
    const floor = parseInt(q.get("floor") || "0", 10) || 0;
    const dbg = q.get("debug");
    if (dbg === "win") {
      reset();
      G.floor = WIN_FLOOR;
      updateHUD(true);
      G.state = "win";
      showOverlay("win");
      return;
    }
    if (dbg === "lose") {
      reset();
      if (floor > 1) fastForwardTo(Math.min(floor, 100));
      G.state = "lose";
      elLoseFloor.textContent = String(G.floor);
      showOverlay("lose");
      return;
    }
    if (dbg === "gallery") {
      // 静态展示全部平台类型（供美术评审截图）
      reset();
      const mk = (type, sx, sy, w, dir) => ({
        x: sx, y: G.camY + sy, w, h: type === "grass" ? 20 : PLAT_H, type, row: 1,
        dir: dir || 1, cracking: false, crackT: 0, healed: false,
      });
      G.platforms = [
        mk("wood", 20, 140, 120),
        mk("spike", 280, 150, 130),
        mk("ice", 60, 270, 120),
        mk("belt", 260, 290, 150, -1),
        mk("grass", 140, 430, 130),
        mk("wood", 30, 540, 100),
        mk("spike", 330, 555, 110),
      ];
      G.bird.x = 235; G.bird.y = G.camY + 350; G.bird.vy = 420; G.bird.onGround = false; G.bird.ground = null;
      G.floor = 42;
      G.state = "playing";
      G.freeze = true;
      showOverlay(null);
      updateHUD(true);
      return;
    }
    if (dbg === "ads") {
      // 确定性摆卡：左金卡 + 右蓝卡（供截图/评审），冻结物理
      reset();
      G.state = "playing";
      G.noPelican = true;
      showOverlay(null);
      ads.L.next = 999; ads.R.next = 999;
      const byId = (id) => BUFFS.find(b => b.id === id);
      spawnAd("L", byId("inv10"), 70);
      spawnAd("L", byId("haste2"), -150);
      spawnAd("R", byId("slow5"), 120);
      spawnAd("R", byId("peli2"), -60);
      G.floor = 42;
      updateHUD(true);
      G.freeze = true;
      return;
    }
    if (dbg === "pelican") {
      // 立即出生鹈鹕（n=数量，pf=-1 朝左），供测试与截图
      reset();
      G.state = "playing";
      showOverlay(null);
      const n = clamp(parseInt(q.get("n") || "1", 10) || 1, 1, MAX_PELICANS);
      for (let k = 0; k < n; k++) spawnPelican(W / 2 + (k - (n - 1) / 2) * 95 + rand(-15, 15));
      for (const p of G.pelicans) {
        p.state = "patrol";
        p.wy = G.camY + PATROL_Y;
        p.y = PATROL_Y;
        if (q.get("pf") === "-1") { p.facing = -1; p.vx = -Math.abs(p.vx); }
        else { p.facing = 1; p.vx = Math.abs(p.vx); }
      }
      if (q.get("crash") === "1") {
        // 立即散架（截图用）：寿命只剩 0.05 秒
        for (const p of G.pelicans) p.age = p.life - 0.05;
      }
      if (q.get("freeze") === "1") G.freeze = true;
      return;
    }
    if (dbg === "stage") {
      reset();
      if (floor > 1) fastForwardTo(Math.min(floor, 99));
      G.state = "playing";
      G.freeze = true; // 冻结物理供截图
      showOverlay(null);
      return;
    }
    if (floor > 1) {
      reset();
      fastForwardTo(Math.min(floor, 99));
      G.state = "playing";
      showOverlay(null);
      return;
    }
    reset();
    G.state = "start";
    showOverlay("start");
  }

  /* ---------- 面板内的大号胖红（开始/胜利/失败姿势） ---------- */
  function drawPanelBirds() {
    const draw = (id, opts) => {
      const c = document.getElementById(id);
      if (!c) return;
      const cx = c.getContext("2d");
      cx.clearRect(0, 0, c.width, c.height);
      cx.save();
      cx.translate(c.width / 2, c.height / 2 + 6);
      cx.scale(2.3, 2.3);
      Art.bird(cx, Object.assign(
        { x: 0, y: 0, facing: 1, tilt: 0, sx: 1, sy: 1, blink: false, dead: false, flashT: 0 },
        opts
      ), 0);
      cx.restore();
    };
    draw("birdStart", { tilt: -0.05 });
    draw("birdWin", { tilt: -0.08, sy: 1.04, sx: 0.96 });
    draw("birdLose", { dead: true, tilt: 0.32, facing: -1, sy: 0.96, sx: 1.04 });
  }

  /* ---------- 启动 ---------- */
  buildHearts();
  drawPanelBirds();
  applyDebugParams();
  requestAnimationFrame(frame);

  // 调试钩子
  window.__game = G;
  window.__restart = restart;
  window.__ads = ads;
  window.__claim = claimAd;
  window.__BUFFS = BUFFS;
})();
