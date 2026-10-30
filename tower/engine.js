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
    // economy (TOWER-a0006 P1): every used floor above the lobby costs upkeep per day, more the
    // higher it is (blocks of 5 floors); rent = potential rent × fulfilment; a small loan as lifeline
    economy: {
      floorUpkeep: 12000,    // € per day for a floor with floor (room or shell), EG free (P2: 13000 → 12000, office lunch costs ~5 % rent)
      floorUpkeepStep: 0.25, // + this share per block of floorBlock floors
      floorBlock: 5,
      loanStep: 100000, loanMax: 300000,
      loanRate: 0.01,        // interest per day on the loan
      loanBlockDays: 3,      // no new loan after this many loss days in a row
      heatEven: 2000,        // heatmap "Geld": |floor net| below this = even, below heatStrong = low
      heatStrong: 10000,
    },
    // wear and maintenance: cars wear per stop with people and per floor driven (CFG.shafts),
    // slow down from slowAt, break down at 100; workshops send mechanics, emergency service on click
    wear: { slowAt: 70, slowFactor: 0.8 },
    serviceAt: 75,           // default wear that opens a job (workshop panel: serviceMin–serviceMax)
    serviceMin: 40, serviceMax: 90,
    repair: { sec: 30 * 60, parts: 5000, blockSec: 30 * 60 },   // blockSec: job pause after a mechanic gave up
    emergency: { cost: 40000, delaySec: 60 * 60 },
    mechanics: { perWorkshop: 2, shiftStart: 6 * 3600, shiftEnd: 22 * 3600 },
    // star = from which star it can be built (default 1). Providers (TOWER-a0006 P2) have seats,
    // a price per visit (Kita: per child and day) and upkeep per day; `no` = text when none is there.
    // P1 money scale: a provider with the traffic of ~10 upscale rooms around it about carries its own
    // upkeep – the profit is in the upgrades it makes possible (+60 % rent net, see tiers)
    rooms: {
      office:      { w: 4, cost: 40000,  rent: 5000, cap: 6, label: 'Büro',       icon: '💼' },
      condo:       { w: 3, cost: 50000,  rent: 3000, cap: 3, label: 'Wohnung',    icon: '🏠' },
      restaurant:  { w: 6, cost: 80000,  price: 80, seats: 24, label: 'Restaurant', icon: '🍽️', no: 'kein Restaurant' },
      skylobby:    { w: 6, cost: 100000, star: 2, label: 'Sky-Lobby', icon: '🛋️' },
      workshop:    { w: 4, cost: 60000,  upkeep: 5000, star: 1, label: 'Werkstatt', icon: '🔧' },
      cafe:        { w: 3, cost: 45000,  seats: 8,  price: 60,  upkeep: 2000, star: 2, label: 'Café',       icon: '☕', no: 'kein Café' },
      daycare:     { w: 4, cost: 70000,  seats: 10, price: 600, upkeep: 4000, star: 2, label: 'Kita',       icon: '🧸', no: 'keine Kita' },
      supermarket: { w: 6, cost: 120000, seats: 16, price: 150, upkeep: 6000, star: 2, walkIn: 30, label: 'Supermarkt', icon: '🛒', no: 'kein Supermarkt' },
      gym:         { w: 5, cost: 90000,  seats: 12, price: 200, upkeep: 2000, star: 2, label: 'Fitness',    icon: '🏋️', no: 'kein Fitness' },
    },
    shafts: {
      normal:  { base: 30000, perFloor: 2000, car: 15000, upkeep: 3000, cap: 10, speed: 1 / 20, maxSpan: 15, maxCars: 4, wearPerStop: 0.015, wearPerFloor: 0.016, label: 'Aufzug' },
      express: { base: 80000, perFloor: 3000, car: 30000, upkeep: 6000, cap: 20, speed: 1 / 8,  maxSpan: 50, maxCars: 4, wearPerStop: 0.015, wearPerFloor: 0.006, star: 2, label: 'Express' },
    },
    // ----- needs, penalties, tiers (TOWER-a0006 P2, concept sections 3–5) -----
    // fulfilment of a need from the felt minutes t to the provider: 1 up to t0, 1 − ((t − t0)/(t1 − t0))^k
    // between, 0 from t1 or unreachable
    needCurve: { t0: 4, t1: 20, k: 2 },
    // who goes where: provider room type (street: the entrance counts as a provider too), start point of the
    // trip ('room' or 'entrance' – forecast and measurement use the same), stay in s, share of people
    // (sport: a trait from the seed, coffee: drawn each day), when = time windows, every = every n-th day
    needs: {
      lunch:     { provider: 'restaurant', street: true, from: 'room', label: 'Mittagessen' },   // the old meal trip (60 % of office people)
      coffee:    { provider: 'cafe', from: 'room', stay: 15 * 60, share: 0.5, when: [[10 * 3600, 10.5 * 3600], [15 * 3600, 15.5 * 3600]], label: 'Kaffee' },
      childcare: { provider: 'daycare', from: 'entrance', stay: 10 * 60, pickup: 16.5 * 3600, label: 'Kinderbetreuung' },
      shopping:  { provider: 'supermarket', from: 'entrance', stay: 20 * 60, every: 2, label: 'Einkauf' },
      sport:     { provider: 'gym', from: 'room', stay: 45 * 60, share: 0.3, when: [[6 * 3600, 8 * 3600], [18 * 3600, 20 * 3600]], label: 'Sport' },
    },
    visitGiveUp: 20 * 60,     // waiting longer than this at a full provider: give up (= 0 for the need)
    walkInHours: [8 * 3600, 20 * 3600],   // walk-in customers (supermarket) from outside
    // tiers 0 standard, 1 upscale, 2 luxury: needs per room type, rent factor, extra upkeep per day as a
    // share of the standard rent (also when vacant), penalty sensitivity; luxury is locked in this run
    tiers: [
      { label: 'Standard', star: 1, rent: 1,   upkeep: 0,   sens: { office: 0.5, condo: 1.0 }, needs: { office: ['lunch'], condo: [] } },
      { label: 'Gehoben',  star: 2, rent: 1.8, upkeep: 0.2, sens: { office: 1.5, condo: 1.5 }, needs: { office: ['lunch', 'coffee', 'childcare'], condo: ['shopping', 'sport'] } },
      // luxury needs (sport for offices, spa, prestige restaurant …) come with ★★★ (follow-up card)
      { label: 'Luxus',    star: 3, rent: 3,   upkeep: 0.6, sens: { office: 1.5, condo: 1.5 }, needs: { office: ['lunch', 'coffee', 'childcare'], condo: ['shopping', 'sport'] }, locked: true },
    ],
    upgradeShare: 0.5,        // upgrading costs this share of the room's build price
    warnBelow: 0.5,           // fulfilment at most this (whole percent as shown) = below the threshold. Not "below":
                              // a flat with one of two needs gone sits at exactly 50 %
    // crumbling instead of jumping (TOWER-a0007): a room is below the threshold on a day with a bad trip
    // rating (score > okMin) or fulfilment at most warnBelow; warnDays counts such days in a row, one good
    // day resets it. While warnDays >= 1 the tenants may go any hour in moveOutHours, with the day's
    // probability moveOutP[warnDays - 1] (last entry from then on) spread over those hours
    moveOutP: [0.05, 0.10, 0.20, 0.30, 0.40],   // card: 0.10 … 0.90 – tuned (README: Balance-Befund TOWER-a0007)
    moveOutHours: [7, 20],
    warnNearWait: 0.8,        // yellow sign: trip rating above this share of okMin ...
    warnNearNeed: 0.6,        // ... or fulfilment at most this (but above warnBelow)
    // demand instead of everyone at once: per hour in demandHours at most ceil(occupied offices+flats /
    // demandPer) move-ins (at least 1), each into a random vacant reachable room
    demandPer: 100,           // card: 25 – tuned; below 100 rooms the minimum of 1 per hour rules
    demandHours: [7, 18],
    moveInMin: 0.6,           // new tenants only if the forecast is at least this ...
    moveInRamp: 0.3,          // ... and only for sure from moveInMin + this (in between: chance grows linearly)
    // penalties (noise, smell) go through walls: d = max(|Δfloor|, gap between room edges / 6),
    // penalty s × (1 − d / r) for d < r, the strongest source counts, × sensitivity of the room
    noise: {
      workshop:    { r: 1.5, s: 0.3 },
      daycare:     { r: 1.5, s: 0.2 },
      supermarket: { r: 1.5, s: 0.2 },
      gym:         { r: 1,   s: 0.15 },
      restaurant:  { r: 1,   s: 0.1 },
    },
    needHeat: { good: 0.8 },             // heatmap "Bedürfnisse": fulfilment >= good, above warnBelow ok, else bad
    noiseHeat: { ok: 0.01, bad: 0.15 },  // heatmap "Lärm": penalty below ok = good, below bad = ok
    // stairs/escalators connect floor f with f+1; no waiting, but slow and less comfortable.
    // up/down = game seconds per floor, comfort = factor on the felt time of that part of the trip,
    // energyUp/energyDown = energy per floor
    links: {
      stairs:    { w: 2, cost: 5000,  upkeep: 0,    up: 60, down: 40, comfort: 2.0, energyUp: 15, energyDown: 8, label: 'Treppe',     icon: '🪜' },
      escalator: { w: 3, cost: 20000, upkeep: 1000, up: 30, down: 30, comfort: 1.2, energyUp: 4,  energyDown: 4, label: 'Rolltreppe', icon: '↗️' },
    },
    // shell floor ("Rohbau"): bare floor to close gaps; people only walk and queue on built floor
    // (rooms, shell, the lobby). Building fills the whole gap around the tapped tile.
    shell: { cost: 1000, label: 'Rohbau', icon: '🧱' },
    seasonDays: 5,         // days per season (spring, summer, autumn, winter) – looks only
    // index = stars - 1; requirement to REACH this star, maxFloor unlocked with it
    stars: [
      { maxFloor: 15 },
      { pop: 100, sat: 0.70, maxFloor: 30 },
      { pop: 300, sat: 0.75, restaurants: 1, upgraded: 10, maxFloor: 50 },   // upgraded: rooms on tier ≥ 1 (occupied)
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
  const isTenantRoom = r => r.type === 'office' || r.type === 'condo';
  // fulfilment of a need for `min` felt minutes to the provider (null = unreachable)
  function needShare(min) {
    const C = CFG.needCurve;
    if (min == null) return 0;
    if (min <= C.t0) return 1;
    if (min >= C.t1) return 0;
    return 1 - Math.pow((min - C.t0) / (C.t1 - C.t0), C.k);
  }
  // how long a visit to a provider type lasts (walk-in customers too)
  function stayAt(type) {
    for (const k in CFG.needs) { const N = CFG.needs[k]; if (N.provider === type && N.stay) return N.stay; }
    return 20 * 60;
  }
  // warning level as the player sees it (whole percent): at most warnBelow
  function needWarn(v) { return v != null && Math.round(v * 100) <= Math.round(CFG.warnBelow * 100); }
  function needsOf(type, tier) { const T = CFG.tiers[tier || 0]; return (T && T.needs[type]) || []; }
  function penaltySens(r, tier) { const T = CFG.tiers[tier ?? r.tier ?? 0]; return (T && T.sens[r.type]) || 0; }
  // raw penalty of a source {type, f, x, w} on room r (before the room's sensitivity)
  function penaltyRaw(type, f, x, w, r) {
    const N = CFG.noise[type]; if (!N) return 0;
    const gap = Math.max(0, r.x - (x + w), x - (r.x + r.w));
    const d = Math.max(Math.abs(r.f - f), gap / 6);
    return d < N.r ? N.s * (1 - d / N.r) : 0;
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
      this.loan = s.loan ?? 0;
      this.negDays = s.negDays ?? 0;
      this.serviceAt = Math.max(CFG.serviceMin, Math.min(CFG.serviceMax, s.serviceAt ?? CFG.serviceAt));
      this.floorNet = null;       // net per floor yesterday (rent + sales − upkeep − repairs), null before the first evening
      this.fcGen = 0;             // forecasts (P2) are cached per room until this changes (structure, evening)
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
      this.today = this._newToday();
      // tenants are not saved: occupied rooms get their people back on load
      for (const r of this.rooms) if (r.occupied && (r.type === 'office' || r.type === 'condo')) {
        for (let i = 0; i < CFG.rooms[r.type].cap; i++) this._newPerson(r.type === 'office' ? 'worker' : 'resident', r);
      }
      for (const r of this.rooms) if (r.type === 'workshop') this._hire(r);
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
        loan: this.loan, negDays: this.negDays, serviceAt: this.serviceAt,
        rooms: this.rooms.map(r => ({ id: r.id, type: r.type, f: r.f, x: r.x, occupied: r.occupied, score: r.score, tenancy: r.tenancy,
          tier: r.tier, fulfil: r.fulfil, warnDays: r.warnDays, needOut: r.needOut || undefined, lastQ: r.lastQ ? Math.round(r.lastQ * 100) / 100 : undefined, lastGU: r.lastGU ? Math.round(r.lastGU * 1000) / 1000 : undefined,
          meas: Object.keys(r.meas).length ? Object.fromEntries(Object.entries(r.meas).map(([k, m]) => [k, [Math.round(m.v * 1000) / 1000, m.min == null ? null : Math.round(m.min * 10) / 10]])) : undefined })),
        shafts: this.shafts.map(s => ({ id: s.id, kind: s.kind, c: s.c, f0: s.f0, f1: s.f1, stops: s.stops.slice(), nCars: s.cars.length, name: s.name,
          wears: s.cars.map(c => Math.round(c.wear * 100) / 100), lastWait: s.lastWait == null ? undefined : Math.round(s.lastWait * 100) / 100 })),
        links: this.links.map(l => ({ id: l.id, kind: l.kind, f: l.f, x: l.x })),
        shells: this.shells.map(r => ({ f: r.f, x: r.x, w: r.w })),
      };
    }

    _makeLink(l) { return { id: l.id, kind: l.kind, f: l.f, x: l.x, w: CFG.links[l.kind].w, used: 0, isLink: true }; }

    _makeRoom(r) {
      const tenant = r.type === 'office' || r.type === 'condo';
      return {
        id: r.id, type: r.type, f: r.f, x: r.x, w: CFG.rooms[r.type].w,
        occupied: !!r.occupied, score: r.score ?? null, tenancy: r.tenancy || 0,
        // tier 0 standard, 1 upscale, 2 luxury; fulfil 0..1 (rent factor; P1: always 1 for offices
        // and flats, needs come with P2), warnDays: days in a row below the threshold (trips or needs;
        // saves from before TOWER-a0007 kept bad trip days apart in badNights), warn: sign 0/1 yellow/2 red
        tier: r.tier || 0, fulfil: r.fulfil ?? (tenant ? 1 : null), warnDays: Math.max(r.warnDays || 0, r.badNights || 0), warn: 0,
        tripSum: 0, tripN: 0, inside: 0, people: [], eSum: 0, eN: 0, eLast: null, failN: 0,
        // P2: measured needs {need: {v 0..1, min}} (yesterday or older, saved), today's samples nd, queue at
        // a provider, penalty (pen after sensitivity, penRaw before), needOut = moved out for needs, waits
        // for a structure change before new tenants come; fc = cached forecasts per tier
        meas: Object.fromEntries(Object.entries(r.meas || {}).map(([k, a]) => [k, { v: a[0], min: a[1] }])),
        nd: {}, queue: [], pen: 0, penRaw: 0, penSrc: null, needOut: !!r.needOut, fc: null, fcGen: -1, vN: 0,
        // provider: yesterday's Ø minutes in its queue (of those who got a seat) and share who gave up (forecast)
        lastQ: r.lastQ || 0, lastGU: r.lastGU || 0, qSum: 0, qN: 0, guN: 0,
      };
    }

    _makeShaft(s) {
      const span = s.f1 - s.f0 + 1;
      const sh = {
        id: s.id, kind: s.kind, c: s.c, f0: s.f0, f1: s.f1,
        stops: s.stops ? s.stops.slice() : new Array(span).fill(true),
        name: s.name || this._shaftName(),
        cars: [], qUp: [], qDown: [], waitSum: 0, waitN: 0, lastWait: s.lastWait ?? null,
      };
      for (let i = 0; i < span; i++) { sh.qUp.push([]); sh.qDown.push([]); }
      const n = s.nCars || 1;
      for (let i = 0; i < n; i++) sh.cars.push(this._makeCar(sh, s.wears ? s.wears[i] : 0));
      sh.running = sh.cars.filter(c => !c.halt).length;
      return sh;
    }

    // wear 0..100; cond ok | slow | waiting (mechanic on the way) | repair | broken (100, nobody coming);
    // halt = out of service (broken, or parked for/under repair): takes nobody new, brings its riders
    // to their floor, then goes to the shaft's service floor. job = maintenance order open,
    // mech = the mechanic (or emergency service) coming, fix = null | 'park' | 'repair'
    _makeCar(s, wear) {
      const car = { y: s.f0, dir: 0, state: 'idle', timer: 0, pax: [], target: null,
        wear: Math.max(0, Math.min(100, wear || 0)), cond: 'ok', halt: false, job: false, mech: null, fix: null, repairEnd: 0, jobBlock: 0, emerg: false };
      this._setCond(car);
      return car;
    }

    _setCond(car) {
      car.halt = car.wear >= 100 || car.fix != null;
      car.cond = car.fix === 'repair' ? 'repair' : car.mech ? 'waiting' : car.wear >= 100 ? 'broken' : car.wear >= CFG.wear.slowAt ? 'slow' : 'ok';
    }

    // after a car changed: condition, running cars; a shaft without running cars leaves the
    // routing graph (rebuilt only when the count crosses 0)
    _refresh(s, car) {
      if (car) this._setCond(car);
      const n = s.cars.reduce((a, c) => a + (c.halt ? 0 : 1), 0);
      const cross = (n > 0) !== (s.running > 0);
      s.running = n;
      if (cross && this.shafts.includes(s)) this._afterChange(true);
    }

    inService(car) { return !car.halt; }

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
      // service floor of each shaft: lowest stop with floor at the door (null = no maintenance possible)
      for (const s of this.shafts) {
        s.svc = null;
        for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) && this.walkable(f, s.c)) { s.svc = f; break; }
      }
      // P2: providers by type, rooms by floor, penalties
      this.providers = {}; this.floorRooms = [];
      for (let f = 0; f <= F; f++) this.floorRooms.push([]);
      for (const r of this.rooms) {
        this.floorRooms[r.f].push(r);
        if (CFG.rooms[r.type].seats) (this.providers[r.type] || (this.providers[r.type] = [])).push(r);
      }
      this._computePenalties();
      this._buildRouteGraph();
    }

    // strongest penalty source per sensitive room (only ±2 floors around each source)
    _computePenalties() {
      for (const r of this.rooms) { r.penRaw = 0; r.penSrc = null; }
      for (const src of this.rooms) {
        if (!CFG.noise[src.type]) continue;
        for (let f = Math.max(0, src.f - 2); f <= Math.min(CFG.MAX_FLOOR, src.f + 2); f++) for (const r of this.floorRooms[f]) {
          if (!isTenantRoom(r)) continue;
          const v = penaltyRaw(src.type, src.f, src.x, src.w, r);
          if (v > r.penRaw) { r.penRaw = v; r.penSrc = src; }
        }
      }
      for (const r of this.rooms) r.pen = Math.min(1, r.penRaw * penaltySens(r));
    }

    // where a mechanic stands at the service floor: next to the door, on the side with floor
    svcX(s, f) { return this.walkable(f, s.c - 1) ? s.c - 0.6 : s.c + 1.6; }

    // floors with a door of shaft s (its running costs and repairs are shared among them)
    _doorFloors(s) {
      const fs = [];
      for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) && this.walkable(f, s.c)) fs.push(f);
      if (!fs.length) fs.push(s.f0);
      return fs;
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
        if (!s.running) continue;                    // all cars broken or under repair: shaft is dead
        const doors = [];
        for (let f = s.f0; f <= s.f1; f++) if (this.serves(s, f) && this.walkable(f, s.c)) doors.push(add(f, s.c + 0.5, { shaft: s }));
        const per = R.perFloor[s.kind];
        for (const a of doors) for (const b of doors) {
          if (a === b) continue;
          const ride = Math.abs(b.f - a.f) * per;
          join(a, b, { mode: 'elev', shaft: s, cost: R.waitGuess + ride, ride, energy: R.waitGuess * E.waitPerMin + ride * E.ridePerMin });
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
      this.fcCache = new Map(); this.fcGen++;
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
    // fc = forecast (P2): elevators cost yesterday's measured Ø wait of their shaft (at least waitGuess)
    _routeTable(df, dx, fc) {
      const key = df * 1000 + Math.round(dx * 2), cache = fc ? this.fcCache : this.routeCache;
      let T = cache.get(key);
      if (T) return T;
      const wg = CFG.route.waitGuess;
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
            const pre = ed.from.i * 4 + 2, t = L.t + (fc && elev ? Math.max(wg, ed.shaft.lastWait || 0) + ed.ride : ed.cost), en = L.en + ed.energy;
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
      cache.set(key, T);
      return T;
    }

    // Best next move from (f, x) for someone with `energy` left. withQueues adds a penalty for the
    // people already queueing at an elevator door (live, not cached).
    // Returns {mode: 'final'|'elev'|'link', edge, cost, energy} or null (no way that energy allows).
    _plan(f, x, byElev, energy, dest, withQueues, fc) {
      const T = this._routeTable(dest.f, dest.x, fc), e = byElev ? 1 : 0, lim = energy + 1e-9;
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
            c += q.length * CFG.route.queuePenalty / Math.max(1, s.running);
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
      if ((def.star || 1) > this.stars) { res.reason = 'Erst ab ' + '★'.repeat(def.star); return res; }
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
      if (type === 'workshop') {
        // the new staff comes in from the street right away (or tomorrow morning)
        this._hire(r);
        const M = CFG.mechanics;
        r.staff.forEach((p, i) => {
          this._schedule(Math.max(this.t, M.shiftStart) + 60 * (i + 1), p, 'arrive');
          this._schedule(M.shiftEnd, p, 'leave');
        });
      }
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
      if ((def.star || 1) > this.stars) { res.reason = 'Erst ab ' + '★'.repeat(def.star); return res; }
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
      this._refresh(s, null);
      this._clearNeedOut();
      return { ok: true };
    }

    removeCar(s) {
      if (s.cars.length <= 1) return { ok: false, reason: 'Eine Kabine bleibt' };
      // take an empty broken car if there is one, else an empty car
      let i = s.cars.findIndex(c => c.pax.length === 0 && c.halt);
      if (i < 0) i = s.cars.findIndex(c => c.pax.length === 0);
      if (i < 0) i = s.cars.length - 1;
      const car = s.cars.splice(i, 1)[0];
      this._releaseJob(car);
      for (const p of car.pax.slice()) this._dropFromCar(p, s, car);
      this._refresh(s, null);
      this._clearNeedOut();
      return { ok: true };
    }

    toggleStop(s, f) {
      if (f < s.f0 || f > s.f1) return;
      s.stops[f - s.f0] = !s.stops[f - s.f0];
      this._afterChange();
    }

    // would anything float if o were gone?
    _supportOk(o) {
      if (!o.isShell && !o.cars) return true;   // a torn-down room leaves its shell floor: carries the same
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
        for (const car of o.cars) this._releaseJob(car);
        for (const car of o.cars) for (const p of car.pax.slice()) this._dropFromCar(p, o, car, true);
        for (const q of [...o.qUp, ...o.qDown]) for (const p of q) p.state = 'stranded';
      } else {
        // anything stacked on top would float – only allow if nothing above relies on it
        this.rooms = this.rooms.filter(r => r !== o);
        for (let i = o.x; i < o.x + o.w; i++) this.shellRows[o.f][i] = 1;   // the shell stays
        for (const p of o.people.slice()) this._kill(p);
        if (o.staff) for (const p of o.staff.slice()) this._kill(p);   // mechanics leave with their workshop
        // visits to a provider that is gone: the need counts 0 (P2.4); people inside or in its queue go
        // home, people on the way turn round (their trip home does not count in the trip rating)
        for (const p of [...this.persons]) {
          const v = p.visit;
          if (!v || v.room !== o || v.aborted) continue;
          this._visitSample(p, null);
          if (p.kind === 'visitor') { this._kill(p); continue; }
          if (p.visitQ === o || (p.state === 'in' && p.where === o)) { this._endVisit(p); this._teleportHome(p); }
          else { v.aborted = true; p.dest = v.then === 'out' ? { f: 0, x: CFG.ENTRANCE_X, room: null } : this._homeDest(p); }
        }
        for (const p of this.persons) if (p.dest && p.dest.room === o) p.dest = { f: 0, x: CFG.ENTRANCE_X, room: null };
        for (const p of [...this.persons]) if (p.state === 'in' && p.where === o) {
          if (p.kind === 'visitor') this._kill(p); else this._teleportHome(p);
        }
      }
      this._afterChange();
      return { ok: true };
    }

    // after building or tearing down; byCar = only a shaft stopped or started running (not a player's change)
    _afterChange(byCar) {
      this._structureChanged();
      if (!byCar) this._clearNeedOut();
      // replan everyone waiting or heading to a queue
      for (const p of this.persons) {
        if (p.state === 'stranded') { this._nextLeg(p); continue; }
        if (p.state === 'wait' && !p.visitQ) { this._drainWait(p); this._unqueue(p); this._nextLeg(p); continue; }
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
      const p = { id: this.nextId++, kind, home, f: 0, x: CFG.ENTRANCE_X, state: 'out', where: null, dest: null, legTo: 0, shaft: null, after: null, tx: 0, tripStart: 0, waitStart: 0, scoreRoom: home, dead: false,
        role: kind === 'visitor' ? 'guest' : kind === 'mechanic' ? 'mechanic' : 'tenant' };
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
      if (p.state === 'in' && p.where) this._leaveRoom(p.where);
      this.walking.delete(p);
      this.climbing.delete(p);
      this.persons.delete(p);
      if (p.home) { const i = p.home.people.indexOf(p); if (i >= 0) p.home.people.splice(i, 1); }
      if (p.kind === 'mechanic') {
        if (p.job) { const { s, car } = p.job; p.job = null; if (car.mech === p) { car.mech = null; car.fix = null; this._refresh(s, car); } }
        if (p.home && p.home.staff) { const i = p.home.staff.indexOf(p); if (i >= 0) p.home.staff.splice(i, 1); }
      }
    }

    _teleportHome(p) {
      if (p.state === 'wait') this._unqueue(p);
      if (p.state === 'in' && p.where) this._leaveRoom(p.where);
      this.walking.delete(p);
      this.climbing.delete(p);
      p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
      this._restFrom(p, p.home);
    }

    // someone leaves room r: a seat at a provider gets free for the first in its queue
    _leaveRoom(r) {
      r.inside--;
      if (r.queue.length) this._admit(r);
    }

    _unqueue(p) {
      if (p.visitQ) { const q = p.visitQ.queue, k = q.indexOf(p); if (k >= 0) q.splice(k, 1); p.visitQ = null; return; }
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
      if (p.state === 'in' && p.where) { const w = p.where; p.f = w.f; p.x = w.x + w.w / 2; p.where = null; this._leaveRoom(w); }
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
      if (p.kind === 'mechanic') { this._mechFail(p); return; }
      if (p.mover) { this._kill(p); return; }   // moved out and found no way: gone
      if (p.visit && !p.visit.aborted) {
        // a visit to a provider failed (no way, no energy): the need counts 0, no 60-minute trip (P2.6)
        this._visitSample(p, null);
        const v = this._endVisit(p);
        this.walking.delete(p);
        this.today.visitFails++;
        if (p.kind === 'visitor') { this._kill(p); return; }
        if (v.then === 'out') { p.state = 'out'; p.f = 0; this._restFrom(p, null); return; }
        p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++; this._restFrom(p, p.home);
        return;
      }
      if (p.meal) { p.meal = false; this._needSample(p.home, 'lunch', null); }
      const back = p.visit || p.noScore;   // on the way back from a visit: not rated (scoreRoom is null)
      // no way to get there (or not with the energy left): a very bad trip, person gives up
      this._record(p, 60 * 60);
      this.today.fails = (this.today.fails || 0) + 1;
      if (p.scoreRoom) p.scoreRoom.failN++;
      this.walking.delete(p);
      if (back) { if (p.visit) this._endVisit(p); p.noScore = false; if (p.home && isTenantRoom(p.home)) p.scoreRoom = p.home; }
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
      if (p.kind === 'mechanic') { this._mechArrive(p); return; }   // own statistics, see workshopStats
      if (p.mover) { this._kill(p); return; }   // moved out: out on the street, gone (no statistics)
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
      if (p.noScore) { p.noScore = false; p.scoreRoom = p.home; }
      const v = p.visit;
      if (v && !v.aborted && d.room && d.room === v.room) { this._visitArrive(p, felt); return; }
      if (v) this._endVisit(p);   // a visit whose provider was torn down: arrived home / outside instead
      if (p.meal) { p.meal = false; this._needSample(p.home, 'lunch', felt); }   // restaurant or street
      if (d.room) {
        if (!this.rooms.includes(d.room)) { this._startTrip(p, { f: 0, x: CFG.ENTRANCE_X, room: null }); return; }
        p.state = 'in'; p.where = d.room; d.room.inside++;
        this._restFrom(p, d.room);
        if (d.room.type === 'restaurant') {
          const price = CFG.rooms.restaurant.price;
          this.money += price; this.today.guests++; this.today.sales += price; this.today.fl[d.room.f] += price;
          d.room.vN++;
          this._emit('visit', { kind: 'restaurant', room: d.room });
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

    _homeDest(p) { const h = p.home; return { f: h.f, x: h.x + h.w / 2, room: h }; }

    _doEvent(e) {
      const p = e.p;
      if (p.dead || p.mover) return;
      if (p.kind === 'mechanic') { this._mechEvent(p, e.act); return; }
      if (e.act === 'visitEnd' || e.act === 'visitGiveUp') { this._visitEvent(p, e.act); return; }
      // during a visit (on the way, queueing, inside a provider) everything else waits
      const busy = p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb' || !!p.visit;
      if (busy) { this._schedule(this.t + 600, p, e.act); return; }
      const home = p.home;
      const toHome = () => this._homeDest(p);
      const out = () => ({ f: 0, x: CFG.ENTRANCE_X, room: null });
      switch (e.act) {
        case 'arrive':            // worker comes to office / resident comes home / visitor to restaurant
          if (p.state !== 'out') return;
          if (p.kind === 'visitor') {
            if (!p.walkIn) this._startTrip(p, { f: p.target.f, x: p.target.x + p.target.w / 2, room: p.target });
            else if (this.rooms.includes(p.walkIn)) this._startVisitTo(p, p.walkIn, null, 'out');
            else this._kill(p);
          } else if (p.kid) { p.kid = false; this._startVisit(p, 'childcare', 'home'); }   // child to the Kita first
          else if (p.shop) { p.shop = false; this._startVisit(p, 'shopping', 'home'); }  // shopping on the way home
          else this._startTrip(p, toHome());
          break;
        case 'leave':             // to the street
          if (p.state !== 'in') return;
          this._startTrip(p, out());
          break;
        case 'meal': {            // lunch / dinner: restaurant if one is reachable and has seats, else outside
          if (p.state !== 'in') return;
          p.meal = p.kind === 'worker';   // office lunch is a need (P2): measured on arrival (restaurant or street)
          const r = this._pickRestaurant(p);
          if (r) this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r });
          else { p.pendingBack = 'arrive'; this._startTrip(p, out()); }
          break;
        }
        case 'backFromMeal':
          if (p.state !== 'in') return;
          this._startTrip(p, toHome());
          break;
        case 'coffee':            // from the room to a provider and back
        case 'sport':
          if (p.state === 'out' && e.act === 'sport' && this.t < hm(20, 30)) { this._schedule(this.t + 600, p, e.act); return; }
          if (p.state !== 'in' || p.where !== home) return;
          this._startVisit(p, e.act, 'back');
          break;
        case 'pickup':            // Kita: fetch the child, then go home (not measured, paid in the morning)
          if (p.state !== 'in' || p.where !== home) return;
          this._startVisit(p, 'childcare', 'out', { measure: false, pay: false });
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

    // ----- visits to providers (P2): café, Kita, supermarket, fitness -----
    // p.visit = {need, room, then: 'back' | 'home' | 'out', stay, measure, pay, sampled, seated, aborted}.
    // The way there counts only for the need (felt minutes incl. queueing, P2.6), not in the trip rating:
    // scoreRoom is null while the visit runs and on the way 'back' (noScore).
    // Choice: planning cost + (inside + queue − seats)⁺ × stay / seats (P2.7).
    _pickProvider(p, need) {
      const N = CFG.needs[need], list = this.providers[N.provider];
      if (!list) return null;
      const def = CFG.rooms[N.provider], inRoom = p.state === 'in' && p.where;
      const f = inRoom ? p.where.f : 0, x = inRoom ? p.where.x + p.where.w / 2 : CFG.ENTRANCE_X, en = this.energyNow(p);
      let best = null, bc = Infinity;
      for (const r of list) {
        const pl = this._plan(f, x, false, en, { f: r.f, x: r.x + r.w / 2 }, false);
        if (!pl) continue;
        const c = pl.cost + Math.max(0, r.inside + r.queue.length - def.seats) * (N.stay / 60) / def.seats;
        if (c < bc) { bc = c; best = r; }
      }
      return best;
    }

    // planned visit; no provider reachable = 0 for the need (P2.4), the person carries on as without it
    _startVisit(p, need, then, opt) {
      const r = this._pickProvider(p, need);
      if (r) { this._startVisitTo(p, r, need, then, opt); return; }
      if (!opt || opt.measure !== false) this._needSample(p.home, need, null);
      this.today.visitFails++;
      if (then === 'home' && p.state === 'out') this._startTrip(p, this._homeDest(p));
    }

    _startVisitTo(p, r, need, then, opt) {
      p.visit = { need, room: r, then, stay: stayAt(r.type), measure: !opt || opt.measure !== false, pay: !opt || opt.pay !== false,
        sampled: false, seated: false, aborted: false };
      if (p.kind !== 'visitor') p.scoreRoom = null;
      this._startTrip(p, { f: r.f, x: r.x + r.w / 2, room: r });
    }

    _visitArrive(p, felt) {
      const r = p.visit.room;
      this._emit('visit', { kind: r.type, room: r });
      p.f = r.f;
      if (r.inside < CFG.rooms[r.type].seats) { this._seatVisit(p, felt); return; }
      // full: wait in front of the counter (standing on the room's tiles), the felt clock runs on
      p.state = 'wait'; p.visitQ = r; r.queue.push(p); p.visit.qT = this.t;
      p.waitStart = this.t; p.eWaitT = this.t;
      p.x = Math.min(r.x + r.w - 0.3, r.x + 0.3 + 0.42 * (r.queue.length - 1));
      this._schedule(this.t + CFG.visitGiveUp, p, 'visitGiveUp');
    }

    _seatVisit(p, felt) {
      const v = p.visit, r = v.room, def = CFG.rooms[r.type];
      p.state = 'in'; p.where = r; r.inside++;
      this._restFrom(p, r);
      this._visitSample(p, felt);
      v.seated = true;
      r.qSum += v.qT != null ? (this.t - v.qT) / 60 : 0; r.qN++;
      if (v.pay) { this.money += def.price; this.today.sales += def.price; this.today.fl[r.f] += def.price; }
      r.vN++; this.today.visits++;
      this._schedule(this.t + v.stay, p, 'visitEnd');
    }

    // seats got free: the first in the queue goes in
    _admit(r) {
      const seats = CFG.rooms[r.type].seats || Infinity;
      while (r.queue.length && r.inside < seats) {
        const q = r.queue.shift();
        q.visitQ = null;
        this._drainWait(q);
        this._seatVisit(q, this.t - q.tripStart + (q.extra || 0));
      }
    }

    _visitEvent(p, act) {
      const v = p.visit;
      if (act === 'visitGiveUp') {
        if (!v || !p.visitQ || this.t - p.waitStart < CFG.visitGiveUp - 1) return;   // seated meanwhile (or an old timer)
        this._drainWait(p); this._unqueue(p);
        this._visitSample(p, null);
        this.today.visitGiveUps++;
        v.room.guN++;
        this._visitLeave(p, v);
        return;
      }
      if (!v || p.state !== 'in' || p.where !== v.room) return;
      this._visitLeave(p, v);
    }

    _visitLeave(p, v) {
      this._endVisit(p);
      if (p.kind === 'visitor' || v.then === 'out') { this._startTrip(p, { f: 0, x: CFG.ENTRANCE_X, room: null }); return; }
      if (v.then === 'back') { p.noScore = true; p.scoreRoom = null; }   // the way back is not rated either
      this._startTrip(p, this._homeDest(p));
    }

    _endVisit(p) {
      const v = p.visit;
      p.visit = null;
      if (p.visitQ) this._unqueue(p);
      if (p.kind === 'worker' || p.kind === 'resident') p.scoreRoom = p.home;
      return v;
    }

    // one measurement per visit (felt seconds, null = failed / gave up / provider gone = 0)
    _visitSample(p, felt) {
      const v = p.visit;
      if (!v || v.sampled) return;
      v.sampled = true;
      if (v.need && v.measure) this._needSample(p.home, v.need, felt);
    }

    _needSample(r, need, felt) {
      if (!r || !isTenantRoom(r)) return;
      const a = r.nd[need] || (r.nd[need] = { s: 0, n: 0, m: 0, mn: 0 });
      a.n++;
      if (felt != null) { const min = felt / 60; a.s += needShare(min); a.m += min; a.mn++; }
    }

    // ----- maintenance: wear, jobs, mechanics, emergency service -----
    // Mechanics are real people (kind = role = 'mechanic', no scoreRoom): shift 06:00–22:00 from the
    // street to their workshop, from there over the normal routing to a car's service floor.
    _hire(r) {
      r.staff = [];
      for (let i = 0; i < CFG.mechanics.perWorkshop; i++) {
        const p = this._newPerson('mechanic', null);
        p.home = r; p.scoreRoom = null; p.job = null; p.restUntil = 0;
        p.eMax = this._energyMax(r.id * 64 + 60 + i); p.energy = p.eMax;   // same people after reload
        r.staff.push(p);
      }
    }

    _mechTrip(p, goal, dest) { p.mGoal = goal; this._startTrip(p, dest); }

    // job done or gone: next job, else back to the workshop (or out after the shift / emergency)
    _mechHome(p) {
      if (!p.emergency && this.t < CFG.mechanics.shiftEnd && this.rooms.includes(p.home)) {
        this._dispatch();
        if (p.job) return;
        const ws = p.home;
        this._mechTrip(p, 'shop', { f: ws.f, x: ws.x + ws.w / 2, room: ws });
      } else this._mechTrip(p, 'out', { f: 0, x: CFG.ENTRANCE_X, room: null });
    }

    _mechEvent(p, act) {
      const busy = p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb';
      switch (act) {
        case 'dispatch': this._dispatch(); break;
        case 'arrive':
          if (p.state !== 'out') return;
          if (p.emergency) {
            const { s, car } = p.job;
            if (!this.shafts.includes(s) || !s.cars.includes(car) || s.svc == null) { this._kill(p); return; }
            p.jobT0 = this.t;
            this._mechTrip(p, 'job', { f: s.svc, x: this.svcX(s, s.svc), room: null });
          } else if (this.rooms.includes(p.home)) {
            const ws = p.home;
            this._mechTrip(p, 'shop', { f: ws.f, x: ws.x + ws.w / 2, room: ws });
          }
          break;
        case 'leave':
          if (busy || p.job) { this._schedule(this.t + 600, p, 'leave'); return; }
          if (p.state === 'in' || p.state === 'work') this._mechTrip(p, 'out', { f: 0, x: CFG.ENTRANCE_X, room: null });
          break;
      }
    }

    _mechArrive(p) {
      this.walking.delete(p);
      if (p.mGoal === 'out') {
        if (p.emergency) { this._kill(p); return; }
        p.state = 'out'; p.f = 0; this._restFrom(p, null);
        return;
      }
      if (p.mGoal === 'shop') {
        const ws = p.home;
        if (!this.rooms.includes(ws)) { this._kill(p); return; }
        p.state = 'in'; p.where = ws; ws.inside++; this._restFrom(p, ws);
        this._dispatch();
        return;
      }
      // at the service floor of the job's shaft
      const job = p.job;
      p.state = 'work'; p.where = null;
      if (!job || !this.shafts.includes(job.s) || !job.s.cars.includes(job.car)) { p.job = null; this._mechHome(p); return; }
      const { s, car } = job;
      if (s.svc == null) { this._releaseJob(car); this._refresh(s, car); return; }
      if (s.svc !== p.f) { this._mechTrip(p, 'job', { f: s.svc, x: this.svcX(s, s.svc), room: null }); return; }   // stops changed
      if (!p.emergency) this.today.mechApp.push((this.t - p.jobT0) / 60);
      car.fix = 'park';                 // the car takes nobody new, delivers its riders, comes down empty
      this._refresh(s, car);
    }

    // a mechanic cannot go on (no way, or too tired): the job goes back with a pause
    _mechFail(p) {
      this.walking.delete(p);
      this.today.mechFails++;
      if (p.job) {
        const { s, car } = p.job;
        p.job = null;
        if (car.mech === p) { car.mech = null; car.fix = null; car.jobBlock = this.t + CFG.repair.blockSec; this._refresh(s, car); }
        if (p.emergency) { this.money += CFG.emergency.cost; this.msg('Notdienst kommt nicht durch – Geld zurück', 'bad'); }
      }
      if (p.emergency) { this._kill(p); return; }
      const ws = p.home;
      if (p.mGoal === 'job' && this.rooms.includes(ws)) {
        // rests in the workshop, then is free again
        p.state = 'in'; p.where = ws; p.f = ws.f; ws.inside++; this._restFrom(p, ws);
        p.restUntil = this.t + CFG.repair.blockSec;
        this._schedule(p.restUntil + 1, p, 'dispatch');
      } else if (p.mGoal === 'shop') {
        p.state = 'out'; p.f = 0; this._restFrom(p, null);
        this._schedule(this.t + 3600, p, 'arrive');
      } else { p.state = 'out'; p.f = 0; this._restFrom(p, null); }
    }

    _mechFree(p) {
      return !p.emergency && !p.job && this.t < CFG.mechanics.shiftEnd && !(p.restUntil > this.t)
        && ((p.state === 'in' && p.where === p.home) || p.state === 'work');
    }

    // hand open jobs (most worn first) to free mechanics who can get there (plan from where they are,
    // reference energy, cached until the structure changes); unreachable jobs stay open
    _dispatch() {
      let jobs = null;
      for (const s of this.shafts) for (const car of s.cars) {
        if (car.job && !car.mech && car.fix == null && !(car.jobBlock > this.t) && s.svc != null) (jobs || (jobs = [])).push({ s, car });
      }
      if (!jobs) return;
      const free = [];
      for (const r of this.rooms) if (r.staff) for (const p of r.staff) if (this._mechFree(p)) free.push(p);
      if (!free.length) return;
      jobs.sort((a, b) => b.car.wear - a.car.wear);
      for (const { s, car } of jobs) {
        if (!free.length) break;
        const x = this.svcX(s, s.svc);
        let best = -1, bc = Infinity;
        free.forEach((p, i) => {
          const px = p.state === 'in' ? p.where.x + p.where.w / 2 : p.x;
          const key = 'm' + p.f + ':' + Math.round(px * 2) + '>' + s.id;
          let c = this.reachCache.get(key);
          if (c === undefined) {
            const pl = this._plan(p.f, px, false, CFG.energy.ref, { f: s.svc, x }, false);
            c = pl ? pl.cost : -1;
            this.reachCache.set(key, c);
          }
          if (c >= 0 && c < bc) { bc = c; best = i; }
        });
        if (best < 0) continue;
        const p = free.splice(best, 1)[0];
        car.mech = p; p.job = { s, car }; p.jobT0 = this.t;
        this._setCond(car);
        this._mechTrip(p, 'job', { f: s.svc, x, room: null });
      }
    }

    _openJob(s, car) {
      car.job = true;
      this.today.jobsOpened++;
      this._dispatch();
    }

    // wear from a stop with people or a floor driven; opens the job, slows down, breaks down
    _wear(s, car, w) {
      const b = car.wear;
      if (b >= 100) return;
      const a = car.wear = Math.min(100, b + w);
      if (!car.job && a >= this.serviceAt) this._openJob(s, car);
      if (a >= 100) this._breakdown(s, car);
      else if (b < CFG.wear.slowAt && a >= CFG.wear.slowAt) this._setCond(car);
    }

    _carName(s, car) { return CFG.shafts[s.kind].label + ' ' + s.name + (s.cars.length > 1 ? ', Kabine ' + (s.cars.indexOf(car) + 1) : ''); }

    _breakdown(s, car) {
      this.today.breakdowns++;
      this._refresh(s, car);
      this.msg('Panne: ' + this._carName(s, car) + (car.mech ? ' – Handwerker ist unterwegs' : ' steht – Werkstatt oder 🚨 Notdienst'), 'bad');
      this._emit('breakdown', { shaft: s, car });
    }

    _startRepair(s, car) {
      car.fix = 'repair'; car.repairEnd = this.t + CFG.repair.sec;
      this._refresh(s, car);
      this._emit('repairStart', { shaft: s, car });
    }

    // repair done: wear 0, parts paid (the emergency price includes them); night = end of day, no new trips
    _finishRepair(s, car, night) {
      const p = car.mech;
      car.wear = 0; car.job = false; car.mech = null; car.fix = null; car.jobBlock = 0;
      if (!car.emerg) { this._book(s, CFG.repair.parts); this.today.jobs++; }
      car.emerg = false;
      this._refresh(s, car);
      this._emit('repairDone', { shaft: s, car });
      if (!p) return;
      p.job = null;
      if (p.emergency && night) { this._kill(p); return; }
      if (!night) this._mechHome(p);
    }

    // a job loses its mechanic (car removed, shaft demolished, …): the mechanic goes home
    _releaseJob(car) {
      const p = car.mech;
      car.mech = null; car.fix = null;
      this._setCond(car);
      if (!p) return;
      p.job = null;
      if (p.state === 'work') this._mechHome(p);
    }

    // maintenance costs: paid now, shared among the shaft's door floors (heatmap "Geld")
    _book(s, cost) {
      this.money -= cost; this.today.repairs += cost;
      const fs = this._doorFloors(s);
      for (const f of fs) this.today.fl[f] -= cost / fs.length;
    }

    // emergency service: only for a broken car nobody is coming for; arrives after delaySec through the entrance
    checkEmergency(s, car) {
      const E = CFG.emergency, res = { ok: false, cost: E.cost };
      if (car.mech) { res.reason = car.mech.emergency ? 'Notdienst ist unterwegs' : 'Handwerker ist unterwegs'; return res; }
      if (car.wear < 100) { res.reason = 'Nur bei einer Panne'; return res; }
      if (s.svc == null) { res.reason = 'Keine Halte-Etage mit Boden für die Wartung'; return res; }
      if (!this._plan(0, CFG.ENTRANCE_X, false, CFG.energy.ref, { f: s.svc, x: this.svcX(s, s.svc) }, false)) { res.reason = 'Vom Eingang kommt niemand zur Wartungs-Etage (' + floorName(s.svc) + ')'; return res; }
      if (this.money < E.cost) { res.reason = 'Zu wenig Geld – Kredit nehmen?'; return res; }
      res.ok = true;
      return res;
    }

    callEmergency(car) {
      const s = this.shafts.find(sh => sh.cars.includes(car));
      if (!s) return { ok: false, reason: 'Unbekannt' };
      const c = this.checkEmergency(s, car);
      if (!c.ok) return c;
      this._book(s, c.cost);
      const p = this._newPerson('mechanic', null);
      p.scoreRoom = null; p.emergency = true; p.job = { s, car }; p.restUntil = 0;
      car.mech = p; car.emerg = true; car.jobBlock = 0;
      this._setCond(car);
      this._schedule(this.t + CFG.emergency.delaySec, p, 'arrive');
      this.today.emergencies++;
      this.msg('🚨 Notdienst gerufen für ' + this._carName(s, car) + ' – kommt in ' + Math.round(CFG.emergency.delaySec / 60) + ' Min.', 'info');
      this._emit('emergency', { shaft: s, car });
      return c;
    }

    // workshop panel: today's approach times of mechanics (minutes), jobs done, breakdowns
    workshopStats() {
      const a = this.today.mechApp.slice().sort((x, y) => x - y);
      return {
        avgApproachMin: a.length ? a.reduce((x, y) => x + y, 0) / a.length : null,
        medianApproachMin: a.length ? a[a.length >> 1] : null,
        maxApproachMin: a.length ? a[a.length - 1] : null,
        jobsToday: this.today.jobs, breakdownsToday: this.today.breakdowns,
      };
    }

    // ----- money -----
    floorUsed(f) {
      if (f < 1) return false;   // the lobby costs nothing
      const row = this.seg[f];
      for (let x = 0; x < CFG.W; x++) if (row[x] >= 0) return true;
      return false;
    }

    floorUpkeep(f) {
      const E = CFG.economy;
      return Math.round(E.floorUpkeep * (1 + E.floorUpkeepStep * Math.floor(f / E.floorBlock)));
    }

    // rent at full fulfilment: standard rent × tier factor
    potentialRent(r, tier) { return Math.round((CFG.rooms[r.type].rent || 0) * CFG.tiers[tier ?? r.tier ?? 0].rent); }

    // extra upkeep per day of an upgraded room (share of the standard rent, also when vacant)
    tierUpkeep(r) { return Math.round((CFG.rooms[r.type].rent || 0) * CFG.tiers[r.tier || 0].upkeep); }

    rentOf(r) { return Math.round(this.potentialRent(r) * (r.fulfil ?? 1)); }

    canLoan() { return this.loan < CFG.economy.loanMax && this.negDays < CFG.economy.loanBlockDays; }

    takeLoan() {
      const E = CFG.economy;
      if (this.loan >= E.loanMax) return { ok: false, reason: 'Höchstens ' + E.loanMax.toLocaleString('de-DE') + ' € Kredit' };
      if (this.negDays >= E.loanBlockDays) return { ok: false, reason: 'Kredit gesperrt: ' + E.loanBlockDays + ' Tage in Folge Verlust' };
      this.loan += E.loanStep; this.money += E.loanStep;
      this.msg('Kredit +' + E.loanStep.toLocaleString('de-DE') + ' € (Zins ' + Math.round(E.loanRate * 100) + ' % je Tag)', 'info');
      return { ok: true, amount: E.loanStep };
    }

    repayLoan(amount) {
      const a = Math.min(amount == null ? this.loan : amount, this.loan, Math.max(0, Math.floor(this.money)));
      if (this.loan <= 0) return { ok: false, reason: 'Kein Kredit offen' };
      if (a <= 0) return { ok: false, reason: 'Zu wenig Geld' };
      this.loan -= a; this.money -= a;
      return { ok: true, amount: a };
    }

    // heatmap "Geld": the net of the room's floor yesterday (works for shell pieces {f, …} too)
    moneyStatus(r) {
      if (!this.floorNet) return 'none';
      const v = this.floorNet[r.f], E = CFG.economy;
      if (Math.abs(v) < E.heatEven) return 'even';
      if (v < 0) return v > -E.heatStrong ? 'lossLow' : 'loss';
      return v < E.heatStrong ? 'gainLow' : 'gain';
    }

    // ----- needs, penalties, tiers (P2) -----
    needsOf(type, tier) { return needsOf(type, tier); }

    // evening: today's samples become the measurement (no sample today = yesterday's value, never
    // measured = forecast, P2.4); fulfilment = mean of the needs (none = 1) × (1 − penalty)
    _settleNeeds(r) {
      const needs = needsOf(r.type, r.tier);
      for (const n of needs) {
        const a = r.nd[n];
        if (a && a.n) r.meas[n] = { v: a.s / a.n, min: a.mn ? a.m / a.mn : null };
      }
      const fc = needs.some(n => !r.meas[n]) ? this.forecast(r, r.tier) : null;
      let sum = 0;
      for (const n of needs) sum += r.meas[n] ? r.meas[n].v : fc.needs.find(x => x.need === n).share;
      r.fulfil = (needs.length ? sum / needs.length : 1) * (1 - r.pen);
    }

    // what pulls the room down most: a need (measured, else forecast) or the penalty – as text
    needReason(r) {
      const needs = needsOf(r.type, r.tier), fc = this.forecast(r, r.tier);
      let worst = null, wl = r.pen;
      for (const e of fc.needs) {
        const m = r.meas[e.need], v = m ? m.v : e.share, loss = (1 - v) / needs.length;
        if (loss > wl || (!worst && loss > 0 && loss >= wl)) { wl = loss; worst = { e, m }; }
      }
      if (!worst) return r.pen > 0 && r.penSrc ? 'Lärm von ' + CFG.rooms[r.penSrc.type].label + ' ' + floorName(r.penSrc.f) + ' (−' + Math.round(r.pen * 100) + ' %)' : 'alles gut';
      const { e, m } = worst;
      if (m && m.min != null) return (e.type === 'street' ? 'Weg zur Straße' : CFG.rooms[e.type].label) + ' jetzt ' + Math.round(m.min) + ' Min.';
      if (m) return CFG.needs[e.need].label + ': ' + (e.min == null ? e.reason : 'kein Besuch geschafft');
      return e.reason;
    }

    // forecast minutes from a point to (f, x); a provider adds yesterday's Ø wait in its queue
    _fcMin(from, f, x, prov) {
      const pl = this._plan(from.f, from.x, false, CFG.energy.ref, { f, x }, false, true);
      return pl ? pl.cost + (prov ? prov.lastQ : 0) : null;
    }

    // forecast share a provider gives for m minutes: those who gave up in its queue yesterday got 0
    _provShare(m, prov) { return m == null ? 0 : needShare(m) * (1 - (prov.lastGU || 0)); }

    _needForecast(r, need) {
      const N = CFG.needs[need], def = CFG.rooms[N.provider], list = this.providers[N.provider] || [];
      const from = N.from === 'entrance' ? { f: 0, x: CFG.ENTRANCE_X } : { f: r.f, x: r.x + r.w / 2 };
      let best = null, bm = Infinity, bs = -1, street = false;
      for (const p of list) {
        const m = this._fcMin(from, p.f, p.x + p.w / 2, p), sh = this._provShare(m, p);
        if (m != null && (sh > bs || (sh === bs && m < bm))) { bm = m; bs = sh; best = p; }
      }
      if (N.street) {
        const m = this._fcMin(from, 0, CFG.ENTRANCE_X), sh = needShare(m);
        if (m != null && (sh > bs || (sh === bs && m < bm))) { bm = m; bs = sh; best = null; street = true; }
      }
      const min = bm < Infinity ? bm : null, meas = r.meas && r.meas[need];
      const reason = min == null ? def.no + (list.length ? ' erreichbar' : ' gebaut')
        : (street ? 'Straße' : def.label) + ' ' + Math.round(min) + ' Min.';
      return { need, type: street ? 'street' : N.provider, min, share: min == null ? 0 : bs, measured: meas ? meas.v : null,
        measuredMin: meas ? meas.min : null, provider: best, reason };
    }

    _forecast(r, tier) {
      const needs = needsOf(r.type, tier).map(n => this._needForecast(r, n));
      const pen = Math.min(1, (r.penRaw || 0) * penaltySens(r, tier));
      const mean = needs.length ? needs.reduce((a, e) => a + e.share, 0) / needs.length : 1;
      return { fulfil: mean * (1 - pen), pen, needs };
    }

    // forecast of the fulfilment on a tier: routing with yesterday's measured waits, fresh energy (P2.1);
    // cached per room until the structure changes or the day ends
    forecast(r, tier) {
      tier = tier ?? r.tier ?? 0;
      if (r.fcGen !== this.fcGen) { r.fc = []; r.fcGen = this.fcGen; r.fcShares = null; }
      return r.fc[tier] || (r.fc[tier] = this._forecast(r, tier));
    }

    // forecast for a room that is not built yet (ghost): null if there is no floor to walk on yet
    forecastAt(type, tier, f, x) {
      const def = CFG.rooms[type];
      if (!def || !isTenantRoom({ type })) return null;
      x = Math.max(0, Math.min(CFG.W - def.w, x));
      if (!this.walkable(f, x + def.w / 2)) return null;
      const r = { type, f, x, w: def.w, tier: tier || 0, meas: {}, penRaw: 0 };
      for (let g = Math.max(0, f - 2); g <= Math.min(CFG.MAX_FLOOR, f + 2); g++) for (const s of this.floorRooms[g]) {
        if (CFG.noise[s.type]) r.penRaw = Math.max(r.penRaw, penaltyRaw(s.type, s.f, s.x, s.w, r));
      }
      return this._forecast(r, r.tier);
    }

    // every provider (and the street) for each need of r: share 0..1 of what it would give, null = unreachable
    providerShares(r) {
      if (!isTenantRoom(r)) return [];
      this.forecast(r);   // validates the cache generation
      if (r.fcShares) return r.fcShares;
      const out = [];
      for (const need of needsOf(r.type, r.tier)) {
        const N = CFG.needs[need];
        const from = N.from === 'entrance' ? { f: 0, x: CFG.ENTRANCE_X } : { f: r.f, x: r.x + r.w / 2 };
        for (const p of this.providers[N.provider] || []) {
          const m = this._fcMin(from, p.f, p.x + p.w / 2, p);
          out.push({ room: p, need, share: m == null ? null : this._provShare(m, p), min: m });
        }
        if (N.street) { const m = this._fcMin(from, 0, CFG.ENTRANCE_X); out.push({ room: null, need, share: m == null ? null : needShare(m), min: m }); }
      }
      return (r.fcShares = out);
    }

    // penalty sources that reach room r (after its sensitivity), strongest first
    penaltySources(r) {
      const out = [];
      if (!isTenantRoom(r)) return out;
      for (let g = Math.max(0, r.f - 2); g <= Math.min(CFG.MAX_FLOOR, r.f + 2); g++) for (const s of this.floorRooms[g]) {
        if (!CFG.noise[s.type]) continue;
        const v = penaltyRaw(s.type, s.f, s.x, s.w, r);
        if (v > 0) out.push({ room: s, pen: Math.min(1, v * penaltySens(r)) });
      }
      return out.sort((a, b) => b.pen - a.pen);
    }

    // rooms a disturber of `type` at (f, x) would reach (ghost while building)
    penaltyArea(type, f, x) {
      const def = CFG.rooms[type], out = [];
      if (!def || !CFG.noise[type]) return out;
      x = Math.max(0, Math.min(CFG.W - def.w, x));
      for (let g = Math.max(0, f - 2); g <= Math.min(CFG.MAX_FLOOR, f + 2); g++) for (const r of this.floorRooms[g]) {
        if (!isTenantRoom(r)) continue;
        const v = penaltyRaw(type, f, x, def.w, r);
        if (v > 0) out.push({ room: r, pen: Math.min(1, v * penaltySens(r)) });
      }
      return out;
    }

    // heatmap "Bedürfnisse": occupied rooms by their fulfilment, vacant ones by the forecast
    needStatus(r) {
      if (!isTenantRoom(r)) return 'none';
      const v = r.occupied && r.fulfil != null ? r.fulfil : this.forecast(r).fulfil, H = CFG.needHeat;
      return needWarn(v) ? 'bad' : v >= H.good ? 'good' : 'ok';
    }

    // heatmap "Lärm": penalty of the room after its sensitivity
    noiseStatus(r) {
      if (!isTenantRoom(r)) return 'none';
      const H = CFG.noiseHeat;
      return r.pen < H.ok ? 'good' : r.pen < H.bad ? 'ok' : 'bad';
    }

    upgradedRooms() { let n = 0; for (const r of this.rooms) if (isTenantRoom(r) && r.occupied && r.tier >= 1) n++; return n; }

    // active upgrade (concept 5): costs upgradeShare of the build price, needs the star, no way back
    checkUpgrade(r) {
      const res = { ok: false, cost: 0, tier: (r.tier || 0) + 1 };
      if (!isTenantRoom(r)) { res.reason = 'Nur Büros und Wohnungen'; return res; }
      const T = CFG.tiers[res.tier];
      if (!T) { res.reason = 'Höchste Stufe'; return res; }
      res.cost = Math.round(CFG.rooms[r.type].cost * CFG.upgradeShare);
      if (T.locked) { res.reason = T.label + ' kommt später (ab ' + '★'.repeat(T.star) + ', Folgekarte)'; return res; }
      if (T.star > this.stars) { res.reason = T.label + ' erst ab ' + '★'.repeat(T.star); return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    upgrade(r) {
      const c = this.checkUpgrade(r);
      if (!c.ok) return c;
      this._doUpgrade(r, c);
      this._afterUpgrade();
      this.msg('▲ ' + CFG.rooms[r.type].label + ' ' + floorName(r.f) + ' ist jetzt ' + CFG.tiers[r.tier].label + ' (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      return c;
    }

    _doUpgrade(r, c) {
      this.money -= c.cost;
      r.tier = c.tier;
      r.pen = Math.min(1, r.penRaw * penaltySens(r));
      this._emit('upgrade', { room: r, tier: r.tier });
    }

    _afterUpgrade() { this.fcCache = new Map(); this.fcGen++; this._clearNeedOut(); }

    // whole floor: every office and flat on the lowest tier there goes up one step
    checkUpgradeFloor(f) {
      const rs = this.rooms.filter(r => r.f === f && isTenantRoom(r));
      const res = { ok: false, cost: 0, n: 0, rooms: [] };
      if (!rs.length) { res.reason = 'Keine Büros oder Wohnungen'; return res; }
      const low = Math.min(...rs.map(r => r.tier || 0));
      let reason = null;
      for (const r of rs) {
        if ((r.tier || 0) !== low) continue;
        const c = this.checkUpgrade(r);
        if (!c.ok && c.reason !== 'Zu wenig Geld') { reason = c.reason; continue; }
        res.rooms.push(r); res.cost += c.cost; res.n++;
      }
      if (!res.n) { res.reason = reason || 'Nichts aufzuwerten'; return res; }
      if (this.money < res.cost) { res.reason = 'Zu wenig Geld'; return res; }
      res.ok = true;
      return res;
    }

    upgradeFloor(f) {
      const c = this.checkUpgradeFloor(f);
      if (!c.ok) return c;
      for (const r of c.rooms) this._doUpgrade(r, this.checkUpgrade(r));
      this._afterUpgrade();
      this.msg('▲ ' + floorName(f) + ': ' + c.n + ' Räume aufgewertet (−' + c.cost.toLocaleString('de-DE') + ' €)', 'good');
      return c;
    }

    // a structure change lets rooms that moved out for needs take tenants again (if the forecast agrees)
    _clearNeedOut() { for (const r of this.rooms) r.needOut = false; }

    // ----- day cycle -----
    // today's counters; fl = net per floor so far (sales and repairs during the day, the rest in the evening)
    _newToday() {
      return { rent: 0, guests: 0, waitSum: 0, waitN: 0, sales: 0, repairs: 0, fl: new Float64Array(CFG.MAX_FLOOR + 1),
        jobs: 0, jobsOpened: 0, breakdowns: 0, emergencies: 0, mechApp: [], mechFails: 0, visits: 0, visitFails: 0, visitGiveUps: 0,
        movedOut: 0, movedNeeds: 0 };
    }

    _startDay() {
      this.rand = mulberry32(this.seed + this.day * 7919);
      this.t = CFG.DAY_START;
      this.events = new Heap();
      this.walking.clear(); this.climbing.clear();
      for (const l of this.links) l.used = 0;
      for (const p of [...this.persons]) if (p.kind === 'visitor' || p.emergency || p.mover) this._kill(p);
      // maintenance: no mechanic is on the way in the morning; open jobs again from the wear
      let graph = false;
      for (const s of this.shafts) {
        for (let i = 0; i < s.qUp.length; i++) { s.qUp[i] = []; s.qDown[i] = []; }
        for (const car of s.cars) {
          car.pax = []; car.state = 'idle'; car.dir = 0; car.target = null;
          car.mech = null; car.fix = null; car.emerg = false; car.jobBlock = 0;
          car.job = car.wear >= this.serviceAt;
          this._setCond(car);
        }
        const n = s.cars.reduce((a, c) => a + (c.halt ? 0 : 1), 0);
        if ((n > 0) !== (s.running > 0)) graph = true;
        s.running = n;
        s.waitSum = 0; s.waitN = 0;
      }
      if (graph) this._structureChanged();
      this.today = this._newToday();
      const R = this.rand;
      for (const r of this.rooms) { r.tripSum = 0; r.tripN = 0; r.inside = 0; r.eSum = 0; r.eN = 0; r.failN = 0; r.queue = []; r.nd = {}; r.vN = 0; }

      this._hour = Math.floor(this.t / 3600);
      this._updateWarn();

      // daily schedules
      const uni = (a, b) => a + R() * (b - a);
      for (const p of this.persons) {
        p.pendingBack = null; p.car = null;
        p.visit = null; p.visitQ = null; p.noScore = false; p.meal = false; p.kid = false; p.shop = false; p.goesOut = false;
        if (p.kind === 'worker' || p.kind === 'resident') p.scoreRoom = p.home;
        p.energy = p.eMax; p.restT = this.t; p.restRate = CFG.energy.recoverPerHour;   // a night's sleep
        if (p.kind === 'worker') {
          p.state = 'out'; p.f = 0; p.where = null;
          this._schedule(uni(hm(7, 30), hm(9, 0)), p, 'arrive');
          if (R() < 0.6) this._schedule(uni(hm(11, 45), hm(12, 45)), p, 'meal');
          this._schedule(uni(hm(17, 0), hm(18, 30)), p, 'leave');
        } else if (p.kind === 'resident') {
          p.state = 'in'; p.where = p.home; p.f = p.home.f; p.home.inside++;
          if (R() < 0.75) {
            p.goesOut = true;
            this._schedule(uni(hm(6, 45), hm(8, 30)), p, 'leave');
            this._schedule(uni(hm(16, 30), hm(19, 30)), p, 'arrive');
          }
          if (R() < 0.3) this._schedule(uni(hm(19, 30), hm(20, 30)), p, 'meal');
        } else if (p.kind === 'mechanic') {
          // shift: from the street to the workshop, out in the evening (no random draw: the day's stream stays)
          p.state = 'out'; p.f = 0; p.where = null; p.job = null; p.restUntil = 0;
          const i = p.home.staff.indexOf(p);
          this._schedule(CFG.mechanics.shiftStart + 60 * (i + 1), p, 'arrive');
          this._schedule(CFG.mechanics.shiftEnd, p, 'leave');
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
      this._planVisits();
    }

    // P2: visits of upscale rooms and walk-in customers. Own random stream (towers without providers and
    // upscale rooms draw nothing extra and run as before); who is sporty / brings a child is fixed per
    // person by hash (seed, room, slot, tenancy) like the personal energy.
    _planVisits() {
      const V = mulberry32((this.seed ^ 0x2545F491) + this.day * 104729);
      const uni = (a, b) => a + V() * (b - a);
      const hash = (r, i) => mulberry32((this.seed ^ Math.imul(r.id * 64 + i + 4099 * (r.tenancy || 0) + 7, 0x85EBCA6B)) | 0)();
      const N = CFG.needs;
      for (const r of this.rooms) {
        if (!isTenantRoom(r) || !r.occupied || !r.tier) continue;
        const needs = needsOf(r.type, r.tier);
        if (r.type === 'office') {
          if (needs.includes('coffee')) for (const p of r.people) {
            if (V() >= N.coffee.share) continue;
            const w = N.coffee.when[V() < 0.5 ? 0 : 1];
            this._schedule(uni(w[0], w[1]), p, 'coffee');
          }
          if (needs.includes('childcare') && r.people.length) {
            const p = r.people[Math.floor(hash(r, 50) * r.people.length)];
            p.kid = true;
            this._schedule(N.childcare.pickup, p, 'pickup');
          }
        } else {
          if (needs.includes('shopping') && (this.day + r.id) % N.shopping.every === 0) {
            const p = r.people.find(q => q.goesOut);   // on the way home from the street
            if (p) p.shop = true;
          }
          if (needs.includes('sport')) r.people.forEach((p, i) => {
            if (hash(r, i) >= N.sport.share) return;
            const w = N.sport.when[V() < 0.5 ? 0 : 1];
            this._schedule(uni(w[0], w[1]), p, 'sport');
          });
        }
      }
      // walk-in customers from outside (supermarket): all day
      const [a, b] = CFG.walkInHours;
      for (const r of this.rooms) {
        const n = CFG.rooms[r.type].walkIn;
        if (!n || !this.roomReachable(r)) continue;
        for (let i = 0; i < n; i++) {
          const v = this._newPerson('visitor', null);
          v.target = r; v.scoreRoom = r; v.walkIn = r;
          this._schedule(uni(a, b), v, 'arrive');
        }
      }
    }

    // vacant rooms new tenants would take: reachable, not waiting for a structure change after moving out
    // for needs, forecast at least moveInMin (P2.9)
    vacantForRent() {
      return this.rooms.filter(r => isTenantRoom(r) && !r.occupied && !r.needOut && this.roomReachable(r)
        && this.forecast(r, r.tier).fulfil >= CFG.moveInMin);
    }

    // move-ins per hour (TOWER-a0007): demand grows with the tower, at least 1
    demandPerHour() {
      let n = 0;
      for (const r of this.rooms) if (isTenantRoom(r) && r.occupied) n++;
      return Math.max(1, Math.ceil(n / CFG.demandPer));
    }

    // chance that a tenant looking at r takes it: 0 at moveInMin, sure from moveInMin + moveInRamp
    moveInChance(r) {
      return Math.max(0, Math.min(1, (this.forecast(r, r.tier).fulfil - CFG.moveInMin) / CFG.moveInRamp));
    }

    // demand stream: demandPerHour() tenants look at a random vacant room each and take it with
    // moveInChance – a room just above moveInMin fills slowly instead of all of them in one day
    _rentTick() {
      const R = this.rand, free = this.vacantForRent();
      for (let n = Math.min(this.demandPerHour(), free.length); n > 0; n--) {
        const i = Math.floor(R() * free.length);
        if (R() < this.moveInChance(free[i])) this._moveIn(free[i], true);
        free[i] = free[free.length - 1]; free.pop();
      }
    }

    // midday = they come from the street now (workers go home in the evening); else they start with the day
    _moveIn(r, midday) {
      const R = this.rand;
      r.occupied = true; r.score = null; r.tenancy++;
      r.warnDays = 0; r.meas = {}; r.nd = {}; r.fulfil = null;
      const kind = r.type === 'office' ? 'worker' : 'resident';
      for (let i = 0; i < CFG.rooms[r.type].cap; i++) {
        const q = this._newPerson(kind, r);
        if (!midday) continue;
        this._schedule(this.t + R() * 1800, q, 'arrive');
        if (kind === 'worker') this._schedule(Math.max(this.t + 3600, hm(17, 0) + R() * hm(1, 30)), q, 'leave');
      }
      this._setWarn(r);
      this.msg('Neue Mieter: ' + CFG.rooms[r.type].label + ' ' + floorName(r.f), 'good');
      this._emit('movein', { room: r });
    }

    // today's chance that the tenants of r go (0 on a good day): moveOutP by days below the threshold
    moveOutChance(r) {
      if (!isTenantRoom(r) || !r.occupied || !r.warnDays) return 0;
      const P = CFG.moveOutP;
      return P[Math.min(r.warnDays, P.length) - 1];
    }

    // hourly check of rooms below the threshold; per hour 1 − (1 − P)^(1/hours), so the day sums to P
    _moveOutTick() {
      const R = this.rand, [a, b] = CFG.moveOutHours, hours = b - a + 1;
      for (const r of this.rooms.slice()) {
        const P = this.moveOutChance(r);
        if (P > 0 && R() < 1 - Math.pow(1 - P, 1 / hours)) this._moveOut(r);
      }
    }

    // why r is below the threshold: 'trip' (bad trip rating, the room becomes free) or 'needs' (the room
    // keeps its tier and waits for a structure change, P2.9); null = not below
    warnWhy(r) {
      if (r.score != null && r.score > CFG.okMin) return 'trip';
      return needWarn(r.fulfil) ? 'needs' : null;
    }

    // the tenants go now: people at home walk out to the street, the others are gone
    _moveOut(r) {
      const why = this.warnWhy(r) || 'trip', label = CFG.rooms[r.type].label + ' ' + floorName(r.f);
      const d = r.warnDays, days = d + (d > 1 ? ' Tage' : ' Tag');
      this.msg(label + ' zieht aus – ' + (why === 'trip' ? 'Ø ' + Math.round(r.score) + ' Min. pro Weg' : this.needReason(r)) + ' (' + days + ' unter der Schwelle)', 'bad');
      this._emit('moveout', { room: r });
      for (const p of r.people.slice()) {
        if (p.state === 'in' && p.where === r && !p.visit) this._walkOut(p);
        else this._kill(p);
      }
      r.occupied = false; r.score = null; r.warnDays = 0; r.warn = 0;
      if (why === 'needs') r.needOut = true;
      this.today.movedOut++;
      if (why === 'needs') this.today.movedNeeds++;
    }

    // a tenant who moved out leaves the room for the street and is gone there (not rated, no events)
    _walkOut(p) {
      const i = p.home.people.indexOf(p);
      if (i >= 0) p.home.people.splice(i, 1);
      p.mover = true; p.home = null; p.scoreRoom = null; p.meal = false; p.kid = false; p.shop = false; p.pendingBack = null;
      this._startTrip(p, { f: 0, x: CFG.ENTRANCE_X, room: null });
    }

    // live trip rating: yesterday's score mixed with today's trips so far (as in the evening)
    tripScore(r) {
      const live = r.tripN > 0 ? r.tripSum / r.tripN : null;
      return r.score == null ? live : live == null ? r.score : 0.5 * r.score + 0.5 * live;
    }

    // sign over a room: 2 red = below the threshold, the tenants may go any hour; 1 yellow = close to it
    // (trip rating above warnNearWait × okMin or fulfilment at most warnNearNeed); 0 none
    warnLevel(r) {
      if (!isTenantRoom(r) || !r.occupied) return 0;
      if (r.warnDays > 0) return 2;
      const sc = this.tripScore(r);
      if (sc != null && sc > CFG.warnNearWait * CFG.okMin) return 1;
      return r.fulfil != null && Math.round(r.fulfil * 100) <= Math.round(CFG.warnNearNeed * 100) ? 1 : 0;
    }

    // why the sign is there, as text for the room panel
    warnReason(r) {
      const sc = this.tripScore(r);
      if (r.warnDays > 0 ? this.warnWhy(r) === 'trip' : sc != null && sc > CFG.warnNearWait * CFG.okMin) {
        return 'Ø ' + Math.round(r.warnDays > 0 ? r.score : sc) + ' Min. pro Weg';
      }
      return 'nur ' + Math.round((r.fulfil ?? 0) * 100) + ' % Erfüllung – ' + this.needReason(r);
    }

    _setWarn(r) { r.warn = this.warnLevel(r); }
    _updateWarn() { for (const r of this.rooms) if (isTenantRoom(r)) this._setWarn(r); }

    _endDay() {
      // unfinished trips count with the time spent so far
      for (const p of this.persons) {
        if (p.state === 'walk' || p.state === 'wait' || p.state === 'ride' || p.state === 'stranded' || p.state === 'climb') this._record(p, this.t - p.tripStart + 15 * 60);
      }
      // maintenance at night: running repairs and called emergency services finish (costs today),
      // mechanics on their way give the job back (it opens again tomorrow morning)
      for (const s of this.shafts) for (const car of s.cars) {
        if (car.fix === 'repair' || (car.mech && car.mech.emergency)) this._finishRepair(s, car, true);
        else if (car.mech) { car.mech.job = null; car.mech = null; car.fix = null; this._setCond(car); }
      }
      const T = this.today, fl = T.fl;
      let rent = 0, upkeepFloors = 0, upkeepRooms = 0, upkeepShafts = 0;
      // forecasts from now on with today's measured waits (P2.1)
      for (const s of this.shafts) if (s.waitN) s.lastWait = s.waitSum / s.waitN / 60;
      for (const r of this.rooms) if (r.qN + r.guN) {   // providers' queues
        r.lastQ = r.qN ? r.qSum / r.qN : 0; r.lastGU = r.guN / (r.qN + r.guN); r.qSum = 0; r.qN = 0; r.guN = 0;
      }
      this.fcCache = new Map(); this.fcGen++;
      for (const r of this.rooms) {
        const def = CFG.rooms[r.type];
        if (r.eN) r.eLast = r.eSum / r.eN;
        r.lastFails = r.failN;
        r.lastVisits = r.vN;
        if (def.upkeep) { upkeepRooms += def.upkeep; fl[r.f] -= def.upkeep; }
        if (r.type === 'office' || r.type === 'condo') {
          if (r.tier) { const c = this.tierUpkeep(r); upkeepRooms += c; fl[r.f] -= c; }
          if (!r.occupied) continue;
          this._settleNeeds(r);
          const re = this.rentOf(r);
          rent += re; fl[r.f] += re;
          if (r.tripN > 0) {
            const avg = r.tripSum / r.tripN;
            r.score = r.score == null ? avg : 0.5 * r.score + 0.5 * avg;
            r.lastAvg = avg;
          }
          // below the threshold (bad trips or needs): warning from the first day, tomorrow the tenants may
          // go (_moveOutTick); one good day resets it (TOWER-a0007)
          const why = this.warnWhy(r);
          if (why) {
            r.warnDays++;
            if (r.warnDays === 1) {
              const label = CFG.rooms[r.type].label + ' ' + floorName(r.f);
              this.msg('⚠ ' + label + ': ' + (why === 'trip' ? 'Ø ' + Math.round(r.score) + ' Min. pro Weg' : 'nur noch ' + Math.round(r.fulfil * 100) + ' % – ' + this.needReason(r)), 'bad');
              this._emit('downgrade', { room: r });
            }
          } else r.warnDays = 0;
        } else if (r.tripN > 0 && def.seats) {
          const avg = r.tripSum / r.tripN;
          r.score = r.score == null ? avg : 0.5 * r.score + 0.5 * avg;
          r.lastAvg = avg;
        }
      }
      for (const s of this.shafts) {
        const c = CFG.shafts[s.kind].upkeep * s.cars.length, fs = this._doorFloors(s);
        upkeepShafts += c;
        for (const f of fs) fl[f] -= c / fs.length;
      }
      for (const l of this.links) { const c = CFG.links[l.kind].upkeep; upkeepShafts += c; fl[l.f] -= c; }
      for (let f = 1; f <= CFG.MAX_FLOOR; f++) if (this.floorUsed(f)) { const c = this.floorUpkeep(f); upkeepFloors += c; fl[f] -= c; }
      const upkeep = upkeepFloors + upkeepRooms + upkeepShafts;
      const interest = Math.round(CFG.economy.loanRate * this.loan);
      this.money += rent - upkeep - interest;   // sales and repairs were booked during the day
      const net = rent + T.sales - upkeep - T.repairs - interest;
      this.floorNet = Array.from(fl);
      const E = CFG.economy, wasBlocked = this.negDays >= E.loanBlockDays;
      this.negDays = net < 0 ? this.negDays + 1 : 0;
      this.lastDay = { day: this.day, rent, upkeep, guests: T.guests, guestIncome: T.sales, avgWait: T.waitN ? T.waitSum / T.waitN / 60 : 0, movedOut: T.movedOut,
        movedNeeds: T.movedNeeds, visits: T.visits, visitFails: T.visitFails, visitGiveUps: T.visitGiveUps,
        avgFelt: T.tripN ? T.feltSum / T.tripN : 0, avgEnergy: T.tripN ? T.eSum / T.tripN : 1, fails: T.fails || 0, modes: T.modes || {},
        sales: T.sales, upkeepFloors, upkeepRooms, upkeepShafts, repairs: T.repairs, interest, net,
        jobs: T.jobs, jobsOpened: T.jobsOpened, breakdowns: T.breakdowns, emergencies: T.emergencies, mechFails: T.mechFails, approaches: T.mechApp.slice(), ...this.workshopStats() };
      // stats + stars: a room is satisfied with good trips and no needs warning (P2.6)
      const occ = this.rooms.filter(r => (r.type === 'office' || r.type === 'condo') && r.occupied);
      const okRooms = occ.filter(r => (r.score == null || r.score <= CFG.okMin) && !r.warnDays).length;
      this.sat = occ.length ? okRooms / occ.length : 1;
      const pop = this.population;
      while (this.stars < CFG.stars.length) {
        const req = CFG.stars[this.stars];
        const rest = this.rooms.filter(r => r.type === 'restaurant').length;
        if (pop >= req.pop && this.sat >= req.sat && rest >= (req.restaurants || 0) && this.upgradedRooms() >= (req.upgraded || 0)) {
          this.stars++;
          this.msg('★ Neuer Stern! Jetzt ' + this.stars + ' Sterne – bauen bis ' + floorName(this.maxFloor), 'star');
          this._emit('star', { stars: this.stars });
        } else break;
      }
      if (this.stars >= CFG.stars.length && !this.won) { this.won = true; this.msg('🏆 4 Sterne – Ziel des Prototyps erreicht!', 'star'); }
      const eu = n => Math.round(n).toLocaleString('de-DE');
      this.msg('Tag ' + this.day + ': +' + eu(rent) + ' € Miete, +' + eu(T.sales) + ' € Umsatz, −' + eu(upkeep) + ' € Betrieb'
        + (T.repairs ? ', −' + eu(T.repairs) + ' € Wartung' : '') + (interest ? ', −' + eu(interest) + ' € Zins' : '')
        + ' = ' + (net >= 0 ? '+' : '−') + eu(Math.abs(net)) + ' €', net >= 0 ? 'day' : 'bad');
      if (this.negDays >= E.loanBlockDays && !wasBlocked) this.msg('Kredit gesperrt: ' + E.loanBlockDays + ' Tage in Folge Verlust', 'bad');
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
        if (h !== this._hour) {
          this._hour = h;
          if (h >= CFG.moveOutHours[0] && h <= CFG.moveOutHours[1]) this._moveOutTick();
          if (h >= CFG.demandHours[0] && h <= CFG.demandHours[1]) this._rentTick();
          this._updateWarn();
          this._dispatch();                   // safety net: paused jobs, mechanics back from a break
        }
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
      if (car.halt) return 0;                       // out of service: nobody gets in
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
      if (n > 0) this._wear(s, car, CFG.shafts[s.kind].wearPerStop);   // a door cycle with people
    }

    _covered(s, car, f) {
      const cap = CFG.shafts[s.kind].cap;
      for (const c2 of s.cars) {
        if (c2 === car || c2.halt) continue;
        if (c2.target === f) return true;
        if (c2.state === 'doors' && Math.round(c2.y) === f) return true;
        if (c2.state === 'moving' && c2.pax.length < cap && (f - c2.y) * c2.dir > 0) return true;
      }
      return false;
    }

    _stepCar(s, car, dt) {
      if (car.halt) { this._stepHalted(s, car, dt); return; }
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
      // moving (worn cars from slowAt are slower)
      let y = car.y, rem = def.speed * dt * (car.wear >= CFG.wear.slowAt ? CFG.wear.slowFactor : 1);
      while (rem > 0) {
        const next = car.dir > 0 ? Math.floor(y + 1e-6) + 1 : Math.ceil(y - 1e-6) - 1;
        if (next < s.f0 || next > s.f1) { car.y = Math.max(s.f0, Math.min(s.f1, Math.round(y))); car.dir = 0; car.state = 'idle'; car.target = null; return; }
        const dist = Math.abs(next - y);
        if (dist > rem + 1e-6) { y += car.dir * rem; rem = 0; break; }
        y = next; rem = Math.max(0, rem - dist);
        this._wear(s, car, def.wearPerFloor);
        if (car.halt) { car.y = y; car.state = 'idle'; car.target = null; return; }   // broke down: _stepHalted takes over at this floor
        if (this._shouldStop(s, car, next)) { this._openDoors(s, car, next); return; }
      }
      car.y = y;
    }

    // out of service: nobody new gets in; riders are brought to their floor, then the car goes empty
    // to the service floor and waits there (for the mechanic, the repair, or forever if nobody comes)
    _stepHalted(s, car, dt) {
      const def = CFG.shafts[s.kind];
      if (car.fix === 'repair') { if (this.t >= car.repairEnd) this._finishRepair(s, car, false); return; }
      if (car.state === 'doors') {
        car.timer -= dt;
        if (car.timer > 0) return;
        car.state = 'idle'; car.dir = 0; car.target = null;
        return;
      }
      if (car.state === 'idle') {
        const cf = Math.round(car.y), at = Math.abs(car.y - cf) < 1e-6;
        if (car.pax.length) {
          let best = null, bd = Infinity;
          for (const p of car.pax) { const d = Math.abs(p.legTo - car.y); if (d < bd) { bd = d; best = p.legTo; } }
          if (at && best === cf) { car.y = cf; this._openDoors(s, car, cf); return; }
          car.target = null; car.dir = best > car.y ? 1 : -1; car.state = 'moving';
          return;
        }
        const home = s.svc;
        if (home == null) return;
        if (at && cf === home) {
          if (car.fix === 'park' && car.mech) {
            const m = car.mech;
            if (m.state === 'work' && m.f === home) this._startRepair(s, car);
            else if (m.state === 'work') { car.fix = null; this._refresh(s, car); this._mechTrip(m, 'job', { f: home, x: this.svcX(s, home), room: null }); }
          }
          return;
        }
        car.target = home; car.dir = home > car.y ? 1 : -1; car.state = 'moving';
        return;
      }
      // moving: stop only for riders and at the service floor
      let y = car.y, rem = def.speed * dt * (car.wear >= CFG.wear.slowAt ? CFG.wear.slowFactor : 1);
      while (rem > 0) {
        const next = car.dir > 0 ? Math.floor(y + 1e-6) + 1 : Math.ceil(y - 1e-6) - 1;
        if (next < s.f0 || next > s.f1) { car.y = Math.max(s.f0, Math.min(s.f1, Math.round(y))); car.dir = 0; car.state = 'idle'; car.target = null; return; }
        const dist = Math.abs(next - y);
        if (dist > rem + 1e-6) { y += car.dir * rem; rem = 0; break; }
        y = next; rem = Math.max(0, rem - dist);
        this._wear(s, car, def.wearPerFloor);
        if (this.serves(s, next) && car.pax.some(p => p.legTo === next)) { this._openDoors(s, car, next); return; }
        if (!car.pax.length && (car.target === next || car.target == null)) { car.y = next; car.state = 'idle'; car.dir = 0; car.target = null; return; }
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
      if ((r.type === 'workshop' || CFG.rooms[r.type].seats) && !this.roomReachable(r)) return 'unreachable';
      const sc = this.tripScore(r);
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

  const api = { CFG, Game, floorName, fmtTime, needShare, needWarn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TowerEngine = api;
})(this);
