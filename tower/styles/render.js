// Tower game – shared scene renderer for exchangeable drawing styles (design study TOWER-a0003).
//
// The renderer owns the scene order of index.html's draw(): sky, ground, floor labels, lobby,
// rooms, stairs/escalators, climbing people, shafts with cars and queues, walking people.
// A style module only answers "how does X look" via hooks (see STYLE_HOOKS below) and registers
// itself in window.TowerStyles[<id>]. The world is anything game-shaped: the real engine Game,
// or the fixed sample worlds of docs/design-study.html.
//
// World contract (subset of TowerEngine.Game):
//   t, W, entranceX, maxFloor, maxFloors, rooms[{type,f,x,w,inside}], links[{kind,f,x,w}],
//   shafts[{kind,c,f0,f1,cars[{y,pax[],state}],qUp[][],qDown[][]}] (queue entries {id,waitStart}),
//   walking/climbing (iterables of {id,x,f} / {id,x,cy}), roomStatus(r), serves(sh,f), isLobby(f);
//   optional: shells[{f,x,w}] (bare floor, style hook shell), walkable(f,x), season (0..3).
(function (root) {
  'use strict';

  const FH = 1.6;                       // floor height in tiles (same as index.html)
  const MARGIN_L = 1.7, MARGIN_R = 0.5;
  const STYLE_HOOKS = ['sky', 'ground', 'label', 'lobby', 'room', 'link', 'shaft', 'car', 'person', 'overflow'];
  const styles = root.TowerStyles = root.TowerStyles || {};

  // ---------- colour helpers shared by the styles ----------
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, k) {
    const pa = hexToRgb(a), pb = hexToRgb(b);
    const c = i => Math.round(pa[i] * (1 - k) + pb[i] * k);
    return '#' + ((1 << 24) | (c(0) << 16) | (c(1) << 8) | c(2)).toString(16).slice(1);
  }
  function rgba(h, a) { const p = hexToRgb(h); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; }
  // deterministic noise in [0,1) from integers – keeps hand-drawn jitter stable between frames
  function hash(a, b, c) {
    let h = (Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // sky colour by game time (same stops as index.html), returns [top, bottom] as hex
  function skyColors(t, stops) {
    const h = t / 3600;
    stops = stops || [[0, '#0b1430', '#18244a'], [5.5, '#0b1430', '#18244a'], [6.5, '#f4a261', '#fde2c4'], [8, '#6fb7e8', '#d6efff'],
      [17, '#6fb7e8', '#d6efff'], [18.5, '#e76f51', '#f8c291'], [20, '#1b2550', '#3b3f6b'], [24, '#0b1430', '#18244a']];
    for (let i = 0; i < stops.length - 1; i++) {
      const [h0, a0, b0] = stops[i], [h1, a1, b1] = stops[i + 1];
      if (h >= h0 && h <= h1) { const k = (h - h0) / (h1 - h0 || 1); return [mix(a0, a1, k), mix(b0, b1, k)]; }
    }
    return [stops[0][1], stops[0][2]];
  }
  const isNight = t => t < 6.5 * 3600 || t > 19.5 * 3600;
  const waitLevel = min => (min < 4 ? 0 : min < 10 ? 1 : 2);   // 0 fine, 1 getting long, 2 too long

  // positions for n figures inside a room of width w (tiles), max per row; returns [{x, row}]
  function slots(n, w, perRow) {
    const out = [];
    perRow = Math.max(1, perRow);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), k = i % perRow;
      const inRow = Math.min(perRow, n - row * perRow);
      out.push({ x: (k + 0.5) * w / inRow, row });
    }
    return out;
  }

  // ---------- the renderer ----------
  // view: {s: px per tile, x, y: world coords of the top-left corner, w, h: css px, dpr}
  // opt: heat (truthy = heatmap on), heatStatus(r, st) – the room's heat status if it is not
  // roomStatus (the game's energy heatmap), tired(p) – 0 fresh, 1 tired, 2 exhausted for people
  // on the move; both optional, so the study pages keep working without them
  function draw(ctx, style, world, view, opt) {
    opt = opt || {};
    const s = view.s, dpr = view.dpr || 1;
    const sx = x => (x - view.x) * s, sy = y => (y - view.y) * s;
    const floorTop = f => -(f + 1) * FH;
    const W = world.W;
    const rc = {
      ctx, s, sx, sy, floorTop, FH, W, world, view, dpr,
      t: world.t, night: isNight(world.t), heat: !!opt.heat,
      season: opt.season != null ? opt.season : world.season || 0,   // 0 spring, 1 summer, 2 autumn, 3 winter
      time: opt.time || 0,                                          // real seconds, for background motion
      cssW: view.w, cssH: view.h,
      detail: s >= 22 ? 2 : s >= 11 ? 1 : 0,   // 0 = whole tower, 1 = phone default, 2 = zoomed in
      rect(x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(sx(x), sy(y), w * s, h * s); },
    };
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';

    const maxF = world.maxFloors || 50;
    rc.fTop = Math.min(maxF, Math.floor(-view.y / FH) + 1);
    rc.fBot = Math.max(0, Math.floor(-(view.y + view.h / s) / FH));

    style.sky(rc);
    style.ground(rc);
    if (style.limit && world.maxFloor < maxF) style.limit(rc, floorTop(world.maxFloor));
    const step = s * FH >= 11 ? 1 : 5;
    for (let f = rc.fBot; f <= rc.fTop; f++) {
      if (f % step && f !== 0) continue;
      style.label(rc, f, f === 0 ? 'EG' : String(f), world.isLobby(f));
    }
    if (rc.fBot === 0) style.lobby(rc, world.entranceX);
    if (world.shells && style.shell) for (const sh of world.shells) {
      if (sh.f >= rc.fBot && sh.f <= rc.fTop) style.shell(rc, sh);
    }

    for (const r of world.rooms) {
      if (r.f < rc.fBot || r.f > rc.fTop) continue;
      const st = world.roomStatus(r);
      style.room(rc, r, st, opt.heat && opt.heatStatus ? opt.heatStatus(r, st) : st);
    }
    const tired = opt.tired || (() => 0);
    for (const l of world.links) {
      if (l.f + 1 < rc.fBot || l.f > rc.fTop) continue;
      style.link(rc, l.kind, l.f, l.x, l.w);
    }
    for (const p of world.climbing) {
      if (p.cy + 1 < rc.fBot || p.cy > rc.fTop + 1) continue;
      style.person(rc, p.x, p.cy, { id: p.id, mode: 'climb', tired: tired(p) });
    }
    for (const sh of world.shafts) {
      if (sh.f1 < rc.fBot || sh.f0 > rc.fTop) continue;
      style.shaft(rc, sh, f => world.serves(sh, f));
      const cap = sh.cap || (sh.kind === 'express' ? 20 : 10);
      for (const car of sh.cars) style.car(rc, sh, car, Math.min(1, car.pax.length / cap));
      for (let f = Math.max(sh.f0, rc.fBot); f <= Math.min(sh.f1, rc.fTop); f++) {
        const i = f - sh.f0;
        // queues stand on the floor: up on the left, down on the right – or both on the side that has floor
        const wk = world.walkable ? x => world.walkable(f, x) : () => true;
        const L = wk(sh.c - 1), Rt = wk(sh.c + 1);
        if (L === Rt || !world.walkable) {
          queue(rc, style, sh.qUp[i], sh.c - 0.05, f, -1);
          queue(rc, style, sh.qDown[i], sh.c + 1.05, f, 1);
        } else {
          const dir = L ? -1 : 1, x0 = L ? sh.c - 0.05 : sh.c + 1.05;
          const nUp = Math.min(sh.qUp[i].length, 3);
          queue(rc, style, sh.qUp[i], x0, f, dir, 3);
          queue(rc, style, sh.qDown[i], x0 + dir * (0.3 + nUp * 0.42), f, dir, 3);
        }
      }
    }
    for (const p of world.walking) {
      if (p.f < rc.fBot || p.f > rc.fTop) continue;
      style.person(rc, p.x, p.f, { id: p.id, mode: 'walk', tired: tired(p) });
    }
    if (style.post) style.post(rc);
    ctx.restore();
    return rc;
  }

  function queue(rc, style, q, x0, f, dir, max) {
    if (!q || !q.length) return;
    const n = Math.min(q.length, max || 5);
    let maxWait = 0;
    for (let k = n - 1; k >= 0; k--) {        // back of the queue first, so the front is on top
      const p = q[k];
      const wait = (rc.t - p.waitStart) / 60;
      maxWait = Math.max(maxWait, wait);
      style.person(rc, x0 + dir * (0.25 + k * 0.42), f, { id: p.id, mode: 'wait', wait, level: waitLevel(wait), front: k === 0, dir });
    }
    if (style.queueInfo) style.queueInfo(rc, x0, f, dir, q.length, maxWait);
    if (q.length > n && rc.s * FH >= 14) style.overflow(rc, '+' + (q.length - n), x0 + dir * (0.25 + n * 0.42), f, dir);
  }

  // view helpers for pages that show a crop of the world
  function fitView(box, cssW, dpr) {
    // box: {x0, x1, f0, f1} → view that shows these tiles/floors, ground strip below floor 0
    const s = cssW / (box.x1 - box.x0);
    const top = -(box.f1 + 1) * FH - (box.padTop == null ? 0.35 : box.padTop);
    const bottom = -box.f0 * FH + (box.f0 === 0 ? (box.ground == null ? 1.1 : box.ground) : 0.02);
    return { s, x: box.x0, y: top, w: cssW, h: Math.round((bottom - top) * s), dpr: dpr || 1 };
  }
  function phoneView(cssW, cssH, W, dpr) {
    // what index.html shows after resetView(): full width, ground at the bottom
    const s = cssW / (W + MARGIN_L + MARGIN_R);
    return { s, x: -MARGIN_L, y: 2 - cssH / s, w: cssW, h: cssH, dpr: dpr || 1 };
  }

  // zoom step for pixel styles: the nearest scale at which one art px (grid art px per tile)
  // is a whole number of device px – otherwise art px come out unevenly 2 and 3 px wide
  function snapScale(s, grid, dpr) {
    const unit = grid / (dpr || 1);
    return Math.max(1, Math.round(s / unit)) * unit;
  }

  function check(style) {
    return STYLE_HOOKS.filter(k => typeof style[k] !== 'function');
  }

  root.TowerRender = { FH, MARGIN_L, MARGIN_R, STYLE_HOOKS, draw, fitView, phoneView, snapScale, check,
    util: { mix, rgba, hash, skyColors, isNight, waitLevel, slots } };
})(typeof window !== 'undefined' ? window : globalThis);
