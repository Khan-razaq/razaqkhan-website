// Canvas scenes for the home page: the hero (sun, clouds, tree, the name on its
// robots) and the "Say salaam" swarm in the footer. Plain JS on purpose: it is
// one long animation loop. Each start* function returns a stop function.

export function startHero(c, FONT, MONO) {
  var alive = true, ac = new AbortController(), on = { signal: ac.signal };
  var x = c.getContext('2d'), W = c.width, H = c.height, small = W < 900;
  // Ground: a grass strip over a band of soil.
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
  function palette(h) {
    var morning = h < 12, el = Math.sin(Math.PI * (h - 6) / 12);
    var K = [[-1, [6, 10, 32], [24, 30, 70], [200, 205, 225]], [-.12, [16, 22, 68], [64, 46, 112], [220, 215, 235]], [0, [38, 56, 132], morning ? [250, 146, 126] : [248, 104, 50], morning ? [255, 160, 104] : [255, 108, 44]], [.15, [50, 106, 198], morning ? [252, 192, 136] : [250, 152, 80], morning ? [255, 192, 124] : [255, 146, 64]], [.45, [34, 116, 214], [116, 188, 240], [255, 230, 164]], [1, [22, 108, 220], [134, 200, 246], [255, 244, 210]]];
    var i = 0; while (i < K.length - 2 && el > K[i + 1][0]) i++;
    var a = K[i], b = K[i + 1], k = Math.max(0, Math.min(1, (el - a[0]) / (b[0] - a[0])));
    return { el: el, top: mixc(a[1], b[1], k), hor: mixc(a[2], b[2], k), sun: mixc(a[3], b[3], k), lum: Math.max(0, Math.min(1, (el + .08) * 2.2)) };
  }
  var isDay = function (h) { return Math.sin(Math.PI * (h - 6) / 12) > -0.04; };
  var spotFor = function (h) { var hh = isDay(h) ? h : (h + 12) % 24, el = Math.sin(Math.PI * (hh - 6) / 12); return [EDGE + 50 + (W - 2 * EDGE - 100) * Math.min(1, Math.max(0, (hh - 6) / 12)), Math.max(RAD + 20, G - 40 - Math.max(0, el) * (G - (small ? 260 : 170)))]; };

  // Fixed scenery: fine grain in the soil and grass blades along the top.
  var seed = 11, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  var PEB = [], BLADE = [];
  for (var pi = 0; pi < (small ? 220 : 340); pi++) PEB.push([rnd() * W, G + GRASS + rnd() * (H - G - GRASS), .6 + rnd() * 1.6, rnd()]);
  for (var bx = 0; bx < W; bx += small ? 3.5 : 3) BLADE.push([bx + rnd() * 3, 2 + rnd() * (small ? 8 : 6), (rnd() - .5) * 3, rnd()]);

  // The name, carried by robots.
  // On wider scenes the name sits in the space left of the tree; on phones it spans the width.
  // The tree's leaves reach about 88px either side of its trunk, so the name stops well short of them.
  var TREE_X = small ? W - 44 : W - 130, LEFT = EDGE, RIGHT = small ? W - EDGE : TREE_X - 135;
  var word = 'RAZAQ KHAN', FS = 110;
  x.font = 'bold ' + FS + 'px ' + FONT; while (x.measureText(word).width > RIGHT - LEFT && FS > 30) { FS -= 2; x.font = 'bold ' + FS + 'px ' + FONT; }
  var LH = FS * .48, cx = (LEFT + RIGHT) / 2 - x.measureText(word).width / 2, L = [];
  for (var q = 0; q < word.length; q++) { var ch = word[q], w = x.measureText(ch).width; if (ch !== ' ') L.push({ ch: ch, w: w, hx: cx + w / 2, hy: G - 14 - LH, x: cx + w / 2, y: G - 14 - LH, vx: 0, vy: 0, r: 0, vr: 0, st: 'home', wait: 0 }); cx += w; }
  var PER = small ? 6 : 10, R = [];
  L.forEach(function (l, j) { for (var k = 0; k < PER; k++) { var off = (k - (PER - 1) / 2) * (l.w / PER); R.push({ j: j, off: off, hx: l.hx + off, hy: G - 8, x: l.hx + off, y: G - 8, a: -Math.PI / 2, vx: 0, vy: 0, up: true }); } });
  var REST_Y = G - LH + 2;

  // The tree: a spring at its base, so a hit makes it sway and settle.
  var T = { x: TREE_X, th: small ? 150 : 128, tw: small ? 14 : 12, cr: small ? 56 : 50, a: 0, va: 0 };
  var CAN = [[0, 0, 1], [-.62, .22, .7], [.62, .2, .72], [-.3, -.45, .68], [.34, -.42, .66], [0, .4, .62]];
  var treeAt = function (len) { return [T.x + Math.sin(T.a) * len, G - Math.cos(T.a) * len]; };
  var canopy = function () { return treeAt(T.th + T.cr * .15); };

  // Thin, flat clouds: soft overlapping blobs, squashed vertically (FLAT), with feathered edges.
  // They burst into mist when the sun hits them and fade back a while later.
  var FLAT = .55;
  var PUFF = [[-1.25, .08, .3], [-.85, 0, .42], [-.42, -.08, .5], [0, -.14, .56], [.42, -.06, .48], [.84, .02, .4], [1.22, .08, .28], [-.2, .12, .38], [.3, .14, .36], [-.62, .14, .3], [.7, .14, .3]];
  var mkCloud = function (fx, fy, s, vx) { return { x: W * fx, y: H * fy, s: s * (small ? 78 : 74), vx: vx, a: 1, st: 'on', t: 0 }; };
  var CL = small ? [mkCloud(.26, .14, 1, .1), mkCloud(.7, .3, .8, .07)] : [mkCloud(.24, .16, 1, .12), mkCloud(.64, .1, .8, .08)];

  var S = { p: spotFor(hourNow()), v: [0, 0], st: 'sky', t: 0, from: null, still: 0, ghost: false };
  var FX = [], ptr = null, pull = null, bubble = null, sunCol = [255, 240, 200], cloudCol = [255, 255, 255], tick = 0;
  var P = function (e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };

  function dust(px, py, s, nx, ny) { s = Math.max(.15, Math.min(1, s)); var base = Math.atan2(ny, nx); for (var i = 0; i < Math.round(5 + 10 * s); i++) { var a = base + (Math.random() - .5) * 2.2, v = 1.2 + 4.5 * s * Math.random(); FX.push({ k: 'dust', x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, sz: 2 + 3.2 * Math.random() }); } }
  function flash(px, py, s) { s = Math.max(.2, Math.min(1, s)); FX.push({ k: 'flash', x: px, y: py, r: RAD * (1.1 + 1.8 * s), life: 1, col: sunCol.slice() }); }
  function leaves(px, py, s) { var n = Math.round(3 + s * .5); for (var i = 0; i < n; i++) FX.push({ k: 'leaf', x: px + (Math.random() - .5) * 30, y: py + (Math.random() - .5) * 30, vx: (Math.random() - .5) * 3, vy: -Math.random() * 2, life: 1, rot: Math.random() * 6, vr: (Math.random() - .5) * .2, ph: Math.random() * 6 }); }
  function burst(cl) {
    cl.st = 'gone'; cl.t = 0; cl.a = 0;
    PUFF.forEach(function (p) {
      var px = cl.x + p[0] * cl.s, py = cl.y + p[1] * cl.s * FLAT, pr = p[2] * cl.s;
      for (var k = 0; k < (small ? 7 : 9); k++) { var ang = Math.random() * 6.283, rr = Math.random() * pr, ox = Math.cos(ang) * rr, oy = Math.sin(ang) * rr * FLAT; FX.push({ k: 'puff', x: px + ox, y: py + oy, vx: ox / pr * (.6 + Math.random() * 1.2) + S.v[0] * .12, vy: oy / pr * (.4 + Math.random() * .8) + S.v[1] * .06, life: 1, fade: .006 + Math.random() * .008, sz: pr * (.35 + Math.random() * .35) }); }
    });
  }
  function knock(l, vx, vy, spin) { l.st = 'fall'; l.vx = vx; l.vy = vy; l.vr = spin; l.wait = 50; var j = L.indexOf(l); R.forEach(function (r) { if (r.j === j) { r.vx = (Math.random() - .5) * 12; r.vy = -Math.random() * 6; } }); }
  function sayTime() { var n = new Date(), tm = n.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), h = n.getHours(); var tag = h < 5 ? 'Still night. Go to sleep.' : h < 8 ? 'Rising slowly.' : h < 12 ? 'Morning shift.' : h < 15 ? 'Peak hours.' : h < 18 ? 'Golden hour soon.' : h < 20 ? 'Setting off for the day.' : 'Moon shift now.'; bubble = { t: "It's " + tm + '. ' + tag, life: 200 }; }

  function treeHit() {
    var cc = canopy(), cr = T.cr * .95, dx = S.p[0] - cc[0], dy = S.p[1] - cc[1], d = Math.hypot(dx, dy);
    if (d < RAD + cr) return { n: [dx / (d || 1), dy / (d || 1)], depth: RAD + cr - d, lever: 1 };
    var top = treeAt(T.th), bx = top[0] - T.x, by = top[1] - G;
    var tt = Math.max(0, Math.min(1, ((S.p[0] - T.x) * bx + (S.p[1] - G) * by) / (bx * bx + by * by)));
    var ex = S.p[0] - (T.x + bx * tt), ey = S.p[1] - (G + by * tt), e = Math.hypot(ex, ey);
    if (e < RAD + T.tw / 2) return { n: [ex / (e || 1), ey / (e || 1)], depth: RAD + T.tw / 2 - e, lever: tt };
    return null;
  }

  c.addEventListener('pointermove', function (e) { ptr = P(e); if (pull) { var a = pull.anchor, dx = ptr[0] - a[0], dy = ptr[1] - a[1], d = Math.hypot(dx, dy); if (d > MAXPULL) { dx *= MAXPULL / d; dy *= MAXPULL / d; } pull.d = Math.min(d, MAXPULL); pull.moved = pull.moved || d > 8; S.p = [a[0] + dx, a[1] + dy]; } }, on);
  c.addEventListener('pointerleave', function () { ptr = null; }, on);
  c.addEventListener('pointerdown', function (e) {
    var p = P(e); ptr = p;
    if (S.st === 'sky' && Math.hypot(p[0] - S.p[0], p[1] - S.p[1]) < RAD + 28) { pull = { anchor: S.p.slice(), d: 0, moved: false }; c.style.cursor = 'grabbing'; c.setPointerCapture(e.pointerId); return; }
    var cc = canopy(); if (Math.hypot(p[0] - cc[0], p[1] - cc[1]) < T.cr * 1.1) { T.va += (p[0] < cc[0] ? 1 : -1) * .025; leaves(p[0], p[1], 4); return; }
    // Only a tap on the name itself (with a small margin) knocks it down; sky, clouds and ground do nothing.
    var PAD = small ? 18 : 12, onName = L.some(function (l) { return Math.abs(p[0] - l.x) < l.w / 2 + PAD && Math.abs(p[1] - l.y) < LH + PAD; });
    if (onName && L.every(function (l) { return l.st === 'home' || l.st === 'wobble'; })) { L.forEach(function (l) { knock(l, (p[0] < l.x ? 1 : -1) * (8 + Math.random() * 10), -14 - Math.random() * 8, (Math.random() - .5) * .5); }); flash(p[0], p[1], .6); }
  }, on);
  c.addEventListener('pointerup', function () {
    c.style.cursor = 'grab'; if (!pull) return; var a = pull.anchor;
    if (!pull.moved) { S.p = a.slice(); sayTime(); pull = null; return; }
    var dx = a[0] - S.p[0], dy = a[1] - S.p[1], k = (pull.d / MAXPULL) * MAXSPEED / (Math.hypot(dx, dy) || 1);
    S.v = [dx * k, dy * k]; S.st = 'fly'; S.t = 0; S.still = 0; S.ghost = !!treeHit(); pull = null;
  }, on);

  function hitLetters() {
    var r = RAD;
    L.forEach(function (l) {
      if (l.st !== 'home' && l.st !== 'wobble') return;
      var dx = S.p[0] - l.x, dy = S.p[1] - l.y, ox = l.w / 2 + r - Math.abs(dx), oy = LH + r - Math.abs(dy); if (ox <= 0 || oy <= 0) return;
      var nx = ox < oy ? Math.sign(dx) : 0, ny = ox < oy ? 0 : Math.sign(dy), vn = S.v[0] * nx + S.v[1] * ny; if (vn >= 0) return; var impact = -vn;
      if (impact > 7) knock(l, S.v[0] * .75, Math.min(-6, S.v[1] * .5) - impact * .45, (Math.random() - .5) * impact * .03); else { l.st = 'wobble'; l.vr += (nx || (Math.random() - .5)) * impact * .012; }
      flash(S.p[0] - nx * r, S.p[1] - ny * r, impact / MAXSPEED); S.v[0] -= (1 + REST) * vn * nx; S.v[1] -= (1 + REST) * vn * ny; S.v[0] *= .88; S.v[1] *= .88;
    });
  }
  function hitTree() {
    var hit = treeHit();
    if (S.ghost) { if (!hit) S.ghost = false; return; }
    if (!hit) return;
    var n = hit.n; S.p[0] += n[0] * hit.depth; S.p[1] += n[1] * hit.depth;
    var vn = S.v[0] * n[0] + S.v[1] * n[1]; if (vn >= 0) return;
    var impact = -vn;
    // The tree takes the hit: it sways by how hard and how high it was struck...
    T.va += -n[0] * impact * .0022 * (.35 + .65 * hit.lever);
    if (impact > 2) {
      // ...and stops the sun dead, leaving only a small bounce back.
      var back = Math.min(1.5, impact * .06);
      S.v[0] = S.v[0] * .08 + n[0] * back; S.v[1] = S.v[1] * .08 + n[1] * back;
      leaves(S.p[0] - n[0] * RAD, S.p[1] - n[1] * RAD, impact);
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
      else { S.v[1] = 0; S.v[0] *= ROLL; }
    }
    hitLetters(); hitTree(); hitClouds();
    S.still = Math.hypot(S.v[0], S.v[1]) < .35 ? S.still + 1 : 0;
    if (S.still > 30) { S.st = 'rest'; S.t = 0; }
  }

  function update() {
    tick++;
    var home = spotFor(hourNow());
    if (S.st === 'fly') step();
    else if (S.st === 'rest') { S.t++; if (S.t > 50) { S.st = 'return'; S.t = 0; S.from = S.p.slice(); } }
    else if (S.st === 'return') { S.t++; var k = ease(Math.min(1, S.t / 110)); S.p = [lerp(S.from[0], home[0], k), lerp(S.from[1], home[1], k) - Math.sin(k * Math.PI) * 60]; if (k >= 1) S.st = 'sky'; }
    else if (S.st === 'sky' && !pull) S.p = home.slice();
    T.va += (Math.sin(tick * .02) * .01 - T.a) * .05; T.va *= .93; T.a = Math.max(-.25, Math.min(.25, T.a + T.va));
    CL.forEach(function (cl) {
      cl.x += cl.vx; if (cl.x - 1.3 * cl.s > W) cl.x = -1.3 * cl.s;
      if (cl.st === 'gone') { cl.t++; if (cl.t > 420) { cl.st = 'back'; cl.a = 0; } }
      else if (cl.st === 'back') { cl.a = Math.min(1, cl.a + .012); if (cl.a >= 1) cl.st = 'on'; }
    });
    for (var i = FX.length - 1; i >= 0; i--) {
      var e = FX[i];
      if (e.k === 'dust') { e.vy += .12; e.vx *= .97; e.x += e.vx; e.y = Math.min(G + 2, e.y + e.vy); e.life -= .028; }
      else if (e.k === 'flash') e.life -= .06;
      else if (e.k === 'puff') { e.vx *= .965; e.vy = e.vy * .965 - .006; e.x += e.vx; e.y += e.vy; e.life -= e.fade; }
      else if (e.k === 'leaf') { e.vy = Math.min(1.3, e.vy + .05); e.vx = e.vx * .96 + Math.sin(e.ph + tick * .09) * .07; e.x += e.vx; e.y += e.vy; e.rot += e.vr; if (e.y >= G - 2) { e.y = G - 2; e.vx *= .5; e.vy = 0; e.vr = 0; e.life -= .02; } else e.life -= .002; }
      if (e.life <= 0) FX.splice(i, 1);
    }
    if (bubble) { bubble.life--; if (bubble.life <= 0) bubble = null; }
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
      var l = L[r.j], up = l.st === 'home' || l.st === 'wobble', tx, ty; r.up = up;
      if (up) { tx = r.hx; ty = r.hy; } else if (l.wait > 0) { tx = r.x; ty = r.y; } else { tx = l.x + r.off; ty = G - 8; }
      r.vx += (tx - r.x) * .08; r.vy += (ty - r.y) * .08 + (r.y < G - 8 ? .45 : 0); r.vx *= .72; r.vy *= .72; r.x += r.vx; r.y = Math.min(G - 8, r.y + r.vy);
      var sp = Math.hypot(r.vx, r.vy), want = sp > .8 ? Math.atan2(r.vy, r.vx) : (ptr && up ? Math.atan2(ptr[1] - r.y, ptr[0] - r.x) : -Math.PI / 2); r.a = turn(r.a, want, .15);
    });
  }

  function drawClouds(pal) {
    var sh = mixc(cloudCol, pal.top, .45), base = pal.lum < .3 ? .32 : .5;
    CL.forEach(function (cl) {
      if (cl.st === 'gone' || cl.a <= 0) return;
      x.save(); x.translate(cl.x, cl.y); x.scale(1, FLAT);
      // A faint grey underside first, then the lit body; each blob fades to nothing at its edge.
      [[sh, cl.s * .16, .5], [cloudCol, 0, 1]].forEach(function (layer) {
        PUFF.forEach(function (p) {
          var px = p[0] * cl.s, py = p[1] * cl.s + layer[1], pr = p[2] * cl.s * 1.25, al = base * layer[2] * cl.a;
          var g = x.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, rgb(layer[0], al)); g.addColorStop(.55, rgb(layer[0], al * .6)); g.addColorStop(1, rgb(layer[0], 0));
          x.fillStyle = g; x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        });
      });
      x.restore();
    });
  }
  function drawGround(pal, sc, day) {
    var lum = pal.lum;
    // Muted, natural tones: olive grass fading into dark soil, no outlines, only fine grain.
    var g1 = mixc([20, 30, 18], [92, 118, 66], lum), g2 = mixc([18, 24, 15], [70, 88, 50], lum);
    var s1 = mixc([24, 20, 16], [88, 72, 54], lum), s2 = mixc([12, 10, 8], [48, 39, 30], lum);
    var sg = x.createLinearGradient(0, G, 0, H); sg.addColorStop(0, rgb(g1)); sg.addColorStop(GRASS / (H - G), rgb(g2)); sg.addColorStop(Math.min(.9, GRASS * 2.6 / (H - G)), rgb(s1)); sg.addColorStop(1, rgb(s2)); x.fillStyle = sg; x.fillRect(0, G, W, H - G);
    PEB.forEach(function (p) { x.fillStyle = rgb(p[3] > .5 ? [0, 0, 0] : [255, 240, 220], p[3] > .5 ? .14 : .06); x.fillRect(p[0], p[1], p[2], p[2]); });
    x.lineWidth = 1.1; BLADE.forEach(function (b) { x.strokeStyle = rgb(mixc(g1, g2, b[3]), .85); x.beginPath(); x.moveTo(b[0], G + 3); x.lineTo(b[0] + b[2], G + 2 - b[1]); x.stroke(); });
    var lit = x.createRadialGradient(S.p[0], G, 0, S.p[0], G, W * .5); lit.addColorStop(0, rgb(sc, day ? .14 : .05)); lit.addColorStop(1, rgb(sc, 0)); x.fillStyle = lit; x.fillRect(0, G, W, H - G);
  }
  function drawTree(pal) {
    var lum = pal.lum, bark = mixc([26, 21, 17], [74, 58, 44], lum), leaf = mixc([16, 26, 18], [52, 80, 46], lum), leafHi = mixc([24, 36, 24], [82, 112, 62], lum);
    x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(T.x + T.a * 40, G + 6, T.cr * .9, 7, 0, 0, 7); x.fill();
    var top = treeAt(T.th), mid = treeAt(T.th * .5), br = treeAt(T.th * .72);
    x.strokeStyle = rgb(bark); x.lineCap = 'round'; x.lineWidth = T.tw; x.beginPath(); x.moveTo(T.x, G + 4); x.quadraticCurveTo(T.x + (mid[0] - T.x) * .6, mid[1], top[0], top[1]); x.stroke();
    x.lineWidth = T.tw * .45; x.beginPath(); x.moveTo(br[0], br[1]); x.lineTo(br[0] - T.cr * .5, br[1] - T.cr * .45); x.moveTo(br[0], br[1] - 8); x.lineTo(br[0] + T.cr * .45, br[1] - T.cr * .55); x.stroke(); x.lineCap = 'butt';
    var cc = canopy(), pts = CAN.map(function (p) { return [cc[0] + p[0] * T.cr + Math.sin(T.a) * T.cr * .35 * (1 - p[1]), cc[1] + p[1] * T.cr, p[2] * T.cr]; });
    x.fillStyle = rgb(leaf); x.beginPath(); pts.forEach(function (p) { x.moveTo(p[0] + p[2], p[1] + 4); x.arc(p[0], p[1] + 4, p[2], 0, 7); }); x.fill();
    x.fillStyle = rgb(leafHi, .4); x.beginPath(); pts.forEach(function (p) { var hr = p[2] * .55; x.moveTo(p[0] - p[2] * .2 + hr, p[1] - p[2] * .25); x.arc(p[0] - p[2] * .2, p[1] - p[2] * .25, hr, 0, 7); }); x.fill();
  }
  function drawFX(pal) {
    var dc = mixc([60, 50, 40], [150, 128, 100], pal.lum), lc = mixc([28, 40, 26], [88, 116, 66], pal.lum);
    FX.forEach(function (e) {
      var a = Math.max(0, e.life);
      if (e.k === 'dust') { x.fillStyle = rgb(dc, .65 * a); x.beginPath(); x.arc(e.x, e.y, e.sz * (1.5 - a * .5), 0, 7); x.fill(); }
      else if (e.k === 'flash') { var g = x.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (1.2 - .2 * a)); g.addColorStop(0, rgb(mixc(e.col, [255, 255, 255], .5), .65 * a)); g.addColorStop(1, rgb(e.col, 0)); x.fillStyle = g; x.beginPath(); x.arc(e.x, e.y, e.r * 1.2, 0, 7); x.fill(); }
      else if (e.k === 'puff') { var pr = e.sz * (1.8 - .8 * a), pg = x.createRadialGradient(e.x, e.y, 0, e.x, e.y, pr); pg.addColorStop(0, rgb(cloudCol, .45 * a * a)); pg.addColorStop(1, rgb(cloudCol, 0)); x.fillStyle = pg; x.fillRect(e.x - pr, e.y - pr, pr * 2, pr * 2); }
      else if (e.k === 'leaf') { x.save(); x.translate(e.x, e.y); x.rotate(e.rot); x.fillStyle = rgb(lc, Math.min(1, a * 3)); x.beginPath(); x.ellipse(0, 0, small ? 7 : 6, small ? 3.5 : 3, 0, 0, 7); x.fill(); x.restore(); }
    });
  }
  function drawSun(day, sc) {
    var g2 = x.createRadialGradient(S.p[0] - RAD * .38, S.p[1] - RAD * .38, RAD * .08, S.p[0], S.p[1], RAD);
    if (day) { g2.addColorStop(0, 'rgba(255,255,250,1)'); g2.addColorStop(.35, rgb(mixc(sc, [255, 255, 255], .3))); g2.addColorStop(1, rgb(mixc(sc, [210, 80, 20], .35))); }
    else { g2.addColorStop(0, 'rgb(250,250,245)'); g2.addColorStop(.6, 'rgb(205,208,215)'); g2.addColorStop(1, 'rgb(140,145,160)'); }
    x.fillStyle = g2; x.beginPath(); x.arc(S.p[0], S.p[1], RAD, 0, 7); x.fill();
  }
  function draw() {
    var h = hourNow(), pal = palette(h), day = isDay(h);
    var sky = x.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, rgb(pal.top)); sky.addColorStop(1, rgb(pal.hor)); x.fillStyle = sky; x.fillRect(0, 0, W, G);
    if (pal.lum < .5) for (var i = 0; i < 80; i++) { x.fillStyle = 'rgba(255,255,255,' + ((1 - pal.lum * 2) * (.2 + ((i * 37) % 10) / 14)) + ')'; x.fillRect((i * 211) % W, (i * 97) % (G - 90), 2, 2); }
    var sc = day ? pal.sun : [200, 210, 235]; sunCol = sc; var glowR = day ? RAD * (pal.el < .2 ? 10 : 7) : RAD * 5, ga = day ? (pal.el < .2 ? .55 : .4) : .18;
    var glow = x.createRadialGradient(S.p[0], S.p[1], RAD * .6, S.p[0], S.p[1], glowR); glow.addColorStop(0, rgb(sc, ga)); glow.addColorStop(1, rgb(sc, 0)); x.fillStyle = glow; x.fillRect(0, 0, W, G);
    // Resting in the sky, the sun sits behind the clouds; once thrown it flies in front of everything.
    var behind = S.st === 'sky' && !pull;
    if (behind) drawSun(day, sc);
    cloudCol = mixc(mixc([60, 66, 98], [255, 255, 255], pal.lum), sc, .15);
    drawClouds(pal);
    drawGround(pal, sc, day);
    drawTree(pal);
    if (pull) {
      var a = pull.anchor, t = pull.d / MAXPULL; x.strokeStyle = rgb(day ? [90, 60, 30] : [200, 210, 235], .55); x.lineWidth = 5 - 3 * t;
      [-24, 24].forEach(function (ox) { x.beginPath(); x.moveTo(a[0] + ox, a[1]); x.lineTo(S.p[0], S.p[1]); x.stroke(); });
      if (pull.moved) {
        var px = S.p[0], py = S.p[1], ddx = a[0] - S.p[0], ddy = a[1] - S.p[1], kk = t * MAXSPEED / (Math.hypot(ddx, ddy) || 1), vx = ddx * kk, vy = ddy * kk; x.fillStyle = 'rgba(255,255,255,.75)';
        for (var n = 0; n < 90; n++) { vy += GRAV; vx *= AIR; vy *= AIR; px += vx; py += vy; if (py > G || px < 0 || px > W) break; if (n % 4 === 0) { x.beginPath(); x.arc(px, py, 3 * (1 - n / 100), 0, 7); x.fill(); } }
        x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '18px ' + MONO; x.textAlign = 'center'; x.fillText(Math.round(t * 100) + '%', a[0], a[1] - RAD - 34);
      }
    }
    drawFX(pal);
    var fg = pal.lum > .55 ? '#22231f' : '#F1EFE8';
    R.forEach(function (r) {
      x.save(); x.translate(r.x, r.y); x.rotate(r.a); x.fillStyle = r.up ? fg : teal; x.beginPath(); x.moveTo(8, 0); x.lineTo(-6, 6); x.lineTo(-6, -6); x.closePath(); x.fill();
      if (pal.lum < .4) { x.fillStyle = '#9FE1CB'; x.beginPath(); x.arc(8, 0, 2.5, 0, 7); x.fill(); } x.restore();
    });
    L.forEach(function (l) {
      x.save(); x.translate(l.x, l.y); x.rotate(l.r); x.fillStyle = (l.st === 'home' || l.st === 'wobble') ? fg : teal; x.font = 'bold ' + FS + 'px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (day && (l.st === 'home' || l.st === 'wobble')) { x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowOffsetX = (l.x - S.p[0]) * .012; x.shadowOffsetY = 6; x.shadowBlur = 6; }
      x.fillText(l.ch, 0, 0); x.restore();
    });
    if (!behind) drawSun(day, sc);
    if (bubble) {
      x.globalAlpha = Math.max(0, Math.min(1, bubble.life / 30)); x.font = (small ? '26px ' : '22px ') + FONT;
      var tw = x.measureText(bubble.t).width + 28, bx = Math.min(W - tw - 16, Math.max(16, S.p[0] - tw / 2)), by = S.p[1] + RAD + 18; if (by > G - 180) by = S.p[1] - RAD - 62;
      x.fillStyle = '#F1EFE8'; x.strokeStyle = '#2C2C2A'; x.lineWidth = 2; x.beginPath(); x.roundRect(bx, by, tw, small ? 50 : 44, 12); x.fill(); x.stroke(); x.fillStyle = '#2C2C2A'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(bubble.t, bx + 14, by + (small ? 25 : 22)); x.textBaseline = 'alphabetic'; x.globalAlpha = 1;
    }
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
  return function stop() { alive = false; ac.abort(); };
}

export function startSwarm(c, FONT, isDark) {
  var alive = true, ac = new AbortController(), on = { signal: ac.signal };
  var x = c.getContext('2d'), W = c.width, H = c.height, small = W < 900, teal = '#1D9E75';
  var o = document.createElement('canvas'); o.width = W; o.height = H; var ox = o.getContext('2d');
  ox.textAlign = 'center'; ox.textBaseline = 'middle';
  if (small) { ox.font = 'bold 150px ' + FONT; ox.fillText('Say', W / 2, H * .3); ox.fillText('salaam', W / 2, H * .7); }
  else { ox.font = 'bold 140px ' + FONT; ox.fillText('Say salaam', W / 2, H / 2); }
  var d = ox.getImageData(0, 0, W, H).data, T = [], gap = small ? 13 : 11;
  for (var j = 0; j < H; j += gap) for (var i = 0; i < W; i += gap) if (d[(j * W + i) * 4 + 3] > 120) T.push([i, j]);
  var onWords = function (px, py) { for (var dy = -14; dy <= 14; dy += 7) for (var dx = -14; dx <= 14; dx += 7) { var a = Math.round(px + dx), b = Math.round(py + dy); if (a >= 0 && b >= 0 && a < W && b < H && d[(b * W + a) * 4 + 3] > 120) return true; } return false; };
  var A = T.map(function (t) { return { x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, a: Math.random() * 6, t: t }; }), ptr = null, tt = 0;
  // The robots fly in and form the words when the footer scrolls into view, not
  // on page load (when it is still off screen). Leaving view scatters them again,
  // so they re-form every time you come back down.
  var seen = false;
  var scatter = function () { A.forEach(function (a) { a.x = Math.random() * W; a.y = Math.random() * H; a.vx = 0; a.vy = 0; a.a = Math.random() * 6; }); };
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio >= .35) { if (!seen) { seen = true; } } else if (!e.isIntersecting && seen) { seen = false; scatter(); } }); }, { threshold: [0, .35] });
  io.observe(c);
  ac.signal.addEventListener('abort', function () { io.disconnect(); });
  var P = function (e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  c.addEventListener('pointermove', function (e) { ptr = P(e); }, on);
  c.addEventListener('pointerdown', function (e) { ptr = P(e); }, on);
  c.addEventListener('pointerleave', function () { ptr = null; }, on);
  var turn = function (a, b, k) { var dd = b - a; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); return a + dd * k; };
  function frame() {
    if (!alive) return; tt += .02; x.clearRect(0, 0, W, H);
    var ink = isDark() ? '#EEECE6' : '#1C1D1A', over = ptr && onWords(ptr[0], ptr[1]);
    A.forEach(function (a) {
      // Until the footer is in view they hold their scattered places, drifting a little.
      if (seen) { a.vx += (a.t[0] - a.x) * .012; a.vy += (a.t[1] - a.y) * .012; }
      else { a.vx += Math.sin(tt * 2 + a.t[1] * .05) * .02; a.vy += Math.cos(tt * 2 + a.t[0] * .05) * .02; }
      if (over) { var dx = a.x - ptr[0], dy = a.y - ptr[1], dd = Math.hypot(dx, dy) || 1; if (dd < 120) { a.vx += dx / dd * 3.4; a.vy += dy / dd * 3.4; } }
      a.vx *= .86; a.vy *= .86; a.x += a.vx; a.y += a.vy; var sp = Math.hypot(a.vx, a.vy);
      var want = sp > 1.2 ? Math.atan2(a.vy, a.vx) : (ptr ? Math.atan2(ptr[1] - a.y, ptr[0] - a.x) : -Math.PI / 2 + Math.sin(tt + a.t[0] * .01) * .5); a.a = turn(a.a, want, sp > 1.2 ? .3 : .12);
      var s = small ? 1.25 : 1;
      x.save(); x.translate(a.x, a.y); x.rotate(a.a); x.fillStyle = sp > 1.5 ? teal : ink; x.beginPath(); x.moveTo(7 * s, 0); x.lineTo(-5 * s, 5 * s); x.lineTo(-5 * s, -5 * s); x.closePath(); x.fill(); x.restore();
    });
    requestAnimationFrame(frame);
  }
  frame();
  return function stop() { alive = false; ac.abort(); };
}
