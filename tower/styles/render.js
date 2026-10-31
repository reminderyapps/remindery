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
//   optional: shells[{f,x,w}] (bare floor, style hook shell(rc, sh, hs) – hs = opt.heatStatus(sh, null)
//   in heatmap mode, else null), walkable(f,x), season (0..3).
//   Basements (TOWER-a0010 P1), optional: minFloors (deepest floor the arrays know, negative; without it
//   nothing below floor 0 is drawn), minFloor (deepest floor the stars allow: labels go down to it),
//   floorName(f) for the labels below 0 (else "1. UG" …). Floor f < 0 lies in the ground (y > 0).
//   Graphics G (TOWER-a0010), all optional: rc.minF (= minFloor) / rc.lowF (= minFloors); the style hook
//   basement(rc, f, spans) once per visible basement floor minFloor … −1 before the rooms (not in
//   STYLE_HOOKS), spans = [[x0, x1], …] tiles dug out there (rooms, shells, shafts, links); limit(rc, y) also
//   marks the deepest allowed floor while deeper ones exist. room.merged, room.tenantType (key in
//   CFG.tenants), room.damaged, room.damperLevel 1..3, room.guests (hotel), room.parked (garage).
//   quakeOffset(world, t real s) → {x, y} art px (10 per tile), {dx, dy} tiles, level, k: the screen shake
//   from world.quakeToday (1..3 or {level}); quakeStart(world, level, t) starts one by hand (preview).
//   fitView box.padBottom = earth below a basement crop (default 0.3).
//   Block mode (TOWER-a0011 P1, E7/E71): far out (floor height fp = s × FH < 8 css px) the tower is drawn as blocks of
//   rc.block = 5 floors (10 below fp 2): per block and tile the most frequent category (0 empty · 1 shell · 2 office ·
//   3 flat · 4 provider/other room · 5 lobby · 6 plant · 7 public/entrance), shafts as 1 px lines, no people, cars or
//   queues, labels every 25 floors, roomStatus is never called (warning frame from room.warn). Optional style hook
//   block(rc, f0, f1, cats) draws one block (floors f0…f1, cats = Uint8Array(W)); without it a fallback palette.
//   Cache key world.structGen (+ the hour, for room.warn). TowerRender.blockOf(s) tells the UI the mode of a scale.
//   Depth run (TOWER-a0006), all optional – a missing field draws like before:
//     room types workshop, cafe, daycare, supermarket, gym; room.tier 0 standard · 1 upscale ·
//     2 luxury (office/condo); room.warn 1 = yellow / 2 = red warning sign (TOWER-a0007; without warn: warnDays > 0 = red); room.id (stable per room);
//     car.cond 'ok'|'slow'|'waiting'|'repair'|'broken', car.wear 0..100, car.mech (person or null);
//     person.role 'tenant'|'guest'|'mechanic', person.emergency (emergency service) – passed on to
//     style.person as o2.role / o2.emergency for walking, climbing and waiting people.
//   Stars run part 2 (TOWER-a0011), all optional: room.h (2 = over floors f and f + 1, drawn when either is in view),
//   room.closed (storm/fog), room.whole, room.platform (space station); shaft kinds double, fire, service, twin
//   (s.split), multi (s.c2 above floor s.fb – queues stand at that column there), maglev; car.cap from
//   CFG.shafts[kind].cap; world.weatherToday {fog, ice, storm}, world.look {facade, cabin, windows}, world.twin,
//   world.launchT (game time of the space elevator launch): launchState(world, t real s) → {launched, climbing,
//   k 0..1} (90 s of real time from the moment a new launchT is first seen; one already in a loaded save counts as
//   done), launchStart(world, t) starts one by hand (preview). Style hook block(rc, f0, f1, cats) for block mode.
//   Optional style hooks the game UI calls itself after draw() with the returned rc (only if the
//   style has them): tint(rc, room, share 0..1|null), mark(rc, room, pen 0..1),
//   radius(rc, {type,f,x,w,r}, hits[{room,pen}]). Not in STYLE_HOOKS, so older styles still pass check().
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
    rc.fBot = Math.max(world.minFloors || 0, Math.floor(-(view.y + view.h / s) / FH));
    rc.minF = Math.min(0, world.minFloor || 0);              // deepest floor allowed now (G, TOWER-a0010)
    rc.lowF = Math.min(rc.minF, world.minFloors || 0);       // deepest floor the world knows at all
    rc.block = blockOf(s);                                   // 0 = off, else floors per block (TOWER-a0011 E7/E71)

    style.sky(rc);
    style.ground(rc);
    if (!rc.block && rc.minF < 0 && rc.fBot < 0) basements(rc, style, world);
    if (style.limit && world.maxFloor < maxF) style.limit(rc, floorTop(world.maxFloor));
    if (style.limit && rc.minF < 0 && rc.lowF < rc.minF && rc.fBot < rc.minF) style.limit(rc, floorTop(rc.minF - 1));   // deeper with the next star
    const step = rc.block ? 25 : s * FH >= 11 ? 1 : 5;
    const fLab = Math.max(rc.fBot, Math.min(0, world.minFloor || 0));
    const uName = f => world.floorName ? world.floorName(f) : -f + '. UG';
    for (let f = fLab; f <= rc.fTop; f++) {
      if (f % step && f !== 0) continue;
      style.label(rc, f, f === 0 ? 'EG' : f < 0 ? uName(f) : String(f), world.isLobby(f));
    }
    if (rc.block) { drawBlocks(rc, style, world); ctx.restore(); return rc; }
    if (rc.fBot <= 0 && rc.fTop >= 0) style.lobby(rc, world.entranceX);
    if (world.shells && style.shell) for (const sh of world.shells) {
      if (sh.f >= rc.fBot && sh.f <= rc.fTop) style.shell(rc, sh, opt.heat && opt.heatStatus ? opt.heatStatus(sh, null) : null);
    }

    for (const r of world.rooms) {
      if (r.f + (r.h > 1 ? r.h - 1 : 0) < rc.fBot || r.f > rc.fTop) continue;
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
      style.person(rc, p.x, p.cy, { id: p.id, mode: 'climb', tired: tired(p), role: p.role, emergency: p.emergency });
    }
    for (const sh of world.shafts) {
      if (sh.f1 < rc.fBot || sh.f0 > rc.fTop) continue;
      style.shaft(rc, sh, f => world.serves(sh, f));
      const def = shaftDef(sh.kind), cap = sh.cap || (def && def.cap) || (sh.kind === 'express' ? 20 : 10);
      for (const car of sh.cars) style.car(rc, sh, car, Math.min(1, car.pax.length / cap));
      for (let f = Math.max(sh.f0, rc.fBot); f <= Math.min(sh.f1, rc.fTop); f++) {
        const i = f - sh.f0;
        // queues stand on the floor: up on the left, down on the right – or both on the side that has floor
        const wk = world.walkable ? x => world.walkable(f, x) : () => true;
        const c = sh.c2 != null && sh.fb != null && f > sh.fb ? sh.c2 : sh.c;   // MULTI above its bridge floor
        const L = wk(c - 1), Rt = wk(c + 1);
        if (L === Rt || !world.walkable) {
          queue(rc, style, sh.qUp[i], c - 0.05, f, -1);
          queue(rc, style, sh.qDown[i], c + 1.05, f, 1);
        } else {
          const dir = L ? -1 : 1, x0 = L ? c - 0.05 : c + 1.05;
          const nUp = Math.min(sh.qUp[i].length, 3);
          queue(rc, style, sh.qUp[i], x0, f, dir, 3);
          queue(rc, style, sh.qDown[i], x0 + dir * (0.3 + nUp * 0.42), f, dir, 3);
        }
      }
    }
    for (const p of world.walking) {
      if (p.f < rc.fBot || p.f > rc.fTop) continue;
      style.person(rc, p.x, p.f, { id: p.id, mode: 'walk', tired: tired(p), role: p.role, emergency: p.emergency });
    }
    if (style.post) style.post(rc);
    ctx.restore();
    return rc;
  }

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function shaftDef(kind) {
    const E = root.TowerEngine, c = E && E.CFG;
    return c && c.shafts ? c.shafts[kind] : null;
  }

  // ---------- block mode (TOWER-a0011 P1, E7/E71) ----------
  // floors per block for a scale (css px per tile): fp = s × FH; < 8 → 5, < 2 → 10, else 0 (off)
  function blockOf(s) { const fp = s * FH; return fp < 2 ? 10 : fp < 8 ? 5 : 0; }
  const BLOCK_CAT = { shell: 1, office: 2, condo: 3, skylobby: 5, district: 5, bridge: 5, tech: 6, damper: 6, gondola: 6, geothermal: 6, wind: 6,
    garage: 7, station: 7, heliport: 7, airship: 7, passage: 7, clinic: 7, school: 7, townhall: 7 };   // other rooms: 4
  const BLOCK_PAL = [null, '#8d8778', '#6f93bf', '#c99a62', '#7fae76', '#d9c9a8', '#7b7f89', '#b48ac2'];
  const blockCache = new WeakMap();
  // index of the block of floor f: 0…B−1 → 0, B…2B−1 → 1; basements −1…−B → −1, −B−1…−2B → −2
  const blockIdx = (f, B) => (f >= 0 ? Math.floor(f / B) : -1 - Math.floor((-f - 1) / B));
  function blockData(world, B) {
    const W = world.W, lo = Math.min(0, world.minFloors || 0), hi = world.maxFloors || 50;
    const key = [world.structGen ?? -1, Math.floor((world.t || 0) / 3600), B, W, world.rooms.length, world.shells ? world.shells.length : 0].join(':');
    const old = blockCache.get(world);
    if (old && old.key === key) return old;
    const nF = hi - lo + 1, cell = new Uint8Array(nF * W);
    const put = (f, x0, w, c) => {
      if (f < lo || f > hi) return;
      const o = (f - lo) * W;
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) cell[o + x] = c;
    };
    put(0, 0, W, 5);                                       // the lobby
    if (world.shells) for (const sh of world.shells) put(sh.f, sh.x, sh.w || 1, 1);
    for (const r of world.rooms) for (let k = 0; k < Math.max(1, r.h | 0); k++) put(r.f + k, r.x, r.w || 1, BLOCK_CAT[r.type] || 4);   // r.h = 2: both floors
    const blocks = [], k0 = blockIdx(lo, B), k1 = blockIdx(hi, B), cnt = new Uint16Array(8);
    for (let k = k0; k <= k1; k++) {
      const f0 = Math.max(lo, k >= 0 ? k * B : -(-k - 1) * B - B), f1 = Math.min(hi, k >= 0 ? k * B + B - 1 : -(-k - 1) * B - 1);
      const cats = new Uint8Array(W);
      let any = false;
      for (let x = 0; x < W; x++) {
        cnt.fill(0);
        for (let f = f0; f <= f1; f++) cnt[cell[(f - lo) * W + x]]++;
        let best = 0;
        for (let c = 1; c < 8; c++) if (cnt[c] >= cnt[best]) best = c;   // most frequent, ties → the higher category
        cats[x] = best; if (best) any = true;
      }
      blocks.push({ f0, f1, cats, any, warn: [] });
    }
    for (const r of world.rooms) {
      const wl = r.warn != null ? r.warn : r.warnDays > 0 ? 2 : 0;
      if (wl > 0 && r.f >= lo && r.f <= hi) blocks[blockIdx(r.f, B) - k0].warn.push([r.x, r.w || 1, wl]);
    }
    const d = { key, blocks };
    blockCache.set(world, d);
    return d;
  }
  function drawBlocks(rc, style, world) {
    const { ctx, sx, sy, floorTop, s } = rc, B = rc.block, data = blockData(world, B);
    for (const b of data.blocks) {
      if (!b.any || b.f1 < rc.fBot || b.f0 > rc.fTop) continue;
      if (style.block) { style.block(rc, b.f0, b.f1, b.cats); continue; }
      const y = floorTop(b.f1), h = (b.f1 - b.f0 + 1) * FH;
      for (let x = 0; x < rc.W;) {
        const c = b.cats[x];
        let e = x + 1; while (e < rc.W && b.cats[e] === c) e++;
        if (c) rc.rect(x, y, e - x, h, rc.night && c !== 5 ? rgba(BLOCK_PAL[c], 0.75) : BLOCK_PAL[c]);
        x = e;
      }
    }
    // warning frames: yellow first, red on top
    ctx.lineWidth = 1;
    for (const lv of [1, 2]) {
      ctx.strokeStyle = lv > 1 ? '#ff4d5e' : '#ffc94d';
      for (const b of data.blocks) {
        if (b.f1 < rc.fBot || b.f0 > rc.fTop) continue;
        const y0 = sy(floorTop(b.f1)), y1 = sy(floorTop(b.f0 - 1));
        for (const [x, w, l] of b.warn) if (l === lv) ctx.strokeRect(Math.round(sx(x)) + 0.5, Math.round(y0) + 0.5, Math.max(1, Math.round(w * s) - 1), Math.max(1, Math.round(y1 - y0) - 1));
      }
    }
    // shafts: 1 px lines, express darker
    for (const sh of world.shafts) {
      if (sh.f1 < rc.fBot || sh.f0 > rc.fTop) continue;
      ctx.fillStyle = sh.kind === 'express' ? '#22252c' : '#454b56';
      const y0 = Math.round(sy(floorTop(sh.f1))), y1 = Math.round(sy(floorTop(sh.f0 - 1)));
      ctx.fillRect(Math.round(sx(sh.c + 0.5)), y0, 1, y1 - y0);
    }
  }

  // basement floors in view: what is dug out on each floor (rooms, shells, shafts, links) as merged
  // spans, handed to the style's basement hook (concrete box against the earth) before the rooms
  function basements(rc, style, world) {
    if (!style.basement) return;
    const f0 = Math.max(rc.fBot, rc.minF), f1 = Math.min(-1, rc.fTop);
    if (f0 > f1) return;
    const by = new Map();
    const add = (f, x0, x1) => {
      if (f < f0 || f > f1 || !(x1 > x0)) return;
      let a = by.get(f); if (!a) by.set(f, a = []);
      a.push([x0, x1]);
    };
    for (const r of world.rooms) if (r.f < 0) for (let k = 0; k < Math.max(1, r.h | 0); k++) add(r.f + k, r.x, r.x + (r.w || 1));
    if (world.shells) for (const sh of world.shells) if (sh.f < 0) add(sh.f, sh.x, sh.x + (sh.w || 1));
    for (const sh of world.shafts) if (sh.f0 < 0) for (let f = Math.max(sh.f0, f0); f <= Math.min(sh.f1, f1); f++) add(f, sh.c, sh.c + 1);
    for (const l of world.links) if (l.f < 0) { add(l.f, l.x, l.x + (l.w || 1)); add(l.f + 1, l.x, l.x + (l.w || 1)); }
    for (let f = f0; f <= f1; f++) {
      const a = by.get(f) || [];
      a.sort((p, q) => p[0] - q[0]);
      const spans = [];
      for (const p of a) { const last = spans[spans.length - 1]; if (last && p[0] <= last[1]) last[1] = Math.max(last[1], p[1]); else spans.push([p[0], p[1]]); }
      style.basement(rc, f, spans);
    }
  }

  // ---------- earthquake shake (TOWER-a0010) ----------
  // world.quakeToday: 0/null = none, 1..3 = strength (or an object {level}). The shake starts when a new
  // value is first seen and dies away in a few real seconds (1: 2.5 s ±1 art px, 2: 4 s ±2, 3: 6 s ±3).
  const QUAKE = [null, { amp: 1, secs: 2.5, hz: 7 }, { amp: 2, secs: 4, hz: 6 }, { amp: 3, secs: 6, hz: 5 }];
  const quakeSeen = new WeakMap();
  const NO_SHAKE = Object.freeze({ x: 0, y: 0, dx: 0, dy: 0, level: 0, k: 0 });
  function quakeLevel(q) {
    if (!q) return 0;
    const v = typeof q === 'object' ? num(q.level, num(q.strength, 1)) : q === true ? 1 : num(+q, 0);
    return Math.max(0, Math.min(3, Math.round(v)));
  }
  function quakeStart(world, level, t) {
    if (!world || typeof world !== 'object') return;
    const lv = Math.max(1, Math.min(3, Math.round(+level || 1)));
    const st = quakeSeen.get(world) || {};
    st.forced = { level: lv, start: num(t, 0) };
    quakeSeen.set(world, st);
  }
  function quakeOffset(world, t) {
    if (!world || typeof world !== 'object') return NO_SHAKE;
    t = num(t, 0);
    let st = quakeSeen.get(world);
    let lv = 0, start = 0;
    if (st && st.forced && t - st.forced.start <= QUAKE[st.forced.level].secs && t >= st.forced.start) ({ level: lv, start } = st.forced);
    else {
      const q = world.quakeToday, ql = quakeLevel(q);
      if (!ql) { if (st) st.key = null; return NO_SHAKE; }
      const key = num(world.day, 0) + ':' + ql + ':' + (q && typeof q === 'object' ? num(q.t, '') : '');
      if (!st) quakeSeen.set(world, st = {});
      if (st.key !== key) { st.key = key; st.start = t; }
      lv = ql; start = st.start;
    }
    const Q = QUAKE[lv], age = t - start;
    if (age < 0 || age > Q.secs) return NO_SHAKE;
    const k = 1 - age / Q.secs, a = Q.amp * Math.min(1, age * 4) * (0.35 + 0.65 * k * k);   // short swell, then dies away
    const w = 2 * Math.PI * Q.hz;
    const x = Math.round(a * Math.sin(w * age) * (0.7 + 0.3 * Math.sin(w * 0.37 * age + 1.3)));
    const y = Math.round(a * 0.5 * Math.sin(w * 1.31 * age + 0.7));
    return { x, y, dx: x / 10, dy: y / 10, level: lv, k };
  }

  // ---------- space elevator launch (TOWER-a0011 E55) ----------
  // world.launchT changes (null → a time) when the first cabin starts: the style animates it 90 s of real time.
  const LAUNCH_SECS = 90;
  const launchSeen = new WeakMap();
  const NO_LAUNCH = Object.freeze({ launched: false, climbing: false, k: 0 });
  function launchState(world, t) {
    if (!world || typeof world !== 'object') return NO_LAUNCH;
    t = num(t, 0);
    let st = launchSeen.get(world);
    if (!st) launchSeen.set(world, st = { key: undefined, start: -1e9 });
    if (st.forced != null && t >= st.forced && t - st.forced <= LAUNCH_SECS) return { launched: true, climbing: true, k: (t - st.forced) / LAUNCH_SECS };
    const lt = world.launchT;
    const has = lt != null && lt !== false;
    if (st.key === undefined) { st.key = has ? lt : null; st.start = -1e9; }          // first look: a launch in the save is done
    else if (has && st.key !== lt) { st.key = lt; st.start = t; }
    else if (!has) st.key = null;
    if (!has) return NO_LAUNCH;
    const age = t - st.start;
    if (age >= 0 && age <= LAUNCH_SECS) return { launched: true, climbing: true, k: age / LAUNCH_SECS };
    return { launched: true, climbing: false, k: 1 };
  }
  function launchStart(world, t) {
    if (!world || typeof world !== 'object') return;
    const st = launchSeen.get(world) || { key: undefined, start: -1e9 };
    st.forced = num(t, 0);
    launchSeen.set(world, st);
  }

  function queue(rc, style, q, x0, f, dir, max) {
    if (!q || !q.length) return;
    const n = Math.min(q.length, max || 5);
    let maxWait = 0;
    for (let k = n - 1; k >= 0; k--) {        // back of the queue first, so the front is on top
      const p = q[k];
      const wait = (rc.t - p.waitStart) / 60;
      maxWait = Math.max(maxWait, wait);
      style.person(rc, x0 + dir * (0.25 + k * 0.42), f, { id: p.id, mode: 'wait', wait, level: waitLevel(wait), front: k === 0, dir, role: p.role, emergency: p.emergency });
    }
    if (style.queueInfo) style.queueInfo(rc, x0, f, dir, q.length, maxWait);
    if (q.length > n && rc.s * FH >= 14) style.overflow(rc, '+' + (q.length - n), x0 + dir * (0.25 + n * 0.42), f, dir);
  }

  // view helpers for pages that show a crop of the world
  function fitView(box, cssW, dpr) {
    // box: {x0, x1, f0, f1} → view that shows these tiles/floors, ground strip below floor 0 (f0 < 0: a little earth below the basement)
    const s = cssW / (box.x1 - box.x0);
    const top = -(box.f1 + 1) * FH - (box.padTop == null ? 0.35 : box.padTop);
    const bottom = -box.f0 * FH + (box.f0 === 0 ? (box.ground == null ? 1.1 : box.ground) : box.f0 < 0 ? (box.padBottom == null ? 0.3 : box.padBottom) : 0.02);
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

  root.TowerRender = { FH, MARGIN_L, MARGIN_R, STYLE_HOOKS, draw, fitView, phoneView, snapScale, check, quakeOffset, quakeStart, blockOf,
    launchState, launchStart, LAUNCH_SECS,
    util: { mix, rgba, hash, skyColors, isNight, waitLevel, slots } };
})(typeof window !== 'undefined' ? window : globalThis);
