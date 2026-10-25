// Glub Glub Diver — 올라오는 발판을 밟으며 바다 아래로 내려가는 게임
// 생명은 산소 하나뿐: 시간이 지나거나 장애물(성게·해파리)에 부딪히면 산소가 줄고, 0이 되면 게임오버
(() => {
  'use strict';

  // ---------- 화면 ----------
  const W = 540, H = 960, RES = 2;
  const HUD_H = 100, CEIL_Y = 172, X_MIN = 46, X_MAX = 494;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W * RES;
  canvas.height = H * RES;

  // 휴대폰을 가로로 눕히면 index.html 의 "세로로 돌려주세요" 안내가 뜨고 게임은 일시정지 (같은 조건)
  const LANDSCAPE = matchMedia('(orientation: landscape) and (pointer: coarse) and (max-height: 600px)');
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  }
  addEventListener('resize', fit);
  addEventListener('resize', () => { if (LANDSCAPE.matches && state === 'play') state = 'pause'; });
  fit();

  // ---------- 리소스 ----------
  // 목록은 manifest.js. 이미지는 assets_data.js 에 게임 크기(RES배)로 내장되어 있고,
  // 없으면 ../assets/ 원본을 읽음 (Safari는 파일로 열 때 원본 읽기를 막을 수 있음)
  const EMBED = window.GGD_ASSETS || {};
  const manifest = [];
  for (const g of window.GGD_MANIFEST || []) {
    for (const n of g.names) {
      manifest.push(EMBED[n]
        ? [n, EMBED[n], 1 / (window.GGD_RES || RES)]
        : [n, `../assets/${g.dir}/${n}.png`, g.scale, g.optional]);
    }
  }

  const SPR = {};
  let loadPct = 0;

  // 큰 원본을 한 번만 줄여서 캔버스로 보관 (매 프레임 축소하면 느림)
  function prep(img, scale) {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement('canvas');
    c.width = w * RES;
    c.height = h * RES;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return { c, w, h };
  }

  function load() {
    let done = 0;
    return Promise.all(manifest.map(([n, src, s, optional]) => new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try { SPR[n] = prep(img, s); } catch (e) { console.warn('이미지 처리 실패:', n, e); }
        loadPct = ++done / manifest.length;
        res();
      };
      img.onerror = () => { if (!optional) console.warn('이미지 없음:', src); loadPct = ++done / manifest.length; res(); };
      img.src = src;
    })));
  }

  // 멀리 있는 배경 생물용: 물 색으로 덮어서 흐릿하고 푸르게 만든 사본 (far_이름)
  function makeFar(n, tint = 'rgba(30, 90, 115, 0.62)') {
    const s = SPR[n];
    if (!s) return;
    const c = document.createElement('canvas');
    c.width = s.c.width;
    c.height = s.c.height;
    const g = c.getContext('2d');
    g.drawImage(s.c, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    SPR['far_' + n] = { c, w: s.w, h: s.h };
  }

  // x, y 기준점에 스프라이트 그리기 (ax, ay = 기준점 비율, 기본 중앙)
  // sx, sy = 가로/세로 늘이기 (기준점 기준), glow = 테두리 빛 색
  function spr(n, x, y, o = {}) {
    const s = SPR[n];
    if (!s) return;
    const k = o.k || 1, w = s.w * k, h = s.h * k;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.flip) ctx.scale(-1, 1);
    if (o.sx != null || o.sy != null) ctx.scale(o.sx ?? 1, o.sy ?? 1);
    if (o.alpha != null) ctx.globalAlpha = Math.max(0, o.alpha);
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur ?? 14; }
    ctx.drawImage(s.c, -w * (o.ax ?? 0.5), -h * (o.ay ?? 0.5), w, h);
    ctx.restore();
  }

  const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  function text(s, x, y, size, color = '#3b2414', stroke = null, align = 'center') {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineWidth = size / 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  // 숫자 스프라이트로 숫자 그리기 (가운데 정렬)
  function number(value, cx, cy, k = 1, suffix = '') {
    const digits = String(value).split('');
    const gap = 1;
    const widths = digits.map(c => (SPR['num_' + c]?.w || 20) * k);
    const sw = suffix ? 22 * k : 0;
    let x = cx - (widths.reduce((a, b) => a + b + gap, 0) + sw) / 2;
    digits.forEach((c, i) => { spr('num_' + c, x + widths[i] / 2, cy, { k }); x += widths[i] + gap; });
    if (suffix) text(suffix, x + sw / 2, cy + 4 * k, 26 * k, '#f3e6c4', '#3b2414');
  }

  // ---------- 효과음 (Web Audio로 합성, 파일 불필요) ----------
  let actx = null, muted = false;
  function audioInit() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS는 다른 앱에 다녀오면 'interrupted' 상태가 되기도 함
      if (actx.state !== 'running') actx.resume();
    } catch (e) { /* 소리 없이 진행 */ }
  }
  function tone(f1, f2, dur, type = 'sine', vol = 0.15, delay = 0) {
    if (!actx || muted) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t0);
    o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }
  const SFX = {
    land: () => tone(220, 140, 0.08, 'triangle', 0.12),
    spring: () => tone(180, 820, 0.28, 'square', 0.07),
    pearl: () => { tone(880, 1320, 0.1, 'sine', 0.14); tone(1320, 1760, 0.12, 'sine', 0.1, 0.07); },
    bubble: () => tone(500, 1300, 0.12, 'sine', 0.12),
    tank: () => tone(300, 900, 0.3, 'sine', 0.15),
    chest: () => { tone(660, 990, 0.12, 'square', 0.07); tone(990, 1480, 0.2, 'square', 0.07, 0.12); },
    hurt: () => tone(320, 70, 0.4, 'sawtooth', 0.12),
    crumble: () => tone(130, 50, 0.25, 'triangle', 0.16),
    alarm: () => tone(880, 860, 0.12, 'square', 0.05),
    over: () => { tone(440, 330, 0.3, 'triangle', 0.16); tone(330, 110, 0.8, 'triangle', 0.16, 0.3); },
    click: () => tone(600, 700, 0.06, 'triangle', 0.1),
  };

  // ---------- 배경음악 (music_data.js 에 내장, 없으면 무음) ----------
  // 게임 중엔 크게, 일시정지 중엔 작게, 그 밖에는 꺼짐. 새 판을 시작하면 처음부터
  const BGM = 'bgm_fight', BGM_VOL = { play: 0.32, pause: 0.08 };
  let bgmBuf = null, bgmSrc = null, bgmGain = null, bgmLoading = false, bgmVol = 0;
  function bgmLoad() {
    const url = window.GGD_MUSIC?.[BGM];
    if (!actx || !url || bgmBuf || bgmLoading) return;
    bgmLoading = true;
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    actx.decodeAudioData(bytes.buffer).then(b => { bgmBuf = b; }, e => console.warn('배경음악 읽기 실패:', e));
  }
  function bgmRestart() {
    if (bgmSrc) { bgmSrc.stop(); bgmSrc = null; }
  }
  function bgmUpdate() {
    if (!actx) return;
    bgmLoad();
    if (!bgmBuf) return;
    if (!bgmGain) { bgmGain = actx.createGain(); bgmGain.gain.value = 0; bgmGain.connect(actx.destination); }
    const vol = muted ? 0 : BGM_VOL[state] || 0;
    if (!bgmSrc && vol > 0) {
      bgmSrc = actx.createBufferSource();
      bgmSrc.buffer = bgmBuf;
      bgmSrc.loop = true;
      bgmSrc.connect(bgmGain);
      bgmSrc.start();
    }
    if (vol !== bgmVol) { bgmVol = vol; bgmGain.gain.setTargetAtTime(vol, actx.currentTime, 0.15); }   // 부드럽게 커지고 작아짐
  }

  // ---------- 유틸 ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

  let best = 0, bestDepth = 0;   // 최고 점수, 최고 깊이(m)
  try {
    best = +localStorage.getItem('ggd_best') || 0;
    bestDepth = +localStorage.getItem('ggd_best_depth') || 0;
  } catch (e) { /* 저장 불가 환경 */ }
  function saveBest(v, depth) {
    best = Math.max(best, v);
    bestDepth = Math.max(bestDepth, Math.floor(depth));
    try { localStorage.setItem('ggd_best', best); localStorage.setItem('ggd_best_depth', bestDepth); } catch (e) { /* 무시 */ }
  }

  // ---------- 입력 ----------
  const keys = {};
  // 누르고 있는 손가락들 (pointerId → 게임 좌표). Map은 넣은 순서를 지켜서 마지막 항목 = 가장 나중에 누른 손가락
  const touches = new Map();
  const lastTouch = () => { let p = null; for (const v of touches.values()) p = v; return p; };
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  addEventListener('keydown', e => {
    if (!keys[e.code]) onKey(e.code);
    keys[e.code] = true;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    audioInit();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });

  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  }
  // 화면 전체에서 터치를 받음 (휴대폰이 게임보다 길면 생기는 위아래 여백을 눌러도 움직임)
  addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    audioInit();
    const p = toGame(e);
    if (clickButtons(p)) return;
    touches.delete(e.pointerId);
    touches.set(e.pointerId, p);
  });
  addEventListener('pointermove', e => { if (touches.has(e.pointerId)) touches.set(e.pointerId, toGame(e)); });
  // iOS Safari는 손가락을 뗄 때 소리를 켜는 게 더 확실함
  addEventListener('pointerup', e => { touches.delete(e.pointerId); audioInit(); });
  addEventListener('pointercancel', e => { touches.delete(e.pointerId); });
  // 길게 누르기 메뉴, iOS 핀치 확대 막기
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());

  function inputX() {
    let d = 0;
    if (keys.ArrowLeft || keys.KeyA) d -= 1;
    if (keys.ArrowRight || keys.KeyD) d += 1;
    const p = lastTouch();
    if (p && state === 'play') d += p.x < W / 2 ? -1 : 1;
    return clamp(d, -1, 1);
  }

  function onKey(code) {
    if (code === 'KeyM') muted = !muted;
    const go = code === 'Space' || code === 'Enter';
    if (state === 'title' && go) startGame();
    else if (state === 'play' && (code === 'KeyP' || code === 'Escape')) state = 'pause';
    else if (state === 'pause' && (code === 'KeyP' || code === 'Escape' || go)) state = 'play';
    else if (state === 'over' && go) startGame();
  }

  document.addEventListener('visibilitychange', () => {
    touches.clear();
    if (document.hidden && state === 'play') state = 'pause';
  });

  // ---------- 버튼 ----------
  function buttons() {
    switch (state) {
      case 'title': return [{ n: 'btn_play', x: W / 2, y: 720, k: 1.1, act: startGame }];
      case 'play': return [{ n: 'btn_pause', x: W - 40, y: H - 40, k: 0.6, act: () => { state = 'pause'; } }];
      case 'pause': return [
        { n: 'btn_play', x: W / 2 - 75, y: 520, k: 1, act: () => { state = 'play'; } },
        { n: 'btn_home', x: W / 2 + 75, y: 520, k: 1, act: () => { state = 'title'; } },
      ];
      case 'over': return [
        { n: 'btn_retry', x: W / 2 - 70, y: 640, k: 0.9, act: startGame },
        { n: 'btn_home', x: W / 2 + 70, y: 640, k: 0.9, act: () => { state = 'title'; } },
      ];
      default: return [];
    }
  }
  function clickButtons(p) {
    for (const b of buttons()) {
      const r = (SPR[b.n]?.w || 96) * b.k / 2;
      if (dist2(p.x, p.y, b.x, b.y) < r * r) { SFX.click(); b.act(); return true; }
    }
    return false;
  }
  function drawButtons() {
    for (const b of buttons()) {
      const p = lastTouch();
      const press = p && dist2(p.x, p.y, b.x, b.y) < 2500 ? 0.94 : 1;
      spr(b.n, b.x, b.y, { k: b.k * press });
    }
  }

  // ---------- 발판 ----------
  // w: 밟을 수 있는 폭, off: 이미지 윗변에서 밟는 면까지 거리
  const PT = {
    plank_wood: { w: 120, off: 2 },
    plank_moss: { w: 112, off: 10 },
    plank_current: { w: 122, off: 3 },
    plank_crumble: { w: 112, off: 10 },
    plank_urchin: { w: 120, off: 18 },
    turtle_carrier: { w: 118, off: 4 },
    jelly_spring: { w: 56, off: 8 },
  };

  function pickType() {
    const d = G.depth;
    const table = [
      ['plank_wood', 40],
      ['plank_moss', 14],
      ['plank_current', d > 15 ? 12 : 0],
      ['jelly_spring', d > 10 ? 8 : 0],
      ['turtle_carrier', d > 25 ? 10 : 0],
      ['plank_crumble', d > 35 ? 14 : 0],
      ['plank_urchin', d > 45 && G.lastType !== 'plank_urchin' ? Math.min(16, 4 + d / 20) : 0],
    ];
    let r = Math.random() * table.reduce((a, [, w]) => a + w, 0);
    for (const [n, w] of table) if ((r -= w) < 0) return n;
    return 'plank_wood';
  }

  function spawnPlatform(y, type) {
    type = type || pickType();
    G.lastType = type;
    const def = PT[type];
    const p = {
      type, y, w: def.w, off: def.off,
      lo: X_MIN + def.w / 2, hi: X_MAX - def.w / 2,   // 발판 가운데가 갈 수 있는 범위
      dir: Math.random() < 0.5 ? -1 : 1,
      vx: 0, vy: 0, alpha: 1, crumbleT: -1, broken: false, pressT: 0,
    };
    avoidSigns(p);
    p.x = rand(p.lo, p.hi);
    if (type === 'turtle_carrier') p.vx = p.dir * rand(40, 80);
    G.platforms.push(p);
    if (type !== 'plank_urchin' && type !== 'jelly_spring') {
      const r = Math.random();
      if (r < 0.32) G.items.push({ n: pickTreasure(), p, dx: rand(-p.w / 3, p.w / 3) });
      else if (r < 0.39) G.items.push({ n: 'oxygen_tank', p, dx: rand(-p.w / 4, p.w / 4) });
      else if (r < 0.42 && G.depth > 20) G.items.push({ n: 'chest_closed', p, dx: 0 });
    }
    return p;
  }

  // 점수 아이템: 진주가 가장 흔하고 낮은 점수, 깊이 내려갈수록 귀한 아이템이 섞여 나옴
  // v = 점수, w = 나오는 비율, d = 등장 깊이(m), col = 빛·점수 글자 색
  const TREASURE = {
    pearl: { v: 10, w: 60, d: 0, col: '#fff1c2' },
    starfish_gold: { v: 20, w: 22, d: 30, col: '#ffd34d' },
    conch_shell: { v: 40, w: 12, d: 80, col: '#ffb8cf' },
    sapphire: { v: 80, w: 6, d: 150, col: '#7fb6ff' },
    diamond: { v: 150, w: 3, d: 250, col: '#dff8ff' },
  };
  function pickTreasure() {
    const ok = Object.entries(TREASURE).filter(([n, o]) => G.depth >= o.d && (n === 'pearl' || SPR[n]));
    let r = Math.random() * ok.reduce((a, [, o]) => a + o.w, 0);
    for (const [n, o] of ok) if ((r -= o.w) < 0) return n;
    return 'pearl';
  }

  // 표지판 자리 비우기: 표지판과 같은 높이의 발판은 표지판 반대쪽에만 놓임
  // (표지판이 차지하는 가로 구간 = 벽 ~ 배너 끝, 세로 구간 = 표지판 위아래 + 발판·여유 높이)
  function signZone(sg) {
    const s = SPR.sign_depth, w = s ? s.w : 190, h = s ? s.h : 74;
    const wall = sg.left ? X_MIN - 6 : X_MAX + 6, reach = w * (1 - SIGN_ANCHOR.ax) + 8;
    return {
      top: sg.y - h * SIGN_ANCHOR.ay - 30, bottom: sg.y + h * (1 - SIGN_ANCHOR.ay) + 30,
      left: sg.left ? -Infinity : wall - reach, right: sg.left ? wall + reach : Infinity,
    };
  }
  function avoidSigns(p) {
    for (const sg of G.signs) {
      const z = signZone(sg);
      if (p.y < z.top || p.y - p.off > z.bottom) continue;
      if (sg.left) p.lo = Math.max(p.lo, z.right + p.w / 2);
      else p.hi = Math.min(p.hi, z.left - p.w / 2);
    }
    if (p.lo > p.hi) p.lo = p.hi;
  }

  // ---------- 게임 상태 ----------
  let state = 'load', t = 0, shake = 0;
  let G = null;
  const CEIL = ['urchin_purple_grin', 'urchin_orange_wink', 'urchin_red_angry',
    'urchin_purple_tongue', 'urchin_orange_smirk', 'urchin_red_furious'];
  const JELLY = ['jellyfish_purple', 'jellyfish_orange', 'jellyfish_yellow', 'jellyfish_red'];
  const FISH = ['fish_blue', 'fish_orange', 'fish_green'];
  const FAR = [...FISH, ...JELLY];   // 멀리 있는 배경용 사본을 만들 이미지
  // 부딪혔을 때 잃는 산소량
  const HIT = { ceil: 20, fall: 25, urchin: 15, jelly: 15 };
  const SIGN_EVERY = 100, SIGN_AT_Y = 520;   // 깊이 표지판 간격(m), 표지판이 그 깊이를 가리킬 때의 화면 높이
  const puffs = [];   // 장식용 작은 공기방울
  const fish = [];    // 멀리 있는 배경 생물 (물고기·해파리, 닿아도 괜찮음)
  let fishT = 0;

  function startGame() {
    bgmRestart();
    G = {
      scroll: 0, speed: 80, depth: 0, bonus: 0, oxygen: 100, hitT: 0, lastHit: false,
      platforms: [], items: [], bubbles: [], jellies: [], fx: [], pops: [], sparks: [], rings: [], signs: [],
      nextY: 0, bubbleT: 1, jellyT: 5, alarmT: 0, deadT: 0, lastType: '', gainT: 0, nextSign: SIGN_EVERY,
      bestDepth,   // 이번 판 시작할 때의 최고 깊이 (판 도중에 갱신돼도 선 위치는 그대로)
      d: { x: W / 2, y: 0, vx: 0, vy: 0, on: null, inv: 0, landT: 0, springT: 0, hurtT: 0, face: 1, turnT: 0, walk: 0 },
    };
    let y = 300;
    while (y < H + 60) { spawnPlatform(y, 'plank_wood'); y += rand(115, 150); }
    G.nextY = y;
    // 화면 가운데쯤 발판에서 시작
    const p0 = G.platforms.reduce((a, b) => (Math.abs(b.y - 540) < Math.abs(a.y - 540) ? b : a));
    p0.x = W / 2;
    G.items = G.items.filter(i => i.p !== p0);
    Object.assign(G.d, { x: p0.x, y: p0.y, on: p0 });
    state = 'play';
  }

  function addFx(n, x, y, life = 0.5, k0 = 0.6, k1 = 1.2) {
    G.fx.push({ n, x, y, t: 0, life, k0, k1 });
  }

  // 퍼지는 고리 + 사방으로 튀었다가 떠오르는 작은 방울 (산소 얻음 / 산소 샘 표현)
  function burst(x, y, col, n, up = 0) {
    G.rings.push({ x, y, col, t: 0 });
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(60, 160);
      G.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, r: rand(2, 5), col, t: 0, life: rand(0.5, 0.8) });
    }
  }

  // 부딪히면 산소가 줄어듦 (산소 0 판정은 update 에서)
  function hurt(amount, force = false) {
    const d = G.d;
    if (d.inv > 0 && !force) return false;
    G.oxygen -= amount;
    G.hitT = 0.5;
    G.lastHit = G.oxygen <= 0;   // 게임오버 문구용: 마지막 산소를 부딪혀서 잃었는지
    d.inv = 1.5;
    d.hurtT = 0.6;
    shake = 0.3;
    SFX.hurt();
    burst(d.x, d.y - 60, 'rgba(255, 90, 70, 0.95)', 0);
    burst(d.x + d.face * 8, d.y - 92, 'rgba(235, 250, 255, 0.95)', 12, 120);   // 헬멧에서 산소가 새어 나감
    return true;
  }

  function respawn() {
    const d = G.d;
    const ok = G.platforms.filter(p => !p.broken && p.y > H * 0.55 && p.y < H * 0.85 &&
      p.type !== 'plank_urchin' && p.type !== 'jelly_spring' && p.type !== 'plank_crumble');
    const p = ok.length ? ok[0] : spawnPlatform(H * 0.55, 'plank_wood');
    Object.assign(d, { x: p.x, y: p.y, vx: 0, vy: 0, on: p });
  }

  function die() {
    if (state !== 'play') return;
    state = 'dying';
    G.deadT = 0;
    G.d.on = null;
    SFX.over();
    saveBest(score(), G.depth);
  }

  const score = () => G.bonus + Math.floor(G.depth);

  function land(p) {
    const d = G.d;
    d.y = p.y;
    if (p.type === 'jelly_spring') {
      d.vy = -600; d.springT = 0.6; p.pressT = 0.25; d.on = null;
      SFX.spring();
      return;
    }
    if (p.type === 'plank_urchin') {
      d.vy = -380; d.on = null;
      hurt(HIT.urchin);
      return;
    }
    d.on = p; d.vy = 0; d.landT = 0.15;
    SFX.land();
    if (p.type === 'plank_crumble' && p.crumbleT < 0) p.crumbleT = 0;
  }

  // 진주는 발판 위 조개 안에 놓여 있어서 떠다니는 산소방울과 구분됨
  const itemSpr = i => (i.n === 'pearl' && SPR.clam_open ? 'clam_open' : i.n);
  function scorePop(x, y, v, col) {
    G.bonus += v;
    G.pops.push({ s: `+${v}`, x, y, t: 0, col, size: v >= 100 ? 30 : v >= 40 ? 26 : 22 });
  }
  function itemPos(i) {
    const s = SPR[itemSpr(i)];
    return { x: i.p.x + i.dx, y: i.p.y - (s ? s.h / 2 : 15) };
  }

  // ---------- 업데이트 ----------
  function update(dt) {
    const d = G.d;
    d.inv = Math.max(0, d.inv - dt);
    d.hurtT = Math.max(0, d.hurtT - dt);
    d.landT = Math.max(0, d.landT - dt);
    d.springT = Math.max(0, d.springT - dt);
    d.turnT = Math.max(0, d.turnT - dt);
    G.hitT = Math.max(0, G.hitT - dt);
    updateFx(dt);

    if (state === 'dying') {
      G.deadT += dt;
      d.y -= 40 * dt;
      if (G.deadT > 1.6) state = 'over';
      return;
    }

    // 깊이에 따라 속도 증가
    G.depth = G.scroll / 40;
    G.speed = 80 + Math.min(G.depth * 0.9, 170);
    const dy = G.speed * dt;
    G.scroll += dy;

    // 발판 이동
    for (const p of G.platforms) {
      p.y -= dy;
      if (p.type === 'turtle_carrier') {
        p.x += p.vx * dt;
        const lo = p.lo + 10, hi = p.hi - 10;   // 표지판 자리에는 들어가지 않음
        if (p.x < lo || p.x > hi) { p.vx *= -1; p.x = clamp(p.x, lo, hi); }
      }
      if (p.crumbleT >= 0 && !p.broken) {
        p.crumbleT += dt;
        if (p.crumbleT > 0.45) {
          p.broken = true;
          if (d.on === p) d.on = null;
          SFX.crumble();
          addFx('fx_dust', p.x, p.y + 10, 0.6);
        }
      }
      if (p.broken) { p.vy += 900 * dt; p.y += p.vy * dt; p.alpha -= dt * 1.6; }
      p.pressT = Math.max(0, p.pressT - dt);
    }
    G.platforms = G.platforms.filter(p => p.y > HUD_H + 20 && p.alpha > 0 && p.y < H + 400);
    G.items = G.items.filter(i => !i.p.broken && G.platforms.includes(i.p));
    G.nextY -= dy;
    for (const sg of G.signs) sg.y -= dy;   // 새 표지판을 띄우기 전에 움직여야 발판과 위치가 어긋나지 않음
    // 100m 마다 벽에 표지판: 화면 아래에서 올라와 다이버 높이쯤 왔을 때 그 깊이가 되도록 미리 띄움
    if (G.scroll >= G.nextSign * 40 - (H + 80 - SIGN_AT_Y)) {
      G.signs.push({ m: G.nextSign, y: H + 80, left: (G.nextSign / SIGN_EVERY) % 2 === 1 });
      G.nextSign += SIGN_EVERY;
      // 이미 생겨서 아직 화면 아래에 있는 발판도 표지판 자리에서 비켜줌 (화면 밖이라 옮기는 게 안 보임)
      for (const p of G.platforms) {
        if (p.y - p.off < H) continue;
        p.lo = X_MIN + p.w / 2; p.hi = X_MAX - p.w / 2;
        avoidSigns(p);
        p.x = clamp(p.x, p.lo, p.hi);
      }
    }
    G.signs = G.signs.filter(sg => sg.y > HUD_H - 60);
    while (G.nextY < H + 60) {
      spawnPlatform(G.nextY);
      G.nextY += rand(110, 150) + Math.min(G.depth * 0.08, 30);
    }

    // 다이버 이동
    const ix = inputX();
    d.vx += (ix * 300 - d.vx) * Math.min(1, dt * 10);
    if (ix && ix !== d.face) { d.face = ix; d.turnT = 0.12; }
    d.ix = ix;
    // 걸음 진행 (최고 속도에서 초당 약 3.6걸음). 멈추면 처음 걸음으로 되돌림
    if (d.on && ix) d.walk += Math.abs(d.vx) * dt * 0.012;
    else if (!ix) d.walk = 0;
    d.x += d.vx * dt;
    if (d.on) {
      const p = d.on;
      d.y = p.y;
      if (p.type === 'turtle_carrier') d.x += p.vx * dt;
      if (p.type === 'plank_current') d.x += p.dir * 110 * dt;
      if (Math.abs(d.x - p.x) > p.w / 2 + 14) { d.on = null; d.vy = 0; }
    } else {
      const prevY = d.y;
      d.vy = Math.min(d.vy + 800 * dt, 380);
      d.y += d.vy * dt;
      if (d.vy > 0) {
        for (const p of G.platforms) {
          if (p.broken) continue;
          if (prevY <= p.y + dy + 2 && d.y >= p.y && Math.abs(d.x - p.x) <= p.w / 2 + 12) { land(p); break; }
        }
      }
    }
    d.x = clamp(d.x, X_MIN + 16, X_MAX - 16);

    // 천장(성게)과 바닥
    if (d.y - 78 < CEIL_Y) {
      if (hurt(HIT.ceil)) respawn();
      else { d.on = null; d.y = CEIL_Y + 80; d.vy = 120; }
    }
    if (d.y - 80 > H) {
      hurt(HIT.fall, true);
      respawn();
    }

    // 산소
    G.oxygen -= (3.2 + G.depth * 0.004) * dt;
    if (G.oxygen < 25) {
      G.alarmT -= dt;
      if (G.alarmT <= 0) { SFX.alarm(); G.alarmT = 0.8; }
    }
    if (G.oxygen <= 0) { G.oxygen = 0; die(); return; }

    // 아이템 줍기
    const cx = d.x, cy = d.y - 40;
    G.items = G.items.filter(i => {
      const q = itemPos(i);
      if (dist2(q.x, q.y, cx, cy) > 46 * 46) return true;
      const tr = TREASURE[i.n];
      if (tr) {
        scorePop(q.x, q.y - 30, tr.v, tr.col);
        SFX.pearl();
        if (i.n === 'pearl' && SPR.clam_closed) addFx('clam_closed', q.x, i.p.y - SPR.clam_closed.h / 2, 0.5, 1, 1);
        addFx('fx_sparkle', q.x, q.y - 10, 0.4, 0.4, tr.v >= 80 ? 1.2 : 0.8);
      }
      if (i.n === 'oxygen_tank') {
        G.oxygen = Math.min(100, G.oxygen + 35); G.gainT = 0.5; SFX.tank();
        addFx('fx_splash', q.x, q.y, 0.4, 0.4, 0.9); burst(q.x, q.y, 'rgba(130, 230, 255, 0.95)', 14, 60);
      }
      if (i.n === 'chest_closed') {
        scorePop(q.x, q.y - 40, 100, '#ffd66b');
        G.oxygen = Math.min(100, G.oxygen + 15); SFX.chest();
        addFx('chest_open', q.x, q.y - 6, 0.8, 1, 1.1);
        addFx('fx_sparkle', q.x, q.y - 20, 0.6, 0.5, 1.1);
      }
      return false;
    });

    // 산소 방울 (발판보다 빨리 올라옴)
    G.bubbleT -= dt;
    if (G.bubbleT <= 0) {
      G.bubbleT = rand(0.9, 1.8);
      G.bubbles.push({ x: rand(X_MIN + 30, X_MAX - 30), y: H + 30, n: Math.random() < 0.3 ? 'bubble_large' : 'bubble_medium', ph: rand(0, 6) });
    }
    G.bubbles = G.bubbles.filter(b => {
      b.y -= (G.speed + 45) * dt;
      b.x += Math.sin(t * 2 + b.ph) * 25 * dt;
      if (dist2(b.x, b.y, cx, cy) < 42 * 42) {
        const add = b.n === 'bubble_large' ? 14 : 8;
        G.oxygen = Math.min(100, G.oxygen + add);
        G.gainT = 0.4;
        burst(b.x, b.y, 'rgba(130, 230, 255, 0.95)', b.n === 'bubble_large' ? 12 : 8, 60);
        SFX.bubble();
        addFx('fx_splash', b.x, b.y, 0.3, 0.3, 0.6);
        return false;
      }
      return b.y > CEIL_Y - 20;
    });

    // 떠다니는 해파리 (닿으면 피해)
    if (G.depth > 25) {
      G.jellyT -= dt;
      if (G.jellyT <= 0) {
        G.jellyT = rand(3.5, 7) - Math.min(G.depth / 100, 2);
        const x = rand(X_MIN + 40, X_MAX - 40);
        G.jellies.push({ x, bx: x, y: H + 80, n: pick(JELLY), ph: rand(0, 6) });
      }
    }
    G.jellies = G.jellies.filter(j => {
      j.y -= (G.speed + 20) * dt;
      j.x = j.bx + Math.sin(t * 1.4 + j.ph) * 45;
      if (dist2(j.x, j.y - 20, cx, cy) < 40 * 40) hurt(HIT.jelly);
      return j.y > CEIL_Y - 60;
    });
  }

  function updateFx(dt) {
    if (!G) return;
    G.fx = G.fx.filter(f => (f.t += dt) < f.life);
    G.pops = G.pops.filter(p => (p.t += dt) < 0.9);
    G.rings = G.rings.filter(r => (r.t += dt) < 0.4);
    G.sparks = G.sparks.filter(p => {
      p.vx *= 1 - dt * 4; p.vy = p.vy * (1 - dt * 4) - 90 * dt;   // 물속이라 금방 느려지고 위로 떠오름
      p.x += p.vx * dt; p.y += p.vy * dt;
      return (p.t += dt) < p.life;
    });
    G.gainT = Math.max(0, G.gainT - dt);
  }

  // 모든 화면에서 돌아가는 장식 (공기방울, 물고기)
  function updateAmbient(dt) {
    const speed = state === 'play' ? G.speed : 40;
    if (Math.random() < dt * 4) puffs.push({ x: rand(X_MIN, X_MAX), y: H + 10, r: rand(1.5, 4), v: rand(30, 70) });
    if (state === 'play' && Math.random() < dt * 5) {
      const d = G.d;
      puffs.push({ x: d.x + d.face * 10 + rand(-3, 3), y: d.y - 84, r: rand(2, 4.5), v: rand(60, 90) });
    }
    for (const p of puffs) { p.y -= (p.v + speed * 0.3) * dt; p.x += Math.sin(t * 3 + p.y * 0.05) * 10 * dt; }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].y < CEIL_Y - 30) puffs.splice(i, 1);

    // z = 거리감 (작을수록 멀리: 작고, 느리고, 흐릿함)
    fishT -= dt;
    if (fishT <= 0) {
      fishT = rand(1.5, 3.5);
      const z = rand(0.35, 0.6);
      if (Math.random() < 0.7) {
        const left = Math.random() < 0.5;
        fish.push({ x: left ? -30 : W + 30, y: rand(220, H - 100), vx: (left ? 1 : -1) * rand(30, 60) * z, vy: 0, n: pick(FISH), ph: rand(0, 6), z });
      } else {
        fish.push({ x: rand(40, W - 40), y: H + 40, vx: 0, vy: -rand(12, 25), n: pick(JELLY), ph: rand(0, 6), z, jelly: true });
      }
      fish.sort((a, b) => a.z - b.z);
    }
    for (const f of fish) { f.x += f.vx * dt; f.y += (f.vy - speed * 0.25 * f.z) * dt; }
    for (let i = fish.length - 1; i >= 0; i--) if (fish[i].x < -60 || fish[i].x > W + 60 || fish[i].y < CEIL_Y - 40) fish.splice(i, 1);
  }

  // ---------- 그리기 ----------
  function drawBg() {
    ctx.fillStyle = '#123446';
    ctx.fillRect(0, 0, W, H);
    if (SPR.bg_main) ctx.drawImage(SPR.bg_main.c, 0, 0, W, H);
    // 깊이 들어갈수록 어두워짐
    const dark = G && state !== 'title' ? Math.min(0.55, G.depth / 700) : 0;
    if (dark > 0) { ctx.fillStyle = `rgba(4, 14, 34, ${dark})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawAmbient() {
    for (const f of fish) {
      const n = SPR['far_' + f.n] ? 'far_' + f.n : f.n;
      if (f.jelly) spr(n, f.x + Math.sin(t * 0.8 + f.ph) * 12, f.y, { k: f.z * 0.8, sy: 1 + Math.sin(t * 2.5 + f.ph) * 0.05, alpha: 0.4 + f.z * 0.5 });
      else spr(n, f.x, f.y + Math.sin(t * 2 + f.ph) * 3, { k: f.z, flip: f.vx < 0, alpha: 0.4 + f.z * 0.5 });
    }
    ctx.strokeStyle = 'rgba(235, 250, 255, 0.75)';
    ctx.lineWidth = 1.5;
    for (const p of puffs) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
  }

  function drawCeiling() {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x = 22 + i * (W - 44) / (n - 1);
      const y = HUD_H + 32 + (i % 2) * 10 + Math.sin(t * 3 + i) * 3;
      spr(CEIL[i % CEIL.length], x, y, { rot: Math.sin(t * 2 + i) * 0.08 });
    }
  }

  function drawPlatform(p) {
    const top = p.y - p.off;
    const a = p.alpha;
    switch (p.type) {
      case 'plank_current':
        spr(p.type, p.x, top, { ay: 0, flip: p.dir < 0, alpha: a });
        spr('fx_current', p.x + p.dir * (((t * 40) % 30) - 15), top - 20, { k: 0.6, flip: p.dir < 0, alpha: 0.75 });
        break;
      case 'plank_crumble': {
        const wob = p.crumbleT >= 0 && !p.broken ? Math.sin(t * 60) * 2 : 0;
        spr(p.broken ? 'plank_crumble_broken' : p.type, p.x + wob, top, { ay: 0, alpha: a });
        break;
      }
      case 'turtle_carrier':
        spr(p.type, p.x, top, { ay: 0, flip: p.vx < 0, alpha: a });
        break;
      case 'jelly_spring': {
        const bottom = top + (SPR.jelly_spring?.h || 126);
        if (p.pressT > 0) spr('jelly_spring_pressed', p.x, bottom, { ay: 1 });
        else spr(p.type, p.x, top + Math.sin(t * 4 + p.x) * 2, { ay: 0 });
        break;
      }
      default:
        spr(p.type, p.x, top, { ay: 0, alpha: a });
    }
  }

  // 이동 프레임이 있으면 쓰고 (diver_walk_1.., diver_swim_1..), 없으면 기본 프레임을 흔들고 늘여서 움직임 표현
  function frames(base) {
    const out = [];
    for (let i = 1; SPR[`${base}_${i}`]; i++) out.push(`${base}_${i}`);
    return out;
  }

  function drawDiver() {
    const d = G.d;
    let n, rot = 0, bob = 0, sx = 1, sy = 1;
    // 키를 놓으면 바로 서기 (감속 중에 다리가 슬로모션으로 움직이지 않게)
    const moving = d.ix && Math.abs(d.vx) > 40;
    if (state === 'dying' || state === 'over') {
      n = 'diver_dead'; rot = Math.sin(t * 2) * 0.2;
    } else if (d.hurtT > 0) {
      n = 'diver_hurt'; rot = Math.sin(t * 30) * 0.08;
    } else if (d.on) {
      if (d.landT > 0) {
        n = 'diver_land';
        const q = d.landT / 0.15;   // 착지 순간 납작해졌다 돌아옴
        sx = 1 + q * 0.08; sy = 1 - q * 0.1;
      } else if (moving) {
        const walk = frames('diver_walk');
        const step = Math.sin(d.walk * Math.PI);
        n = walk.length ? walk[Math.floor(d.walk * 2) % walk.length] : 'diver_idle';
        // 걸음마다 통통 튀고 좌우로 뒤뚱 (걷기 프레임이 있으면 살짝만)
        bob = -Math.abs(step) * (walk.length ? 3 : 6);
        rot = step * (walk.length ? 0.05 : 0.12);
        sy = 1 + Math.abs(step) * 0.04; sx = 2 - sy;
      } else {
        // 옆모습 서기 프레임이 있으면 걷기와 같은 방향으로 서 있음
        const stand = frames('diver_stand');
        n = stand.length ? stand[Math.floor(t * 1.6) % stand.length] : 'diver_idle';
        sy = 1 + Math.sin(t * 3) * 0.02; sx = 2 - sy;   // 숨쉬기
      }
    } else {
      const swim = frames('diver_swim');
      if (d.springT > 0 && d.vy < 0) {
        n = 'diver_jump'; sy = 1.08; sx = 0.94;
      } else {
        n = swim.length ? swim[Math.floor(t * 6) % swim.length] : 'diver_fall';
        rot = Math.sin(t * 9) * 0.07;        // 허우적
        bob = Math.sin(t * 9) * 2;
      }
      rot += d.vx / 300 * 0.15;
    }
    if (d.turnT > 0) sx *= 0.6 + 0.4 * (1 - d.turnT / 0.12);   // 방향 바꿀 때 휙 도는 느낌
    const blink = d.inv > 0 && d.hurtT <= 0 && state === 'play' && Math.floor(t * 12) % 2 === 0;
    spr(n, d.x, d.y + 3 + bob, { ay: 1, flip: d.face < 0, alpha: blink ? 0.35 : 1, rot, sx, sy });
  }

  function drawHud() {
    spr('panel_score', 112, 52);
    spr('panel_depth', W - 112, 52);
    text('SCORE', 112, 34, 17, '#3b2414');
    text('DEPTH', W - 112, 34, 17, '#3b2414');
    number(score(), 112, 64, 0.78);
    number(Math.floor(G.depth), W - 112, 64, 0.78, 'm');

    // 산소 게이지: 가득=왼쪽(파랑), 바닥=오른쪽(빨강)
    const gx = W / 2 + (G.hitT > 0 ? Math.sin(t * 70) * 4 * G.hitT / 0.5 : 0), gy = 56;
    spr('oxygen_gauge', gx, gy, G.hitT > 0 ? { glow: 'rgba(255, 60, 40, 0.9)', blur: 18 }
      : G.gainT > 0 ? { glow: `rgba(120, 230, 255, ${G.gainT / 0.5})`, blur: 18 } : {});
    // ±1.95rad = 파랑/빨강 구역 맨 아래 끝 (게이지 이미지 기준 측정값)
    const ang = -1.95 + (1 - G.oxygen / 100) * 3.9;
    spr('oxygen_needle', gx, gy + 12, { ax: 0.5, ay: 0.83, rot: ang, k: 0.72 });

    if (G.oxygen < 25 && state === 'play') {
      const a = 0.25 + Math.sin(t * 8) * 0.15;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
      g.addColorStop(0, 'rgba(200, 30, 20, 0)');
      g.addColorStop(1, `rgba(200, 30, 20, ${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function dim(a = 0.5) { ctx.fillStyle = `rgba(5, 15, 30, ${a})`; ctx.fillRect(0, 0, W, H); }

  // 벽에 매달린 닻+배너 표지판, 숫자는 코드로 씀 (이미지 하나로 모든 깊이에 사용)
  // 배너 안 글자 자리 (표지판 이미지 대비 비율, sign_depth.png 에서 잰 값):
  // 가운데 cx, cy / 쓸 수 있는 길이 len, 두께 thick / 배너 기울기 slope(rad)
  const SIGN_ANCHOR = { ax: 0.12, ay: 0.1 };
  const BANNER = { cx: 0.5, cy: 0.665, len: 0.46, thick: 0.34, slope: -0.17 };
  function drawSigns() {
    const s = SPR.sign_depth;
    if (!s) return;
    for (const sg of G.signs) {
      const dir = sg.left ? 1 : -1;
      const x = sg.left ? X_MIN - 6 : X_MAX + 6;
      const rot = Math.sin(t * 1.5 + sg.m) * 0.04 * dir;
      spr('sign_depth', x, sg.y, { ax: SIGN_ANCHOR.ax, ay: SIGN_ANCHOR.ay, flip: !sg.left, rot });
      // 표지판과 같이 흔들리고, 배너 기울기를 따라 글자를 씀
      ctx.save();
      ctx.translate(x, sg.y);
      ctx.rotate(rot);
      ctx.translate(dir * (BANNER.cx - SIGN_ANCHOR.ax) * s.w, (BANNER.cy - SIGN_ANCHOR.ay) * s.h);
      ctx.rotate(BANNER.slope * dir);
      const label = `${sg.m}m`;
      let size = BANNER.thick * s.h * 0.7;
      ctx.font = `900 ${size}px ${FONT}`;
      const fit = BANNER.len * s.w / ctx.measureText(label).width;
      if (fit < 1) size *= fit;   // 1000m 처럼 길어지면 배너 안에 들어가게 줄임
      text(label, 0, 1, size, '#3b2414');
      ctx.restore();
    }
  }

  // 내 최고 깊이 지점: 벽에서 벽까지 점선 + 작은 글씨 (표지판과 같은 방식으로 아래에서 올라옴)
  function drawBestLine() {
    if (!G.bestDepth) return;
    const y = SIGN_AT_Y + G.bestDepth * 40 - G.scroll;
    if (y < CEIL_Y || y > H + 20) return;
    const passed = G.depth >= G.bestDepth;
    ctx.save();
    ctx.setLineDash([12, 9]);
    ctx.lineDashOffset = -t * 12;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(28, 47, 58, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(X_MIN + 4, y); ctx.lineTo(X_MAX - 4, y); ctx.stroke();
    ctx.strokeStyle = passed ? 'rgba(255, 214, 107, 0.95)' : 'rgba(243, 230, 196, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    text(passed ? 'NEW BEST!' : `MY BEST ${G.bestDepth}m`, X_MAX - 10, y - 13, 15, passed ? '#ffd66b' : '#f3e6c4', '#1c2f3a', 'right');
  }

  function drawGame() {
    drawSigns();   // 표지판 자리는 발판이 비켜가므로 겹치지 않음
    for (const p of G.platforms) drawPlatform(p);
    drawBestLine();
    for (const i of G.items) {
      const q = itemPos(i);
      const tr = TREASURE[i.n];
      if (tr) spr(itemSpr(i), q.x, q.y + (i.n === 'pearl' ? 0 : Math.sin(t * 3 + i.dx) * 2), { glow: tr.col, blur: 10 + Math.sin(t * 4 + i.dx) * 4 });
      else spr(i.n, q.x, q.y);
    }
    // 산소방울: 하늘색 빛 + O₂ 글자
    for (const b of G.bubbles) {
      const big = b.n === 'bubble_large';
      spr(b.n, b.x, b.y, { glow: 'rgba(110, 225, 255, 0.95)', blur: 12 + Math.sin(t * 6 + b.ph) * 5 });
      text('O₂', b.x, b.y + 1, big ? 17 : 13, '#2a8fb4', '#ffffff');
    }
    // 위험 해파리: 선명한 원색 + 빨간 경고 빛 (배경 해파리는 작고 흐릿함)
    for (const j of G.jellies) {
      spr(j.n, j.x, j.y, { k: 1.08, sy: 1 + Math.sin(t * 4 + j.ph) * 0.05, glow: `rgba(255, 70, 50, ${0.55 + Math.sin(t * 6 + j.ph) * 0.25})`, blur: 16 });
    }
    drawDiver();
    for (const f of G.fx) {
      const r = f.t / f.life;
      spr(f.n, f.x, f.y - r * 10, { k: f.k0 + (f.k1 - f.k0) * r, alpha: 1 - r * r });
    }
    for (const r of G.rings) {
      const k = r.t / 0.4;
      ctx.strokeStyle = r.col;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, 12 + k * 46, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    for (const p of G.sparks) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.strokeStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 점수 아이템만 숫자로 보여줌 (산소 증감은 위 효과와 게이지 빛으로 표현)
    for (const p of G.pops) {
      const k = p.t / 0.9;
      ctx.globalAlpha = 1 - k * k;
      text(p.s, p.x, p.y - p.t * 45, p.size * (k < 0.15 ? 0.7 + k * 2 : 1), p.col, '#3b2414');
      ctx.globalAlpha = 1;
    }
  }

  function drawTitle() {
    spr('logo', W / 2, 330 + Math.sin(t * 2) * 6);
    spr('diver_idle', W / 2, 600 + Math.sin(t * 2.5) * 8, { ay: 1, rot: Math.sin(t * 1.5) * 0.06 });
    drawButtons();
    text(TOUCH ? '화면 왼쪽·오른쪽을 누르고 있으면 이동' : '← → 키 또는 화면 좌우를 눌러 이동', W / 2, 812, 20, '#f3e6c4', '#1c2f3a');
    text('성게·해파리에 부딪히면 산소가 줄어요. O₂ 방울을 모아요!', W / 2, 846, 15, '#d6ecef', '#1c2f3a');
    if (best > 0) text(`BEST ${best}`, W / 2, 890, 22, '#ffd66b', '#3b2414');
  }

  function drawOver() {
    dim(0.55);
    spr('panel_gameover', W / 2, 480);
    text('GAME OVER', W / 2, 300, 44, '#c8382a', '#3b2414');
    text('SCORE', W / 2, 375, 20);
    number(score(), W / 2, 412, 1);
    text(`DEPTH  ${Math.floor(G.depth)}m`, W / 2, 470, 24);
    text(G.lastHit ? '부딪혀서 산소가 다 새어 나갔어요!' : '산소가 바닥났어요!', W / 2, 515, 18, '#5a3a22');
    text(`BEST ${best}`, W / 2, 560, 22, '#b07a10');
    drawButtons();
  }

  function drawPause() {
    dim(0.5);
    text('일시정지', W / 2, 400, 46, '#f3e6c4', '#3b2414');
    drawButtons();
  }

  function drawLoading() {
    ctx.fillStyle = '#0c2a3a';
    ctx.fillRect(0, 0, W, H);
    text('Glub Glub Diver', W / 2, H / 2 - 40, 40, '#f3e6c4', '#3b2414');
    ctx.fillStyle = '#1f4a5c';
    ctx.fillRect(120, H / 2 + 10, 300, 16);
    ctx.fillStyle = '#ffd66b';
    ctx.fillRect(120, H / 2 + 10, 300 * loadPct, 16);
  }

  function render() {
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    if (state === 'load') { drawLoading(); return; }
    if (shake > 0) ctx.translate(rand(-6, 6) * shake / 0.3, rand(-6, 6) * shake / 0.3);
    drawBg();
    drawAmbient();
    if (state !== 'title' && G) drawGame();
    drawCeiling();
    if (state === 'title') drawTitle();
    else {
      drawHud();
      if (state === 'play') drawButtons();
      if (state === 'pause') drawPause();
      if (state === 'over') drawOver();
    }
  }

  // ---------- 루프 ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    shake = Math.max(0, shake - dt);
    if (state !== 'load') updateAmbient(state === 'pause' ? 0 : dt);
    if (state === 'play' || state === 'dying') update(dt);
    bgmUpdate();
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  load().then(() => {
    for (const n of FAR) makeFar(n);
    state = 'title';
  });
})();
