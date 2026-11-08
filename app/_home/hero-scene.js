// The home page hero: the name RAZAQ KHAN carried by small robots, under the
// visitor's real sky (their sunrise and sunset, moon phase, clouds, rain, snow,
// wind, fog and thunder), with a sun you can throw, clouds that burst and a tree
// that stops it. Plain JS on purpose: it is one long animation loop.
//
// startHero(canvas, sansFont, monoFont) starts it and returns stop(); call
// stop.setSky(sky) with the weather from sky.ts whenever it arrives.

export function startHero(c, FONT, MONO) {
  var alive = true, ac = new AbortController(), on = { signal: ac.signal };
  var x = c.getContext('2d'), W = c.width, H = c.height, small = W < 900;
  var G = H - (small ? 150 : Math.round(H * .22)), GRASS = small ? 16 : 12;
  // Physics runs per 1/60 s tick on a fixed clock, so 120 Hz screens are not twice as fast.
  // Full power on release, then real losses: light air drag, energy lost on every bounce, rolling friction.
  var RAD = small ? 28 : 32, MAXPULL = small ? 150 : 190, MAXSPEED = small ? 30 : 36;
  var GRAV = .42, AIR = .995, REST = .6, WALL = .6, ROLL = .975, STEP = 1000 / 60;
  var teal = '#1D9E75', EDGE = small ? 40 : 70;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lerp = function (a, b, k) { return a + (b - a) * k; };
  var mixc = function (a, b, k) { return a.map(function (v, i) { return Math.round(lerp(v, b[i], k)); }); };
  var rgb = function (q, a) { return 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',' + (a === undefined ? 1 : a) + ')'; };
  var turn = function (a, b, k) { var d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
  var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var hourNow = function () { var n = new Date(); return n.getHours() + n.getMinutes() / 60; };

  // ---- The visitor's sky. Defaults until setSky() brings the real forecast.
  var WX = { rise: 6, set: 18, cloud: .3, wind: 6, rain: 0, snow: 0, fog: 0, thunder: false, over: 0 };
  // Where the sun (or moon) is: f runs 0..1 across the day or the night; el is its height (-1..1).
  function sunAt(h) {
    var rise = WX.rise, set = WX.set, len = set - rise;
    if (h >= rise && h <= set) { var f = (h - rise) / len; return { day: true, f: f, el: Math.sin(Math.PI * f), morning: f < .5 }; }
    var nf = ((h - set + 24) % 24) / (24 - len);
    return { day: false, f: nf, el: -Math.sin(Math.PI * nf), morning: nf > .5 };
  }
  function palette(s) {
    var el = s.el, morning = s.morning;
    var K = [[-1, [6, 10, 32], [24, 30, 70], [200, 205, 225]], [-.12, [16, 22, 68], [64, 46, 112], [220, 215, 235]], [0, [38, 56, 132], morning ? [250, 146, 126] : [248, 104, 50], morning ? [255, 160, 104] : [255, 108, 44]], [.15, [50, 106, 198], morning ? [252, 192, 136] : [250, 152, 80], morning ? [255, 192, 124] : [255, 146, 64]], [.45, [34, 116, 214], [116, 188, 240], [255, 230, 164]], [1, [22, 108, 220], [134, 200, 246], [255, 244, 210]]];
    var i = 0; while (i < K.length - 2 && el > K[i + 1][0]) i++;
    var a = K[i], b = K[i + 1], k = Math.max(0, Math.min(1, (el - a[0]) / (b[0] - a[0])));
    return { el: el, top: mixc(a[1], b[1], k), hor: mixc(a[2], b[2], k), sun: mixc(a[3], b[3], k), lum: Math.max(0, Math.min(1, (el + .08) * 2.2)) };
  }
  // The sun (and moon) cross the sky from the left edge to just short of the tree's leaves,
  // so at sunset it never sinks behind the tree where you can't see or grab it.
  // Near sunrise and sunset it rests just above the top of the name rather than down among the
  // letters, so there is always open sky around it to pull and throw from.
  var spotFor = function (s) {
    var x0 = EDGE + 50, x1 = TREE_X - (small ? 100 : 92) - RAD - 12, low = G - 14 - 2 * LH - RAD - 16;
    return [x0 + (x1 - x0) * s.f, Math.max(RAD + 20, Math.min(low, G - 40 - Math.abs(s.el) * (G - (small ? 260 : 170))))];
  };
  // Moon phase 0..1 (0 new, .5 full), from a known new moon and the synodic month.
  var moonPhase = function () { var P = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14); return ((((Date.now() - ref) / 864e5) % P) + P) % P / P; };

  // Fixed scenery: fine grain in the soil and grass blades along the top.
  var seed = 11, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  var PEB = [], BLADE = [];
  for (var pi = 0; pi < (small ? 220 : 340); pi++) PEB.push([rnd() * W, G + GRASS + rnd() * (H - G - GRASS), .6 + rnd() * 1.6, rnd()]);
  for (var bx = 0; bx < W; bx += small ? 3.5 : 3) BLADE.push([bx + rnd() * 3, 2 + rnd() * (small ? 8 : 6), (rnd() - .5) * 3, rnd()]);

  // ---- The name, carried by robots. On wider scenes it sits in the space left of
  // the tree (whose leaves reach about 88px either side of its trunk); on phones it spans the width.
  var TREE_X = small ? W - 44 : W - 130, LEFT = EDGE, RIGHT = small ? W - EDGE : TREE_X - 135;
  var word = 'RAZAQ KHAN', FS = 110;
  x.font = 'bold ' + FS + 'px ' + FONT; while (x.measureText(word).width > RIGHT - LEFT && FS > 30) { FS -= 2; x.font = 'bold ' + FS + 'px ' + FONT; }
  var LH = FS * .48, cx = (LEFT + RIGHT) / 2 - x.measureText(word).width / 2, L = [];
  for (var q = 0; q < word.length; q++) { var ch = word[q], w = x.measureText(ch).width; if (ch !== ' ') L.push({ ch: ch, w: w, hx: cx + w / 2, hy: G - 14 - LH, x: cx + w / 2, y: G - 14 - LH, vx: 0, vy: 0, r: 0, vr: 0, st: 'home', wait: 0 }); cx += w; }
  var PER = small ? 6 : 10, R = [];
  L.forEach(function (l, j) { for (var k = 0; k < PER; k++) { var off = (k - (PER - 1) / 2) * (l.w / PER); R.push({ j: j, off: off, hx: l.hx + off, hy: G - 8, x: l.hx + off, y: G - 8, a: -Math.PI / 2, vx: 0, vy: 0, up: true }); } });
  var REST_Y = G - LH + 2, CAP_TOP = FS * .36;
  var isHome = function (l) { return l.st === 'home' || l.st === 'wobble'; };

  // ---- The tree: a spring at its base, so a hit (or the wind) makes it sway and settle.
  var T = { x: TREE_X, th: small ? 150 : 128, tw: small ? 14 : 12, cr: small ? 56 : 50, a: 0, va: 0, snow: 0 };
  var CAN = [[0, 0, 1], [-.62, .22, .7], [.62, .2, .72], [-.3, -.45, .68], [.34, -.42, .66], [0, .4, .62]];
  var treeAt = function (len) { return [T.x + Math.sin(T.a) * len, G - Math.cos(T.a) * len]; };
  var canopy = function () { return treeAt(T.th + T.cr * .15); };

  // ---- Clouds: thin, flat, soft blobs (FLAT squashes them). How many depends on cloud cover.
  var FLAT = .55;
  var PUFF = [[-1.25, .08, .3], [-.85, 0, .42], [-.42, -.08, .5], [0, -.14, .56], [.42, -.06, .48], [.84, .02, .4], [1.22, .08, .28], [-.2, .12, .38], [.3, .14, .36], [-.62, .14, .3], [.7, .14, .3]];
  function makeClouds(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push({ x: W * ((i + .2 + Math.random() * .6) / n), y: H * (small ? .1 + Math.random() * .2 : .07 + Math.random() * .14), s: (.75 + Math.random() * .35) * (small ? 78 : 74), vx0: .06 + Math.random() * .06, a: 1, st: 'on', t: 0 });
    return out;
  }
  var CL = makeClouds(2);

  // ---- Rain and snow. Drops end on a "floor" somewhere in the ground band, for depth.
  var DROPS = [], FLAKES = [], groundSnow = 0, flashT = 0, flash2 = 0, nextBolt = 240;
  var floorY = function () { return G + 2 + Math.random() * (H - G) * .7; };
  var newDrop = function (d, anywhere) { d.x = -60 + Math.random() * (W + 120); d.y = anywhere ? -20 - Math.random() * G * 1.2 : -20 - Math.random() * 80; d.v = 11 + Math.random() * 5; d.len = 10 + Math.random() * 8; d.floor = floorY(); return d; };
  var newFlake = function (f, anywhere) { f.x = Math.random() * W; f.y = anywhere ? Math.random() * G : -10 - Math.random() * 40; f.v = .6 + Math.random() * .9; f.r = (small ? 1.6 : 1.2) + Math.random() * 2; f.ph = Math.random() * 6; f.floor = floorY(); return f; };

  // ---- Personality: a sign after repeated knock-downs, a badge for clearing the sky, sleep when idle.
  var SIGNS = ['please', 'again?', 'we just fixed that'];
  var knocks = 0, throwKnocked = false, sign = null, badge = null, cleared = false, asleep = false, lastActive = 0;

  var S = { p: spotFor(sunAt(hourNow())), v: [0, 0], st: 'sky', t: 0, from: null, still: 0, freeTree: false, freeL: [] };
  var FX = [], ptr = null, pull = null, bubble = null, sunCol = [255, 240, 200], cloudCol = [255, 255, 255], tick = 0;
  var P = function (e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };

  function dust(px, py, s, nx, ny) { s = Math.max(.15, Math.min(1, s)); var base = Math.atan2(ny, nx); for (var i = 0; i < Math.round(5 + 10 * s); i++) { var a = base + (Math.random() - .5) * 2.2, v = 1.2 + 4.5 * s * Math.random(); FX.push({ k: 'dust', x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, sz: 2 + 3.2 * Math.random() }); } }
  function flash(px, py, s) { s = Math.max(.2, Math.min(1, s)); FX.push({ k: 'flash', x: px, y: py, r: RAD * (1.1 + 1.8 * s), life: 1, col: sunCol.slice() }); }
  function leaves(px, py, s) { var n = Math.round(3 + s * .5); for (var i = 0; i < n; i++) FX.push({ k: 'leaf', x: px + (Math.random() - .5) * 30, y: py + (Math.random() - .5) * 30, vx: (Math.random() - .5) * 3, vy: -Math.random() * 2, life: 1, rot: Math.random() * 6, vr: (Math.random() - .5) * .2, ph: Math.random() * 6 }); }
  function splash(px, py, n) { for (var i = 0; i < n; i++) FX.push({ k: 'splash', x: px, y: py, vx: (Math.random() - .5) * 2.4, vy: -1 - Math.random() * 1.6, life: 1 }); }
  function burst(cl) {
    cl.st = 'gone'; cl.t = 0; cl.a = 0;
    PUFF.forEach(function (p) {
      var px = cl.x + p[0] * cl.s, py = cl.y + p[1] * cl.s * FLAT, pr = p[2] * cl.s;
      for (var k = 0; k < (small ? 7 : 9); k++) { var ang = Math.random() * 6.283, rr = Math.random() * pr, ox = Math.cos(ang) * rr, oy = Math.sin(ang) * rr * FLAT; FX.push({ k: 'puff', x: px + ox, y: py + oy, vx: ox / pr * (.6 + Math.random() * 1.2) + S.v[0] * .12, vy: oy / pr * (.4 + Math.random() * .8) + S.v[1] * .06, life: 1, fade: .006 + Math.random() * .008, sz: pr * (.35 + Math.random() * .35) }); }
    });
  }
  function knock(l, vx, vy, spin) { l.st = 'fall'; l.vx = vx; l.vy = vy; l.vr = spin; l.wait = 50; var j = L.indexOf(l); R.forEach(function (r) { if (r.j === j) { r.vx = (Math.random() - .5) * 12; r.vy = -Math.random() * 6; } }); }
  // Every third time the name is knocked down, a robot walks out with a sign.
  function noteKnock() { knocks++; if (knocks % 3 === 0) sign = { t: SIGNS[(knocks / 3 - 1) % SIGNS.length], life: 420 }; }
  function sayTime() { var n = new Date(), tm = n.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), h = n.getHours(); var tag = h < 5 ? 'Still night. Go to sleep.' : h < 8 ? 'Rising slowly.' : h < 12 ? 'Morning shift.' : h < 15 ? 'Peak hours.' : h < 18 ? 'Golden hour soon.' : h < 20 ? 'Setting off for the day.' : 'Moon shift now.'; bubble = { t: "It's " + tm + '. ' + tag, life: 200 }; }
  // Any pointer activity wakes the robots with a little hop.
  function active() { lastActive = tick; if (asleep) { asleep = false; R.forEach(function (r) { r.vy = -2.5 - Math.random() * 2; }); } }

  // margin (optional) widens the test, to ask "is the sun close to the tree" rather than "touching it".
  function treeHit(margin) {
    var m = margin || 0, cc = canopy(), cr = T.cr * .95 + m, dx = S.p[0] - cc[0], dy = S.p[1] - cc[1], d = Math.hypot(dx, dy);
    if (d < RAD + cr) return { n: [dx / (d || 1), dy / (d || 1)], depth: RAD + cr - d, lever: 1 };
    var top = treeAt(T.th), bx = top[0] - T.x, by = top[1] - G;
    var tt = Math.max(0, Math.min(1, ((S.p[0] - T.x) * bx + (S.p[1] - G) * by) / (bx * bx + by * by)));
    var ex = S.p[0] - (T.x + bx * tt), ey = S.p[1] - (G + by * tt), e = Math.hypot(ex, ey);
    if (e < RAD + T.tw / 2 + m) return { n: [ex / (e || 1), ey / (e || 1)], depth: RAD + T.tw / 2 - e, lever: tt };
    return null;
  }

  c.addEventListener('pointermove', function (e) { active(); ptr = P(e); if (pull) { var a = pull.anchor, dx = ptr[0] - a[0], dy = ptr[1] - a[1], d = Math.hypot(dx, dy); if (d > MAXPULL) { dx *= MAXPULL / d; dy *= MAXPULL / d; } pull.d = Math.min(d, MAXPULL); pull.moved = pull.moved || d > 8; S.p = [a[0] + dx, Math.min(G - RAD, a[1] + dy)]; } }, on);
  c.addEventListener('pointerleave', function () { ptr = null; }, on);
  c.addEventListener('pointerdown', function (e) {
    active(); var p = P(e); ptr = p;
    // Grabbing the sun always comes first, even where it overlaps a cloud or the tree's edge.
    if (S.st === 'sky' && Math.hypot(p[0] - S.p[0], p[1] - S.p[1]) < RAD + 28) { pull = { anchor: S.p.slice(), d: 0, moved: false }; c.style.cursor = 'grabbing'; c.setPointerCapture(e.pointerId); return; }
    var cc = canopy(); if (Math.hypot(p[0] - cc[0], p[1] - cc[1]) < T.cr * 1.1) { T.va += (p[0] < cc[0] ? 1 : -1) * .025; leaves(p[0], p[1], 4); if (T.snow > .1) { T.snow *= .4; } return; }
    // Only a tap on the name itself (with a small margin) knocks it down; sky, clouds and ground do nothing.
    var PAD = small ? 18 : 12, onName = L.some(function (l) { return Math.abs(p[0] - l.x) < l.w / 2 + PAD && Math.abs(p[1] - l.y) < LH + PAD; });
    if (onName && L.every(isHome)) { L.forEach(function (l) { knock(l, (p[0] < l.x ? 1 : -1) * (8 + Math.random() * 10), -14 - Math.random() * 8, (Math.random() - .5) * .5); }); flash(p[0], p[1], .6); noteKnock(); }
  }, on);
  c.addEventListener('pointerup', function () {
    c.style.cursor = 'grab'; if (!pull) return; var a = pull.anchor;
    if (!pull.moved) { S.p = a.slice(); sayTime(); pull = null; return; }
    var dx = a[0] - S.p[0], dy = a[1] - S.p[1], k = (pull.d / MAXPULL) * MAXSPEED / (Math.hypot(dx, dy) || 1);
    S.v = [dx * k, dy * k]; S.st = 'fly'; S.t = 0; S.still = 0; startFree(); throwKnocked = false; pull = null;
  }, on);

  // A throw that starts right next to a letter or the tree flies freely through *that* thing until
  // it is clear of it; everything else (the other letters, the tree, the ground) still takes hits.
  function nearLetter(l, m) { return isHome(l) && Math.abs(S.p[0] - l.x) < l.w / 2 + RAD + m && Math.abs(S.p[1] - l.y) < LH + RAD + m; }
  function startFree() { S.freeTree = !!treeHit(24); S.freeL = L.map(function (l) { return nearLetter(l, 24); }); }
  function updateFree() {
    if (S.freeTree && !treeHit(8)) S.freeTree = false;
    L.forEach(function (l, i) { if (S.freeL[i] && !nearLetter(l, 8)) S.freeL[i] = false; });
  }
  function hitLetters() {
    var r = RAD;
    L.forEach(function (l, i) {
      if (!isHome(l) || S.freeL[i]) return;
      var dx = S.p[0] - l.x, dy = S.p[1] - l.y, ox = l.w / 2 + r - Math.abs(dx), oy = LH + r - Math.abs(dy); if (ox <= 0 || oy <= 0) return;
      var nx = ox < oy ? Math.sign(dx) : 0, ny = ox < oy ? 0 : Math.sign(dy), vn = S.v[0] * nx + S.v[1] * ny; if (vn >= 0) return; var impact = -vn;
      if (impact > 7) { knock(l, S.v[0] * .75, Math.min(-6, S.v[1] * .5) - impact * .45, (Math.random() - .5) * impact * .03); if (!throwKnocked) { throwKnocked = true; noteKnock(); } }
      else { l.st = 'wobble'; l.vr += (nx || (Math.random() - .5)) * impact * .012; }
      flash(S.p[0] - nx * r, S.p[1] - ny * r, impact / MAXSPEED); S.v[0] -= (1 + REST) * vn * nx; S.v[1] -= (1 + REST) * vn * ny; S.v[0] *= .88; S.v[1] *= .88;
    });
  }
  function hitTree() {
    var hit = treeHit();
    if (S.freeTree) return;
    if (!hit) return;
    var n = hit.n; S.p[0] += n[0] * hit.depth; S.p[1] += n[1] * hit.depth;
    var vn = S.v[0] * n[0] + S.v[1] * n[1]; if (vn >= 0) return;
    var impact = -vn;
    // The tree takes the hit: it sways by how hard and how high it was struck...
    T.va += -n[0] * impact * .0022 * (.35 + .65 * hit.lever);
    if (impact > 2) {
      // ...and stops the sun dead, leaving only a small bounce back. Snow on it shakes loose.
      var back = Math.min(1.5, impact * .06);
      S.v[0] = S.v[0] * .08 + n[0] * back; S.v[1] = S.v[1] * .08 + n[1] * back;
      leaves(S.p[0] - n[0] * RAD, S.p[1] - n[1] * RAD, impact); T.snow *= .3;
    } else { S.v[0] -= vn * n[0]; S.v[1] -= vn * n[1]; S.v[0] *= .9; S.v[1] *= .9; }
  }
  function hitClouds() {
    CL.forEach(function (cl) {
      if (cl.st !== 'on') return;
      for (var i = 0; i < PUFF.length; i++) { var p = PUFF[i], px = cl.x + p[0] * cl.s, py = cl.y + p[1] * cl.s * FLAT; if (Math.hypot(S.p[0] - px, (S.p[1] - py) / FLAT) < RAD / FLAT * .8 + p[2] * cl.s * .75) { burst(cl); S.v[0] *= .95; S.v[1] *= .95; return; } }
    });
  }
  function step() {
    var r = RAD;
    S.v[1] += GRAV; S.v[0] *= AIR; S.v[1] *= AIR; S.p[0] += S.v[0]; S.p[1] += S.v[1];
    if (S.p[0] < r || S.p[0] > W - r) { var side = S.p[0] < r ? 1 : -1; S.p[0] = Math.max(r, Math.min(W - r, S.p[0])); if (Math.abs(S.v[0]) > 2) dust(S.p[0] - side * r, S.p[1], Math.abs(S.v[0]) / MAXSPEED, side, 0); S.v[0] *= -WALL; S.v[1] *= .9; }
    if (S.p[1] < r) { S.p[1] = r; S.v[1] *= -WALL; }
    if (S.p[1] > G - r) {
      S.p[1] = G - r;
      if (S.v[1] > 1.4) { if (S.v[1] > 2) dust(S.p[0], G, S.v[1] / MAXSPEED, 0, -1); S.v[1] *= -REST; S.v[0] *= .9; }
      else if (S.v[1] >= 0) { S.v[1] = 0; S.v[0] *= ROLL; } // rolling; a throw heading up keeps its speed
    }
    updateFree();
    hitLetters(); hitTree(); hitClouds();
    S.still = Math.hypot(S.v[0], S.v[1]) < .35 ? S.still + 1 : 0;
    if (S.still > 30) { S.st = 'rest'; S.t = 0; }
  }

  // ---- Weather in: map the forecast to rain, snow, fog, thunder, cloud count and wind.
  function setSky(k) {
    if (!k) return;
    WX.rise = k.rise; WX.set = k.set; WX.cloud = k.cloud; WX.wind = k.wind;
    var code = k.code;
    WX.rain = ({ 51: .25, 53: .35, 55: .45, 56: .35, 57: .5, 61: .4, 63: .65, 65: 1, 66: .5, 67: .8, 80: .45, 81: .7, 82: 1, 95: .85, 96: .9, 99: 1 })[code] || 0;
    WX.snow = ({ 71: .35, 73: .6, 75: 1, 77: .3, 85: .5, 86: .9 })[code] || 0;
    WX.fog = code === 45 || code === 48 ? .85 : 0;
    WX.thunder = code >= 95;
    WX.over = Math.max(0, Math.min(1, (WX.cloud - .45) * 1.8));
    if (WX.rain || WX.snow) WX.over = Math.max(WX.over, .8);
    if (WX.thunder) WX.over = 1;
    var n = WX.cloud < .15 ? 1 : WX.cloud < .4 ? 2 : WX.cloud < .7 ? 4 : 6;
    if (WX.rain || WX.snow) n = Math.max(n, 5);
    if (n !== CL.length) CL = makeClouds(n);
    // Snow that has been falling a while has already settled a little.
    if (WX.snow) { groundSnow = Math.max(groundSnow, .6 + .3 * WX.snow); T.snow = Math.max(T.snow, .6); }
  }

  function updateWeather() {
    var sx = WX.wind * .06, cc = canopy(), i, l;
    var wantD = Math.round(WX.rain * (small ? 160 : 220));
    while (DROPS.length < wantD) DROPS.push(newDrop({}, true));
    if (DROPS.length > wantD) DROPS.length = wantD;
    DROPS.forEach(function (d) {
      var py = d.y, hit = false; d.x += sx; d.y += d.v;
      if (d.y > 0) {
        for (i = 0; i < L.length; i++) { l = L[i]; if (!isHome(l)) continue; var top = l.y - CAP_TOP; if (Math.abs(d.x - l.x) < l.w * .42 && py < top && d.y >= top) { splash(d.x, top, 2); hit = true; break; } }
        // The sun is far away in the sky, so rain passes in front of it; only near things catch it.
        if (!hit && Math.hypot(d.x - cc[0], d.y - cc[1]) < T.cr) hit = true;
        if (!hit && d.y >= d.floor) { if (Math.random() < .5) splash(d.x, d.floor, 1); hit = true; }
      }
      if (hit) newDrop(d, false);
    });
    var wantF = Math.round(WX.snow * (small ? 140 : 180));
    while (FLAKES.length < wantF) FLAKES.push(newFlake({}, true));
    if (FLAKES.length > wantF) FLAKES.length = wantF;
    FLAKES.forEach(function (f) {
      var hit = false; f.x += WX.wind * .025 + Math.sin(f.ph + tick * .03) * .35; f.y += f.v;
      if (f.x < -10) f.x += W + 20; else if (f.x > W + 10) f.x -= W + 20;
      // Snow settles on the tree and the ground; it drifts past the name and the (distant) sun.
      if (Math.hypot(f.x - cc[0], f.y - cc[1]) < T.cr) { T.snow = Math.min(1, T.snow + .004); hit = true; }
      if (!hit && f.y >= f.floor) { groundSnow = Math.min(1, groundSnow + .00025); hit = true; }
      if (hit) newFlake(f, false);
    });
    // Without snow falling, what settled melts away slowly.
    if (!WX.snow) { groundSnow = Math.max(0, groundSnow - .0004); T.snow = Math.max(0, T.snow - .001); }
    // Thunder: a flash, a second fainter one a moment later, then quiet for 6 to 16 seconds.
    if (WX.thunder) { if (--nextBolt <= 0) { flashT = 1; flash2 = 9; nextBolt = 360 + Math.random() * 600; } if (flash2 > 0 && --flash2 === 0) flashT = .7; }
    flashT = Math.max(0, flashT - .07);
  }

  function update() {
    tick++;
    var s = sunAt(hourNow()), home = spotFor(s);
    if (S.st === 'fly') step();
    else if (S.st === 'rest') { S.t++; if (S.t > 50) { S.st = 'return'; S.t = 0; S.from = S.p.slice(); } }
    else if (S.st === 'return') { S.t++; var k = ease(Math.min(1, S.t / 110)); S.p = [lerp(S.from[0], home[0], k), lerp(S.from[1], home[1], k) - Math.sin(k * Math.PI) * 60]; if (k >= 1) S.st = 'sky'; }
    else if (S.st === 'sky' && !pull) S.p = home.slice();
    // The tree leans with the wind and moves in gusts.
    var lean = Math.min(.08, WX.wind * .0015), gust = Math.sin(tick * .02) * .01 * (1 + WX.wind / 15) + Math.sin(tick * .071) * .004 * WX.wind / 10;
    T.va += (lean + gust - T.a) * .05; T.va *= .93; T.a = Math.max(-.25, Math.min(.25, T.a + T.va));
    CL.forEach(function (cl) {
      cl.x += cl.vx0 * (.5 + WX.wind / 12); if (cl.x - 1.3 * cl.s > W) cl.x = -1.3 * cl.s;
      if (cl.st === 'gone') { cl.t++; if (cl.t > 420) { cl.st = 'back'; cl.a = 0; } }
      else if (cl.st === 'back') { cl.a = Math.min(1, cl.a + .012); if (cl.a >= 1) cl.st = 'on'; }
    });
    // Every cloud burst at once: a small badge.
    var allGone = CL.length > 0 && CL.every(function (cl) { return cl.st === 'gone'; });
    if (allGone && !cleared) { cleared = true; badge = { t: 'Clear skies', life: 300 }; }
    if (CL.every(function (cl) { return cl.st === 'on'; })) cleared = false;
    updateWeather();
    for (var i = FX.length - 1; i >= 0; i--) {
      var e = FX[i];
      if (e.k === 'dust') { e.vy += .12; e.vx *= .97; e.x += e.vx; e.y = Math.min(G + 2, e.y + e.vy); e.life -= .028; }
      else if (e.k === 'flash') e.life -= .06;
      else if (e.k === 'puff') { e.vx *= .965; e.vy = e.vy * .965 - .006; e.x += e.vx; e.y += e.vy; e.life -= e.fade; }
      else if (e.k === 'leaf') { e.vy = Math.min(1.3, e.vy + .05); e.vx = e.vx * .96 + Math.sin(e.ph + tick * .09) * .07; e.x += e.vx; e.y += e.vy; e.rot += e.vr; if (e.y >= G - 2) { e.y = G - 2; e.vx *= .5; e.vy = 0; e.vr = 0; e.life -= .02; } else e.life -= .002; }
      else if (e.k === 'splash') { e.vy += .25; e.x += e.vx; e.y += e.vy; e.life -= .07; }
      else if (e.k === 'z') { e.x += Math.sin(e.ph + tick * .05) * .3 + .12; e.y -= .4; e.life -= .007; }
      if (e.life <= 0) FX.splice(i, 1);
    }
    if (bubble && --bubble.life <= 0) bubble = null;
    if (sign && --sign.life <= 0) sign = null;
    if (badge && --badge.life <= 0) badge = null;
    // Left alone for 45 seconds with everything at rest, the robots doze off.
    if (!asleep && tick - lastActive > 45 * 60 && S.st === 'sky' && !pull && L.every(function (l) { return l.st === 'home'; })) asleep = true;
    if (asleep && tick % 80 === 0) { var zl = L[Math.floor(Math.random() * L.length)]; FX.push({ k: 'z', x: zl.x + zl.w * .3, y: zl.y - FS * .45, life: 1, ph: Math.random() * 6 }); }
    L.forEach(function (l, j) {
      if (l.wait > 0) l.wait--;
      if (l.st === 'wobble') { l.vr += -l.r * .08; l.vr *= .86; l.r += l.vr; if (Math.abs(l.r) < .002 && Math.abs(l.vr) < .002) { l.r = 0; l.vr = 0; l.st = 'home'; } }
      if (l.st === 'fall') {
        l.vy += .8; l.vx *= .995; l.x += l.vx; l.y += l.vy; l.r += l.vr;
        if (l.y > REST_Y) { l.y = REST_Y; l.vy *= -.35; l.vx *= .8; l.vr *= .6; } if (l.y < 40) { l.y = 40; l.vy = Math.abs(l.vy) * .5; } if (l.x < EDGE || l.x > W - EDGE) { l.vx *= -.6; l.x = Math.max(EDGE, Math.min(W - EDGE, l.x)); }
        if (l.wait === 0 && Math.abs(l.vy) < 1.5 && l.y >= REST_Y - 1) { var ok = R.every(function (r) { return r.j !== j || Math.hypot(r.x - (l.x + r.off), r.y - (G - 8)) < 9; }); if (ok) l.st = 'carry'; }
      }
      if (l.st === 'carry') { var dx = l.hx - l.x, dy = l.hy - l.y, dd = Math.hypot(dx, dy), sp = Math.min(3.4, dd); l.x += dx / (dd || 1) * sp; l.y += (Math.abs(dx) > 30 ? (REST_Y - 4 - l.y) * .1 : dy * .12); l.r *= .9; if (dd < 2) { l.x = l.hx; l.y = l.hy; l.r = 0; l.st = 'home'; } }
    });
    R.forEach(function (r) {
      var l = L[r.j], up = isHome(l), tx, ty; r.up = up;
      if (up) { tx = r.hx; ty = r.hy; } else if (l.wait > 0) { tx = r.x; ty = r.y; } else { tx = l.x + r.off; ty = G - 8; }
      r.vx += (tx - r.x) * .08; r.vy += (ty - r.y) * .08 + (r.y < G - 8 ? .45 : 0); r.vx *= .72; r.vy *= .72; r.x += r.vx; r.y = Math.min(G - 8, r.y + r.vy);
      var sp = Math.hypot(r.vx, r.vy), want;
      if (sp > .8) want = Math.atan2(r.vy, r.vx);
      else if (asleep && up) want = -Math.PI / 2 + (r.j % 2 ? 1 : -1) * .85 + Math.sin(tick * .02 + r.off) * .05; // drooping
      else want = ptr && up ? Math.atan2(ptr[1] - r.y, ptr[0] - r.x) : -Math.PI / 2;
      r.a = turn(r.a, want, asleep ? .03 : .15);
    });
  }

  // ---- Drawing
  function drawClouds(pal, ov) {
    var sh = mixc(cloudCol, pal.top, .45), base = (pal.lum < .3 ? .32 : .5) + ov * .3;
    CL.forEach(function (cl) {
      if (cl.st === 'gone' || cl.a <= 0) return;
      x.save(); x.translate(cl.x, cl.y); x.scale(1, FLAT);
      // A faint grey underside first, then the lit body; each blob fades to nothing at its edge.
      [[sh, cl.s * .16, .5], [cloudCol, 0, 1]].forEach(function (layer) {
        PUFF.forEach(function (p) {
          var px = p[0] * cl.s, py = p[1] * cl.s + layer[1], pr = p[2] * cl.s * 1.25, al = Math.min(.9, base * layer[2] * cl.a);
          var g = x.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, rgb(layer[0], al)); g.addColorStop(.55, rgb(layer[0], al * .6)); g.addColorStop(1, rgb(layer[0], 0));
          x.fillStyle = g; x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        });
      });
      x.restore();
    });
  }
  function drawGround(pal, sc, day, snowCol) {
    var lum = pal.lum;
    // Muted, natural tones: olive grass fading into dark soil, no outlines, only fine grain.
    var g1 = mixc([20, 30, 18], [92, 118, 66], lum), g2 = mixc([18, 24, 15], [70, 88, 50], lum);
    var s1 = mixc([24, 20, 16], [88, 72, 54], lum), s2 = mixc([12, 10, 8], [48, 39, 30], lum);
    var sg = x.createLinearGradient(0, G, 0, H); sg.addColorStop(0, rgb(g1)); sg.addColorStop(GRASS / (H - G), rgb(g2)); sg.addColorStop(Math.min(.9, GRASS * 2.6 / (H - G)), rgb(s1)); sg.addColorStop(1, rgb(s2)); x.fillStyle = sg; x.fillRect(0, G, W, H - G);
    PEB.forEach(function (p) { x.fillStyle = rgb(p[3] > .5 ? [0, 0, 0] : [255, 240, 220], p[3] > .5 ? .14 : .06); x.fillRect(p[0], p[1], p[2], p[2]); });
    // Grass bends with the wind, in slow waves.
    var bendK = (WX.wind / 30) * (small ? 5 : 4);
    x.lineWidth = 1.1; BLADE.forEach(function (b) { var bend = bendK * (.6 + .4 * Math.sin(tick * .06 + b[0] * .03)); x.strokeStyle = rgb(mixc(g1, g2, b[3]), .85); x.beginPath(); x.moveTo(b[0], G + 3); x.lineTo(b[0] + b[2] + bend, G + 2 - b[1]); x.stroke(); });
    if (groundSnow > .01) {
      // A blanket over the whole field: soft drifts along the top (deepest against the tree),
      // cool blue shade further down, with a few grass blades poking through and a faint sparkle.
      var cover = Math.min(1, groundSnow * 1.5), lift = (small ? 9 : 7) * cover, shade = mixc(snowCol, [150, 168, 196], .3);
      var sb = x.createLinearGradient(0, G - lift, 0, H);
      sb.addColorStop(0, rgb(snowCol, .97 * cover)); sb.addColorStop(.35, rgb(mixc(snowCol, shade, .5), .94 * cover)); sb.addColorStop(1, rgb(shade, .88 * cover));
      x.fillStyle = sb; x.beginPath(); x.moveTo(0, H);
      for (var sx = 0; sx <= W + 16; sx += 16) {
        var drift = .55 + .45 * Math.sin(sx * .021) * Math.sin(sx * .0067 + 1.3), nearTree = Math.max(0, 1 - Math.abs(sx - T.x) / 70);
        x.lineTo(sx, G - lift * drift - lift * .7 * nearTree);
      }
      x.lineTo(W + 16, H); x.closePath(); x.fill();
      if (cover < .95) { x.lineWidth = 1.1; x.strokeStyle = rgb(g1, .8 * (1 - cover)); x.beginPath(); BLADE.forEach(function (b, i) { if (i % 5) return; x.moveTo(b[0], G + 1); x.lineTo(b[0] + b[2], G - b[1]); }); x.stroke(); }
      PEB.forEach(function (p) { if (p[3] < .86) return; var tw = .5 + .5 * Math.sin(tick * .05 + p[0]); x.fillStyle = 'rgba(255,255,255,' + (.55 * tw * cover * Math.max(.3, lum)) + ')'; x.fillRect(p[0], p[1], 1.6, 1.6); });
    }
    var lit = x.createRadialGradient(S.p[0], G, 0, S.p[0], G, W * .5); lit.addColorStop(0, rgb(sc, day ? .14 : .05)); lit.addColorStop(1, rgb(sc, 0)); x.fillStyle = lit; x.fillRect(0, G, W, H - G);
  }
  function drawTree(pal, snowCol) {
    var lum = pal.lum, bark = mixc([26, 21, 17], [74, 58, 44], lum), leaf = mixc([16, 26, 18], [52, 80, 46], lum), leafHi = mixc([24, 36, 24], [82, 112, 62], lum);
    x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(T.x + T.a * 40, G + 6, T.cr * .9, 7, 0, 0, 7); x.fill();
    var top = treeAt(T.th), mid = treeAt(T.th * .5), br = treeAt(T.th * .72);
    x.strokeStyle = rgb(bark); x.lineCap = 'round'; x.lineWidth = T.tw; x.beginPath(); x.moveTo(T.x, G + 4); x.quadraticCurveTo(T.x + (mid[0] - T.x) * .6, mid[1], top[0], top[1]); x.stroke();
    x.lineWidth = T.tw * .45; x.beginPath(); x.moveTo(br[0], br[1]); x.lineTo(br[0] - T.cr * .5, br[1] - T.cr * .45); x.moveTo(br[0], br[1] - 8); x.lineTo(br[0] + T.cr * .45, br[1] - T.cr * .55); x.stroke(); x.lineCap = 'butt';
    var cc = canopy(), pts = CAN.map(function (p) { return [cc[0] + p[0] * T.cr + Math.sin(T.a) * T.cr * .35 * (1 - p[1]), cc[1] + p[1] * T.cr, p[2] * T.cr]; });
    x.fillStyle = rgb(leaf); x.beginPath(); pts.forEach(function (p) { x.moveTo(p[0] + p[2], p[1] + 4); x.arc(p[0], p[1] + 4, p[2], 0, 7); }); x.fill();
    x.fillStyle = rgb(leafHi, .4); x.beginPath(); pts.forEach(function (p) { var hr = p[2] * .55; x.moveTo(p[0] - p[2] * .2 + hr, p[1] - p[2] * .25); x.arc(p[0] - p[2] * .2, p[1] - p[2] * .25, hr, 0, 7); }); x.fill();
    if (T.snow > .02) { x.fillStyle = rgb(snowCol, .92 * T.snow); pts.forEach(function (p, i) { if (CAN[i][1] > .05) return; x.beginPath(); x.ellipse(p[0], p[1] - p[2] * .55, p[2] * .78, Math.max(2, p[2] * .3 * T.snow), 0, Math.PI, 0); x.fill(); }); }
  }
  function drawRain(pal) {
    if (!DROPS.length) return;
    var sx = WX.wind * .06;
    x.strokeStyle = rgb(mixc([120, 132, 156], [200, 214, 232], pal.lum), .55); x.lineWidth = small ? 1.6 : 1.2; x.beginPath();
    DROPS.forEach(function (d) { if (d.y < -d.len) return; x.moveTo(d.x - sx * d.len / d.v, d.y - d.len); x.lineTo(d.x, d.y); });
    x.stroke();
  }
  function drawFX(pal, front) {
    var dc = mixc([60, 50, 40], [150, 128, 100], pal.lum), lc = mixc([28, 40, 26], [88, 116, 66], pal.lum), rc = mixc([140, 150, 172], [214, 226, 240], pal.lum);
    FX.forEach(function (e) {
      var a = Math.max(0, e.life);
      if (front) { if (e.k === 'z') { x.globalAlpha = Math.min(1, a * 2); x.fillStyle = pal.lum > .55 ? '#22231f' : '#F1EFE8'; x.font = 'bold ' + Math.round((small ? 22 : 16) * (1 + (1 - a) * .7)) + 'px ' + MONO; x.textAlign = 'center'; x.fillText('z', e.x, e.y); x.globalAlpha = 1; } return; }
      if (e.k === 'dust') { x.fillStyle = rgb(dc, .65 * a); x.beginPath(); x.arc(e.x, e.y, e.sz * (1.5 - a * .5), 0, 7); x.fill(); }
      else if (e.k === 'flash') { var g = x.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (1.2 - .2 * a)); g.addColorStop(0, rgb(mixc(e.col, [255, 255, 255], .5), .65 * a)); g.addColorStop(1, rgb(e.col, 0)); x.fillStyle = g; x.beginPath(); x.arc(e.x, e.y, e.r * 1.2, 0, 7); x.fill(); }
      else if (e.k === 'puff') { var pr = e.sz * (1.8 - .8 * a), pg = x.createRadialGradient(e.x, e.y, 0, e.x, e.y, pr); pg.addColorStop(0, rgb(cloudCol, .45 * a * a)); pg.addColorStop(1, rgb(cloudCol, 0)); x.fillStyle = pg; x.fillRect(e.x - pr, e.y - pr, pr * 2, pr * 2); }
      else if (e.k === 'leaf') { x.save(); x.translate(e.x, e.y); x.rotate(e.rot); x.fillStyle = rgb(lc, Math.min(1, a * 3)); x.beginPath(); x.ellipse(0, 0, small ? 7 : 6, small ? 3.5 : 3, 0, 0, 7); x.fill(); x.restore(); }
      else if (e.k === 'splash') { x.fillStyle = rgb(rc, .7 * a); x.beginPath(); x.arc(e.x, e.y, small ? 1.8 : 1.4, 0, 7); x.fill(); }
    });
  }
  function drawSun(day, sc) {
    if (!day) { drawMoon(S.p[0], S.p[1]); return; }
    var g2 = x.createRadialGradient(S.p[0] - RAD * .38, S.p[1] - RAD * .38, RAD * .08, S.p[0], S.p[1], RAD);
    g2.addColorStop(0, 'rgba(255,255,250,1)'); g2.addColorStop(.35, rgb(mixc(sc, [255, 255, 255], .3))); g2.addColorStop(1, rgb(mixc(sc, [210, 80, 20], .35)));
    x.fillStyle = g2; x.beginPath(); x.arc(S.p[0], S.p[1], RAD, 0, 7); x.fill();
  }
  // Tonight's real moon: a dim disc with the lit part drawn by phase (waxing lit on the right).
  function drawMoon(mx, my) {
    var p = moonPhase(), r = RAD, waning = p > .5, k = Math.cos(2 * Math.PI * (waning ? 1 - p : p));
    x.save(); x.translate(mx, my);
    x.fillStyle = 'rgba(58,64,84,.92)'; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
    if (waning) x.scale(-1, 1);
    var g = x.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, 'rgb(252,252,246)'); g.addColorStop(1, 'rgb(192,197,208)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); x.ellipse(0, 0, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0); x.fill();
    x.restore();
  }
  function drawSign(fg) {
    if (!sign) return;
    var a = Math.max(0, Math.min(1, (420 - sign.life) / 30, sign.life / 40));
    var rx = Math.max(EDGE * .5, L[0].hx - L[0].w / 2 - (small ? 40 : 34)), ry = G - 8 + Math.sin(tick * .2) * 1;
    x.globalAlpha = a;
    x.save(); x.translate(rx, ry); x.rotate(-Math.PI / 2); x.fillStyle = fg; x.beginPath(); x.moveTo(8, 0); x.lineTo(-6, 6); x.lineTo(-6, -6); x.closePath(); x.fill(); x.restore();
    x.strokeStyle = '#6b5a45'; x.lineWidth = 2; x.beginPath(); x.moveTo(rx, ry - 6); x.lineTo(rx, ry - 50); x.stroke();
    x.font = (small ? '22px ' : '15px ') + FONT; var tw = x.measureText(sign.t).width + 18, bh = small ? 34 : 26, bx = Math.max(6, rx - tw / 2), by = ry - 50 - bh;
    x.fillStyle = '#F1EFE8'; x.strokeStyle = '#2C2C2A'; x.lineWidth = 1.5; x.beginPath(); x.roundRect(bx, by, tw, bh, 4); x.fill(); x.stroke();
    x.fillStyle = '#2C2C2A'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sign.t, bx + tw / 2, by + bh / 2 + 1); x.textBaseline = 'alphabetic';
    x.globalAlpha = 1;
  }
  function drawBadge() {
    if (!badge) return;
    var a = Math.max(0, Math.min(1, badge.life / 40, (300 - badge.life) / 20)), bh = small ? 42 : 30;
    x.globalAlpha = a; x.font = (small ? '21px ' : '14px ') + MONO;
    var bw = x.measureText(badge.t).width + bh * 1.4, bx = 16, by = 16;
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.roundRect(bx, by, bw, bh, bh / 2); x.fill();
    x.fillStyle = '#E8A23A'; x.beginPath(); x.arc(bx + bh * .5, by + bh / 2, bh * .18, 0, 7); x.fill();
    x.fillStyle = '#22231f'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(badge.t, bx + bh * .9, by + bh / 2 + 1); x.textBaseline = 'alphabetic';
    x.globalAlpha = 1;
  }
  function draw() {
    var s = sunAt(hourNow()), pal = palette(s), day = s.day, ov = WX.over;
    // Overcast and stormy skies go grey.
    var grey = mixc([34, 38, 46], [150, 158, 168], pal.lum);
    var top = mixc(pal.top, grey, ov * .6), hor = mixc(pal.hor, mixc(grey, [235, 238, 242], .25), ov * .6);
    var snowCol = mixc([150, 158, 178], [244, 247, 251], pal.lum);
    var sky = x.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, rgb(top)); sky.addColorStop(1, rgb(hor)); x.fillStyle = sky; x.fillRect(0, 0, W, G);
    if (pal.lum < .5) for (var i = 0; i < 80; i++) { x.fillStyle = 'rgba(255,255,255,' + ((1 - pal.lum * 2) * (1 - ov) * (.2 + ((i * 37) % 10) / 14)) + ')'; x.fillRect((i * 211) % W, (i * 97) % (G - 90), 2, 2); }
    var sc = day ? pal.sun : [200, 210, 235]; sunCol = sc; var glowR = day ? RAD * (pal.el < .2 ? 10 : 7) : RAD * 5, ga = (day ? (pal.el < .2 ? .55 : .4) : .18) * (1 - ov * .75);
    var glow = x.createRadialGradient(S.p[0], S.p[1], RAD * .6, S.p[0], S.p[1], glowR); glow.addColorStop(0, rgb(sc, ga)); glow.addColorStop(1, rgb(sc, 0)); x.fillStyle = glow; x.fillRect(0, 0, W, G);
    // Resting in the sky, the sun sits behind the clouds; once thrown it flies in front of everything.
    var behind = S.st === 'sky' && !pull;
    // Under a grey sky the sun (or moon) is only a pale disc behind the cloud.
    if (behind) { x.globalAlpha = 1 - ov * .7; drawSun(day, sc); x.globalAlpha = 1; }
    cloudCol = mixc(mixc(mixc([60, 66, 98], [255, 255, 255], pal.lum), sc, .15), grey, WX.rain || WX.snow ? .5 : ov * .35);
    drawClouds(pal, ov);
    drawGround(pal, sc, day, snowCol);
    drawTree(pal, snowCol);
    drawRain(pal);
    if (pull) {
      var a = pull.anchor, t = pull.d / MAXPULL; x.strokeStyle = rgb(day ? [90, 60, 30] : [200, 210, 235], .55); x.lineWidth = 5 - 3 * t;
      [-24, 24].forEach(function (ox) { x.beginPath(); x.moveTo(a[0] + ox, a[1]); x.lineTo(S.p[0], S.p[1]); x.stroke(); });
      if (pull.moved) {
        var px = S.p[0], py = S.p[1], ddx = a[0] - S.p[0], ddy = a[1] - S.p[1], kk = t * MAXSPEED / (Math.hypot(ddx, ddy) || 1), vx = ddx * kk, vy = ddy * kk; x.fillStyle = 'rgba(255,255,255,.75)';
        for (var n = 0; n < 90; n++) { vy += GRAV; vx *= AIR; vy *= AIR; px += vx; py += vy; if (py > G || px < 0 || px > W) break; if (n % 4 === 0) { x.beginPath(); x.arc(px, py, 3 * (1 - n / 100), 0, 7); x.fill(); } }
        x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '18px ' + MONO; x.textAlign = 'center'; x.fillText(Math.round(t * 100) + '%', a[0], a[1] - RAD - 34);
      }
    }
    drawFX(pal, false);
    var fg = pal.lum > .55 ? '#22231f' : '#F1EFE8';
    R.forEach(function (r) {
      x.save(); x.translate(r.x, r.y); x.rotate(r.a); x.fillStyle = r.up ? fg : teal; x.beginPath(); x.moveTo(8, 0); x.lineTo(-6, 6); x.lineTo(-6, -6); x.closePath(); x.fill();
      if (pal.lum < .4 && !asleep) { x.fillStyle = '#9FE1CB'; x.beginPath(); x.arc(8, 0, 2.5, 0, 7); x.fill(); } x.restore();
    });
    L.forEach(function (l) {
      x.save(); x.translate(l.x, l.y); x.rotate(l.r); x.fillStyle = isHome(l) ? fg : teal; x.font = 'bold ' + FS + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (day && isHome(l)) { x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowOffsetX = (l.x - S.p[0]) * .012; x.shadowOffsetY = 6; x.shadowBlur = 6; }
      x.fillText(l.ch, 0, 0);
      x.restore();
    });
    drawSign(fg);
    drawFX(pal, true);
    if (FLAKES.length) { x.fillStyle = rgb(snowCol, .92); x.beginPath(); FLAKES.forEach(function (f) { if (f.y < -5) return; x.moveTo(f.x + f.r, f.y); x.arc(f.x, f.y, f.r, 0, 7); }); x.fill(); }
    if (!behind) drawSun(day, sc);
    if (WX.fog) { var fc = mixc([70, 76, 90], [214, 218, 222], pal.lum), fg2 = x.createLinearGradient(0, 0, 0, H); fg2.addColorStop(0, rgb(fc, .3 * WX.fog)); fg2.addColorStop(.75, rgb(fc, .62 * WX.fog)); fg2.addColorStop(1, rgb(fc, .4 * WX.fog)); x.fillStyle = fg2; x.fillRect(0, 0, W, H); }
    if (flashT > 0) { x.fillStyle = 'rgba(255,255,255,' + (flashT * .45) + ')'; x.fillRect(0, 0, W, H); }
    if (bubble) {
      x.globalAlpha = Math.max(0, Math.min(1, bubble.life / 30)); x.font = (small ? '26px ' : '22px ') + FONT;
      var tw = x.measureText(bubble.t).width + 28, bx = Math.min(W - tw - 16, Math.max(16, S.p[0] - tw / 2)), by = S.p[1] + RAD + 18; if (by > G - 180) by = S.p[1] - RAD - 62;
      x.fillStyle = '#F1EFE8'; x.strokeStyle = '#2C2C2A'; x.lineWidth = 2; x.beginPath(); x.roundRect(bx, by, tw, small ? 50 : 44, 12); x.fill(); x.stroke(); x.fillStyle = '#2C2C2A'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(bubble.t, bx + 14, by + (small ? 25 : 22)); x.textBaseline = 'alphabetic'; x.globalAlpha = 1;
    }
    drawBadge();
  }

  var last = 0, acc = 0;
  function frame(now) {
    if (!alive) return;
    now = now || performance.now(); if (!last) last = now;
    acc += Math.min(100, now - last); last = now;
    var n = 0; while (acc >= STEP && n < 6) { update(); acc -= STEP; n++; }
    draw();
    if (!reduce) requestAnimationFrame(frame); else setTimeout(function () { requestAnimationFrame(frame); }, 250);
  }
  frame();
  function stop() { alive = false; ac.abort(); }
  stop.setSky = setSky;
  return stop;
}
