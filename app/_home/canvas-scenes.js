// The "Say salaam" swarm in the footer: small robots that form the words and
// scatter from your pointer. Returns a stop function. (The hero lives in hero-scene.js.)

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
