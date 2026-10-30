// Tower game – simulation engine (no DOM). Loaded by index.html and by tool/sim_check.js.
// Time unit: game seconds since midnight. Floors: 0 = lobby, 1..MAX_FLOOR above.
(function (root) {
  'use strict';

  const CFG = {
    W: 24,                 // tiles per floor
    MAX_FLOOR: 50,
    SKY_EVERY: 15,         // sky lobbies only on 15, 30, 45
    DAY_START: 6 * 3600,
    DAY_END: 24 * 3600,
    ENTRANCE_X: 12,
    walkSpeed: 0.25,       // tiles per game second
    // energy: every part of a trip costs some, rooms give it back. A trip that would push energy
    // below 0 is impossible; tired people feel every minute longer (rating).
    energy: {
      min: 70, max: 130,   // personal maximum, drawn per person from the game seed
      ref: 100,            // energy used to decide whether a room is reachable at all
      corridor: 0.5,       // per tile walked (whole floor = 24 tiles = 12)
      waitPerMin: 1,       // standing in an elevator queue
      ridePerMin: 0,       // riding an elevator
      recoverPerHour: 30,  // resting in a room or outside
      mealPerHour: 120,    // eating in a restaurant
      tiredBelow: 0.5,     // below this share of the maximum people get tired ...
      tiredFactor: 1.0,    // ... and at 0 energy every minute counts (1 + tiredFactor)-fold
      step: 4,             // routing: energy is discretised in steps of this size
    },
    // routing estimates (felt minutes) – the real wait is only known afterwards
    route: { waitGuess: 3, perFloor: { normal: 0.35, express: 0.15 }, queuePenalty: 0.2 },
    doorTime: 6,
    boardTime: 1.5,
    goodMin: 12,           // avg trip minutes: <= good, <= ok, above = bad
    okMin: 25,
    energyGood: 0.6,       // heatmap "Energie": Ø share left on arrival >= good, >= ok, below = exhausted
    energyOk: 0.35,
    startMoney: 500000,
    rooms: {
      office:     { w: 4, cost: 40000,  rent: 5000, cap: 6, label: 'Büro',       icon: '💼' },
      condo:      { w: 3, cost: 50000,  rent: 3000, cap: 3, label: 'Wohnung',    icon: '🏠' },
      restaurant: { w: 6, cost: 80000,  price: 80, seats: 24, label: 'Restaurant', icon: '🍽️' },
      skylobby:   { w: 6, cost: 100000, label: 'Sky-Lobby', icon: '🛋️' },
    },
    shafts: {
      normal:  { base: 30000, perFloor: 2000, car: 15000, upkeep: 300, cap: 10, speed: 1 / 20, maxSpan: 15, maxCars: 4, label: 'Aufzug' },
      express: { base: 80000, perFloor: 3000, car: 30000, upkeep: 600, cap: 20, speed: 1 / 8,  maxSpan: 50, maxCars: 4, label: 'Express' },
    },
    // stairs/escalators connect floor f with f+1; no waiting, but slow and less comfortable.
    // up/down = game seconds per floor, comfort = factor on the felt time of that part of the trip,
    // energyUp/energyDown = energy per floor
    links: {
      stairs:    { w: 2, cost: 5000,  upkeep: 0,   up: 60, down: 40, comfort: 2.0, energyUp: 15, energyDown: 8, label: 'Treppe',     icon: '🪜' },
      escalator: { w: 3, cost: 20000, upkeep: 100, up: 30, down: 30, comfort: 1.2, energyUp: 4,  energyDown: 4, label: 'Rolltreppe', icon: '↗️' },
    },
    // shell floor ("Rohbau"): bare floor to close gaps; people only walk and queue on built floor
    // (rooms, shell, the lobby). Building fills the whole gap around the tapped tile.
    shell: { cost: 1000, label: 'Rohbau', icon: '🧱' },
    seasonDays: 5,         // days per season (spring, summer, autumn, winter) – looks only
    // index = stars - 1; requirement to REACH this star, maxFloor unlocked with it
    stars: [
      { maxFloor: 15 },
      { pop: 100, sat: 0.70, maxFloor: 30 },
      { pop: 300, sat: 0.75, restaurants: 1, maxFloor: 50 },
      { pop: 700, sat: 0.80, maxFloor: 50 },
    ],
  };

  // ---------- small helpers ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    peek() { return this.a[0]; }
    push(e) {
      const a = this.a; a.push(e);
      let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p].t <= a[i].t) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < a.length && a[l].t < a[m].t) m = l;
          if (r < a.length && a[r].t < a[m].t) m = r;
          if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
        }
      }
      return top;
    }
  }

  const hm = (h, m) => h * 3600 + (m || 0) * 60;
  const corrMin = d => d / CFG.walkSpeed / 60;     // corridor: felt minutes for d tiles
  const corrEn = d => d * CFG.energy.corridor;     // corridor: energy for d tiles
  function floorName(f) { return f === 0 ? 'EG' : f + '. OG'; }
  function fmtTime(t) {
    const m = Math.floor(t / 60) % (24 * 60);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  // ---------- game ----------
  class Game {
    constructor(saved) {
      const s = saved || {};
      this.money = s.money ?? CFG.startMoney;
      this.day = s.day ?? 1;
      this.stars = s.stars ?? 1;
      this.seed = s.seed ?? ((Math.random() * 1e9) | 0);
      this.nextId = s.nextId ?? 1;
      this.sat = s.sat ?? 1;
      this.won = s.won ?? false;
      this.rand = mulberry32(this.seed + this.day * 7919);
      this.rooms = (s.rooms || []).map(r => this._makeRoom(r));
      this.shafts = (s.shafts || []).map(sh => this._makeShaft(sh));
      this.links = (s.links || []).map(l => this._makeLink(l));
      this.shellRows = [];
      for (let f = 0; f <= CFG.MAX_FLOOR; f++) this.shellRows.push(new Uint8Array(CFG.W));
      for (const r of s.shells || []) for (let x = r.x; x < r.x + r.w; x++) this.shellRows[r.f][x] = 1;
      this.msgs = [];
      this.onMessage = null;
      this.onEvent = null;        // (type, data) for sound: door, movein, moveout, star, day
      this.t = CFG.DAY_START;
      this.persons = new Set();
      this.walking = new Set();
      this.climbing = new Set();
      this.events = new Heap();
      this.today = { rent: 0, guests: 0, waitSum: 0, waitN: 0 };
      // tenants are not saved: occupied rooms get their people back on load
      for (const r of this.rooms) if (r.occupied && (r.type === 'office' || r.type === 'condo')) {
        for (let i = 0; i < CFG.rooms[r.type].cap; i++) this._newPerson(r.type === 'office' ? 'worker' : 'resident', r);
      }
      this._structureChanged();
      // saves from before the shell floor walked over gaps: close them, so the tower works as before
      if (saved && !s.shells) this.closeAllGaps();
      this._startDay();
    }

    // ----- persistence -----
    serialize() {
      return {
        v: 1, money: this.money, day: this.day, stars: this.stars, seed: this.seed,
        nextId: this.nextId, sat: this.sat, won: this.won,
        rooms: this.rooms.map(r => ({ id: r.id, type: r.type, f: r.f, x: r.x, occupied: r.occupied, score: r.score, badNights: r.badNights, tenancy: r.tenancy })),
        shafts: this.shafts.map(s => ({ id: s.id, kind: s.kind, c: s.c, f0: s.f0, f1: s.f1, stops: s.stops.slice(), nCars: s.cars.length, name: s.name })),
        links: this.links.map(l => ({ id: l.id, kind: l.kind, f: l.f, x: l.x })),
        shells: this.shells.map(r => ({ f: r.f, x: r.x, w: r.w })),
      };
    }

    _makeLink(l) { return { id: l.id, kind: l.kind, f: l.f, x: l.x, w: CFG.links[l.kind].w, used: 0, isLink: true }; }

    _makeRoom(r) {
      return {
        id: r.id, type: r.type, f: r.f, x: r.x, w: CFG.rooms[r.type].w,
        occupied: !!r.occupied, score: r.score ?? null, badNights: r.badNights || 0, tenancy: r.tenancy || 0,
        tripSum: 0, tripN: 0, inside: 0, people: [], eSum: 0, eN: 0, eLast: null, failN: 0,
      };
    }

    _makeShaft(s) {
      const span = s.f1 - s.f0 + 1;
      const sh = {
        id: s.id, kind: s.kind, c: s.c, f0: s.f0, f1: s.f1,
        stops: s.stops ? s.stops.slice() : new Array(span).fill(true),
        name: s.name || this._shaftName(),
        cars: [], qUp: [], qDown: [], waitSum: 0, waitN: 0,
      };
      for (let i = 0; i < span; i++) { sh.qUp.push([]); sh.qDown.push([]); }
      const n = s.nCars || 1;
      for (let i = 0; i < n; i++) sh.cars.push(this._makeCar(sh));
      return sh;
    }

    _makeCar(s) { return { y: s.f0, dir: 0, state: 'idle', timer: 0, pax: [], target: null }; }

    _shaftName() {
      const used = new Set(this.shafts ? this.shafts.map(s => s.name) : []);
      for (let i = 0; i < 26; i++) { const n = String.fromCharCode(65 + i); if (!used.has(n)) return n; }
      return 'Z' + this.nextId;
    }

    msg(text, kind) {
      const m = { text, kind: kind || 'info', day: this.day, t: this.t };
      this.msgs.push(m);
      if (this.msgs.length > 60) this.msgs.shift();
      if (this.onMessage) this.onMessage(m);
    }

    _emit(type, data) { if (this.onEvent) this.onEvent(type, data); }

    // ----- derived structure -----
    get maxFloor() { return CFG.stars[Math.min(this.stars, CFG.stars.length) - 1].maxFloor; }
    get season() { return Math.floor((this.day - 1) / CFG.seasonDays) % 4; }   // 0 spring … 3 winter

    _structureChanged() {
      const W = CFG.W, F = CFG.MAX_FLOOR;
      this.grid = []; this.sgrid = [];   // rooms and shafts on separate layers: shafts may run through rooms
      for (let f = 0; f <= F; f++) { this.grid.push(new Array(W).fill(null)); this.sgrid.push(new Array(W).fill(null)); }
      for (const r of this.rooms) for (let x = r.x; x < r.x + r.w; x++) this.grid[r.f][x] = r;
      for (const s of this.shafts) for (let f = s.f0; f <= s.f1; f++) this.sgrid[f][s.c] = s;
      // stairs/escalators: own layer on their lower floor
      this.lgrid = [];
      for (let f = 0; f <= F; f++) this.lgrid.push(new Array(W).fill(null));
      for (const l of this.links) for (let x = l.x; x < l.x + l.w; x++) this.lgrid[l.f][x] = l;
      this.lobbyFloors = new Set([0]);
      for (const r of this.rooms) if (r.type === 'skylobby') this.lobbyFloors.add(r.f);
      // shell runs (for drawing, selecting, demolishing): rooms always win over shell
      this.shells = []; this.shgrid = [];
      for (let f = 0; f <= F; f++) {
        const row = this.shellRows[f], g = new Array(W).fill(null);
        for (let x = 0; x < W; x++) if (row[x] && this.grid[f][x]) row[x] = 0;
        for (let x = 0; x < W;) {
          if (!row[x]) { x++; continue; }
          let e = x; while (e + 1 < W && row[e + 1]) e++;
          const sh = { f, x, w: e - x + 1, isShell: true };
          this.shells.push(sh);
          for (let i = x; i <= e; i++) g[i] = sh;
          x = e + 1;
        }
        this.shgrid.push(g);
      }
      // walkable floor and its connected pieces (segments): the lobby, rooms, shell; a shaft column
      // is a landing if floor touches it. Corridor walks only join points of the same segment.
      this.seg = [];
      for (let f = 0; f <= F; f++) {
        const base = x => x >= 0 && x < W && (f === 0 || !!this.grid[f][x] || !!this.shellRows[f][x]);
        const wk = new Array(W);
        for (let x = 0; x < W; x++) wk[x] = base(x) || (!!this.sgrid[f][x] && (base(x - 1) || base(x + 1)));
        const sg = new Int16Array(W).fill(-1);
        let id = -1;
        for (let x = 0; x < W; x++) if (wk[x]) sg[x] = x > 0 && wk[x - 1] ? id : ++id;
        this.seg.push(sg);
      }
      this._buildRouteGraph();
    }

    walkable(f, x) { return f >= 0 && f <= CFG.MAX_FLOOR && x >= 0 && x < CFG.W && this.seg[f][x | 0] >= 0; }

    // segment of a position; off the floor: the nearest walkable tile (people caught by a demolition)
    segAt(f, x) {
      const row = this.seg[f], t = Math.max(0, Math.min(CFG.W - 1, Math.floor(x)));
      if (row[t] >= 0) return row[t];
      for (let d = 1; d < CFG.W; d++) {
        if (t - d >= 0 && row[t - d] >= 0) return row[t - d];
        if (t + d < CFG.W && row[t + d] >= 0) return row[t + d];
      }
      return -1;
    }

    // Routing graph: nodes are access points (elevator door per shaft and floor, both ends of each
    // stair/escalator). Transport edges join nodes; walking along the corridor joins any two nodes
    // on the same floor and is added during the search.
    _buildRouteGraph() {
      const nodes = [], floorNodes = [];
      for (let f = 0; f <= CFG.MAX_FLOOR; f++) floorNodes.push([]);
      const add = (f, x, o) => { const n = { i: nodes.length, f, x, seg: this.seg[f][Math.floor(x)], out: [], inn: [], shaft: o.shaft || null, link: o.link || null }; nodes.push(n); floorNodes[f].push(n); return n; };
      const join = (a, b, ed) => { ed.from = a; ed.to = b; ed.toF = b.f; a.out.push(ed); b.inn.push(ed); };
      const R = CFG.route, E = CFG.energy;
      for (const s of this.shafts) {
        const doors = [];
        for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) && this.walkable(f, s.c)) doors.push(add(f, s.c + 0.5, { shaft: s }));
        const per = R.perFloor[s.kind];
        for (const a of doors) for (const b of doors) {
          if (a === b) continue;
          const ride = Math.abs(b.f - a.f) * per;
          join(a, b, { mode: 'elev', shaft: s, cost: R.waitGuess + ride, energy: R.waitGuess * E.waitPerMin + ride * E.ridePerMin });
        }
      }
      for (const l of this.links) {
        const d = CFG.links[l.kind];
        if (!this.walkable(l.f, l.x) || !this.walkable(l.f + 1, l.x + l.w - 1)) continue;   // an end in the air
        const lo = add(l.f, l.x + 0.3, { link: l }), hi = add(l.f + 1, l.x + l.w - 0.3, { link: l });
        join(lo, hi, { mode: 'link', link: l, cost: d.up * d.comfort / 60 + 0.1, energy: d.energyUp });
        join(hi, lo, { mode: 'link', link: l, cost: d.down * d.comfort / 60 + 0.1, energy: d.energyDown });
      }
      this.nodes = nodes; this.floorNodes = floorNodes;
      this.routeCache = new Map();
      this.reachCache = new Map();
    }

    isLobby(f) { return this.lobbyFloors.has(f); }

    serves(s, f) {
      if (f < s.f0 || f > s.f1 || !s.stops[f - s.f0]) return false;
      return s.kind === 'normal' || this.isLobby(f);
    }

    floorExtent(f) {
      if (f === 0) return [0, CFG.W - 1];
      let lo = -1, hi = -1;
      const row = this.grid[f], srow = this.sgrid[f], hrow = this.shellRows[f];
      for (let x = 0; x < CFG.W; x++) if (row[x] || srow[x] || hrow[x]) { if (lo < 0) lo = x; hi = x; }
      return lo < 0 ? null : [lo, hi];
    }

    // shaft wins: it is drawn on top of the room
    objectAt(f, x) {
      if (f < 0 || f > CFG.MAX_FLOOR || x < 0 || x >= CFG.W) return null;
      return this.sgrid[f][x] || this.lgrid[f][x] || this.grid[f][x] || this.shgrid[f][x];
    }

    // ----- routing -----
    // Backward label-setting Dijkstra towards one destination (floor df, position dx), cached per
    // destination until the structure changes. Cost = felt minutes, energy = resource (labels per
    // state are Pareto-optimal in (cost, energy step)). States: node × {A = just arrived, B = about
    // to board} × {came by elevator}. Elevator→elevator only in lobbies; stairs/escalators connect
    // to anything on any floor. Corridor walks (A→B on one floor, A→destination) cost time and energy.
    _routeTable(df, dx) {
      const key = df * 1000 + Math.round(dx * 2);
      let T = this.routeCache.get(key);
      if (T) return T;
      const nodes = this.nodes, E = CFG.energy, step = E.step, cap = E.max;
      const S = nodes.length * 4;
      const labels = new Array(S), minLvl = new Array(S).fill(Infinity);
      const pq = new Heap();
      const push = (s, t, en, edge) => {
        if (en > cap || Math.floor(en / step) >= minLvl[s]) return;
        pq.push({ t, s, en, edge });
      };
      const dseg = this.segAt(df, dx);
      for (const m of this.floorNodes[df]) {
        if (m.seg !== dseg) continue;
        const d = Math.abs(m.x - dx);
        push(m.i * 4, corrMin(d), corrEn(d), null);
        push(m.i * 4 + 1, corrMin(d), corrEn(d), null);
      }
      while (pq.size) {
        const L = pq.pop(), s = L.s, lvl = Math.floor(L.en / step);
        if (lvl >= minLvl[s]) continue;
        minLvl[s] = lvl;
        (labels[s] || (labels[s] = [])).push(L);
        const n = nodes[s >> 2], e = s & 1;
        if (((s >> 1) & 1) === 0) {
          // A(n, e): reached n by a transport edge (elevator if e = 1, stairs/escalator if e = 0)
          for (const ed of n.inn) {
            const elev = ed.mode === 'elev';
            if (elev !== (e === 1)) continue;
            const pre = ed.from.i * 4 + 2, t = L.t + ed.cost, en = L.en + ed.energy;
            push(pre, t, en, ed);
            if (!elev || this.isLobby(ed.from.f)) push(pre + 1, t, en, ed);
          }
        } else {
          // B(n, e): walked here along the corridor from any arrival point on this floor
          for (const m of this.floorNodes[n.f]) {
            if (m.seg !== n.seg) continue;
            const d = Math.abs(m.x - n.x);
            push(m.i * 4 + e, L.t + corrMin(d), L.en + corrEn(d), null);
          }
        }
      }
      T = { labels };
      this.routeCache.set(key, T);
      return T;
    }

    // Best next move from (f, x) for someone with `energy` left. withQueues adds a penalty for the
    // people already queueing at an elevator door (live, not cached).
    // Returns {mode: 'final'|'elev'|'link', edge, cost, energy} or null (no way that energy allows).
    _plan(f, x, byElev, energy, dest, withQueues) {
      const T = this._routeTable(dest.f, dest.x), e = byElev ? 1 : 0, lim = energy + 1e-9;
      let best = null, bc = Infinity;
      const pseg = this.segAt(f, x);
      if (f === dest.f && pseg === this.segAt(dest.f, dest.x)) {
        const d = Math.abs(x - dest.x);
        if (corrEn(d) <= lim) { bc = corrMin(d); best = { mode: 'final', edge: null, cost: bc, energy: corrEn(d) }; }
      }
      for (const n of this.floorNodes[f]) {
        if (n.seg !== pseg) continue;
        const ls = T.labels[n.i * 4 + 2 + e];
        if (!ls) continue;
        const d = Math.abs(x - n.x), ce = corrEn(d), cm = corrMin(d);
        for (const L of ls) {                       // sorted by cost; first affordable one is best
          if (ce + L.en > lim) continue;
          let c = cm + L.t;
          if (withQueues && n.shaft) {
            const s = n.shaft, i = f - s.f0, q = L.edge.toF > f ? s.qUp[i] : s.qDown[i];
            c += q.length * CFG.route.queuePenalty / s.cars.length;
          }
          if (c < bc) { bc = c; best = { mode: L.edge.mode, edge: L.edge, cost: c, energy: ce + L.en }; }
          break;
        }
      }
      return best;
    }

    // can a fresh person (reference energy) get from the street entrance to this room?
    roomReachable(r) {
      let v = this.reachCache.get(r.id);
      if (v === undefined) {
        v = !!this._plan(0, CFG.ENTRANCE_X, false, CFG.energy.ref, { f: r.f, x: r.x + r.w / 2 }, false);
        this.reachCache.set(r.id, v);
      }
      return v;
    }

    // floor a → floor b (entrance resp. floor middle), reference energy
    reachable(a, b) {
      if (a === b) return true;
      return !!this._plan(a, a === 0 ? CFG.ENTRANCE_X : CFG.W / 2, false, CFG.energy.ref, { f: b, x: CFG.W / 2 }, false);
    }

    // ----- building -----
    checkRoom(type, f, x) {
      const def = CFG.rooms[type];
      if (!def) return { ok: false, reason: 'Unbekannt' };
      x = Math.max(0, Math.min(CFG.W - def.w, x));
      const res = { ok: false, x, cost: def.cost };
      if (f < 1) { res.reason = 'Im EG ist die Lobby'; return res; }
      if (f > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      if (type === 'skylobby' && f % CFG.SKY_EVERY !== 0) { res.reason = 'Sky-Lobby nur im 15., 30. oder 45. OG'; return res; }
      for (let i = x; i < x + def.w; i++) if (this.grid[f][i]) { res.reason = 'Platz ist belegt'; return res; }
      const ext = this.floorExtent(f - 1);
      if (!ext || x < ext[0] || x + def.w - 1 > ext[1]) { res.reason = 'Darunter fehlt das Fundament'; return res; }
      if (this.money < def.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildRoom(type, f, x) {
      const c = this.checkRoom(type, f, x);
      if (!c.ok) return c;
      this.money -= c.cost;
      const r = this._makeRoom({ id: this.nextId++, type, f, x: c.x });
      this.rooms.push(r);
      for (let i = r.x; i < r.x + r.w; i++) this.shellRows[f][i] = 0;
      this._afterChange();
      return c;
    }

    // shell floor: fills the whole gap around tile x on floor f (as far as the floor below carries)
    checkShell(f, x) {
      x = Math.max(0, Math.min(CFG.W - 1, x));
      const res = { ok: false, f, x, w: 1, cost: CFG.shell.cost };
      if (f < 1) { res.reason = 'Im EG ist die Lobby'; return res; }
      if (f > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      const free = i => !this.grid[f][i] && !this.shellRows[f][i];
      if (!free(x)) { res.reason = 'Hier ist schon Boden'; return res; }
      const ext = this.floorExtent(f - 1);
      if (!ext || x < ext[0] || x > ext[1]) { res.reason = 'Darunter fehlt das Fundament'; return res; }
      let a = x, b = x;
      while (a - 1 >= ext[0] && free(a - 1)) a--;
      while (b + 1 <= ext[1] && free(b + 1)) b++;
      res.x = a; res.w = b - a + 1; res.cost = res.w * CFG.shell.cost;
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildShell(f, x) {
      const c = this.checkShell(f, x);
      if (!c.ok) return c;
      this.money -= c.cost;
      for (let i = c.x; i < c.x + c.w; i++) this.shellRows[f][i] = 1;
      this._afterChange();
      return c;
    }

    // free shell under every gap inside the old floor extent (rooms + shafts), bottom up – old saves
    // and sim_check towers keep their continuous corridors
    closeAllGaps() {
      for (let f = 1; f <= CFG.MAX_FLOOR; f++) {
        let lo = -1, hi = -1;
        for (let x = 0; x < CFG.W; x++) if (this.grid[f][x] || this.sgrid[f][x]) { if (lo < 0) lo = x; hi = x; }
        if (lo < 0) continue;
        for (let x = lo; x <= hi; x++) if (!this.grid[f][x]) this.shellRows[f][x] = 1;
      }
      this._afterChange();
    }

    shaftCost(kind, f0, f1) { const d = CFG.shafts[kind]; return d.base + d.perFloor * (f1 - f0); }

    checkShaft(kind, c, fa, fb) {
      const def = CFG.shafts[kind];
      const f0 = Math.min(fa, fb), f1 = Math.max(fa, fb);
      const res = { ok: false, f0, f1, c, cost: this.shaftCost(kind, f0, f1) };
      if (c < 0 || c >= CFG.W) { res.reason = 'Außerhalb'; return res; }
      if (f1 === f0) { res.reason = 'Mindestens zwei Etagen'; return res; }
      if (f1 - f0 > def.maxSpan) { res.reason = def.label + ' schafft höchstens ' + def.maxSpan + ' Etagen'; return res; }
      if (f1 > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      for (let f = f0; f <= f1; f++) if (this.sgrid[f][c]) { res.reason = 'Da steht schon ein Aufzug (' + floorName(f) + ')'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildShaft(kind, c, fa, fb) {
      const r = this.checkShaft(kind, c, fa, fb);
      if (!r.ok) return r;
      this.money -= r.cost;
      this.shafts.push(this._makeShaft({ id: this.nextId++, kind, c, f0: r.f0, f1: r.f1, nCars: 1 }));
      this._afterChange();
      return r;
    }

    checkLink(kind, f, x) {
      const def = CFG.links[kind];
      x = Math.max(0, Math.min(CFG.W - def.w, x));
      const res = { ok: false, x, f, cost: def.cost };
      if (f < 0 || f + 1 > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      for (let i = x; i < x + def.w; i++) if (this.lgrid[f][i]) { res.reason = 'Da ist schon eine Treppe'; return res; }
      if (this.money < def.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    buildLink(kind, f, x) {
      const r = this.checkLink(kind, f, x);
      if (!r.ok) return r;
      this.money -= r.cost;
      this.links.push(this._makeLink({ id: this.nextId++, kind, f, x: r.x }));
      this._afterChange();
      return r;
    }

    // extend an existing shaft by one floor: dir > 0 at the top, dir < 0 at the bottom (costs perFloor)
    checkExtend(s, dir) {
      const def = CFG.shafts[s.kind];
      const f = dir > 0 ? s.f1 + 1 : s.f0 - 1;
      const res = { ok: false, f, cost: def.perFloor };
      if (f < 0) { res.reason = 'Tiefer als das Erdgeschoss geht nicht'; return res; }
      if (s.f1 - s.f0 + 1 > def.maxSpan) { res.reason = def.label + ' schafft höchstens ' + def.maxSpan + ' Etagen'; return res; }
      if (f > this.maxFloor) { res.reason = 'Höher geht es erst mit mehr Sternen'; return res; }
      if (this.sgrid[f] && this.sgrid[f][s.c]) { res.reason = 'Da steht schon ein Aufzug (' + floorName(f) + ')'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    extendShaft(s, dir) {
      const r = this.checkExtend(s, dir);
      if (!r.ok) return r;
      this.money -= r.cost;
      // queues are indexed by (floor - f0); shifting all arrays together keeps waiting people in their queue
      if (dir > 0) { s.f1 = r.f; s.stops.push(true); s.qUp.push([]); s.qDown.push([]); }
      else { s.f0 = r.f; s.stops.unshift(true); s.qUp.unshift([]); s.qDown.unshift([]); }
      this._afterChange();
      return r;
    }

    addCar(s) {
      const d = CFG.shafts[s.kind];
      if (s.cars.length >= d.maxCars) return { ok: false, reason: 'Mehr Kabinen passen nicht' };
      if (this.money < d.car) return { ok: false, reason: 'Zu wenig Geld' };
      this.money -= d.car;
      s.cars.push(this._makeCar(s));
      return { ok: true };
    }

    removeCar(s) {
      if (s.cars.length <= 1) return { ok: false, reason: 'Eine Kabine bleibt' };
      // take an empty car if possible
      let i = s.cars.findIndex(c => c.pax.length === 0);
      if (i < 0) i = s.cars.length - 1;
      const car = s.cars.splice(i, 1)[0];
      for (const p of car.pax) this._dropFromCar(p, s, car);
      return { ok: true };
    }

    toggleStop(s, f) {
      if (f < s.f0 || f > s.f1) return;
      s.stops[f - s.f0] = !s.stops[f - s.f0];
      this._afterChange();
    }

    // would anything float if o were gone?
    _supportOk(o) {
      const cells = [];
      if (o.isShell) for (let x = o.x; x < o.x + o.w; x++) this.shellRows[o.f][x] = 0;
      else {
        const g = o.cars ? this.sgrid : this.grid;
        for (let f = 0; f <= CFG.MAX_FLOOR; f++) for (let x = 0; x < CFG.W; x++) if (g[f][x] === o) { cells.push([g, f, x]); g[f][x] = null; }
      }
      let ok = true;
      for (const r of [...this.rooms, ...this.shells]) {
        if (r === o || r.f < 1) continue;
        const ext = this.floorExtent(r.f - 1);
        if (!ext || r.x < ext[0] || r.x + r.w - 1 > ext[1]) { ok = false; break; }
      }
      if (o.isShell) for (let x = o.x; x < o.x + o.w; x++) this.shellRows[o.f][x] = 1;
      for (const [g, f, x] of cells) g[f][x] = o;
      return ok;
    }

    demolishAt(f, x) {
      const o = this.objectAt(f, x);
      if (!o) return { ok: false, reason: 'Hier steht nichts' };
      if (o.isLink) {
        this.links = this.links.filter(l => l !== o);
        for (const p of this.climbing) if (p.link === o) this._finishClimb(p, true);
        this._afterChange();
        return { ok: true };
      }
      if (!this._supportOk(o)) return { ok: false, reason: 'Darauf steht noch etwas' };
      if (o.isShell) {
        for (let i = o.x; i < o.x + o.w; i++) this.shellRows[o.f][i] = 0;
      } else if (o.cars) {
        this.shafts = this.shafts.filter(s => s !== o);
        for (const car of o.cars) for (const p of car.pax.slice()) this._dropFromCar(p, o, car, true);
        for (const q of [...o.qUp, ...o.qDown]) for (const p of q) p.state = 'stranded';
      } else {
        // anything stacked on top would float – only allow if nothing above relies on it
        this.rooms = this.rooms.filter(r => r !== o);
        for (let i = o.x; i < o.x + o.w; i++) this.shellRows[o.f][i] = 1;   // the shell stays
        for (const p of o.people.slice()) this._kill(p);
        for (const p of this.persons) if (p.dest && p.dest.room === o) p.dest = { f: 0, x: CFG.ENTRANCE_X, room: null };
        if (o.type === 'restaurant') for (const p of this.persons) if (p.state === 'in' && p.where === o) {
          if (p.kind === 'visitor') this._kill(p); else this._teleportHome(p);
        }
      }
      this._afterChange();
      return { ok: true };
    }

    _afterChange() {
      this._structureChanged();
      // replan everyone waiting or heading to a queue
      for (const p of this.persons) {
        if (p.state === 'stranded') { this._nextLeg(p); continue; }
        if (p.state === 'wait') { this._drainWait(p); this._unqueue(p); this._nextLeg(p); continue; }
        if (p.state === 'walk' && (p.after === 'queue' || p.after === 'link')) { this._nextLeg(p); continue; }
      }
      for (const s of this.shafts) for (const car of s.cars) for (const p of car.pax) {
        if (!this.serves(s, p.legTo)) p.legTo = this._nearestStop(s, p.legTo);
      }
    }

    _nearestStop(s, f) {
      let best = s.f0, bd = Infinity;
      for (let g = s.f0; g <= s.f1; g++) if (this.serves(s, g) && Math.abs(g - f) < bd) { bd = Math.abs(g - f); best = g; }
      return best;
    }

    // ----- people -----
    _newPerson(kind, home) {
      const p = { id: this.nextId++, kind, home, f: 0, x: CFG.ENTRANCE_X, state: 'out', where: null, dest: null, legTo: 0, shaft: null, after: null, tx: 0, tripStart: 0, waitStart: 0, scoreRoom: home, dead: false };
      // personal maximum energy: from the game seed (not from this.rand, so the day's random
      // stream stays as it was); tenants keyed by room, slot and tenancy so a save reloads the same people
      const key = home ? home.id * 64 + home.people.length + 4099 * (home.tenancy || 0) : p.id;
      p.eMax = this._energyMax(key);
      p.energy = p.eMax; p.restT = this.t; p.restRate = CFG.energy.recoverPerHour;
      this.persons.add(p);
      if (home) home.people.push(p);
      return p;
    }

    _energyMax(key) {
      const E = CFG.energy;
      const r = mulberry32((this.seed ^ Math.imul(key + 1, 0x9E3779B1)) | 0)();
      return Math.round(E.min + r * (E.max - E.min));
    }

    // ----- energy -----
    // felt-time multiplier for someone with energy en
    _tiredMult(p, en) {
      const E = CFG.energy, k = 1 - en / (E.tiredBelow * p.eMax);
      return 1 + E.tiredFactor * Math.max(0, Math.min(1, k));
    }

    // spend energy over `sec` seconds of a trip part that counts comfort-fold; tiredness makes it feel longer
    _spend(p, en, sec, comfort) {
      const before = p.energy;
      p.energy = Math.max(0, before - en);
      p.extra = (p.extra || 0) + sec * comfort * (this._tiredMult(p, (before + p.energy) / 2) - 1);
    }

    // standing in a queue: settle the energy since the last mark
    _drainWait(p) {
      const w = this.t - (p.eWaitT ?? this.t);
      p.eWaitT = this.t;
      if (w > 0) this._spend(p, w / 60 * CFG.energy.waitPerMin, w, 1);
    }

    _endRide(p) {
      const w = this.t - (p.rideStart ?? this.t);
      p.rideStart = null;
      if (w > 0) this._spend(p, w / 60 * CFG.energy.ridePerMin, w, 1);
    }

    // start resting (room, restaurant or street)
    _restFrom(p, room) {
      p.restT = this.t;
      p.restRate = room && room.type === 'restaurant' ? CFG.energy.mealPerHour : CFG.energy.recoverPerHour;
    }

    // collect the rest since _restFrom
    _rest(p) {
      if (p.restT != null) p.energy = Math.min(p.eMax, p.energy + (this.t - p.restT) / 3600 * p.restRate);
      p.restT = null;
    }

    // live energy for the UI
    energyNow(p) {
      if (p.state === 'wait') return Math.max(0, p.energy - (this.t - (p.eWaitT ?? this.t)) / 60 * CFG.energy.waitPerMin);
      if (p.restT != null) return Math.min(p.eMax, p.energy + (this.t - p.restT) / 3600 * p.restRate);
      return p.energy;
    }

    _kill(p) {
      if (p.dead) return;
      p.dead = true;
      if (p.state === 'wait') this._unqueue(p);
      if (p.state === 'ride' && p.car) { const i = p.car.pax.indexOf(p); if (i >= 0) p.car.pax.splice(i, 1); }
      if (p.state === 'in' && p.where) p.where.inside--;
      this.walking.delete(p);
      this.climbing.delete(p);
      this.persons.delete(p);
      if (p.home) { const i = p.home.people.indexOf(p); if (i >= 0) p.home.people.splice(i, 1); }
    }

    _teleportHome(p) {
      if (p.state === 'wait') this._unqueue(p);
      if (p.state === 'in' && p.where) p.where.inside--;
      this.walking.delete(p);
      this.climbing.delete(p);
      p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
      this._restFrom(p, p.home);
    }

    _unqueue(p) {
      const s = p.shaft; if (!s) return;
      const i = p.f - s.f0;
      for (const q of [s.qUp[i], s.qDown[i]]) { if (!q) continue; const k = q.indexOf(p); if (k >= 0) q.splice(k, 1); }
    }

    _dropFromCar(p, s, car, shaftGone) {
      const i = car.pax.indexOf(p); if (i >= 0) car.pax.splice(i, 1);
      this._endRide(p);
      p.f = Math.max(s.f0, Math.min(s.f1, Math.round(car.y)));
      p.x = s.c + 0.8; p.car = null; p.byElev = false;
      p.state = shaftGone ? 'stranded' : 'walk';
      if (!shaftGone) this._nextLeg(p);
    }

    // start a trip from where the person is now to dest {f, x, room|null}
    _startTrip(p, dest) {
      if (p.state === 'in' && p.where) { p.where.inside--; p.f = p.where.f; p.x = p.where.x + p.where.w / 2; }
      else if (p.state === 'out') { p.f = 0; p.x = CFG.ENTRANCE_X + (this.rand() - 0.5) * 2; }
      this._rest(p);
      p.where = null;
      p.dest = dest;
      p.tripStart = this.t;
      p.tripF0 = p.f; p.tripLink = false; p.tripElev = false;
      p.extra = 0; p.byElev = false;
      this._nextLeg(p);
    }

    _nextLeg(p) {
      if (p.dead) return;
      const pl = this._plan(p.f, p.x, p.byElev, p.energy, p.dest, true);
      if (!pl) { this._fail(p); return; }
      if (pl.mode === 'final') { this._walk(p, p.dest.x, 'final'); return; }
      const ed = pl.edge;
      p.legTo = ed.toF;
      if (ed.mode === 'link') {
        p.link = ed.link;
        this._walk(p, ed.from.x, 'link');
        return;
      }
      p.shaft = ed.shaft;
      let side = ed.toF > p.f ? -0.7 : 0.7;
      if (!this.walkable(p.f, ed.shaft.c + Math.sign(side))) side = -side;   // only one side has floor
      this._walk(p, ed.shaft.c + 0.5 + side, 'queue');
    }

    _startClimb(p) {
      const l = p.link;
      if (!this.links.includes(l)) { this._nextLeg(p); return; }
      const d = CFG.links[l.kind], up = p.legTo > p.f;
      p.state = 'climb';
      p.climb = { t0: this.t, dur: up ? d.up : d.down, from: p.f, to: p.legTo,
        x0: up ? l.x + 0.3 : l.x + l.w - 0.3, x1: up ? l.x + l.w - 0.3 : l.x + 0.3, comfort: d.comfort, energy: up ? d.energyUp : d.energyDown };
      p.cy = p.f;
      this.climbing.add(p);
    }

    _finishClimb(p, abort) {
      const c = p.climb;
      this.climbing.delete(p);
      p.f = c.to; p.x = c.x1; p.cy = null; p.byElev = false;
      p.extra = (p.extra || 0) + c.dur * (c.comfort - 1);
      this._spend(p, c.energy, c.dur, c.comfort);
      p.tripLink = true;
      if (!abort) p.link.used++;
      p.state = 'walk';
      this._nextLeg(p);
    }

    _walk(p, tx, after) {
      p.state = 'walk'; p.tx = Math.max(0.2, Math.min(CFG.W - 0.2, tx)); p.after = after;
      this.walking.add(p);
    }

    _fail(p) {
      // no way to get there (or not with the energy left): a very bad trip, person gives up
      this._record(p, 60 * 60);
      this.today.fails = (this.today.fails || 0) + 1;
      if (p.scoreRoom) p.scoreRoom.failN++;
      this.walking.delete(p);
      if (p.kind === 'visitor') { this._kill(p); return; }
      if (p.dest.room && p.dest.room === p.home) {
        // can't reach own room -> stays out (worker) / teleports home (resident) to keep the day consistent
        if (p.kind === 'resident') { p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++; this._restFrom(p, p.home); }
        else { p.state = 'out'; p.f = 0; this._restFrom(p, null); }
      } else if (p.home) {
        // trip elsewhere failed: return home instantly
        p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
        p.pendingBack = null;
        this._restFrom(p, p.home);
      } else { p.state = 'out'; this._restFrom(p, null); }
    }

    _record(p, seconds) {
      const r = p.scoreRoom; if (!r) return;
      r.tripSum += seconds / 60; r.tripN++;
    }

    _arrive(p) {
      const felt = this.t - p.tripStart + (p.extra || 0);
      this._record(p, felt);
      // statistics: energy share at arrival, felt minutes, mode by floors travelled
      const T = this.today, ef = p.energy / p.eMax;
      if (p.scoreRoom) { p.scoreRoom.eSum += ef; p.scoreRoom.eN++; }
      T.eSum = (T.eSum || 0) + ef; T.feltSum = (T.feltSum || 0) + felt / 60; T.tripN = (T.tripN || 0) + 1;
      const dist = Math.abs(p.dest.f - p.tripF0);
      if (dist > 0) {
        const m = T.modes || (T.modes = {});
        const b = m[dist] || (m[dist] = { n: 0, walk: 0, elev: 0, both: 0 });
        b.n++; if (p.tripLink && p.tripElev) b.both++; else if (p.tripLink) b.walk++; else b.elev++;
      }
      const d = p.dest;
      if (d.room) {
        if (!this.rooms.includes(d.room)) { this._startTrip(p, { f: 0, x: CFG.ENTRANCE_X, room: null }); return; }
        p.state = 'in'; p.where = d.room; d.room.inside++;
        this._restFrom(p, d.room);
        if (d.room.type === 'restaurant') {
          this.money += CFG.rooms.restaurant.price; this.today.guests++;
          this._schedule(this.t + (p.kind === 'visitor' ? hm(0, 40) : hm(0, 35)), p, p.kind === 'visitor' ? 'leave' : 'backFromMeal');
        }
      } else {
        p.state = 'out'; p.f = 0;
        this._restFrom(p, null);
        if (p.kind === 'visitor') this._kill(p);
        else if (p.pendingBack) { const a = p.pendingBack; p.pendingBack = null; this._schedule(this.t + hm(0, 45), p, a); }
      }
    }

    _schedule(t, p, act) { if (t < CFG.DAY_END) this.events.push({ t, p, act }); }

    _doEvent(e) {
      const p = e.p;
      if (p.dead) return;
      const busy = p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb';
      if (busy) { this._schedule(this.t + 600, p, e.act); return; }
      const home = p.home;
      const toHome = () => ({ f: home.f, x: home.x + home.w / 2, room: home });
      const out = () => ({ f: 0, x: CFG.ENTRANCE_X, room: null });
      switch (e.act) {
        case 'arrive':            // worker comes to office / resident comes home / visitor to restaurant
          if (p.state !== 'out') return;
          if (p.kind === 'visitor') this._startTrip(p, { f: p.target.f, x: p.target.x + p.target.w / 2, room: p.target });
          else this._startTrip(p, toHome());
          break;
        case 'leave':             // to the street
          if (p.state !== 'in') return;
          this._startTrip(p, out());
          break;
        case 'meal': {            // lunch / dinner: restaurant if one is reachable and has seats, else outside
          if (p.state !== 'in') return;
          const r = this._pickRestaurant(p);
          if (r) this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r });
          else { p.pendingBack = 'arrive'; this._startTrip(p, out()); }
          break;
        }
        case 'backFromMeal':
          if (p.state !== 'in') return;
          this._startTrip(p, toHome());
          break;
      }
    }

    // nearest (in felt time) restaurant with free seats that p can reach with the energy p has now
    _pickRestaurant(p) {
      const x = p.where ? p.where.x + p.where.w / 2 : p.x, en = this.energyNow(p);
      let best = null, bc = Infinity;
      for (const r of this.rooms) {
        if (r.type !== 'restaurant' || r.inside >= CFG.rooms.restaurant.seats) continue;
        const pl = this._plan(p.f, x, false, en, { f: r.f, x: r.x + r.w / 2 }, false);
        if (pl && pl.cost < bc) { bc = pl.cost; best = r; }
      }
      return best;
    }

    // ----- day cycle -----
    _startDay() {
      this.rand = mulberry32(this.seed + this.day * 7919);
      this.t = CFG.DAY_START;
      this.events = new Heap();
      this.walking.clear(); this.climbing.clear();
      for (const l of this.links) l.used = 0;
      for (const p of [...this.persons]) if (p.kind === 'visitor') this._kill(p);
      for (const s of this.shafts) {
        for (let i = 0; i < s.qUp.length; i++) { s.qUp[i] = []; s.qDown[i] = []; }
        for (const car of s.cars) { car.pax = []; car.state = 'idle'; car.dir = 0; car.target = null; }
        s.waitSum = 0; s.waitN = 0;
      }
      this.today = { rent: 0, guests: 0, waitSum: 0, waitN: 0 };
      const R = this.rand;
      for (const r of this.rooms) { r.tripSum = 0; r.tripN = 0; r.inside = 0; r.eSum = 0; r.eN = 0; r.failN = 0; }

      this._hour = Math.floor(this.t / 3600);
      this._rentTick(0.6, false);

      // daily schedules
      const uni = (a, b) => a + R() * (b - a);
      for (const p of this.persons) {
        p.pendingBack = null; p.car = null;
        p.energy = p.eMax; p.restT = this.t; p.restRate = CFG.energy.recoverPerHour;   // a night's sleep
        if (p.kind === 'worker') {
          p.state = 'out'; p.f = 0; p.where = null;
          this._schedule(uni(hm(7, 30), hm(9, 0)), p, 'arrive');
          if (R() < 0.6) this._schedule(uni(hm(11, 45), hm(12, 45)), p, 'meal');
          this._schedule(uni(hm(17, 0), hm(18, 30)), p, 'leave');
        } else if (p.kind === 'resident') {
          p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
          if (R() < 0.75) {
            this._schedule(uni(hm(6, 45), hm(8, 30)), p, 'leave');
            this._schedule(uni(hm(16, 30), hm(19, 30)), p, 'arrive');
          }
          if (R() < 0.3) this._schedule(uni(hm(19, 30), hm(20, 30)), p, 'meal');
        }
      }

      // restaurant visitors from outside
      for (const r of this.rooms) {
        if (r.type !== 'restaurant' || !this.roomReachable(r)) continue;
        const q = r.score == null || r.score <= CFG.goodMin ? 1 : r.score <= CFG.okMin ? 0.7 : 0.4;
        const n = Math.round((10 + 4 * this.stars) * q);
        for (const [a, b] of [[hm(11, 30), hm(13, 30)], [hm(18, 0), hm(20, 30)]]) {
          for (let i = 0; i < n; i++) {
            const v = this._newPerson('visitor', null);
            v.target = r; v.scoreRoom = r;
            this._schedule(uni(a, b), v, 'arrive');
          }
        }
      }
    }

    // vacant, reachable rooms find tenants with probability p
    _rentTick(p, midday) {
      const R = this.rand;
      for (const r of this.rooms) {
        if ((r.type !== 'office' && r.type !== 'condo') || r.occupied) continue;
        if (!this.roomReachable(r) || R() >= p) continue;
        r.occupied = true; r.score = null; r.badNights = 0; r.tenancy++;
        const kind = r.type === 'office' ? 'worker' : 'resident';
        for (let i = 0; i < CFG.rooms[r.type].cap; i++) {
          const q = this._newPerson(kind, r);
          if (!midday) continue;
          // moving in now: come from the street, workers go home in the evening
          this._schedule(this.t + R() * 1800, q, 'arrive');
          if (kind === 'worker') this._schedule(Math.max(this.t + 3600, hm(17, 0) + R() * hm(1, 30)), q, 'leave');
        }
        this.msg('Neue Mieter: ' + CFG.rooms[r.type].label + ' ' + floorName(r.f), 'good');
        this._emit('movein', { room: r });
      }
    }

    _endDay() {
      // unfinished trips count with the time spent so far
      for (const p of this.persons) {
        if (p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb') this._record(p, this.t - p.tripStart + 15 * 60);
      }
      let rent = 0, upkeep = 0;
      const moved = [];
      for (const r of this.rooms) {
        const def = CFG.rooms[r.type];
        if (r.eN) r.eLast = r.eSum / r.eN;
        r.lastFails = r.failN;
        if (r.type === 'office' || r.type === 'condo') {
          if (!r.occupied) continue;
          rent += def.rent;
          if (r.tripN > 0) {
            const avg = r.tripSum / r.tripN;
            r.score = r.score == null ? avg : 0.5 * r.score + 0.5 * avg;
            r.lastAvg = avg;
          }
          if (r.score != null && r.score > CFG.okMin) r.badNights++; else r.badNights = 0;
          if (r.badNights >= 2) moved.push(r);
        } else if (r.type === 'restaurant' && r.tripN > 0) {
          const avg = r.tripSum / r.tripN;
          r.score = r.score == null ? avg : 0.5 * r.score + 0.5 * avg;
          r.lastAvg = avg;
        }
      }
      for (const s of this.shafts) upkeep += CFG.shafts[s.kind].upkeep * s.cars.length;
      for (const l of this.links) upkeep += CFG.links[l.kind].upkeep;
      this.money += rent - upkeep;
      const T = this.today;
      this.lastDay = { day: this.day, rent, upkeep, guests: T.guests, guestIncome: T.guests * CFG.rooms.restaurant.price, avgWait: T.waitN ? T.waitSum / T.waitN / 60 : 0, movedOut: moved.length,
        avgFelt: T.tripN ? T.feltSum / T.tripN : 0, avgEnergy: T.tripN ? T.eSum / T.tripN : 1, fails: T.fails || 0, modes: T.modes || {} };
      for (const r of moved) {
        this.msg(CFG.rooms[r.type].label + ' ' + floorName(r.f) + ' zieht aus – Ø ' + Math.round(r.score) + ' Min. pro Weg', 'bad');
        this._emit('moveout', { room: r });
        for (const p of r.people.slice()) this._kill(p);
        r.occupied = false; r.score = null; r.badNights = 0;
      }
      // stats + stars
      const occ = this.rooms.filter(r => (r.type === 'office' || r.type === 'condo') && r.occupied);
      const okRooms = occ.filter(r => r.score == null || r.score <= CFG.okMin).length;
      this.sat = occ.length ? okRooms / occ.length : 1;
      const pop = this.population;
      while (this.stars < CFG.stars.length) {
        const req = CFG.stars[this.stars];
        const rest = this.rooms.filter(r => r.type === 'restaurant').length;
        if (pop >= req.pop && this.sat >= req.sat && rest >= (req.restaurants || 0)) {
          this.stars++;
          this.msg('★ Neuer Stern! Jetzt ' + this.stars + ' Sterne – bauen bis ' + floorName(this.maxFloor), 'star');
          this._emit('star', { stars: this.stars });
        } else break;
      }
      if (this.stars >= CFG.stars.length && !this.won) { this.won = true; this.msg('🏆 4 Sterne – Ziel des Prototyps erreicht!', 'star'); }
      this.msg('Tag ' + this.day + ': +' + rent.toLocaleString('de-DE') + ' € Miete, +' + this.lastDay.guestIncome.toLocaleString('de-DE') + ' € Restaurant, −' + upkeep.toLocaleString('de-DE') + ' € Wartung', 'day');
      this._emit('day', this.lastDay);
      this.day++;
      if (this.onDayEnd) this.onDayEnd();
      this._startDay();
    }

    get population() {
      let n = 0;
      for (const r of this.rooms) if (r.occupied) n += CFG.rooms[r.type].cap || 0;
      return n;
    }

    nextStarReq() { return this.stars < CFG.stars.length ? CFG.stars[this.stars] : null; }

    // ----- simulation step -----
    step(dt) {
      const SUB = 2;
      while (dt > 0) {
        const d = Math.min(SUB, dt); dt -= d;
        this.t += d;
        const h = Math.floor(this.t / 3600);
        if (h !== this._hour) { this._hour = h; if (h >= 7 && h <= 18) this._rentTick(0.25, true); }
        while (this.events.size && this.events.peek().t <= this.t) this._doEvent(this.events.pop());
        for (const p of this.walking) {
          const dx = p.tx - p.x, m = CFG.walkSpeed * d;
          this._spend(p, Math.min(m, Math.abs(dx)) * CFG.energy.corridor, d, 1);
          if (Math.abs(dx) <= m) {
            p.x = p.tx; this.walking.delete(p);
            if (p.after === 'queue') this._enqueue(p); else if (p.after === 'link') this._startClimb(p); else this._arrive(p);
          } else p.x += Math.sign(dx) * m;
        }
        for (const p of this.climbing) {
          const c = p.climb, k = (this.t - c.t0) / c.dur;
          if (k >= 1) this._finishClimb(p, false);
          else { p.cy = c.from + (c.to - c.from) * k; p.x = c.x0 + (c.x1 - c.x0) * k; }
        }
        for (const s of this.shafts) for (const car of s.cars) this._stepCar(s, car, d);
        if (this.t >= CFG.DAY_END) { this._endDay(); }
      }
    }

    _enqueue(p) {
      const s = p.shaft;
      if (!this.shafts.includes(s) || !this.serves(s, p.f) || !this.serves(s, p.legTo)) { this._nextLeg(p); return; }
      p.state = 'wait'; p.waitStart = this.t; p.eWaitT = this.t;
      const i = p.f - s.f0;
      (p.legTo > p.f ? s.qUp : s.qDown)[i].push(p);
    }

    _hasQueue(s, f) { const i = f - s.f0; return s.qUp[i].length > 0 || s.qDown[i].length > 0; }

    _requestsBeyond(s, car, from, dir) {
      for (const p of car.pax) if ((p.legTo - from) * dir > 0) return true;
      for (let f = from + dir; f >= s.f0 && f <= s.f1; f += dir) if (this._hasQueue(s, f)) return true;
      return false;
    }

    _board(s, car, f) {
      const i = f - s.f0;
      if (car.dir === 0) car.dir = s.qUp[i].length ? 1 : s.qDown[i].length ? -1 : 0;
      if (car.dir === 0) return 0;
      const q = car.dir > 0 ? s.qUp[i] : s.qDown[i];
      const cap = CFG.shafts[s.kind].cap;
      let n = 0;
      while (q.length && car.pax.length < cap) {
        const p = q.shift();
        const w = this.t - p.waitStart;
        s.waitSum += w; s.waitN++; this.today.waitSum += w; this.today.waitN++;
        this._drainWait(p);
        p.state = 'ride'; p.car = car; car.pax.push(p); n++; p.rideStart = this.t; p.tripElev = true;
      }
      return n;
    }

    _openDoors(s, car, f) {
      car.y = f; car.state = 'doors';
      if (car.target === f) car.target = null;
      let n = 0;
      for (let k = car.pax.length - 1; k >= 0; k--) {
        const p = car.pax[k];
        if (p.legTo !== f) continue;
        car.pax.splice(k, 1); n++;
        this._endRide(p);
        p.f = f; p.x = s.c + 0.5 + (this.rand() < 0.5 ? -0.8 : 0.8); p.car = null; p.state = 'walk'; p.byElev = true;
        this._nextLeg(p);
      }
      if (car.dir !== 0 && car.pax.length === 0 && !this._requestsBeyond(s, car, f, car.dir)) {
        const i = f - s.f0;
        const same = car.dir > 0 ? s.qUp[i] : s.qDown[i], other = car.dir > 0 ? s.qDown[i] : s.qUp[i];
        if (!same.length && other.length) car.dir = -car.dir;
      }
      n += this._board(s, car, f);
      car.timer = CFG.doorTime + CFG.boardTime * n;
      this._emit('door', { shaft: s, f, n });
    }

    _covered(s, car, f) {
      const cap = CFG.shafts[s.kind].cap;
      for (const c2 of s.cars) {
        if (c2 === car) continue;
        if (c2.target === f) return true;
        if (c2.state === 'doors' && Math.round(c2.y) === f) return true;
        if (c2.state === 'moving' && c2.pax.length < cap && (f - c2.y) * c2.dir > 0) return true;
      }
      return false;
    }

    _stepCar(s, car, dt) {
      const def = CFG.shafts[s.kind];
      if (car.state === 'doors') {
        car.timer -= dt;
        if (car.timer > 0) return;
        const f = Math.round(car.y);
        if (this.serves(s, f)) {
          const n = this._board(s, car, f);
          if (n > 0) { car.timer = CFG.boardTime * n; return; }
        }
        if (car.dir !== 0 && this._requestsBeyond(s, car, f, car.dir)) { car.state = 'moving'; return; }
        if (car.dir !== 0 && this._requestsBeyond(s, car, f, -car.dir)) {
          car.dir = -car.dir;
          if (this.serves(s, f)) { const n = this._board(s, car, f); if (n > 0) { car.timer = CFG.boardTime * n; return; } }
          car.state = 'moving'; return;
        }
        car.dir = 0;
        if (this.serves(s, f) && this._hasQueue(s, f)) { const n = this._board(s, car, f); car.timer = CFG.boardTime * n + 1; return; }
        car.state = 'idle'; car.target = null;
        return;
      }
      if (car.state === 'idle') {
        const cf = Math.round(car.y);
        car.target = null;
        if (car.pax.length) { // safety: never idle with passengers inside
          const p = car.pax[0];
          if (p.legTo === cf) { car.y = cf; this._openDoors(s, car, cf); return; }
          car.dir = p.legTo > car.y ? 1 : -1; car.state = 'moving'; return;
        }
        let best = null, bd = Infinity;
        for (let f = s.f0; f <= s.f1; f++) {
          if (!this._hasQueue(s, f) || this._covered(s, car, f)) continue;
          const d = Math.abs(f - cf);
          if (d < bd) { bd = d; best = f; }
        }
        if (best == null) return;
        if (best === cf && Math.abs(car.y - cf) < 1e-6) { car.dir = 0; this._openDoors(s, car, cf); return; }
        car.target = best; car.dir = best > car.y ? 1 : -1; car.state = 'moving';
        return;
      }
      // moving
      let y = car.y, rem = def.speed * dt;
      while (rem > 0) {
        const next = car.dir > 0 ? Math.floor(y + 1e-6) + 1 : Math.ceil(y - 1e-6) - 1;
        if (next < s.f0 || next > s.f1) { car.y = Math.max(s.f0, Math.min(s.f1, Math.round(y))); car.dir = 0; car.state = 'idle'; car.target = null; return; }
        const dist = Math.abs(next - y);
        if (dist > rem + 1e-6) { y += car.dir * rem; rem = 0; break; }
        y = next; rem = Math.max(0, rem - dist);
        if (this._shouldStop(s, car, next)) { this._openDoors(s, car, next); return; }
      }
      car.y = y;
    }

    _shouldStop(s, car, f) {
      if (!this.serves(s, f)) return false;
      for (const p of car.pax) if (p.legTo === f) return true;
      const i = f - s.f0;
      const q = car.dir > 0 ? s.qUp[i] : s.qDown[i];
      if (q.length && car.pax.length < CFG.shafts[s.kind].cap) return true;
      if (car.target === f) return true;
      if (!this._requestsBeyond(s, car, f, car.dir)) return true;
      return false;
    }

    // ----- info for UI -----
    roomStatus(r) {
      if (r.type === 'skylobby') return 'lobby';
      if ((r.type === 'office' || r.type === 'condo') && !r.occupied) return this.roomReachable(r) ? 'vacant' : 'unreachable';
      if (r.type === 'restaurant' && !this.roomReachable(r)) return 'unreachable';
      const live = r.tripN > 0 ? r.tripSum / r.tripN : null;
      const sc = r.score == null ? live : live == null ? r.score : 0.5 * r.score + 0.5 * live;
      if (sc == null) return 'good';
      return sc <= CFG.goodMin ? 'good' : sc <= CFG.okMin ? 'ok' : 'bad';
    }

    liveAvg(r) { return r.tripN > 0 ? r.tripSum / r.tripN : null; }

    // Ø share of energy left on arrival (today, else yesterday), null = no trips yet
    liveEnergy(r) { return r.eN > 0 ? r.eSum / r.eN : r.eLast; }

    // heatmap "Energie": good = fresh, ok = tired, bad = exhausted
    energyStatus(r) {
      const st = this.roomStatus(r);
      if (st === 'vacant' || st === 'unreachable' || st === 'lobby') return st;
      const e = this.liveEnergy(r);
      if (e == null) return 'none';
      return e >= CFG.energyGood ? 'good' : e >= CFG.energyOk ? 'ok' : 'bad';
    }
  }

  const api = { CFG, Game, floorName, fmtTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TowerEngine = api;
})(this);
