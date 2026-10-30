// Tower game – style C "diorama": a warm, hand-drawn cutaway like an illustrated cross-section.
// Paper tone, ink lines with a slight wobble (stable per world position, no flicker), watercolour
// washes, hatched slabs and shaft walls, brass cages with a folding gate, lamplight in the evening.
(function (root) {
  'use strict';
  const U = root.TowerRender.util;
  const INK = '#4a3526', PAPER = '#f2e8d2';
  const WALL = {
    office:     ['#c9d3bd', '#b3bea3'],
    condo:      ['#ecd09a', '#d9b77a'],
    restaurant: ['#e3a383', '#c98762'],
    skylobby:   ['#eadcbf', '#d6c4a0'],
    vacant:     ['#e6dcc8', '#d6cab2'],
    unreachable:['#dcc4b6', '#c8ab9c'],
  };
  const HEAT = { good: '#5b8fc9', ok: '#e6b34a', bad: '#c9483e', vacant: '#a39d94', unreachable: '#6e2b33', lobby: '#d8c8a8' };
  const CLOTH = ['#5f7896', '#8a6a8e', '#8c7b66', '#4f6b6b', '#7a5e4a', '#9a8a70'];
  const SKIN = ['#f0cfae', '#d8a982', '#ad7a55', '#7e5438'];
  const WAITC = ['#4f9a2e', '#f2a50f', '#dc2318'];
  const SKY = [[0, '#262842', '#433e60'], [5.5, '#262842', '#433e60'], [6.5, '#e3a786', '#f3dab4'], [8, '#a9c7d6', '#efe2c4'],
    [17, '#a9c7d6', '#efe2c4'], [18.5, '#d98a6a', '#f0c9a0'], [20, '#2f3050', '#544a6c'], [24, '#262842', '#433e60']];
  const serif = (rc, k, it) => `${it ? 'italic ' : ''}${Math.max(9, Math.round(rc.s * k))}px Georgia, "Times New Roman", serif`;

  // ---------- hand-drawn primitives ----------
  function amp(rc) { return Math.max(0.35, Math.min(1.4, rc.s * 0.035)); }
  function jit(rc, x, y, k) { return (U.hash(Math.round(x * 23), Math.round(y * 23), k) - 0.5) * 2 * amp(rc); }
  // path through world points; long edges get a wobbly midpoint
  function path(rc, pts, close) {
    const ctx = rc.ctx;
    ctx.beginPath();
    const P = pts.map(([x, y]) => [rc.sx(x) + jit(rc, x, y, 1), rc.sy(y) + jit(rc, x, y, 2)]);
    ctx.moveTo(P[0][0], P[0][1]);
    const n = close ? P.length : P.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % P.length], B = P[(i + 1) % P.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > 0.8 && rc.detail > 0) {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        ctx.quadraticCurveTo(rc.sx(mx) + jit(rc, mx, my, 3) * 1.6, rc.sy(my) + jit(rc, mx, my, 4) * 1.6, B[0], B[1]);
      } else ctx.lineTo(B[0], B[1]);
    }
    if (close) ctx.closePath();
  }
  function stroke(rc, w, col) { const c = rc.ctx; c.lineWidth = Math.max(0.8, rc.s * w); c.strokeStyle = col || INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  function box(rc, x, y, w, h, fill, lw, col) {
    path(rc, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
    if (fill) { rc.ctx.fillStyle = fill; rc.ctx.fill(); }
    if (lw) stroke(rc, lw, col);
  }
  function line(rc, x1, y1, x2, y2, lw, col) { path(rc, [[x1, y1], [x2, y2]]); stroke(rc, lw, col); }
  // watercolour wash: vertical gradient plus a darker pooled edge at the bottom
  function wash(rc, x, y, w, h, top, bottom) {
    const ctx = rc.ctx, g = ctx.createLinearGradient(0, rc.sy(y), 0, rc.sy(y + h));
    g.addColorStop(0, top); g.addColorStop(0.75, U.mix(top, bottom, 0.6)); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(rc.sx(x), rc.sy(y), w * rc.s, h * rc.s);
  }
  function hatch(rc, x, y, w, h, gap, col, lw) {
    const ctx = rc.ctx;
    ctx.save(); ctx.beginPath(); ctx.rect(rc.sx(x), rc.sy(y), w * rc.s, h * rc.s); ctx.clip();
    ctx.beginPath();
    for (let d = -h; d < w; d += gap) { ctx.moveTo(rc.sx(x + d), rc.sy(y + h)); ctx.lineTo(rc.sx(x + d + h), rc.sy(y)); }
    ctx.lineWidth = Math.max(0.6, rc.s * (lw || 0.025)); ctx.strokeStyle = col || 'rgba(74,53,38,.45)'; ctx.stroke();
    ctx.restore();
  }
  function circle(rc, x, y, r, fill, lw) {
    const ctx = rc.ctx; ctx.beginPath(); ctx.arc(rc.sx(x), rc.sy(y), Math.max(0.8, r * rc.s), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) stroke(rc, lw);
  }
  function glow(rc, x, y, r, a) {
    const ctx = rc.ctx, X = rc.sx(x), Y = rc.sy(y), g = ctx.createRadialGradient(X, Y, 0, X, Y, r * rc.s);
    g.addColorStop(0, `rgba(255,214,130,${a})`); g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g; ctx.fillRect(X - r * rc.s, Y - r * rc.s, 2 * r * rc.s, 2 * r * rc.s);
  }

  let grain = null;
  function grainPattern(ctx) {
    if (grain) return grain;
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(90,60,30,${0.05 + U.hash(i, 1, 1) * 0.12})`;
      g.fillRect(Math.floor(U.hash(i, 2, 2) * 96), Math.floor(U.hash(i, 3, 3) * 96), 1, 1);
    }
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = 'rgba(90,60,30,.06)'; g.beginPath();
      const x = U.hash(i, 4, 4) * 96, y = U.hash(i, 5, 5) * 96; g.moveTo(x, y); g.lineTo(x + 6, y + U.hash(i, 6, 6) * 3); g.stroke();
    }
    grain = ctx.createPattern(c, 'repeat');
    return grain;
  }

  // ---------- people ----------
  function look(id) { return { cloth: CLOTH[(U.hash(id, 1, 3) * CLOTH.length) | 0], skin: SKIN[(U.hash(id, 2, 3) * SKIN.length) | 0], hair: U.hash(id, 3, 3) < 0.5 ? '#3a2a1c' : '#7a5232' }; }
  function figure(rc, x, base, lk, opt) {
    opt = opt || {};
    const ctx = rc.ctx, s = rc.s, h = 0.82;
    const cloth = opt.cloth || lk.cloth;
    if (rc.detail === 0) { ctx.fillStyle = cloth; ctx.fillRect(rc.sx(x) - 1, rc.sy(base - h * 0.8), 2.2, h * 0.8 * s); return; }
    const seated = opt.seated;
    const bodyTop = base - (seated ? 0.62 : 0.6), bodyBot = base - (seated ? 0.3 : 0.2);
    if (!seated) { line(rc, x - 0.05, bodyBot - 0.02, x - 0.07, base, 0.045, '#3a2c22'); line(rc, x + 0.05, bodyBot - 0.02, x + 0.07, base, 0.045, '#3a2c22'); }
    path(rc, [[x - 0.1, bodyTop + 0.03], [x + 0.1, bodyTop + 0.03], [x + 0.14, bodyBot], [x - 0.14, bodyBot]], true);
    ctx.fillStyle = cloth; ctx.fill(); stroke(rc, 0.025);
    const hy = bodyTop - 0.1;
    circle(rc, x, hy, 0.1, lk.skin, 0.025);
    ctx.beginPath(); ctx.arc(rc.sx(x), rc.sy(hy), 0.1 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeStyle = lk.hair; ctx.stroke();
    if (opt.steam && rc.detail === 2) {       // little ink squiggle of annoyance
      ctx.beginPath(); const X = rc.sx(x), Y = rc.sy(hy - 0.2);
      ctx.moveTo(X - s * 0.08, Y); ctx.quadraticCurveTo(X - s * 0.04, Y - s * 0.1, X, Y); ctx.quadraticCurveTo(X + s * 0.04, Y + s * 0.1, X + s * 0.08, Y);
      ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeStyle = '#cc2f26'; ctx.stroke();
    }
  }

  // ---------- furniture (x0 = room left, fl = floor surface y, T = ceiling y; world units) ----------
  function win(rc, x, T, w, night) {
    box(rc, x, T + 0.16, w, 0.42, night ? '#3a3d5c' : '#cfe0e3', 0.025);
    line(rc, x + w / 2, T + 0.16, x + w / 2, T + 0.58, 0.02);
  }
  function office(rc, x0, w, T, fl, lit) {
    if (rc.detail === 2) for (let u = 0; u < w; u++) win(rc, x0 + u + 0.32, T, 0.36, rc.night);
    for (let u = 0; u < w; u++) {
      const x = x0 + u + 0.1;
      box(rc, x, fl - 0.44, 0.62, 0.06, '#a77b52', 0.025);
      line(rc, x + 0.06, fl - 0.38, x + 0.06, fl, 0.025); line(rc, x + 0.56, fl - 0.38, x + 0.56, fl, 0.025);
      if (rc.detail === 2) box(rc, x + 0.12, fl - 0.56, 0.2, 0.12, '#efe6d0', 0.02);   // paper stack
      line(rc, x + 0.46, fl - 0.44, x + 0.5, fl - 0.66, 0.02); line(rc, x + 0.5, fl - 0.66, x + 0.4, fl - 0.7, 0.02);   // desk lamp
      path(rc, [[x + 0.34, fl - 0.66], [x + 0.46, fl - 0.74], [x + 0.48, fl - 0.62]], true); rc.ctx.fillStyle = '#5f7a58'; rc.ctx.fill(); stroke(rc, 0.02);
      if (lit && rc.night) glow(rc, x + 0.42, fl - 0.6, 0.55, 0.55);
      line(rc, x + 0.82, fl - 0.62, x + 0.82, fl, 0.025); line(rc, x + 0.66, fl - 0.3, x + 0.84, fl - 0.3, 0.025);  // chair
    }
  }
  function condo(rc, x0, T, fl, lit) {
    if (rc.detail === 2) for (let i = 0; i < 12; i++) circle(rc, x0 + 0.15 + (i % 6) * 0.48 + (i > 5 ? 0.24 : 0), T + 0.25 + (i > 5 ? 0.3 : 0), 0.02, 'rgba(160,110,60,.35)');
    box(rc, x0 + 0.12, fl - 0.62, 0.06, 0.62, '#7a5232', 0.025);                // bed
    box(rc, x0 + 0.18, fl - 0.32, 1.0, 0.16, '#a77b52', 0.025);
    box(rc, x0 + 0.18, fl - 0.42, 1.0, 0.1, '#f4ecd8', 0.02);
    box(rc, x0 + 0.5, fl - 0.44, 0.68, 0.14, '#8a6a8e', 0.02);
    if (rc.detail === 2) box(rc, x0 + 1.05, T + 0.22, 0.42, 0.3, '#8fb0b8', 0.03, '#6a4a2c');   // picture
    line(rc, x0 + 1.58, fl, x0 + 1.58, fl - 0.78, 0.025);                       // floor lamp
    path(rc, [[x0 + 1.46, fl - 0.78], [x0 + 1.7, fl - 0.78], [x0 + 1.64, fl - 0.94], [x0 + 1.52, fl - 0.94]], true);
    rc.ctx.fillStyle = lit && rc.night ? '#ffe2a0' : '#e8d6a8'; rc.ctx.fill(); stroke(rc, 0.02);
    if (lit && rc.night) glow(rc, x0 + 1.58, fl - 0.82, 1.2, 0.6);
    path(rc, [[x0 + 2.0, fl - 0.06], [x0 + 2.0, fl - 0.56], [x0 + 2.14, fl - 0.6], [x0 + 2.18, fl - 0.34], [x0 + 2.74, fl - 0.34], [x0 + 2.8, fl - 0.5], [x0 + 2.88, fl - 0.42], [x0 + 2.86, fl - 0.06]], true);
    rc.ctx.fillStyle = '#5f7896'; rc.ctx.fill(); stroke(rc, 0.025);           // armchair
    if (rc.detail === 2) box(rc, x0 + 2.3, T + 0.2, 0.4, 0.28, rc.night ? '#3a3d5c' : '#cfe0e3', 0.025);  // small window
  }
  const TABLES = [0.75, 2.05, 3.35, 4.65];
  function restaurant(rc, x0, T, fl, lit) {
    for (const t of TABLES) {
      const x = x0 + t;
      line(rc, x, T, x, T + 0.32, 0.02);
      path(rc, [[x - 0.14, T + 0.42], [x + 0.14, T + 0.42], [x + 0.08, T + 0.32], [x - 0.08, T + 0.32]], true); rc.ctx.fillStyle = '#c99a4a'; rc.ctx.fill(); stroke(rc, 0.02);
      if (lit) glow(rc, x, T + 0.5, 0.7, rc.night ? 0.6 : 0.25);
      path(rc, [[x - 0.32, fl - 0.42], [x + 0.32, fl - 0.42], [x + 0.36, fl - 0.24], [x - 0.36, fl - 0.24]], true);
      rc.ctx.fillStyle = '#f4ecd8'; rc.ctx.fill();
      if (rc.detail === 2) for (let i = 0; i < 4; i++) { rc.ctx.fillStyle = '#c8463a'; rc.ctx.fillRect(rc.sx(x - 0.3 + i * 0.16), rc.sy(fl - 0.41), 0.08 * rc.s, 0.08 * rc.s); }
      stroke(rc, 0.025);
      line(rc, x, fl - 0.24, x, fl, 0.03);
    }
    box(rc, x0 + 5.35, fl - 0.62, 0.55, 0.62, '#7a5232', 0.025);               // bar
    if (rc.detail === 2) for (let i = 0; i < 3; i++) box(rc, x0 + 5.42 + i * 0.16, T + 0.3, 0.07, 0.22, ['#5f7a58', '#8a3a2a', '#c99a4a'][i], 0.015);
    line(rc, x0 + 5.35, T + 0.52, x0 + 5.95, T + 0.52, 0.025);
  }
  function plant(rc, x, fl, big) {
    const k = big ? 1.4 : 1;
    path(rc, [[x - 0.14 * k, fl - 0.3 * k], [x + 0.14 * k, fl - 0.3 * k], [x + 0.1 * k, fl], [x - 0.1 * k, fl]], true);
    rc.ctx.fillStyle = '#b4643a'; rc.ctx.fill(); stroke(rc, 0.025);
    for (let i = -2; i <= 2; i++) {
      path(rc, [[x, fl - 0.3 * k], [x + i * 0.14 * k, fl - (0.62 + (2 - Math.abs(i)) * 0.12) * k], [x + i * 0.2 * k, fl - (0.5 + (2 - Math.abs(i)) * 0.06) * k]], true);
      rc.ctx.fillStyle = i % 2 ? '#6f8f4e' : '#5a7a3e'; rc.ctx.fill(); stroke(rc, 0.018);
    }
  }
  function sign(rc, x, y, text, col) {
    const ctx = rc.ctx; ctx.font = serif(rc, 0.36, true);
    const w = ctx.measureText(text).width / rc.s + 0.24;
    line(rc, x + 0.08, y - 0.18, x + 0.08, y, 0.015); line(rc, x + w - 0.08, y - 0.18, x + w - 0.08, y, 0.015);
    box(rc, x, y, w, 0.34, '#f4ecd8', 0.025);
    ctx.fillStyle = col || INK; ctx.fillText(text, rc.sx(x + 0.12), rc.sy(y + 0.18));
  }

  const style = {
    id: 'diorama', label: 'C · Diorama',

    sky(rc) {
      const ctx = rc.ctx, [a, b] = U.skyColors(rc.t, SKY);
      const g = ctx.createLinearGradient(0, 0, 0, rc.cssH);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, rc.cssW, rc.cssH);
      if (rc.night) {
        const X = rc.cssW * 0.82, Y = Math.min(rc.cssH * 0.18, 60), R = Math.max(8, rc.s * 0.6);
        const gl = ctx.createRadialGradient(X, Y, 0, X, Y, R * 4); gl.addColorStop(0, 'rgba(255,240,200,.35)'); gl.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = gl; ctx.fillRect(X - R * 4, Y - R * 4, R * 8, R * 8);
        ctx.fillStyle = '#f4ecd0'; ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(244,236,208,.7)'; ctx.lineWidth = 1;
        for (let i = 0; i < 26; i++) { const x = U.hash(i, 7, 1) * rc.cssW, y = U.hash(i, 8, 1) * rc.cssH * 0.7, r = 1.5 + U.hash(i, 9, 1) * 1.5;
          ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke(); }
      } else {
        for (let i = 0; i < 4; i++) {
          const X = U.hash(i, 1, 9) * rc.cssW, Y = (0.1 + U.hash(i, 2, 9) * 0.45) * rc.cssH, R = (1.4 + U.hash(i, 3, 9)) * Math.max(14, rc.s);
          const gl = ctx.createRadialGradient(X, Y, 0, X, Y, R); gl.addColorStop(0, 'rgba(255,252,240,.55)'); gl.addColorStop(1, 'rgba(255,252,240,0)');
          ctx.save(); ctx.translate(X, Y); ctx.scale(2.2, 0.6); ctx.translate(-X, -Y); ctx.fillStyle = gl; ctx.fillRect(X - R, Y - R, 2 * R, 2 * R); ctx.restore();
        }
      }
    },

    ground(rc) {
      const x0 = rc.view.x, w = rc.cssW / rc.s + 1;
      wash(rc, x0, 0, w, 4, '#9a7a56', '#6a4c34');
      if (rc.detail > 0) {
        const ctx = rc.ctx;
        for (const [y, c] of [[0.55, 'rgba(74,53,38,.35)'], [1.2, 'rgba(74,53,38,.25)']]) {
          ctx.beginPath(); ctx.moveTo(rc.sx(x0), rc.sy(y));
          for (let x = x0; x < x0 + w; x += 0.8) ctx.quadraticCurveTo(rc.sx(x + 0.4), rc.sy(y + (U.hash(Math.round(x * 5), 1, 7) - 0.5) * 0.25), rc.sx(x + 0.8), rc.sy(y));
          ctx.lineWidth = 1; ctx.strokeStyle = c; ctx.stroke();
        }
        for (let x = Math.floor(x0); x < x0 + w; x += 0.37) {
          const hh = 0.12 + U.hash(Math.round(x * 10), 3, 3) * 0.12;
          line(rc, x, 0.02, x - 0.04, -hh, 0.02, '#4e6a2e'); line(rc, x + 0.06, 0.02, x + 0.12, -hh * 0.8, 0.02, '#4e6a2e');
        }
      }
      rc.rect(x0, 0, w, 0.12, '#7a9a4a');
      line(rc, x0, 0, x0 + w, 0, 0.03);
    },

    label(rc, f, text, lobby) {
      const ctx = rc.ctx, X = rc.sx(-0.8), Y = rc.sy(rc.floorTop(f) + rc.FH / 2);
      ctx.font = `italic ${Math.max(9, Math.min(13, Math.round(rc.s * 0.6)))}px Georgia, serif`; ctx.textAlign = 'center';
      if (lobby) {
        const r = Math.max(7, Math.min(11, rc.s * 0.42));
        ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = INK;
      } else ctx.fillStyle = rc.night ? '#e8dcc0' : '#4a3526';
      ctx.fillText(text, X, Y + 0.5);
      ctx.textAlign = 'left';
    },

    limit(rc, y) {
      const ctx = rc.ctx;
      ctx.strokeStyle = rc.night ? 'rgba(242,232,210,.6)' : 'rgba(74,53,38,.55)'; ctx.setLineDash([2, 5]); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rc.sx(0), rc.sy(y)); ctx.lineTo(rc.sx(rc.W), rc.sy(y)); ctx.stroke(); ctx.setLineDash([]);
    },

    lobby(rc, ex) {
      const T = rc.floorTop(0), fl = T + rc.FH - 0.16, W = rc.W;
      wash(rc, 0, T, W, rc.FH - 0.16, rc.heat ? HEAT.lobby : '#eddcb8', rc.heat ? HEAT.lobby : '#d8c296');
      if (rc.detail > 0) {
        for (let c = 2; c < W - 1; c += 4) {                 // arched windows on the back wall
          if (Math.abs(c - ex) < 2.5) continue;
          const ctx = rc.ctx;
          path(rc, [[c - 0.45, fl - 0.15], [c - 0.45, T + 0.55], [c, T + 0.2], [c + 0.45, T + 0.55], [c + 0.45, fl - 0.15]], true);
          ctx.fillStyle = rc.night ? '#3a3d5c' : '#d4e4e6'; ctx.fill(); stroke(rc, 0.03);
          line(rc, c, T + 0.25, c, fl - 0.15, 0.02);
        }
        for (const c of [4, 10, 16, 21]) {                    // chandeliers
          line(rc, c, T, c, T + 0.2, 0.02);
          path(rc, [[c - 0.2, T + 0.28], [c + 0.2, T + 0.28], [c, T + 0.2]], true); rc.ctx.fillStyle = '#d9a441'; rc.ctx.fill(); stroke(rc, 0.02);
          glow(rc, c, T + 0.35, 0.8, rc.night ? 0.6 : 0.3);
        }
        // revolving door in a brass frame
        box(rc, ex - 1.0, T + 0.28, 2.0, fl - T - 0.28, '#b8893a', 0.035);
        box(rc, ex - 0.85, T + 0.42, 1.7, fl - T - 0.42, rc.night ? '#4a4c68' : '#cfe3e6', 0.025);
        for (const k of [-0.45, 0, 0.45]) line(rc, ex + k, T + 0.42, ex + k * 0.6, fl, 0.025);
        path(rc, [[ex - 1.2, T + 0.28], [ex + 1.2, T + 0.28], [ex + 1.0, T + 0.12], [ex - 1.0, T + 0.12]], true); rc.ctx.fillStyle = '#8a3a2a'; rc.ctx.fill(); stroke(rc, 0.025);
        // reception desk + plants
        box(rc, ex + 4.2, fl - 0.55, 2.8, 0.55, '#8a5e3a', 0.03); box(rc, ex + 4.1, fl - 0.62, 3.0, 0.08, '#b98a5a', 0.025);
        plant(rc, ex - 2.2, fl, true); plant(rc, ex + 1.8, fl, true); plant(rc, 0.6, fl);
        // checkered floor
        const ctx = rc.ctx;
        for (let x = 0; x < W; x += 0.25) { ctx.fillStyle = (x * 4) % 2 ? '#3a2c22' : '#efe6d2'; ctx.fillRect(rc.sx(x), rc.sy(fl), 0.25 * rc.s + 0.5, 0.07 * rc.s); }
        if (rc.s * rc.FH >= 15) { ctx.font = serif(rc, 0.55, true); ctx.fillStyle = INK; ctx.fillText('Lobby', rc.sx(1.1), rc.sy(T + 0.5)); }
      } else rc.rect(ex - 1, T + 0.4, 2, rc.FH - 0.56, '#b8893a');
      style._slab(rc, 0, W, T + rc.FH);
      box(rc, 0, T, W, rc.FH, null, 0.035);
    },

    _slab(rc, x, w, bottom) {
      rc.ctx.fillStyle = '#b8ab96'; rc.ctx.fillRect(rc.sx(x), rc.sy(bottom - 0.16), w * rc.s, 0.16 * rc.s);
      if (rc.detail > 0) hatch(rc, x, bottom - 0.16, w, 0.16, 0.14, 'rgba(74,53,38,.55)');
      line(rc, x, bottom - 0.16, x + w, bottom - 0.16, 0.025);
    },

    room(rc, r, st) {
      const T = rc.floorTop(r.f), fl = T + rc.FH - 0.16, x0 = r.x, w = r.w;
      const vacant = st === 'vacant', unreach = st === 'unreachable', occ = !vacant && !unreach;
      const lit = r.inside > 0;
      const pal = WALL[occ ? r.type : st];
      wash(rc, x0, T, w, rc.FH - 0.16, pal[0], pal[1]);
      if (rc.detail > 0 && !(rc.heat && rc.detail === 1)) {
        if (occ) {
          if (r.type === 'office') office(rc, x0, w, T, fl, lit);
          else if (r.type === 'condo') condo(rc, x0, T, fl, lit);
          else if (r.type === 'restaurant') restaurant(rc, x0, T, fl, lit);
          else if (r.type === 'skylobby') {
            for (let c = 0.75; c < w; c += 1.5) {
              path(rc, [[x0 + c - 0.4, fl - 0.1], [x0 + c - 0.4, T + 0.55], [x0 + c, T + 0.22], [x0 + c + 0.4, T + 0.55], [x0 + c + 0.4, fl - 0.1]], true);
              rc.ctx.fillStyle = rc.night ? '#3a3d5c' : '#d4e4e6'; rc.ctx.fill(); stroke(rc, 0.025);
            }
            plant(rc, x0 + 0.5, fl, true); plant(rc, x0 + w - 0.5, fl, true);
            box(rc, x0 + 2.3, fl - 0.3, 1.4, 0.12, '#8a5e3a', 0.025); line(rc, x0 + 2.4, fl - 0.18, x0 + 2.4, fl, 0.025); line(rc, x0 + 3.6, fl - 0.18, x0 + 3.6, fl, 0.025);
          }
        } else {
          line(rc, x0 + 0.2, fl - 0.02, x0 + w - 0.2, fl - 0.02, 0.02, 'rgba(74,53,38,.4)');
          if (vacant && rc.detail === 2) {                      // paint bucket + ladder
            box(rc, x0 + w - 0.7, fl - 0.24, 0.24, 0.24, '#9aa3a8', 0.025);
            line(rc, x0 + w - 1.3, fl, x0 + w - 1.05, fl - 0.95, 0.025); line(rc, x0 + w - 1.0, fl, x0 + w - 0.75, fl - 0.95, 0.025);
            for (let k = 1; k < 4; k++) line(rc, x0 + w - 1.3 + k * 0.06, fl - k * 0.24, x0 + w - 1.0 + k * 0.06, fl - k * 0.24, 0.02);
          }
          if (unreach) hatch(rc, x0, T, w, rc.FH - 0.16, 0.22, 'rgba(140,40,30,.35)', 0.03);
        }
      }
      // people inside
      if (occ && lit && !rc.heat && rc.detail > 0) {
        const n = r.inside;
        if (r.type === 'office') {
          for (let i = 0; i < Math.min(n, w); i++) figure(rc, x0 + i + 0.78, fl - 0.04, look(r.id * 31 + i), { seated: true });
          for (let i = w; i < n; i++) figure(rc, x0 + w - 0.35 - (i - w) * 0.4, fl, look(r.id * 31 + i));
        } else if (r.type === 'condo') {
          const at = [[2.45, true], [1.25, false], [0.75, false]];
          for (let i = 0; i < Math.min(3, n); i++) figure(rc, x0 + at[i][0], at[i][1] ? fl - 0.08 : fl, look(r.id * 31 + i), { seated: at[i][1] });
        } else if (r.type === 'restaurant') {
          const seats = []; for (const t of TABLES) seats.push(t - 0.42, t + 0.42);
          for (let i = 0; i < n; i++) {
            if (i < seats.length) figure(rc, x0 + seats[i], fl - 0.02, look(r.id * 31 + i), { seated: true });
            else if (i < seats.length + 6) figure(rc, x0 + 0.4 + (i - seats.length) * 0.95 + (i % 2) * 0.2, fl, look(r.id * 31 + i));
          }
        }
      }
      // night: dark rooms get an ink-blue wash, lit rooms a warm tint
      if (rc.night && !rc.heat) {
        rc.ctx.fillStyle = lit && occ ? 'rgba(255,190,90,.12)' : 'rgba(34,36,70,.66)';
        rc.ctx.fillRect(rc.sx(x0), rc.sy(T), w * rc.s, (rc.FH - 0.16) * rc.s);
      }
      if (rc.heat) {
        rc.ctx.globalAlpha = rc.detail === 2 ? 0.78 : 0.92;
        wash(rc, x0, T, w, rc.FH - 0.16, HEAT[st] || pal[0], U.mix(HEAT[st] || pal[0], '#2a1a10', 0.25));
        rc.ctx.globalAlpha = 1;
      }
      style._slab(rc, x0, w, T + rc.FH);
      if (rc.detail > 0) { line(rc, x0, T, x0, T + rc.FH, 0.03); line(rc, x0 + w, T, x0 + w, T + rc.FH, 0.03); line(rc, x0, T, x0 + w, T, 0.03); }
      else { rc.ctx.strokeStyle = 'rgba(74,53,38,.7)'; rc.ctx.lineWidth = 0.7; rc.ctx.strokeRect(rc.sx(x0), rc.sy(T), w * rc.s, rc.FH * rc.s); }
      if (rc.s * rc.FH >= 15 && !rc.heat) {
        if (vacant) sign(rc, x0 + 0.3, T + 0.3, 'frei');
        if (unreach) sign(rc, x0 + 0.3, T + 0.3, 'kein Weg', '#a3291f');
        if (r.type === 'skylobby' && rc.detail === 2) { rc.ctx.font = serif(rc, 0.5, true); rc.ctx.fillStyle = INK; rc.ctx.fillText('Sky-Lobby', rc.sx(x0 + 1.9), rc.sy(T + 0.42)); }
      }
    },

    link(rc, kind, f, x, w) {
      const fb = rc.floorTop(f) + rc.FH - 0.16, ft = rc.floorTop(f + 1) + rc.FH - 0.16, ctx = rc.ctx;
      if (rc.detail === 0) { line(rc, x, fb, x + w, ft, 0.18, kind === 'stairs' ? '#8a5e3a' : '#6a6560'); return; }
      if (kind === 'stairs') {
        const n = 8, dw = w / n, dh = (fb - ft) / n;
        path(rc, [[x, fb], [x + w, ft], [x + w, ft + 0.22], [x + 0.25, fb]], true); ctx.fillStyle = '#7a5232'; ctx.fill(); stroke(rc, 0.025);
        for (let k = 0; k < n; k++) {
          const sx = x + k * dw, sy = fb - (k + 1) * dh;
          ctx.fillStyle = '#c4945e'; ctx.fillRect(rc.sx(sx), rc.sy(sy), dw * rc.s + 0.5, (dh + 0.02) * rc.s);
        }
        const pts = [[x, fb]]; for (let k = 0; k < n; k++) { pts.push([x + k * dw, fb - (k + 1) * dh]); pts.push([x + (k + 1) * dw, fb - (k + 1) * dh]); }
        path(rc, pts); stroke(rc, 0.025);
        line(rc, x + 0.05, fb - 0.62, x + w, ft - 0.62, 0.04, '#5a3a22');                   // banister
        for (let k = 1; k < n; k += 2) line(rc, x + (k + 0.5) * dw, fb - (k + 1) * dh, x + (k + 0.5) * dw, fb - (k + 0.5) * dh - 0.62, 0.02);
      } else {
        path(rc, [[x + 0.1, fb - 0.12], [x + w - 0.1, ft - 0.12], [x + w - 0.1, ft - 0.68], [x + 0.1, fb - 0.68]], true);
        ctx.fillStyle = 'rgba(205,228,232,.5)'; ctx.fill();
        path(rc, [[x, fb], [x + w, ft], [x + w, ft + 0.12], [x + 0.3, fb + 0.0]], true); ctx.fillStyle = '#5e5852'; ctx.fill(); stroke(rc, 0.025);
        for (let k = 1; k < 10; k++) { const xx = x + w * k / 10, yy = fb + (ft - fb) * k / 10; line(rc, xx, yy, xx, yy + 0.08, 0.015, '#d8d0c0'); }
        path(rc, [[x + 0.1, fb - 0.12], [x - 0.05, fb - 0.4], [x + 0.1, fb - 0.68], [x + w - 0.1, ft - 0.68], [x + w + 0.05, ft - 0.4], [x + w - 0.1, ft - 0.12]]);
        stroke(rc, 0.06, '#2a2420');
      }
    },

    shaft(rc, sh, serves) {
      const ex = sh.kind === 'express', f0 = Math.max(sh.f0, rc.fBot), f1 = Math.min(sh.f1, rc.fTop);
      const yT = rc.floorTop(f1), H = (f1 - f0 + 1) * rc.FH, x = sh.c;
      wash(rc, x + 0.06, yT, 0.88, H, ex ? '#5a3a2a' : '#5b4a3e', ex ? '#4a2c20' : '#4a3a30');
      if (rc.detail > 0) {
        hatch(rc, x + 0.06, yT, 0.1, H, 0.12, 'rgba(242,232,210,.35)');
        hatch(rc, x + 0.84, yT, 0.1, H, 0.12, 'rgba(242,232,210,.35)');
        line(rc, x + 0.42, yT, x + 0.42, yT + H, 0.012, 'rgba(242,232,210,.5)');
        line(rc, x + 0.58, yT, x + 0.58, yT + H, 0.012, 'rgba(242,232,210,.5)');
      }
      for (let f = f0; f <= f1; f++) {
        const T = rc.floorTop(f);
        if (!serves(f)) continue;
        rc.ctx.fillStyle = ex ? '#c87a3a' : '#c9a24e'; rc.ctx.fillRect(rc.sx(x + 0.06), rc.sy(T + rc.FH - 0.16), 0.88 * rc.s, 0.16 * rc.s);
        if (rc.detail === 2) {                              // floor indicator dial above the landing
          const cx = rc.sx(x + 0.5), cy = rc.sy(T + 0.12), r = rc.s * 0.12;
          rc.ctx.beginPath(); rc.ctx.arc(cx, cy, r, Math.PI, 0); rc.ctx.closePath(); rc.ctx.fillStyle = '#e8c86a'; rc.ctx.fill();
          rc.ctx.lineWidth = 1; rc.ctx.strokeStyle = INK; rc.ctx.stroke();
        }
      }
      line(rc, x + 0.06, yT, x + 0.06, yT + H, 0.03); line(rc, x + 0.94, yT, x + 0.94, yT + H, 0.03);
    },

    car(rc, sh, car, full) {
      const ex = sh.kind === 'express', x = sh.c + 0.14, w = 0.72;
      const top = -(car.y + 1) * rc.FH + 0.14, h = rc.FH - 0.3;
      const frame = ex ? '#a8582e' : '#c9a24e', gate = ex ? '#5a2a14' : '#7a5a22';
      if (rc.detail === 0) {
        rc.rect(x, top, w, h, frame);
        rc.rect(x, top + h * (1 - full), w, h * full, gate);
        return;
      }
      box(rc, x, top, w, h, frame, 0.03);
      box(rc, x + 0.07, top + 0.12, w - 0.14, h - 0.19, car.state === 'doors' ? '#f6e2b0' : '#e2c890', 0.02);
      path(rc, [[x + 0.02, top], [x + w / 2, top - 0.1], [x + w - 0.02, top]], true); rc.ctx.fillStyle = frame; rc.ctx.fill(); stroke(rc, 0.02);
      const shown = Math.round(full * 6), base = top + h - 0.08;
      for (let i = 0; i < shown; i++) {
        const row = i < 3 ? 0 : 1, k = i % 3, px = x + 0.16 + k * 0.2 + row * 0.1;
        const lk = look(sh.id * 13 + i);
        const by = base - row * 0.1;
        path(rc, [[px - 0.08, by - 0.36], [px + 0.08, by - 0.36], [px + 0.1, by], [px - 0.1, by]], true); rc.ctx.fillStyle = lk.cloth; rc.ctx.fill();
        circle(rc, px, by - 0.45, 0.075, lk.skin, 0.015);
      }
      const gx0 = x + 0.07, gx1 = x + w - 0.07, gy0 = top + 0.12, gy1 = top + h - 0.07;
      if (car.state === 'doors') {              // folded gate at both sides
        for (const gx of [gx0 + 0.02, gx0 + 0.06, gx1 - 0.06, gx1 - 0.02]) line(rc, gx, gy0, gx, gy1, 0.02, gate);
      } else {                                  // scissor gate across the opening
        const ctx = rc.ctx; ctx.beginPath();
        const n = 4, dx = (gx1 - gx0) / n;
        for (let i = 0; i <= n; i++) { ctx.moveTo(rc.sx(gx0 + i * dx), rc.sy(gy0)); ctx.lineTo(rc.sx(gx0 + i * dx), rc.sy(gy1)); }
        for (let i = 0; i < n; i++) {
          ctx.moveTo(rc.sx(gx0 + i * dx), rc.sy(gy0)); ctx.lineTo(rc.sx(gx0 + (i + 1) * dx), rc.sy(gy1));
          ctx.moveTo(rc.sx(gx0 + (i + 1) * dx), rc.sy(gy0)); ctx.lineTo(rc.sx(gx0 + i * dx), rc.sy(gy1));
        }
        ctx.lineWidth = Math.max(0.8, rc.s * 0.02); ctx.strokeStyle = gate; ctx.stroke();
      }
    },

    person(rc, x, f, o) {
      const base = rc.floorTop(f) + rc.FH - 0.16;
      const lk = look(o.id);
      if (o.mode === 'wait') figure(rc, x, base, lk, { cloth: WAITC[o.level], steam: o.level === 2 });
      else figure(rc, x, base, lk);
    },

    overflow(rc, text, x, f, dir) {
      const ctx = rc.ctx;
      ctx.font = `bold italic ${Math.max(10, Math.round(rc.s * 0.42))}px Georgia, serif`;
      const w = ctx.measureText(text).width / rc.s + 0.2;
      const X = dir < 0 ? x - w : x, Y = rc.floorTop(f) + 0.62;
      box(rc, X, Y, w, 0.42, '#f4ecd8', 0.025);
      ctx.fillStyle = '#a3291f'; ctx.fillText(text, rc.sx(X + 0.1), rc.sy(Y + 0.22));
    },

    post(rc) {
      const ctx = rc.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = grainPattern(ctx); ctx.fillRect(0, 0, rc.cssW, rc.cssH);
      const g = ctx.createRadialGradient(rc.cssW / 2, rc.cssH / 2, Math.min(rc.cssW, rc.cssH) * 0.45, rc.cssW / 2, rc.cssH / 2, Math.max(rc.cssW, rc.cssH) * 0.8);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,90,50,.18)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, rc.cssW, rc.cssH);
      ctx.restore();
    },
  };
  root.TowerStyles.diorama = style;
})(typeof window !== 'undefined' ? window : globalThis);
