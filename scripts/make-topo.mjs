// Generates public/topo.svg: a seamless 1024×1024 topographic contour tile used as the home page
// background (through a CSS mask, so its colour follows the theme).
//
// The terrain is a sum of sine waves whose periods divide the tile, so it repeats without seams.
// Contours are traced with marching squares and joined into polylines. Every fifth level is an
// "index" contour, drawn at full strength; the others are lighter.
//
// Run: node scripts/make-topo.mjs
import { writeFileSync } from "node:fs";

const TILE = 1024, STEP = 8, N = TILE / STEP;
const P = (2 * Math.PI) / TILE;
const WAVES = [
  [1, 2, 0.9, 0.3], [-2, 1, 0.7, 1.7], [3, -1, 0.5, 2.2], [1, 4, 0.35, 0.8], [-3, -3, 0.3, 4.1], [5, 2, 0.22, 2.9], [-1, 6, 0.15, 5.2],
];
const h = (x, y) => WAVES.reduce((s, [kx, ky, a, ph]) => s + a * Math.sin(P * (kx * x + ky * y) + ph), 0);

const V = [];
for (let j = 0; j <= N; j++) { V.push([]); for (let i = 0; i <= N; i++) V[j].push(h(i * STEP, j * STEP)); }

const r = (v) => Math.round(v * 10) / 10;
const key = (p) => `${p[0]},${p[1]}`;

function trace(L) {
  const segs = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i];
      const k = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const X = i * STEP, Y = j * STEP, t = (p, q) => (L - p) / (q - p);
      const top = [r(X + STEP * t(a, b)), Y], right = [X + STEP, r(Y + STEP * t(b, c))];
      const bottom = [r(X + STEP * t(d, c)), Y + STEP], left = [X, r(Y + STEP * t(a, d))];
      const add = (p, q) => segs.push([p, q]);
      switch (k) {
        case 1: case 14: add(left, bottom); break;
        case 2: case 13: add(bottom, right); break;
        case 3: case 12: add(left, right); break;
        case 4: case 11: add(top, right); break;
        case 6: case 9: add(top, bottom); break;
        case 7: case 8: add(left, top); break;
        case 5: add(left, top); add(bottom, right); break;
        case 10: add(top, right); add(left, bottom); break;
      }
    }
  }
  // Join segments that share endpoints into polylines.
  const ends = new Map();
  segs.forEach((s, n) => { for (const p of s) { const kk = key(p); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(n); } });
  const used = new Uint8Array(segs.length), lines = [];
  const next = (p) => (ends.get(key(p)) || []).find((n) => !used[n]);
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const line = [segs[n][0], segs[n][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? line[line.length - 1] : line[0];
        const m = next(tip); if (m === undefined) break;
        used[m] = 1;
        const [p, q] = segs[m], other = key(p) === key(tip) ? q : p;
        if (dir) line.push(other); else line.unshift(other);
      }
    }
    lines.push(line);
  }
  return lines.map((ln) => "M" + ln.map((p) => `${p[0]} ${p[1]}`).join("L")).join("");
}

let index = "", minor = "", li = 0;
for (let L = -3; L <= 3.0001; L += 0.16, li++) {
  const d = trace(Math.round(L * 100) / 100);
  if (li % 5 === 0) index += d; else minor += d;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}" fill="none" stroke="#000" stroke-linejoin="round"><path d="${minor}" stroke-width="0.8" stroke-opacity="0.55"/><path d="${index}" stroke-width="1.1"/></svg>`;
writeFileSync(new URL("../public/topo.svg", import.meta.url), svg);
console.log(`public/topo.svg written: ${(svg.length / 1024).toFixed(0)} KB`);
