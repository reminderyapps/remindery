// Tower game – style A "pixel": 16-bit pixel art in the spirit of SimTower.
// Everything sits on an art grid of 10 px per tile (a floor is 16 art px: 14 room + 2 slab),
// drawn as crisp rectangles snapped to whole device pixels, so it scales with the zoom.
// Waiting people turn pink, then red (SimTower's stress colours) instead of a traffic light.
//
// The module is a factory: make(opt) builds a variant and registers it in window.TowerStyles.
//   pixel       – the original study direction A
//   pixel_calm  – A2: muted palette, furniture toned into the wall, textures only when zoomed in,
//                 zoom locked to whole pixels (grid 10)
//   pixel_fine  – A3: like A2 plus double density (half art px, grid 20): rounder figures with
//                 arms and shoes, and small signs of life (mugs, cat, child, plates, waiter)
//   pixel_warm  – A×C: A3 with the warm diorama palette and lamp light in the evening
// `grid` = art px per tile the zoom has to snap to (TowerRender.snapScale), so that every art
// pixel is the same whole number of device pixels.
(function (root) {
  'use strict';
  const U = root.TowerRender.util;
  const G = 10;                       // art px per tile
  const FA = 16;                      // art px per floor

  // ---------- art-grid painter ----------
  function P(rc, gx, gy, gw, gh, col) {
    const d = rc.dpr || 1;
    const x0 = Math.round(rc.sx(gx / G) * d) / d, x1 = Math.round(rc.sx((gx + gw) / G) * d) / d;
    const y0 = Math.round(rc.sy(gy / G) * d) / d, y1 = Math.round(rc.sy((gy + gh) / G) * d) / d;
    rc.ctx.fillStyle = col;
    rc.ctx.fillRect(x0, y0, Math.max(1 / d, x1 - x0), Math.max(1 / d, y1 - y0));
  }
  // one art column per step along a diagonal, h art px thick
  function diag(rc, gx0, gy0, gx1, gy1, h, col, every) {
    const n = gx1 - gx0;
    for (let i = 0; i < n; i += every || 1) P(rc, gx0 + i, Math.round(gy0 + (gy1 - gy0) * i / n), 1, h, col);
  }
  const top = f => -(f + 1) * FA;      // art row of a floor's ceiling
  const bot = f => -f * FA;            // art row below the slab (= ceiling of the floor below)

  // heat colours; the money map (game.moneyStatus) runs red → grey → green: brick red with dashes
  // (loss, unlike the dotted pink-red `bad`), salmon, warm grey (unlike the cool vacant/none), light
  // green, green
  const HEAT = { good: '#4a8cff', ok: '#ffc94d', bad: '#ff4d5e', vacant: '#8e959e', unreachable: '#7a2633', lobby: '#d9c9a8', none: '#c3c8d0',
    loss: '#d8553a', lossLow: '#eeab90', even: '#bab3a3', gainLow: '#a6d48e', gain: '#3fa45e' };
  // staff on the move: mechanics in a blue overall with a yellow cap and a red toolbox; the
  // emergency service in orange-red with a reflective stripe, a white helmet and a white case
  const MECH = { cap: '#d8b040', suit: '#4a6ea4', leg: '#3a5888', box: '#b8402e', stripe: null, far: ['#e0b838', '#5a86d0'] };
  const EMG = { cap: '#f2f2ee', suit: '#d8562e', leg: '#b04422', box: '#f2f2ee', stripe: '#f0d84a', far: ['#f6e04a', '#e8602e'] };
  const WARN_Y = '#ffd23f', WARN_R = '#e8383a', INK = '#2c2c36';
  // room types every variant draws with its own look (contract TOWER-a0006: `style.roomTypes`)
  // stars run (TOWER-a0010): spa, rooftop, hotel, garage, tech, damper; every other type gets the generic
  // look (box, icon, label), so new engine types never wait for sprites
  // stars run part 2 (TOWER-a0011): the vertical city, weather, twin tower and the space elevator – see SKY_TYPES
  const SKY_TYPES = ['lockers', 'cinema', 'pool', 'library', 'district', 'logistics', 'station', 'passage', 'clinic', 'school',
    'townhall', 'heliport', 'checkpoint', 'gondola', 'server', 'storage', 'bridge', 'skygarden', 'antenna', 'airship',
    'geothermal', 'wind', 'spacestation'];
  const ROOM_TYPES = ['office', 'condo', 'restaurant', 'skylobby', 'workshop', 'cafe', 'daycare', 'supermarket', 'gym',
    'spa', 'rooftop', 'hotel', 'garage', 'tech', 'damper'].concat(SKY_TYPES);
  // defaults while CFG.rooms has no entry yet (widths per the order, TOWER-a0010 / TOWER-a0011)
  const DEFS = {
    spa: { w: 5, icon: '💆', label: 'Spa' }, rooftop: { w: 6, icon: '🍸', label: 'Rooftop-Bar' },
    hotel: { w: 6, icon: '🛎️', label: 'Hotel', suites: 6 }, garage: { w: 8, icon: '🚗', label: 'Tiefgarage', spaces: 60 },
    tech: { w: 6, icon: '⚙️', label: 'Technikebene' }, damper: { w: 6, icon: '🌀', label: 'Schwingungsdämpfer' },
    lockers: { w: 2, icon: '📦', label: 'Paketschrank' }, cinema: { w: 8, icon: '🎬', label: 'Kino' },
    pool: { w: 6, icon: '🏊', label: 'Pool' }, library: { w: 6, icon: '📚', label: 'Bibliothek' },
    district: { w: 10, icon: '🏘️', label: 'Stadtviertel-Lobby' }, logistics: { w: 6, icon: '🧺', label: 'Logistikzentrale' },
    station: { w: 12, icon: '🚇', label: 'Tiefbahnhof' }, passage: { w: 12, icon: '🛍️', label: 'Einkaufspassage' },
    clinic: { w: 6, icon: '🩺', label: 'Ärztehaus' }, school: { w: 10, icon: '🏫', label: 'Schule' },
    townhall: { w: 8, icon: '🏛️', label: 'Bürgeramt' }, heliport: { w: 4, icon: '🚁', label: 'Heliport', edge: true },
    checkpoint: { w: 2, icon: '🚪', label: 'Schleuse' }, gondola: { w: 3, icon: '🚡', label: 'Fassadengondel' },
    server: { w: 6, icon: '🖥️', label: 'Serverraum' }, storage: { w: 6, icon: '📦', label: 'Self-Storage' },
    bridge: { w: 8, icon: '🌉', label: 'Brücke' }, skygarden: { w: 6, icon: '🌿', label: 'Wolkengarten', open: true },
    antenna: { w: 2, icon: '📡', label: 'Antenne', open: true }, airship: { w: 6, icon: '🛩️', label: 'Luftschiffhafen', edge: true },
    geothermal: { w: 8, icon: '🌋', label: 'Geothermie' }, wind: { w: 2, icon: '🌬️', label: 'Windrad', open: true },
    spacestation: { w: 12, icon: '🛰️', label: 'Station' },
  };
  // world width, tower width and the second tower (E40); without CFG.TW the world is one tower of world.W
  const towerW = rc => { const c = CFG(); return (c && c.TW) || rc.W; };
  const twinX = rc => { const c = CFG(); return rc.world && rc.world.twin && c && c.TWIN_X ? c.TWIN_X : null; };
  const CFG = () => (root.TowerEngine && root.TowerEngine.CFG) || null;
  function roomDef(type) {
    const c = CFG(), e = c && c.rooms && c.rooms[type];
    const d = DEFS[type];
    if (!e) return d || { w: 0, icon: '', label: labelOf(type) };
    return d ? Object.assign({}, d, e) : e;
  }
  const labelOf = k => { k = String(k == null ? '?' : k).replace(/[_-]+/g, ' '); return k.charAt(0).toUpperCase() + k.slice(1); };
  // tenant types of merged rooms (E12): own sign colours; label/icon from CFG.tenants, else these
  const TENANTS = {
    agency:     { label: 'Agentur', short: 'AGENTUR', bg: '#d8487a', fg: '#ffffff' },
    startup:    { label: 'Startup', short: 'STARTUP', bg: '#2a2e3a', fg: '#7cf0a8' },
    callcenter: { label: 'Callcenter', short: 'CALL', bg: '#5a6068', fg: '#ffd23f' },
    lawfirm:    { label: 'Kanzlei', short: 'KANZLEI', bg: '#1e4a3a', fg: '#e8c870', serif: true },
    family:     { label: 'Familienwohnung', short: 'FAMILIE', bg: '#f0c860', fg: '#5a3a1a' },
    flatshare:  { label: 'WG', short: 'WG', bg: '#6a58b0', fg: '#ffe070' },
    penthouse:  { label: 'Penthouse', short: 'PENTHOUSE', bg: '#1a1a20', fg: '#e0b850', serif: true },
    seniors:    { label: 'Senioren-Residenz', short: 'SENIOREN', bg: '#bcd8ec', fg: '#2a4a6a', serif: true },
    // part 2 (TOWER-a0011, E38/E51/E56)
    practice:   { label: 'Praxis', short: 'PRAXIS', bg: '#f2f6f4', fg: '#c83a3a' },
    bank:       { label: 'Bank', short: 'BANK', bg: '#1e3a5a', fg: '#e8d08a', serif: true },
    hq:         { label: 'Konzernzentrale', short: 'KONZERN', bg: '#20242c', fg: '#9ad0ff' },
    embassy:    { label: 'Botschaft', short: 'BOTSCHAFT', bg: '#f0ece0', fg: '#2a3a6a', serif: true },
    authority:  { label: 'Behörde', short: 'BEHÖRDE', bg: '#5a6a58', fg: '#f0f0e0' },
    maisonette: { label: 'Maisonette', short: 'MAISONETTE', bg: '#7a4a6a', fg: '#f8e0b0', serif: true },
    loft:       { label: 'Künstlerloft', short: 'LOFT', bg: '#e8582a', fg: '#1a1a20' },
    studio:     { label: 'Studio', short: 'STUDIO', bg: '#c8283a', fg: '#ffffff' },
    ministry:   { label: 'Ministerium', short: 'MINISTERIUM', bg: '#2a2a2e', fg: '#e0c060', serif: true },
    clan:       { label: 'Clan-Residenz', short: 'CLAN', bg: '#4a1a2a', fg: '#f0c850', serif: true },
    spaceagency:{ label: 'Raumfahrtagentur', short: 'RAUMFAHRT', bg: '#0e1a3a', fg: '#ffffff' },
  };
  const TENANT_ALIAS = { agentur: 'agency', kanzlei: 'lawfirm', law: 'lawfirm', lawyer: 'lawfirm', call: 'callcenter', call_center: 'callcenter',
    familienwohnung: 'family', familie: 'family', wg: 'flatshare', shared: 'flatshare', sharedflat: 'flatshare', senior: 'seniors',
    senioren: 'seniors', seniorenresidenz: 'seniors', retirement: 'seniors' };
  function tenantInfo(key) {
    if (key == null || key === '') return null;
    const c = CFG(), e = c && c.tenants && c.tenants[key];
    const k = String(key).toLowerCase().replace(/[\s-]+/g, '');
    const lookK = TENANTS[key] || TENANTS[k] || TENANTS[TENANT_ALIAS[k]];
    const hue = U.hash(k.length, k.charCodeAt(0) | 0, k.charCodeAt(k.length - 1) | 0) * 360;
    const base = lookK || { short: labelOf(key).toUpperCase(), bg: hslHex(hue, 0.45, 0.32), fg: '#ffffff' };
    const label = (e && e.label) || (lookK && lookK.label) || labelOf(key);
    return Object.assign({}, base, { label, short: (e && e.short) || (lookK ? base.short : label.toUpperCase()), icon: (e && e.icon) || '' });
  }
  function hslHex(h, s, l) {
    const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255); };
    return '#' + ((1 << 24) | (f(0) << 16) | (f(8) << 8) | f(4)).toString(16).slice(1);
  }
  // wall colours of the new types (one set for all themes; mute/tone does the rest)
  const PAL_STARS = {
    spa:     { wall: '#d2e4e0', low: '#c0d6d2', trim: '#8eaea8' },
    rooftop: { wall: '#c8bca8', low: '#b8aa92', trim: '#8a785e' },
    hotel:   { wall: '#e8d8c6', low: '#dac6b0', trim: '#a88c70' },
    garage:  { wall: '#b6b8ba', low: '#a6a8ac', trim: '#80848a' },
    tech:    { wall: '#adb3b8', low: '#9ca3a9', trim: '#737b83' },
    damper:  { wall: '#bcc3ca', low: '#acb3bb', trim: '#7a838d' },
    // part 2 (TOWER-a0011)
    lockers:    { wall: '#d4d6d2', low: '#c4c6c2', trim: '#90948e' },
    cinema:     { wall: '#4a3c4a', low: '#3e3240', trim: '#2a2230' },
    pool:       { wall: '#d6e8ec', low: '#c4dade', trim: '#8aaab0' },
    library:    { wall: '#e4d4b8', low: '#d6c4a4', trim: '#a08868' },
    district:   { wall: '#e6dcc6', low: '#d8ccb0', trim: '#a89676' },
    logistics:  { wall: '#d0d8de', low: '#c0c8d0', trim: '#8a96a2' },
    station:    { wall: '#dcdcd2', low: '#cacabe', trim: '#3a5a8a' },
    passage:    { wall: '#ece6da', low: '#ded6c6', trim: '#b0a48c' },
    clinic:     { wall: '#dceee8', low: '#cae2da', trim: '#8ab0a4' },
    school:     { wall: '#f0e6c0', low: '#e4d8aa', trim: '#b4a272' },
    townhall:   { wall: '#d8d6ce', low: '#c8c6bc', trim: '#8e8a80' },
    heliport:   { wall: '#c8ccd2', low: '#b8bcc4', trim: '#7e848e' },
    checkpoint: { wall: '#c4c8cc', low: '#b4b8be', trim: '#7a8088' },
    gondola:    { wall: '#bfc5ca', low: '#afb6bc', trim: '#7a838d' },
    server:     { wall: '#3a4048', low: '#323840', trim: '#22262c' },
    storage:    { wall: '#d6d0c4', low: '#c8c0b2', trim: '#948a78' },
    bridge:     { wall: '#c8d8e0', low: '#b8c8d2', trim: '#6a7a88' },
    skygarden:  { wall: '#d8e8d0', low: '#c8dcbe', trim: '#8aa47c' },
    antenna:    { wall: '#c4c8cc', low: '#b4b8be', trim: '#7a8088' },
    airship:    { wall: '#e0dccc', low: '#d2ccb8', trim: '#9a9078' },
    geothermal: { wall: '#9a8c80', low: '#8a7c70', trim: '#5e5248' },
    wind:       { wall: '#d0d6da', low: '#c0c8ce', trim: '#8a949c' },
    spacestation:{ wall: '#dfe6ee', low: '#ced8e4', trim: '#5a6e8a' },
  };
  // facade looks (E10 / CFG.looks.facade): colour of the outer tower edge – plain keeps the room edge
  const FACADE = {
    brick: { a: '#9a5038', b: '#c8a890', far: '#9a5a42' },
    glass: { a: '#4a7a98', b: '#b8dcea', far: '#5a8aa8' },
    deco:  { a: '#2a2a30', b: '#c8a040', far: '#3a3530' },
  };
  // cabin looks (CFG.looks.cabin): frame and door colour of public cars; classic = as before
  const CABIN = {
    red:   { frame: '#c84a3a', door: '#8a2a22' },
    brass: { frame: '#e0c070', door: '#a88a3a' },
    wood:  { frame: '#b07a44', door: '#6a4426' },
  };
  // public room types: their own block colour etc. (E7: 7 = public / entrance)
  const BLOCK_COLS = ['#00000000', '#b8b4ac', '#9aaabb', '#e0caa0', '#a8c49a', '#ddd0b2', '#7e848c', '#b89ac8'];
  const palGen = {};
  function genericPal(type) {             // unknown type: a stable muted hue from its name
    if (palGen[type]) return palGen[type];
    const k = String(type);
    let h = 7; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360;
    return (palGen[type] = { wall: hslHex(h, 0.22, 0.78), low: hslHex(h, 0.2, 0.71), trim: hslHex(h, 0.18, 0.52) });
  }
  // basement walls: the colour of the room toned towards raw concrete
  const cellarCache = {};
  function cellarPal(p) {
    const k = p.wall + p.low;
    return cellarCache[k] || (cellarCache[k] = { wall: U.mix(p.wall, '#a9adb2', 0.35), low: U.mix(p.low, '#8f9398', 0.4), trim: '#7c8086' });
  }
  const CONCRETE = '#7e8186', CONCRETE_L = '#9a9da2', CONCRETE_D = '#5e6167', VOID = '#4c5058';
  // earth cross-section: layers from the depth in tiles (a floor is 1.6), colour and pebble colour
  const STRATA = [
    { d: 0, col: '#5f4329', peb: '#4c331e' },     // topsoil
    { d: 0.55, col: '#6a4a30', peb: '#54381f' },  // earth (as before)
    { d: 3.2, col: '#7a5838', peb: '#64462a' },   // clay from about the 2nd basement
    { d: 8.0, col: '#6c645c', peb: '#58514a' },   // gravel and stone from the 5th
    { d: 19.2, col: '#545054', peb: '#46424a' },  // bedrock below the deepest floor
  ];
  const SKIN = ['#f1c7a0', '#d9a074', '#a56a43', '#7a4a2a'];
  const STRESS = [null, ['#ff8fbf', '#e86aa0'], ['#ff2a2a', '#b81420']];   // pink, red
  // seasons (0 spring, 1 summer, 2 autumn, 3 winter): sky tint [colour, amount], grass [top, below]
  const SEASON_SKY = [null, null, ['#e8b070', 0.12], ['#c8ccd4', 0.3]];
  const GRASS = [['#7cc850', '#5aa040'], ['#6cb640', '#4a9030'], ['#c4aa4a', '#9a8a3a'], ['#f4f6fa', '#d8dde6']];
  const SNOW = '#f4f6fa';
  // people on the move: tired = mustard shirt, exhausted = rust shirt and a stoop (index 0 = fresh)
  const TIRED = [null, '#c9a443', '#b8573f'], TIRED_FAR = ['#f0f0f0', '#e6c35a', '#e0684f'];

  // mute: how far furniture and props are blended into the wall colour (0 = as drawn)
  const THEMES = {
    bright: {
      PAL: {
        office:     { wall: '#b6c7dc', low: '#93a7c0', trim: '#5f7290' },
        condo:      { wall: '#ecd2a4', low: '#d8b884', trim: '#9a7350' },
        restaurant: { wall: '#e9ab92', low: '#cf8a72', trim: '#8f5240' },
        skylobby:   { wall: '#e8ddc4', low: '#d2c3a2', trim: '#9c8a66' },
        vacant:     { wall: '#a9a9b0', low: '#96969e', trim: '#707078' },
        unreachable:{ wall: '#8c5c62', low: '#784a50', trim: '#5a3036' },
        workshop:   { wall: '#c4bea0', low: '#aca684', trim: '#7a7456' },
        cafe:       { wall: '#bfe0cc', low: '#9ccab0', trim: '#5f907a' },
        daycare:    { wall: '#f6e090', low: '#ecce6c', trim: '#b89a40' },
        supermarket:{ wall: '#e4eada', low: '#ccd4c0', trim: '#6a9a58' },
        gym:        { wall: '#cbbfe0', low: '#b2a4cc', trim: '#7a6a9c' },
      },
      lobby: '#eadfc8', SLAB_T: '#80808c', SLAB_B: '#4a4a56', EDGE: '#2c2c36', mute: 0,
      HAIR: ['#2a1a10', '#5a3a1a', '#c89a50', '#161616', '#8a4a2a', '#d8d0c0'],
      SHIRT: ['#3a6ab0', '#2f8a6a', '#6a6a7a', '#7a5aa8', '#34486a', '#b07a3a', '#4a8a9a', '#f0f0e8'],
      PANTS: ['#2a2a3a', '#3a3a4a', '#4a3a2a', '#2a3a5a', '#5a5a62'],
      nightLit: 'rgba(255,190,80,.14)', nightDark: 'rgba(12,16,40,.72)',
    },
    calm: {
      PAL: {
        office:     { wall: '#c4d0dc', low: '#b3c0ce', trim: '#8e9cae' },
        condo:      { wall: '#eddcbe', low: '#e0cca8', trim: '#b49a7c' },
        restaurant: { wall: '#eac3b0', low: '#dcb19c', trim: '#ae8370' },
        skylobby:   { wall: '#ebe2cf', low: '#ddd2ba', trim: '#b2a488' },
        vacant:     { wall: '#b6b6bb', low: '#aaaab0', trim: '#8e8e96' },
        unreachable:{ wall: '#a17478', low: '#93676c', trim: '#7a5458' },
        workshop:   { wall: '#ccc7ae', low: '#bcb69a', trim: '#938c72' },
        cafe:       { wall: '#cde0d2', low: '#bcd1c1', trim: '#8ea897' },
        daycare:    { wall: '#f0e2a2', low: '#e4d48a', trim: '#b8a466' },
        supermarket:{ wall: '#e3e7dc', low: '#d2d8ca', trim: '#97ab8b' },
        gym:        { wall: '#d3cbe0', low: '#c3b9d2', trim: '#998fab' },
      },
      lobby: '#ece4d2', SLAB_T: '#9a9aa4', SLAB_B: '#6a6a76', EDGE: '#6a6a78', mute: 0.28,
      HAIR: ['#3a2a1e', '#5a4030', '#a88458', '#2a2a2a'],
      SHIRT: ['#5d7ea3', '#6f9480', '#8c8796', '#a78b6c', '#7f719c'],
      PANTS: ['#3e4150', '#4c4a48', '#465068'],
      nightLit: 'rgba(255,196,110,.12)', nightDark: 'rgba(22,26,52,.66)',
    },
    warm: {
      PAL: {
        office:     { wall: '#e4d8c0', low: '#d6c7aa', trim: '#9c8466' },
        condo:      { wall: '#f0d4a6', low: '#e2c08e', trim: '#a8805a' },
        restaurant: { wall: '#eebc96', low: '#dfa47e', trim: '#a46a4c' },
        skylobby:   { wall: '#efe2c6', low: '#e0cfac', trim: '#a8926c' },
        vacant:     { wall: '#c4bcae', low: '#b6ad9e', trim: '#8e8474' },
        unreachable:{ wall: '#b08276', low: '#a07266', trim: '#7e5448' },
        workshop:   { wall: '#d6ccae', low: '#c6ba98', trim: '#8c7e62' },
        cafe:       { wall: '#d4dcbe', low: '#c4ccaa', trim: '#888e6e' },
        daycare:    { wall: '#f4da98', low: '#e8c87e', trim: '#ae8c52' },
        supermarket:{ wall: '#ebe5d2', low: '#dcd3bc', trim: '#9a9276' },
        gym:        { wall: '#dbc8bc', low: '#cbb6a8', trim: '#988070' },
      },
      lobby: '#f0e2c4', SLAB_T: '#9a7c62', SLAB_B: '#5e4636', EDGE: '#5a4434', mute: 0.22,
      HAIR: ['#3a2416', '#6a4428', '#b88a4a', '#2a2018'],
      SHIRT: ['#5a7a9a', '#7a9a6a', '#b0705a', '#c09a5a', '#8a6a8a'],
      PANTS: ['#4a3e36', '#3e4452', '#5a4a3a'],
      nightLit: 'rgba(255,170,70,.16)', nightDark: 'rgba(26,22,48,.74)',
    },
  };

  function make(o) {
    const th = THEMES[o.theme || 'bright'];
    const fine = !!o.fine, calm = !!o.calm;
    const { SLAB_T, SLAB_B, EDGE, HAIR, SHIRT, PANTS } = th;
    // calm variants drop the busy textures (wallpaper, tiles, marble, dither, rails) and show
    // small clutter (file cabinet, bottles) only when zoomed in
    const texture = () => !calm;
    const clutter = rc => !calm || rc.detail === 2;
    const soft = (c, base) => (th.mute ? U.mix(c, base, th.mute) : c);

    function look(id) {
      const h = k => U.hash(id, k, 7);
      return { hair: HAIR[(h(1) * HAIR.length) | 0], skin: SKIN[(h(2) * SKIN.length) | 0],
        shirt: SHIRT[(h(3) * SHIRT.length) | 0], pants: PANTS[(h(4) * PANTS.length) | 0] };
    }
    // 3×9 sprite, feet on art row `feet`; seated = no legs
    // tired: 1 = mustard shirt, 2 = rust shirt and the head sinks one art px (a stoop)
    // face: 1 looks right (hair at the back = left column), -1 looks left
    function figure(rc, gx, feet, lk, seated, stress, child, tired, face) {
      if (tired && !stress) lk = { hair: lk.hair, skin: lk.skin, pants: lk.pants, shirt: TIRED[tired] };
      if (fine) return figureFine(rc, gx, feet, lk, seated, stress, child);
      const drop = tired === 2 && !stress ? 1 : 0;
      const yT = feet - (seated ? 6 : 8) + drop;
      const s = stress ? STRESS[stress] : null;
      const skin = s ? s[0] : lk.skin, hair = s ? s[1] : lk.hair, shirt = s ? s[0] : lk.shirt, pants = s ? s[1] : lk.pants;
      P(rc, gx, yT, 3, 1, hair);
      P(rc, gx, yT + 1, 3, 2, skin);
      P(rc, face < 0 ? gx + 2 : gx, yT + 1, 1, 1, hair);
      P(rc, gx, yT + 3, 3, 4 - drop, shirt);
      if (!seated) { P(rc, gx, yT + 7 - drop, 1, 2, pants); P(rc, gx + 2, yT + 7 - drop, 1, 2, pants); }
    }
    // same footprint at half art px: round head, arms, hands, two legs with shoes; the skin stays
    // natural under stress (only clothes turn pink/red), so a crowd still looks like people
    function figureFine(rc, gx, feet, lk, seated, stress, child) {
      const s = stress ? STRESS[stress] : null;
      const shirt = s ? s[0] : lk.shirt, pants = s ? s[1] : lk.pants;
      const sleeve = U.mix(shirt, '#000000', 0.18);
      const k = child ? 0.7 : 1;
      const bottom = feet + 1;                                 // lower edge, like the 3×9 sprite
      const leg = seated ? 0 : 3 * k, torso = 3.5 * k, head = 3 * k;
      const yTorso = bottom - leg - torso, yHead = yTorso - head + 0.5;
      const x = gx + (child ? 0.5 : 0);
      P(rc, x + 0.5, yHead + 0.5, 2 * k, head - 0.5, lk.skin);            // face
      P(rc, x + 0.5, yHead, 2 * k, 0.5, lk.hair);                         // hair, rounded corners
      P(rc, x + 0.5, yHead + 0.5, 0.5, 1, lk.hair);
      P(rc, x + 1.5 * k, yHead + 1, 0.5, 0.5, '#2a2018');                 // eye
      P(rc, x + 0.5, yTorso, 2 * k, torso, shirt);                        // torso
      P(rc, x, yTorso + 0.5, 0.5, torso - 1, sleeve);                     // arms
      P(rc, x + 0.5 + 2 * k, yTorso + 0.5, 0.5, torso - 1, sleeve);
      P(rc, x, yTorso + torso - 0.5, 0.5, 0.5, lk.skin);                  // hands
      P(rc, x + 0.5 + 2 * k, yTorso + torso - 0.5, 0.5, 0.5, lk.skin);
      if (seated) { P(rc, x + 0.5, bottom - 1, 2.5 * k, 1, pants); return; }
      P(rc, x + 0.5, bottom - leg, 0.75 * k + 0.25, leg - 0.5, pants);
      P(rc, x + 1.5 * k + 0.25, bottom - leg, 0.75 * k + 0.25, leg - 0.5, pants);
      P(rc, x + 0.5, bottom - 0.5, 1, 0.5, '#2a2622');                     // shoes
      P(rc, x + 1.5 * k + 0.25, bottom - 0.5, 1, 0.5, '#2a2622');
    }

    // ---------- what people do in a room ----------
    // Every person keeps a pose for about `len` game minutes, then may pick another one; the phase
    // differs per person, so a room changes one figure at a time instead of all at once.
    function slot(rc, id, i, len) { return Math.floor((rc.t / 60 + U.hash(id, i, 11) * len) / len); }
    function pickSpots(rc, r, count, spots, len, keep) {
      // keep(i): the person's usual spot (or -1); otherwise a free spot by chance
      const taken = new Array(spots.length).fill(false), out = [];
      for (let i = 0; i < count; i++) {
        const sl = slot(rc, r.id, i, len), h = U.hash(r.id * 7 + i, sl, 13);
        let k = keep ? keep(i, h) : -1;
        if (k < 0 || taken[k]) {
          k = Math.floor(U.hash(r.id * 7 + i, sl, 29) * spots.length);
          for (let j = 0; j < spots.length && taken[k]; j++) k = (k + 1) % spots.length;
        }
        if (taken[k]) { out.push(null); continue; }
        taken[k] = true;
        out.push({ spot: spots[k], face: U.hash(r.id, i, sl + 5) < 0.5 ? 1 : -1 });
      }
      return out;
    }
    // office: mostly at their own desk; now and then at the window, at a colleague's desk or the cabinet
    function officePeople(rc, r, gx, n, feet) {
      const units = r.w, spots = [];
      for (let k = 0; k < units; k++) spots.push({ x: k * G + 7, sit: true });          // chairs
      for (let k = 0; k < units; k++) spots.push({ x: k * G + 3 });                     // in front of the window
      for (let k = 0; k < units - 1; k++) spots.push({ x: k * G + 9, chat: true });     // by a colleague
      spots.push({ x: n - 9 });                                                         // file cabinet
      const res = pickSpots(rc, r, r.inside, spots, 50, (i, h) => (i < units && h < 0.85 ? i : -1));
      res.forEach((a, i) => {
        if (!a) return;
        const sp = a.spot;
        figure(rc, gx + sp.x, sp.sit ? feet - 3 : feet, look(r.id * 31 + i), !!sp.sit, 0, false, 0, sp.sit ? 1 : sp.chat ? -1 : a.face);
      });
    }
    // condo: sofa, bedside, the middle of the room, the edge of the bed; late in the evening in bed
    function condoPeople(rc, r, gx, B, feet, tone) {
      const h = rc.t / 3600, n = Math.min(3, r.inside);
      if (h >= 22 || h < 6.5) {
        for (let i = 0; i < n; i++) {
          if (i < 2) {                                   // heads on the pillow, blanket pulled up
            const lk = look(r.id * 31 + i), x = gx + 2 + i * 3;
            P(rc, x, B - 9, 2, 2, lk.skin); P(rc, x, B - 9, 2, 1, lk.hair);
            P(rc, gx + 7, B - 8, 5, 1, tone('#5a7ac8'));
          } else figure(rc, gx + 21, feet - 3, look(r.id * 31 + i), true, 0, fine, 0, 1);
        }
        return;
      }
      const spots = [{ x: 21, sit: true, face: 1 }, { x: 25, sit: true, face: -1 }, { x: 14 }, { x: 17 }, { x: 8, bed: true }];
      const res = pickSpots(rc, r, n, spots, 60, (i, hv) => (hv < 0.6 ? i : -1));
      res.forEach((a, i) => {
        if (!a) return;
        const sp = a.spot, lk = look(r.id * 31 + i), child = fine && i === 2;
        if (sp.sit) figure(rc, gx + sp.x, feet - 3, lk, true, 0, child, 0, sp.face);
        else if (sp.bed) figure(rc, gx + sp.x, B - 7, lk, true, 0, child, 0, a.face);
        else figure(rc, gx + sp.x, feet, lk, false, 0, child, 0, a.face);
      });
    }
    // winter: snow on every roof tile without floor above
    function roofSnow(rc, f, x, w) {
      if (rc.season !== 3 || rc.detail === 0 || f < 0 || !rc.world.walkable) return;   // no snow below ground
      for (let i = 0; i < w; i++) if (!rc.world.walkable(f + 1, x + i)) P(rc, (x + i) * G, top(f) - 2, G, 2, SNOW);
    }

    // ---------- furniture ----------
    // tier: 1 upscale (desk plants, rug, warmer wall), 2 luxury (plus curtains, art instead of every
    // other window, a floor lamp instead of the file cabinet)
    function office(rc, gx, T, B, n, lit, tone, tier) {
      const units = Math.round(n / G), tx = texture(rc);
      if (tier) P(rc, gx + 1, B - 3, n - 2, 1, tone(tier > 1 ? '#8a3a40' : '#a0704a'));   // rug
      for (let u = 0; u < units; u++) {             // window strip on the back wall
        const wx = gx + u * G;
        if (tier > 1 && u % 2) { art(rc, wx + 2, T + 2, 6, 4, tone, u); continue; }
        P(rc, wx + 2, T + 2, 6, 3, tone(lit ? '#d8f0ff' : '#7a90a8'));
        if (tx) { P(rc, wx + 2, T + 2, 6, 1, tone('#eef8ff')); P(rc, wx + 4, T + 2, 1, 3, tone('#8aa0b8')); }
        if (tier > 1) curtains(rc, wx + 1, T + 1, 8, tone);
      }
      if (tier > 1) floorLamp(rc, gx + n - 4, B, lit, tone);
      for (let u = 0; u < units; u++) {
        const x = gx + u * G + 1;
        if (tier) { P(rc, x, B - 8, 1, 1, tone('#a0522d')); P(rc, x - 1, B - 10, 2, 2, tone('#4f9a48')); }   // desk plant
        P(rc, x, B - 7, 6, 1, tone('#8a5a32'));        // desk
        P(rc, x, B - 6, 1, 4, tone('#6a4224')); P(rc, x + 5, B - 6, 1, 4, tone('#6a4224'));
        P(rc, x + 1, B - 11, 4, 3, tone('#30343c'));   // monitor
        P(rc, x + 2, B - 10, 2, 1, tone(lit ? '#7fd8ff' : '#3a4a5a'));
        P(rc, x + 2, B - 8, 1, 1, tone('#30343c'));
        P(rc, x + 7, B - 10, 1, 5, tone('#3a3a48'));   // chair
        P(rc, x + 6, B - 6, 3, 1, tone('#3a3a48')); P(rc, x + 7, B - 5, 1, 3, tone('#3a3a48'));
        if (fine && !rc.heat) {                        // mug, steaming while people work
          P(rc, x + 4, B - 8, 1, 1, tone('#f2ede2')); P(rc, x + 5, B - 7.5, 0.5, 0.5, tone('#f2ede2'));
          if (lit) { P(rc, x + 4, B - 9.5, 0.5, 0.5, 'rgba(255,255,255,.6)'); P(rc, x + 4.5, B - 10.5, 0.5, 0.5, 'rgba(255,255,255,.4)'); }
        }
      }
      if (clutter(rc) && tier < 2) { P(rc, gx + n - 6, T + 6, 4, 6, tone('#6a4224')); P(rc, gx + n - 6, T + 8, 4, 1, tone('#4a2c18')); }  // file cabinet
    }
    // tier: 1 upscale (rug, bookshelf, plant, warmer wall), 2 luxury (rug, canopy curtains over the bed,
    // a framed painting, a floor lamp)
    function condo(rc, r, gx, T, B, lit, tone, tier) {
      if (texture(rc)) for (let i = 3; i < 30; i += 4) P(rc, gx + i, T + 1, 1, 9, tone('#e0c08a'));   // wallpaper
      if (tier) P(rc, gx + 16, B - 3, 13, 1, tone(tier > 1 ? '#8a3a40' : '#a0704a'));                 // rug
      if (tier === 1) {                                 // bookshelf over the bed
        P(rc, gx + 2, T + 3, 7, 1, tone('#6a4024'));
        if (clutter(rc)) for (let i = 0; i < 6; i++) P(rc, gx + 2 + i, T + 1 + (i % 3 === 2 ? 1 : 0), 1, i % 3 === 2 ? 1 : 2, tone(['#8a3a3a', '#3a5a8a', '#c8a040', '#4a7a4a', '#7a4a7a', '#a05a2a'][i]));
      }
      if (tier > 1) curtains(rc, gx + 1, T + 1, 12, tone, 6);   // canopy bed
      P(rc, gx + 1, B - 10, 1, 8, tone('#6a4024'));     // bed
      P(rc, gx + 2, B - 5, 10, 3, tone('#8a5a32'));
      P(rc, gx + 2, B - 6, 10, 1, tone('#f4f0e8'));
      P(rc, gx + 6, B - 7, 6, 2, tone('#5a7ac8'));
      P(rc, gx + 2, B - 7, 3, 1, tone('#ffffff'));
      if (tier > 1) art(rc, gx + 13, T + 1, 4, 3, tone, r.id | 0);
      else { P(rc, gx + 9, T + 3, 4, 3, tone('#6a4024')); P(rc, gx + 10, T + 4, 2, 1, tone('#7ab0d0')); }  // picture
      P(rc, gx + 14, B - 5, 3, 3, tone('#8a5a32'));     // night table + lamp
      P(rc, gx + 15, B - 7, 1, 2, tone('#3a3a3a'));
      P(rc, gx + 14, B - 9, 3, 2, tone(lit ? '#ffe58a' : '#c8b890'));
      if (tier === 1) { P(rc, gx + 17, B - 5, 2, 2, tone('#a0522d')); P(rc, gx + 17, B - 9, 2, 4, tone('#4f9a48')); P(rc, gx + 18, B - 11, 1, 2, tone('#6ab25a')); }  // plant
      if (tier > 1) floorLamp(rc, gx + 17, B, lit, tone);
      P(rc, gx + 21, T + 2, 7, 4, tone('#26262e'));     // tv
      P(rc, gx + 22, T + 3, 5, 2, tone(lit ? '#8fd0ff' : '#3a4048'));
      if (fine && lit && !rc.heat) P(rc, gx + 21, T + 6, 7, 3, 'rgba(143,208,255,.16)');   // tv glow
      P(rc, gx + 19, B - 8, 10, 3, tone('#b04848'));    // sofa
      P(rc, gx + 19, B - 5, 10, 2, tone('#943838'));
      P(rc, gx + 19, B - 3, 1, 1, tone('#4a2a1a')); P(rc, gx + 28, B - 3, 1, 1, tone('#4a2a1a'));
      if (fine && !rc.heat && r.inside > 0) {           // the cat curls up on the sofa arm
        const cat = U.hash(r.id, 5, 3) > 0.5 ? '#d08a3a' : '#7a7a82';
        P(rc, gx + 26, B - 9.5, 2.5, 1.5, cat); P(rc, gx + 28, B - 10.5, 1, 1, cat);
        P(rc, gx + 28, B - 11, 0.5, 0.5, cat); P(rc, gx + 25.5, B - 9, 0.5, 1, cat);
      }
    }
    // ---------- tier props (office, condo) ----------
    function curtains(rc, x, y, w, tone, drop) {          // valance across, a drape at each side
      const c = tone('#8a3040'), d = drop || 4;
      P(rc, x, y, w, 1, c); P(rc, x, y + 1, 1, d, c); P(rc, x + w - 1, y + 1, 1, d, c);
      if (clutter(rc)) { const g = tone('#c8a040'), ty = y + 1 + (d >> 1); P(rc, x, ty, 1, 1, g); P(rc, x + w - 1, ty, 1, 1, g); }   // tie-backs
    }
    const ART = [['#4a7ab0', '#e0b050'], ['#c0604a', '#5a8a5a'], ['#7a5a9a', '#e8d8a0']];
    function art(rc, x, y, w, h, tone, seed) {             // gilded frame, a painting of two colour fields
      const a = ART[Math.abs(seed | 0) % ART.length];
      P(rc, x, y, w, h, tone('#b8923a'));
      P(rc, x + 1, y + 1, w - 2, h - 2, tone(a[0]));
      if (h > 3) P(rc, x + 1, y + h - 2, w - 2, 1, tone(a[1])); else P(rc, x + w - 2, y + 1, 1, h - 2, tone(a[1]));
    }
    function floorLamp(rc, x, B, lit, tone) {              // 3 art px wide: shade, pole, foot
      const on = lit && !rc.heat;
      if (on && rc.night) P(rc, x - 1, B - 13, 5, 4, 'rgba(255,214,140,.3)');
      P(rc, x, B - 13, 3, 2, tone(on ? '#ffe08a' : '#d8c8a0'));
      P(rc, x + 1, B - 11, 1, 8, tone('#5a4a3a'));
      P(rc, x, B - 3, 3, 1, tone('#5a4a3a'));
    }
    const tierCache = {};
    function tierPal(pal, tier) {                          // upscale and luxury rooms get a warmer wall
      const k = pal.wall + tier;
      return tierCache[k] || (tierCache[k] = {
        wall: U.mix(pal.wall, '#f4c88a', 0.1 * tier), low: U.mix(pal.low, '#d89a6a', 0.12 * tier),
        trim: tier > 1 ? U.mix(pal.trim, '#a8823a', 0.45) : pal.trim });
    }

    // ---------- heat patterns (also readable without colour): bad = dots, loss = dashes ----------
    function heatPattern(rc, hs, gx, T, n) {
      if (hs === 'bad') for (let i = 1; i < n; i += 2) for (let j = 1; j < 13; j += 2) P(rc, gx + i + (j % 4 === 1 ? 0 : 1), T + j, 1, 1, '#d8303e');
      else if (hs === 'loss') for (let j = 3; j < 13; j += 4) for (let i = (j % 8 === 3 ? 2 : 5); i < n - 3; i += 6) P(rc, gx + i, T + j, 3, 1, '#a8321c');
    }
    function heatMark(rc, hs, x, f, w) {                   // whole-tower view
      if (hs === 'bad') for (let i = 0; i < w * 2; i += 2) rc.rect(x + 0.1 + i * 0.5, rc.floorTop(f) + 0.5, 0.45, 0.4, '#b8202e');
      else if (hs === 'loss') rc.rect(x + 0.2, rc.floorTop(f) + 0.75, w - 0.4, 0.2, '#a8321c');
    }

    // ---------- signs ----------
    // room.warn 0/1 yellow/2 red (TOWER-a0007); worlds without it: warnDays > 0 = red
    const warnOf = r => r.warn ?? (r.warnDays > 0 ? 2 : 0);
    // warning triangle 7 art px wide and 6 tall, apex at (cx, y), on a dark rim so it reads on any wall
    const TRI = [[0, 1], [-1, 3], [-1, 3], [-2, 5], [-2, 5], [-3, 7]];
    function warnSign(rc, cx, y, col) {
      for (let i = 0; i < 6; i++) P(rc, cx + TRI[i][0] - 1, y + i - 1, TRI[i][1] + 2, 2, INK);
      P(rc, cx - 4, y + 6, 9, 1, INK);
      for (let i = 0; i < 6; i++) P(rc, cx + TRI[i][0], y + i, TRI[i][1], 1, col);
      P(rc, cx, y + 2, 1, 2, INK); P(rc, cx, y + 5, 1, 1, INK);
    }

    // ---------- staff figures ----------
    function workerLook(id, emg) { const c = emg ? EMG : MECH; return { hair: c.cap, skin: SKIN[(U.hash(id, 2, 7) * SKIN.length) | 0], shirt: c.suit, pants: c.leg }; }
    // mechanic (or emergency service): overall, cap or helmet, toolbox in the hand on the side it faces
    function worker(rc, gx, feet, id, emg, face, box) {
      const c = emg ? EMG : MECH, h = fine ? 0.5 : 1;
      figure(rc, gx, feet, workerLook(id, emg), false, 0, false, 0, face || 1);
      if (c.stripe) P(rc, gx + (fine ? 0.5 : 0), feet - 4, fine ? 2 : 3, h, c.stripe);
      if (box === false) return;
      const bx = (face || 1) < 0 ? gx - 2 : gx + 3;
      P(rc, bx, feet - 3, 2, 2, c.box); P(rc, bx, feet - 3, 2, h, U.mix(c.box, '#000000', 0.3));
    }
    const KID = ['#d8705a', '#5a90c8', '#e0b040', '#6aa860', '#b070a8'];
    function kidLook(id) { const lk = look(id); lk.shirt = KID[(U.hash(id, 3, 9) * KID.length) | 0]; return lk; }
    function kid(rc, gx, feet, lk, face) {                 // 2×6 sprite (half art px in the fine variants)
      if (fine) return figureFine(rc, gx, feet, lk, false, 0, true);
      P(rc, gx, feet - 5, 2, 1, lk.hair); P(rc, gx, feet - 4, 2, 1, lk.skin);
      P(rc, face < 0 ? gx + 1 : gx, feet - 4, 1, 1, U.mix(lk.skin, lk.hair, 0.5));
      P(rc, gx, feet - 3, 2, 2, lk.shirt); P(rc, gx, feet - 1, 2, 2, lk.pants);
    }
    const BARISTA = { hair: '#2a2018', skin: SKIN[1], shirt: '#3e4a42', pants: '#2a2a32' };

    // ---------- providers (depth run): workshop, café, daycare, supermarket, gym ----------
    // ppl: draw the people inside (not in heatmaps); each room places them between its furniture
    function workshop(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc);
      P(rc, gx + 2, T + 2, 16, 6, tone('#b89a6a'));                                 // tool wall
      if (det) {
        for (let i = 3; i < 17; i += 3) for (let j = 3; j < 8; j += 2) P(rc, gx + i, T + j, 1, 1, tone('#a0845a'));
        P(rc, gx + 4, T + 3, 1, 4, tone('#8a5a32')); P(rc, gx + 3, T + 3, 3, 1, tone('#5a5f6a'));                 // hammer
        P(rc, gx + 8, T + 4, 1, 3, tone('#8a909a')); P(rc, gx + 7, T + 3, 1, 1, tone('#8a909a')); P(rc, gx + 9, T + 3, 1, 1, tone('#8a909a'));  // wrench
        P(rc, gx + 11, T + 4, 4, 2, tone('#b0b6be')); P(rc, gx + 15, T + 3, 2, 3, tone('#b0402e'));               // saw
      } else { P(rc, gx + 5, T + 3, 1, 4, tone('#5a5f6a')); P(rc, gx + 9, T + 3, 1, 4, tone('#5a5f6a')); P(rc, gx + 12, T + 4, 4, 2, tone('#8a909a')); }
      P(rc, gx + 2, B - 7, 18, 1, tone('#8a5a32'));                                 // workbench with a shelf
      P(rc, gx + 3, B - 6, 1, 4, tone('#6a4224')); P(rc, gx + 18, B - 6, 1, 4, tone('#6a4224'));
      P(rc, gx + 3, B - 4, 16, 1, tone('#6a4224'));
      if (det) {
        P(rc, gx + 2, B - 9, 3, 2, tone('#4a5060'));                                 // vise
        P(rc, gx + 12, B - 9, 4, 2, tone('#b8402e')); P(rc, gx + 13, B - 10, 2, 1, tone('#3a3a3a'));   // toolbox
        P(rc, gx + 6, B - 5, 3, 1, tone('#c8a040')); P(rc, gx + 11, B - 5, 2, 1, tone('#8a909a'));     // parts
      }
      P(rc, gx + 24, B - 10, 6, 7, tone('#a8483a'));                                // tool cabinet
      P(rc, gx + 24, B - 8, 6, 1, tone('#7a2e24')); P(rc, gx + 24, B - 6, 6, 1, tone('#7a2e24'));
      if (n >= 38) { P(rc, gx + 33, B - 8, 4, 5, tone('#6a7078')); P(rc, gx + 34, B - 7, 2, 3, tone('#3a3e46')); }   // cable drum
      if (!ppl) return;
      const at = [8, 21, 31, 14];
      for (let i = 0; i < Math.min(r.inside, at.length); i++) {
        const p = r.staff && r.staff[i], id = p && p.id != null ? p.id : (r.id | 0) * 31 + i;
        worker(rc, gx + at[i], B - 3, id, !!(p && p.emergency), i % 2 ? 1 : -1, false);
      }
    }
    function cafe(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc), cx = n - 10;                                          // counter on the right
      P(rc, gx + cx + 1, T + 2, 8, 4, tone('#3e4a42'));                               // menu board
      if (det) { P(rc, gx + cx + 2, T + 3, 5, 1, tone('#d8dcd0')); P(rc, gx + cx + 2, T + 4, 3, 1, tone('#d8dcd0')); P(rc, gx + cx + 6, T + 4, 2, 1, tone('#e0b050')); }
      const tables = [4, 14];
      for (const t of tables) { P(rc, gx + t + 1, T + 1, 1, 2, tone('#3a3a3a')); P(rc, gx + t, T + 3, 3, 1, tone(lit ? '#ffe08a' : '#b89a5a')); }   // pendant lamps
      if (ppl) figure(rc, gx + cx + 6, B - 3, BARISTA, false, 0, false, 0, -1);
      P(rc, gx + cx, B - 8, 10, 1, tone('#a0703a'));                                 // counter with a cake display
      P(rc, gx + cx + 1, B - 7, 8, 4, tone('#7a4a2a'));
      P(rc, gx + cx + 2, B - 6, 6, 2, tone('#e8dcc0'));
      if (det) { P(rc, gx + cx + 3, B - 5, 1, 1, tone('#c87a5a')); P(rc, gx + cx + 5, B - 5, 1, 1, tone('#e8c070')); }
      P(rc, gx + cx + 1, B - 12, 4, 4, tone('#9aa0a8'));                             // espresso machine
      P(rc, gx + cx + 2, B - 10, 2, 1, tone('#3a3e46'));
      if (det) P(rc, gx + cx + 4, B - 12, 1, 1, lit && !rc.heat ? '#e04a3a' : tone('#7a5a5a'));
      tables.forEach((t, ti) => {                                                    // bistro tables, two chairs each
        P(rc, gx + t - 2, B - 9, 1, 6, tone('#4a3a2e')); P(rc, gx + t - 2, B - 5, 2, 1, tone('#4a3a2e'));
        P(rc, gx + t + 5, B - 9, 1, 6, tone('#4a3a2e')); P(rc, gx + t + 4, B - 5, 2, 1, tone('#4a3a2e'));
        P(rc, gx + t, B - 7, 4, 1, tone('#f2ede2')); P(rc, gx + t + 1, B - 6, 1, 3, tone('#5a5a62')); P(rc, gx + t, B - 3, 3, 1, tone('#5a5a62'));
        if (det || (ppl && r.inside > 1 + ti * 2)) P(rc, gx + t + 2, B - 8, 1, 1, tone('#f4f0e8'));   // cup
      });
      if (!ppl) return;
      const seats = [[1, 1], [8, -1], [11, 1], [18, -1]];
      for (let i = 0; i < Math.min(r.inside, seats.length); i++) figure(rc, gx + seats[i][0], B - 6, look((r.id | 0) * 31 + i), true, 0, false, 0, seats[i][1]);
    }
    function daycare(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc);
      (det ? [3, 8, 13, 22, 27] : [4, 12, 24]).forEach((x, i) => {                  // children's drawings
        P(rc, gx + x, T + 2 + (i % 2), 4, 3, tone('#f8f6ee'));
        P(rc, gx + x + 1, T + 3 + (i % 2), 2, 1, tone(KID[i % KID.length]));
        if (det) P(rc, gx + x + (i % 2 ? 2 : 1), T + 2 + (i % 2), 1, 1, tone(KID[(i + 2) % KID.length]));
      });
      P(rc, gx + 15, B - 3, 12, 1, tone('#d88a7a'));                                 // rug
      P(rc, gx + 4, B - 6, 9, 1, tone('#e0a040')); P(rc, gx + 5, B - 5, 1, 2, tone('#b07a30')); P(rc, gx + 11, B - 5, 1, 2, tone('#b07a30'));   // low table
      P(rc, gx + 2, B - 7, 1, 4, tone('#5a90c8')); P(rc, gx + 2, B - 5, 2, 1, tone('#5a90c8'));       // tiny chairs
      P(rc, gx + 14, B - 7, 1, 4, tone('#6aa860')); P(rc, gx + 13, B - 5, 2, 1, tone('#6aa860'));
      const sx = n - 10;                                                              // toy shelf with bins
      P(rc, gx + sx, B - 10, 8, 7, tone('#c8a070'));
      P(rc, gx + sx + 1, B - 9, 2, 2, tone('#d8705a')); P(rc, gx + sx + 4, B - 9, 3, 2, tone('#5a90c8'));
      P(rc, gx + sx + 1, B - 6, 3, 2, tone('#e0b040')); P(rc, gx + sx + 5, B - 6, 2, 2, tone('#6aa860'));
      if (det) {                                                                      // blocks and a ball
        P(rc, gx + 17, B - 4, 2, 1, tone('#d8705a')); P(rc, gx + 18, B - 5, 1, 1, tone('#5a90c8')); P(rc, gx + 19, B - 4, 1, 1, tone('#e0b040'));
        P(rc, gx + 24, B - 5, 2, 2, tone('#e88aa0'));
      }
      if (!ppl) return;
      figure(rc, gx + 21, B - 3, look((r.id | 0) * 31), false, 0, false, 0, -1);    // the carer, then the children
      const at = [[5, 1], [9, -1], [16, 1], [26, -1], [28, 1], [7, 1]];
      for (let i = 1; i < Math.min(r.inside, at.length + 1); i++) kid(rc, gx + at[i - 1][0], B - 3, kidLook((r.id | 0) * 31 + i), at[i - 1][1]);
    }
    const GOODS = [['#d8705a', '#e0b040', '#6aa860'], ['#5a90c8', '#e8e0c8', '#c86a8a'], ['#e0a040', '#8a6a4a', '#6aa860']];
    function supermarket(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc), units = Math.max(1, Math.floor((n - 22) / 11));
      for (let u = 0; u < units; u++) {                                              // shelves: three boards of goods
        const x = gx + 2 + u * 11, g = GOODS[u % GOODS.length];
        P(rc, x, T + 3, 1, 9, tone('#8a909a')); P(rc, x + 9, T + 3, 1, 9, tone('#8a909a'));
        for (let k = 0; k < 3; k++) {
          const y = T + 3 + k * 3;
          if (det) for (let i = 0; i < 8; i++) P(rc, x + 1 + i, y + (i % 3 === 1 ? 1 : 0), 1, i % 3 === 1 ? 1 : 2, tone(g[(i + k) % 3]));
          else P(rc, x + 1, y, 8, 2, tone(g[k]));
          P(rc, x + 1, y + 2, 8, 1, tone('#a8aeb6'));
        }
      }
      const fx = gx + 2 + units * 11;                                                // cooler
      P(rc, fx, T + 2, 7, 10, tone('#8a96a6')); P(rc, fx + 1, T + 3, 5, 8, tone(lit ? '#d4ecf4' : '#a8bcc8'));
      if (det) for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) P(rc, fx + 2 + i * 2, T + 4 + j * 3, 1, 2, tone(['#e8e0c8', '#6aa860', '#d8705a'][(i + j) % 3]));
      const kx = gx + n - 14;                                                         // checkout
      if (ppl) figure(rc, kx + 8, B - 6, look((r.id | 0) * 31), true, 0, false, 0, -1);
      P(rc, kx, B - 8, 12, 1, tone('#8a9098')); P(rc, kx + 1, B - 7, 10, 4, tone('#6a7078'));
      P(rc, kx, B - 8, 4, 1, tone('#2c2c36'));                                        // conveyor
      P(rc, kx + 4, B - 11, 3, 3, tone('#3a3e46')); P(rc, kx + 4, B - 11, 3, 1, tone(lit ? '#7fd8ff' : '#4a5a6a'));   // till
      if (!ppl) return;
      const at = [7, 18, 29, fx - gx + 2, kx - gx - 3, 13, 24];
      for (let i = 1; i < Math.min(r.inside, at.length + 1); i++) figure(rc, gx + at[i - 1], B - 3, look((r.id | 0) * 31 + i), false, 0, false, 0, i % 2 ? 1 : -1);
    }
    function gym(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc), people = ppl ? Math.min(r.inside, 5) : 0;
      const lk = i => look((r.id | 0) * 31 + i);
      P(rc, gx + 2, T + 2, 24, 6, tone('#dfe8ee'));                                   // mirror wall
      if (det) { P(rc, gx + 5, T + 3, 1, 1, tone('#ffffff')); P(rc, gx + 6, T + 4, 1, 1, tone('#ffffff')); P(rc, gx + 17, T + 3, 1, 1, tone('#ffffff')); P(rc, gx + 18, T + 4, 1, 1, tone('#ffffff')); }
      [3, 15].forEach((t, i) => {                                                     // treadmills, runners on the belt
        P(rc, gx + t, B - 4, 9, 1, tone('#2c2c36')); P(rc, gx + t, B - 3, 9, 1, tone('#5a5f6a'));
        if (people > i) figure(rc, gx + t + 3, B - 5, lk(i), false, 0, false, 0, 1);
        P(rc, gx + t + 8, B - 10, 1, 6, tone('#5a5f6a')); P(rc, gx + t + 6, B - 11, 3, 2, tone('#3a3e46'));
        P(rc, gx + t + 6, B - 8, 2, 1, tone('#5a5f6a'));
        if (det) P(rc, gx + t + 7, B - 11, 1, 1, lit && !rc.heat ? '#7fd8ff' : tone('#4a5a6a'));
      });
      const bx = 28;                                                                  // bench press
      P(rc, gx + bx, B - 6, 9, 1, tone('#3a3a48')); P(rc, gx + bx + 1, B - 5, 1, 2, tone('#3a3a48')); P(rc, gx + bx + 7, B - 5, 1, 2, tone('#3a3a48'));
      if (people > 2) figure(rc, gx + bx + 3, B - 6, lk(2), true, 0, false, 0, 1);
      P(rc, gx + bx + 1, B - 11, 1, 5, tone('#5a5f6a')); P(rc, gx + bx + 7, B - 11, 1, 5, tone('#5a5f6a'));
      P(rc, gx + bx - 1, B - 11, 11, 1, tone('#9aa0a8'));
      P(rc, gx + bx - 1, B - 13, 1, 4, tone('#2c2c36')); P(rc, gx + bx + 9, B - 13, 1, 4, tone('#2c2c36'));
      const dx = n - 10;                                                              // dumbbell rack
      P(rc, gx + dx, B - 6, 8, 1, tone('#5a5f6a')); P(rc, gx + dx, B - 5, 1, 2, tone('#5a5f6a')); P(rc, gx + dx + 7, B - 5, 1, 2, tone('#5a5f6a'));
      if (det) for (let i = 0; i < 4; i++) { P(rc, gx + dx + i * 2, B - 8, 1, 2, tone('#2c2c36')); P(rc, gx + dx + i * 2 + 1, B - 7, 1, 1, tone('#9aa0a8')); }
      else P(rc, gx + dx, B - 8, 8, 2, tone('#3a3a48'));
      if (people > 3) figure(rc, gx + dx + 3, B - 3, lk(3), false, 0, false, 0, -1);
      if (people > 4) figure(rc, gx + 22, B - 3, lk(4), false, 0, false, 0, -1);
    }
    const PROVIDERS = { workshop, cafe, daycare, supermarket, gym };

    // ---------- stars run (TOWER-a0010): spa, rooftop bar, hotel, garage, tech floor, damper ----------
    const ROBE = { shirt: '#f2eee6', pants: '#e4ded2' };
    const robeLook = id => Object.assign(look(id), ROBE);
    function spa(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc), pw = Math.max(8, Math.min(18, n - 32));
      P(rc, gx + 1, T + 7, n - 2, 1, tone('#b6d0cc'));                                // tile band
      for (const x of [6, Math.round(n / 2)]) { P(rc, gx + x, T + 1, 1, 2, tone('#3a3a3a')); P(rc, gx + x - 1, T + 3, 3, 1, tone(lit ? '#ffe2a8' : '#c8b898')); }   // soft lamps
      P(rc, gx + 2, B - 7, pw + 2, 1, tone('#dcd6c8'));                               // pool: stone rim, water
      P(rc, gx + 3, B - 6, pw, 3, tone('#5aa6c4'));
      P(rc, gx + 3, B - 6, pw, 1, tone('#8ccbe0'));
      if (det) for (let i = 3; i < pw - 1; i += 5) P(rc, gx + 3 + i, B - 5, 2, 1, tone('#a6dcea'));
      if (det && !rc.heat) for (let i = 0; i < 3; i++) P(rc, gx + 5 + i * 6, B - 10 - (i % 2), 1, 1, 'rgba(255,255,255,.55)');   // steam
      const lx = gx + pw + 6;                                                          // lounger with a towel, a plant
      P(rc, lx, B - 6, 9, 1, tone('#f2eee6')); P(rc, lx + 7, B - 8, 2, 2, tone('#f2eee6'));
      P(rc, lx, B - 5, 1, 2, tone('#8a6a4a')); P(rc, lx + 8, B - 5, 1, 2, tone('#8a6a4a'));
      if (det) P(rc, lx + 2, B - 7, 4, 1, tone('#7ab0c8'));
      if (n >= 50) plant(rc, lx + 11, B, tone);
      const sx = gx + n - 11;                                                        // sauna: wooden cabin, door with a window
      P(rc, sx, T + 2, 10, 11, tone('#b8844e')); P(rc, sx, T + 2, 10, 1, tone('#8a5a32'));
      if (det) for (let j = T + 4; j < T + 13; j += 2) P(rc, sx, j, 10, 1, tone('#aa7642'));
      P(rc, sx + 3, T + 5, 4, 8, tone('#946234')); P(rc, sx + 4, T + 6, 2, 2, tone(lit ? '#ffd890' : '#c8a878'));
      if (!ppl) return;
      const inPool = Math.min(r.inside, 3);
      for (let i = 0; i < inPool; i++) {                                                // heads and shoulders above the water
        const lk = look((r.id | 0) * 31 + i), x = gx + 5 + i * 6;
        P(rc, x, B - 9, 2, 2, lk.skin); P(rc, x, B - 9, 2, 1, lk.hair); P(rc, x - 1, B - 7, 4, 1, lk.skin);
      }
      if (r.inside > 3) figure(rc, lx + 3, B - 6, robeLook((r.id | 0) * 31 + 3), true, 0, false, 0, 1);
      if (r.inside > 4) figure(rc, sx - 4, B - 3, robeLook((r.id | 0) * 31 + 4), false, 0, false, 0, -1);
    }
    // open roof terrace: no back wall (the sky shows), deck, glass balustrade at the ends, string lights,
    // parasols, a bar. Built over (floor above) it is a covered room – the engine halves its guests.
    function covered(rc, r, w) {
      const wk = rc.world && rc.world.walkable;
      if (!wk) return false;
      for (let i = 0; i < w; i++) if (wk.call(rc.world, r.f + 1, r.x + i)) return true;
      return false;
    }
    function rooftop(rc, r, gx, T, B, n, lit, tone, ppl, open) {
      const det = clutter(rc), eve = rc.t / 3600 >= 18 || rc.t / 3600 < 6;
      const on = !rc.heat && (eve || rc.night);
      P(rc, gx, B - 3, n, 1, tone('#8a6a48'));                                         // deck
      if (det) for (let i = 4; i < n; i += 7) P(rc, gx + i, B - 3, 1, 1, tone('#6a4e34'));
      for (const x of [gx, gx + n - 6]) {                                              // glass balustrade at both ends
        P(rc, x + 1, B - 8, 4, 5, rc.heat ? tone('#c8e8f4') : open ? 'rgba(200,232,244,.5)' : 'rgba(200,232,244,.25)');
        P(rc, x, B - 9, 1, 6, tone('#6a7078')); P(rc, x + 5, B - 9, 1, 6, tone('#6a7078'));
        P(rc, x, B - 9, 6, 1, tone('#8a9098'));
      }
      // string lights sag across the terrace
      const wy = T + 2, segs = Math.max(2, Math.round(n / 15));
      for (let s = 0; s < segs; s++) {
        const a = gx + 2 + Math.round((n - 4) * s / segs), b = gx + 2 + Math.round((n - 4) * (s + 1) / segs);
        for (let x = a; x < b; x++) {
          const u = (x - a) / Math.max(1, b - a), y = wy + Math.round(Math.sin(u * Math.PI) * 2);
          P(rc, x, y, 1, 1, tone('#4a4a52'));
          if ((x - gx) % 6 === 3) { P(rc, x, y + 1, 1, 1, on ? '#ffe08a' : tone('#d8d0b8')); if (on && rc.detail === 2) P(rc, x - 1, y + 1, 3, 2, 'rgba(255,224,138,.28)'); }
        }
      }
      const tables = n >= 50 ? [9, 25] : [9];
      tables.forEach((t, i) => {                                                        // parasols over high tables
        const x = gx + t;
        P(rc, x - 4, B - 13, 9, 1, tone(i ? '#3a7a8a' : '#c8503a')); P(rc, x - 3, B - 14, 7, 1, tone(i ? '#3a7a8a' : '#c8503a'));
        if (det) { P(rc, x - 2, B - 13, 1, 1, tone('#f0ece0')); P(rc, x + 2, B - 13, 1, 1, tone('#f0ece0')); }
        P(rc, x, B - 12, 1, 9, tone('#5a5a62'));
        P(rc, x - 2, B - 8, 5, 1, tone('#e8e2d4')); P(rc, x - 1, B - 7, 1, 4, tone('#5a5a62'));
      });
      const bx = gx + n - 17;                                                           // bar with a back bar of bottles
      P(rc, bx + 2, B - 12, 12, 1, tone('#6a4224')); P(rc, bx + 2, B - 12, 1, 4, tone('#6a4224')); P(rc, bx + 13, B - 12, 1, 4, tone('#6a4224'));
      if (det) for (let i = 0; i < 5; i++) P(rc, bx + 4 + i * 2, B - 14, 1, 2, tone(['#3a8a4a', '#8a2a2a', '#c8a040', '#4a4ac0', '#e0e0d8'][i]));
      if (ppl) figure(rc, bx + 7, B - 5, { hair: '#2a2018', skin: SKIN[2], shirt: '#2a2a32', pants: '#2a2a32' }, false, 0, false, 0, -1);
      P(rc, bx, B - 8, 14, 1, tone('#a0703a')); P(rc, bx + 1, B - 7, 12, 4, tone('#5a3a24'));
      if (det) P(rc, bx + 3, B - 9, 1, 1, tone('#e8c8a0'));
      plant(rc, gx + 3, B, tone);
      if (!ppl) return;
      const at = [[tables[0] - 4, 1], [tables[0] + 3, -1], [(tables[1] || 17) - 4, 1], [(tables[1] || 17) + 3, -1], [n - 20, 1], [n - 23, 1], [n - 26, -1], [(tables[0] + (tables[1] || 30)) / 2 | 0, 1]];
      for (let i = 0; i < Math.min(r.inside, at.length); i++) figure(rc, gx + at[i][0], B - 3, look((r.id | 0) * 31 + i), false, 0, false, 0, at[i][1]);
    }
    // hotel: six small rooms (or rooms per CFG), each with bed, window, lamp; booked ones lit at night
    function hotel(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc), def = roomDef('hotel'), k = Math.max(1, Math.min(12, Math.round(def.suites || 6))), cw = n / k;
      const raw = [r.guests, r.booked, r.occupiedRooms, r.inside].find(v => typeof v === 'number' && isFinite(v));
      const guests = Math.max(0, Math.min(k, Math.round(raw || 0)));
      const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => U.hash(r.id | 0, a, 61) - U.hash(r.id | 0, b, 61));
      const booked = new Set(order.slice(0, guests));
      const h = rc.t / 3600, sleep = h >= 23 || h < 6.5;
      for (let i = 0; i < k; i++) {
        const x = Math.round(gx + i * cw), w = Math.round(gx + (i + 1) * cw) - x, on = booked.has(i);
        if (i) P(rc, x, T + 1, 1, 13, tone('#a88c70'));                                // partition
        P(rc, x + w - 5, T + 3, 3, 3, tone(on && !sleep ? '#ffe9a8' : '#8aa0b4'));      // window
        P(rc, x + 1, B - 9, 1, 6, tone('#6a4024'));                                    // bed: headboard, frame, sheet, pillow
        P(rc, x + 2, B - 6, Math.max(3, w - 5), 3, tone('#8a5a32'));
        P(rc, x + 2, B - 7, Math.max(3, w - 5), 1, tone('#f4f0e8'));
        P(rc, x + 2, B - 8, 2, 1, tone('#ffffff'));
        if (det && on) P(rc, x + w - 3, B - 5, 2, 2, tone(['#b8402e', '#3a5a8a', '#2c2c36'][i % 3]));   // suitcase
        if (!rc.heat && rc.night && !sleep) P(rc, x + 1, T + 1, w - 1, 13, on ? 'rgba(255,196,110,.16)' : th.nightDark);
        else if (!rc.heat && rc.night) P(rc, x + 1, T + 1, w - 1, 13, th.nightDark);
        if (ppl && on) {
          const lk = look((r.id | 0) * 31 + i);
          if (sleep || h < 7.5) { P(rc, x + 2, B - 9, 2, 2, lk.skin); P(rc, x + 2, B - 9, 2, 1, lk.hair); P(rc, x + 4, B - 8, Math.max(1, w - 7), 1, tone('#5a7ac8')); }
          else if (U.hash(r.id | 0, i, Math.floor(rc.t / 2400)) < 0.7) figure(rc, x + w - 6, B - 3, lk, false, 0, false, 0, i % 2 ? 1 : -1);
        }
      }
      for (let i = 0; i < 3; i++) P(rc, gx + 2 + i * 3, T + 1, 1, 1, '#d8b040');        // three gold stars on the trim
    }
    // underground garage (only below 0): pillars with hazard stripes, a guide line, parked cars, P sign
    const CARS = ['#b8402e', '#3a5a8a', '#d8d4cc', '#2c2c36', '#6a8a5a', '#c8a040', '#7a7e86'];
    function car(rc, x, B, col, tone) {
      P(rc, x, B - 7, 13, 3, tone(col)); P(rc, x + 3, B - 9, 7, 2, tone(col));
      P(rc, x + 4, B - 9, 2, 1, tone('#9ab8c8')); P(rc, x + 7, B - 9, 2, 1, tone('#9ab8c8'));
      P(rc, x, B - 6, 1, 1, tone('#f0e0a0')); P(rc, x + 12, B - 6, 1, 1, tone('#c83a2e'));
      P(rc, x + 2, B - 4, 2, 1, '#1a1a1e'); P(rc, x + 9, B - 4, 2, 1, '#1a1a1e');
    }
    function garage(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc), bays = Math.max(1, Math.floor((n - 2) / 20));
      P(rc, gx, T + 8, n, 1, tone('#d8a838'));                                         // guide line on the wall
      for (let b = 0; b <= bays; b++) {                                                 // pillars
        const x = Math.min(gx + n - 3, gx + b * 20);
        P(rc, x, T + 1, 3, 13, tone('#999da3'));
        if (det) for (let j = 0; j < 3; j++) P(rc, x, B - 5 - j, 3, 1, j % 2 ? '#2c2c36' : '#e0b030');
        else P(rc, x, B - 5, 3, 2, tone('#d8a838'));
      }
      const def = roomDef('garage'), h = rc.t / 3600;
      const v = [r.parked, r.cars].find(q => typeof q === 'number' && isFinite(q));
      // parked cars: r.parked / r.cars if the engine has them (≤ bays = cars, else users of cap), else by the clock
      const parked = v == null ? -1 : v <= bays ? Math.round(v) : Math.round(bays * Math.min(1, v / (def.spaces || 60)));
      const share = h >= 8 && h < 18 ? 0.8 : h >= 6.5 && h < 21 ? 0.45 : 0.3;
      for (let b = 0; b < bays; b++) {
        const there = parked >= 0 ? b < parked : U.hash(r.id | 0, b, 71) < share;
        if (there) car(rc, gx + b * 20 + 5, B, CARS[(U.hash(r.id | 0, b, 73) * CARS.length) | 0], tone);
        else if (det) P(rc, gx + b * 20 + 9, B - 4, 5, 1, tone('#c8c8c0'));            // empty bay: painted line
      }
      const px = gx + n - 9;                                                            // P sign
      P(rc, px, T + 2, 6, 6, tone('#2a5aa8'));
      P(rc, px + 2, T + 3, 1, 4, '#ffffff'); P(rc, px + 3, T + 3, 1, 1, '#ffffff'); P(rc, px + 4, T + 4, 1, 1, '#ffffff'); P(rc, px + 3, T + 5, 1, 1, '#ffffff');
      if (!ppl) return;
      for (let i = 0; i < Math.min(r.inside, bays * 2); i++) figure(rc, gx + 19 + (i >> 1) * 20 + (i % 2 ? -4 : 0), B - 3, look((r.id | 0) * 31 + i), false, 0, false, 0, i % 2 ? -1 : 1);
    }
    // tech floor: pipes, air handlers with fans, a tank, switch cabinets; mechanics if someone is there
    function tech(rc, r, gx, T, B, n, lit, tone, ppl) {
      const det = clutter(rc);
      P(rc, gx, T + 2, n, 1, tone('#b8503a')); P(rc, gx, T + 4, n, 1, tone('#4a74a8'));   // pipes
      if (det) for (let x = 6; x < n; x += 12) { P(rc, gx + x, T + 1, 1, 3, tone('#8a3a2a')); P(rc, gx + x + 3, T + 3, 1, 3, tone('#3a5a88')); }
      for (const ux of [3, 17]) {                                                       // air handlers
        if (ux + 12 > n - 16) break;
        P(rc, gx + ux, B - 11, 12, 8, tone('#8a9298')); P(rc, gx + ux, B - 11, 12, 1, tone('#a8b0b6'));
        P(rc, gx + ux + 2, B - 9, 6, 5, tone('#5a6268')); P(rc, gx + ux + 4, B - 8, 2, 3, tone('#9aa2a8'));
        if (det) for (let j = 0; j < 3; j++) P(rc, gx + ux + 9, B - 9 + j * 2, 2, 1, tone('#6a7278'));
      }
      const tx = gx + Math.max(31, n - 30);                                             // tank
      if (tx + 8 < gx + n - 14) { P(rc, tx, B - 12, 8, 9, tone('#a8b0b8')); P(rc, tx, B - 10, 8, 1, tone('#88909a')); P(rc, tx, B - 6, 8, 1, tone('#88909a')); }
      const cx = gx + n - 13;                                                           // switch cabinets with LEDs
      for (let i = 0; i < 2; i++) {
        P(rc, cx + i * 6, T + 6, 5, 8, tone('#6a7a6a')); P(rc, cx + i * 6 + 2, T + 7, 1, 6, tone('#5a6a5a'));
        const blink = rc.detail === 2 && !rc.heat && Math.floor(rc.time * 1.5 + i) % 2;
        P(rc, cx + i * 6 + 1, T + 7, 1, 1, blink ? '#3a4a3a' : '#5ae07a'); if (det) P(rc, cx + i * 6 + 3, T + 7, 1, 1, '#e8a03a');
      }
      if (!ppl) return;
      for (let i = 0; i < Math.min(r.inside, 2); i++) worker(rc, gx + 14 + i * 16, B - 3, (r.id | 0) * 31 + i, false, i ? -1 : 1);
    }
    // tuned mass damper, one floor; level 1 pendulum · 2 active (hydraulics, blue control) · 3 isolated
    // foundation (rubber bearings, gold band). Chevrons on the wall show the level at any zoom.
    const DAMP_ACC = [null, '#e0b030', '#3a8ad8', '#c8a040'];
    function damper(rc, r, gx, T, B, n, lit, tone, ppl) {
      const lv = Math.max(1, Math.min(3, Math.round(+r.damperLevel || 1))), acc = DAMP_ACC[lv];
      const q = root.TowerRender.quakeOffset ? root.TowerRender.quakeOffset(rc.world, rc.time) : { x: 0 };
      const sway = q.level ? Math.round(q.x * 1.5) : 0;                                 // the mass swings against the shake
      const c0 = gx + 12, c1 = gx + n - 14, cx = Math.round((c0 + c1 + 2) / 2) - sway;
      P(rc, c0, T + 1, 2, 13, tone('#5a626c')); P(rc, c1, T + 1, 2, 13, tone('#5a626c'));   // portal frame
      P(rc, c0, T + 1, c1 - c0 + 2, 2, tone('#5a626c'));
      const mw = Math.min(16, c1 - c0 - 8), mx = cx - (mw >> 1), my = T + 6;
      P(rc, mx + 2, T + 3, 1, 3, tone('#3a3e46')); P(rc, mx + mw - 3, T + 3, 1, 3, tone('#3a3e46'));   // cables
      if (lv >= 2) {                                                                     // hydraulic rams from both columns
        P(rc, c0 + 2, my + 3, mx - c0 - 2, 1, tone('#c8ccd0')); P(rc, mx + mw, my + 3, c1 - mx - mw, 1, tone('#c8ccd0'));
        P(rc, c0 + 2, my + 2, 4, 3, tone('#3a6ab0')); P(rc, c1 - 4, my + 2, 4, 3, tone('#3a6ab0'));
      }
      P(rc, mx, my, mw, 6, tone('#6a7480')); P(rc, mx, my, mw, 1, tone('#8a949e'));      // the mass
      P(rc, mx + 1, my + 2, mw - 2, 1, lv === 3 ? '#c8a040' : tone(acc));
      if (lv === 3) for (let x = c0 + 3; x < c1 - 3; x += 7) {                           // rubber bearings on the floor
        for (let j = 0; j < 3; j++) P(rc, x, B - 6 + j, 5, 1, j % 2 ? tone('#8a8e94') : tone('#2c2c36'));
      } else P(rc, mx + 2, B - 4, mw - 4, 1, tone('#7a828c'));                           // stop buffer
      const panel = gx + 3;                                                              // control panel (level 2+) or a gauge
      P(rc, panel, T + 4, 6, 8, tone('#4a525c'));
      P(rc, panel + 1, T + 5, 4, 3, lv >= 2 && !rc.heat ? '#7fc8ff' : tone('#8a949e'));
      for (let i = 0; i < lv; i++) {                                                     // chevrons = level
        const y = T + 9 + i * 2 - (lv - 1);
        P(rc, panel + 1, y, 1, 1, rc.heat ? tone(acc) : acc); P(rc, panel + 2, y + 1, 2, 1, rc.heat ? tone(acc) : acc); P(rc, panel + 4, y, 1, 1, rc.heat ? tone(acc) : acc);
      }
      if (ppl) worker(rc, gx + n - 8, B - 3, (r.id | 0) * 31, false, -1);
    }
    Object.assign(PROVIDERS, { spa, hotel, garage, tech, damper });
    // generic look for types without a sprite: a frame on the back wall, people standing about; the
    // icon and label come on top in room() (TOWER-a0010 contract)
    // ---------- star expansion part 2 (TOWER-a0011): the vertical city, anchors at the side, the space elevator ----------
    const glow = (rc, tone, c) => (rc.heat ? tone(c) : c);       // lights keep their colour, the heatmap tones them
    // people at fixed spots [{x, sit, face, kid}], at most r.inside, each keeps a spot about `len` game minutes
    function crowd(rc, r, gx, B, spots, len, lookFn) {
      const n = Math.min(r.inside | 0, spots.length);
      if (n <= 0 || rc.heat) return;
      const res = pickSpots(rc, r, n, spots, len || 40, (i, h) => (h < 0.7 ? i : -1));
      res.forEach((a, i) => {
        if (!a) return;
        const sp = a.spot, id = (r.id | 0) * 31 + i, face = sp.face || a.face;
        if (sp.kid) kid(rc, gx + sp.x, B - 3, kidLook(id), face);
        else figure(rc, gx + sp.x, sp.sit ? B - 6 : B - 3, lookFn ? lookFn(id) : look(id), !!sp.sit, 0, false, 0, face);
      });
    }
    const spread = (n, k, a, b) => Array.from({ length: Math.max(0, k) }, (_, i) => ({ x: Math.round(a + (n - a - b) * (i + 0.5) / Math.max(1, k)) }));
    // which outer wall a room touches (heliport, airship, gondola dock outside): -1 left, 1 right, 0 none
    function edgeSide(rc, r, rw) {
      const c = CFG(), tw = towerW(rc), bx = c && c.TWIN_X && r.x >= c.TWIN_X ? c.TWIN_X : 0;
      if (r.x + rw >= bx + tw) return 1;
      if (r.x <= bx) return -1;
      return 0;
    }
    const COURIER = { hair: '#2a2018', skin: SKIN[1], shirt: '#d89a2a', pants: '#5a4a3a' };
    const STAFF = { hair: '#3a2a1e', skin: SKIN[0], shirt: '#8a96a2', pants: '#3e4150' };
    const NURSE = { hair: '#5a4030', skin: SKIN[0], shirt: '#f2f4f2', pants: '#cfe2dc' };
    const GUARD = { hair: '#1e1e22', skin: SKIN[2], shirt: '#2a3448', pants: '#20242e' };
    const CLERK = { hair: '#5a4030', skin: SKIN[1], shirt: '#6a7a8a', pants: '#3e4150' };

    function lockers(rc, r, gx, T, B, n, lit, tone, ppl) {        // a wall of parcel boxes with a screen
      const w = n - 4, cols = Math.max(2, Math.floor(w / 4)), cw = Math.floor(w / cols);
      const full = typeof r.full === 'number' ? r.full : Math.max(0.1, Math.min(0.9, (rc.t / 3600 - 8) / 10));
      P(rc, gx + 2, T + 1, w, 12, tone('#7d8a98'));
      for (let c = 0; c < cols; c++) for (let j = 0; j < 4; j++) {
        const x = gx + 3 + c * cw, y = T + 2 + j * 3, used = U.hash(r.id | 0, c * 4 + j, 51) < full;
        P(rc, x, y, cw - 1, 2, tone(used ? '#c8d0d8' : '#a8b4c0'));
        if (used) P(rc, x + cw - 2, y, 1, 1, glow(rc, tone, '#e0a030'));
      }
      P(rc, gx + 2 + Math.floor(w / 2) - 2, T + 6, 4, 3, glow(rc, tone, '#7fd8ff'));
      if (ppl) figure(rc, gx + Math.round(n / 2) + 2, B - 3, COURIER, false, 0, false, 0, -1);
    }

    const SCREEN = ['#9ad0ff', '#f0d890', '#a8e0b0', '#f0b0a0', '#c8b0f0'];
    function cinema(rc, r, gx, T, B, n, lit, tone, ppl) {         // screen with curtains, three tiers of red seats
      const show = r.inside > 0 && !rc.heat;
      const sw = Math.max(14, Math.round(n * 0.28)), sx = gx + n - sw - 4;
      P(rc, sx - 1, T + 1, sw + 2, 9, tone('#1a1418'));
      P(rc, sx, T + 2, sw, 7, show ? SCREEN[Math.floor(rc.time / 2.5 + (r.id | 0)) % SCREEN.length] : tone('#d8d4c8'));
      if (show) { P(rc, sx + 2, T + 6, sw - 4, 2, 'rgba(0,0,0,.18)'); P(rc, gx + 2, T + 2, 2, 2, '#fff4c8'); }
      P(rc, sx - 3, T + 1, 2, 11, tone('#8a2a30')); P(rc, sx + sw + 1, T + 1, 2, 11, tone('#8a2a30'));
      P(rc, gx + 1, T + 1, 4, 3, tone('#2a2228'));                                      // projector booth
      const x0 = gx + 2, L = sx - 6 - x0, seats = [];
      for (let k = 2; k >= 0; k--) {
        const a = x0 + Math.round(L * (2 - k) / 3), b = x0 + Math.round(L * (3 - k) / 3), feet = B - 3 - 2 * k;
        if (k) P(rc, x0, B - 2 - 2 * k, b - x0, 2 * k, tone('#2a2228'));
        for (let x = a + 1; x + 4 <= b; x += 5) {
          P(rc, x, feet - 4, 1, 4, tone('#8a2430')); P(rc, x + 1, feet - 2, 3, 1, tone('#a83038'));
          P(rc, x + 2, feet - 1, 1, 2, tone('#3a2a2e'));
          seats.push({ x: x + 1, feet });
        }
      }
      if (!show) return;
      const k = Math.min(r.inside | 0, seats.length);
      for (let i = 0; i < k; i++) {
        const s = seats[Math.floor(U.hash(r.id | 0, i, 53) * seats.length + i) % seats.length];
        figure(rc, s.x, s.feet - 3, look((r.id | 0) * 31 + i), true, 0, false, 0, 1);
      }
    }

    function pool(rc, r, gx, T, B, n, lit, tone, ppl) {           // basin with swimmers, ladder, a diving board
      P(rc, gx + 1, T + 6, n - 2, 1, tone('#b6d0d4'));
      if (r.f >= 0) for (let x = 6; x < n - 8; x += 14) P(rc, gx + x, T + 1, 8, 4, tone(lit ? '#e0f4ff' : '#9ab8c8'));
      const a = gx + 4, w = n - 14;
      P(rc, a - 1, B - 8, 1, 6, tone('#dcd6c8')); P(rc, a + w, B - 8, 1, 6, tone('#dcd6c8'));
      P(rc, a, B - 7, w, 5, tone('#5aa6c4'));
      P(rc, a, B - 7, w, 1, tone('#8ccbe0'));
      if (!rc.heat) for (let i = 2; i < w - 2; i += 5) if (U.hash(i, Math.floor(rc.time * 2), 57) > 0.55) P(rc, a + i, B - 7, 2, 1, '#e4f6fb');
      P(rc, a - 1, B - 9, 7, 1, tone('#e8e2d4')); P(rc, a - 1, B - 8, 1, 1, tone('#8a8478'));   // diving board
      const lx = a + w + 3;                                                             // ladder
      P(rc, lx, B - 11, 1, 8, tone('#9aa0a8')); P(rc, lx + 2, B - 11, 1, 8, tone('#9aa0a8'));
      for (let y = B - 10; y < B - 3; y += 2) P(rc, lx, y, 3, 1, tone('#9aa0a8'));
      if (rc.heat) return;
      const k = Math.min(r.inside | 0, Math.max(1, Math.floor(w / 9)));
      for (let i = 0; i < k; i++) {
        const u = (rc.t / (30 + 20 * U.hash(r.id | 0, i, 58)) + U.hash(r.id | 0, i, 59) * 2) % 2, dir = u < 1 ? 1 : -1;
        const x = Math.round(a + 2 + (u < 1 ? u : 2 - u) * (w - 6)), lk = look((r.id | 0) * 31 + i);
        P(rc, x, B - 9, 2, 2, lk.skin); P(rc, x, B - 9, 2, 1, ['#d8483a', '#3a6ab0', '#e0b040', '#f2f2ee'][i % 4]);
        P(rc, dir > 0 ? x + 2 : x - 1, B - 8, 1, 1, '#e4f6fb');
      }
      if (r.inside > k) figure(rc, lx - 6, B - 3, robeLook((r.id | 0) * 31 + k), false, 0, false, 0, -1);
    }

    const BOOKS = ['#8a3a3a', '#3a5a8a', '#c8a040', '#4a7a4a', '#7a5a9a'];
    function library(rc, r, gx, T, B, n, lit, tone, ppl) {        // two tall bookcases, a reading table with lamps
      const det = clutter(rc);
      for (const x0 of [2, n - 18]) {
        P(rc, gx + x0, T + 1, 16, 12, tone('#6a4024'));
        for (let j = 0; j < 4; j++) {
          P(rc, gx + x0 + 1, T + 4 + j * 3, 14, 1, tone('#4a2c18'));
          for (let i = 0; i < 14; i += det ? 1 : 2) P(rc, gx + x0 + 1 + i, T + 2 + j * 3, 1, 2, tone(BOOKS[(i * 3 + j + x0) % BOOKS.length]));
        }
      }
      const tx = gx + 21, tw = n - 42;
      if (tw >= 6) {
        P(rc, tx, B - 7, tw, 1, tone('#8a5a32')); P(rc, tx + 1, B - 6, 1, 3, tone('#6a4224')); P(rc, tx + tw - 2, B - 6, 1, 3, tone('#6a4224'));
        for (const lx of [tx + 2, tx + tw - 5]) { P(rc, lx + 1, B - 9, 1, 2, tone('#3a3a3a')); P(rc, lx, B - 10, 3, 1, glow(rc, tone, lit ? '#5ab07a' : '#3a7a4a')); }
      }
      crowd(rc, r, gx, B, [{ x: tx - 3, sit: true, face: 1 }, { x: tx + tw, sit: true, face: -1 }, { x: 9 }, { x: n - 11 }, { x: tx + 6, sit: true, face: 1 }], 50);
    }

    function district(rc, r, gx, T, B, n, lit, tone, ppl) {       // a small square: café stall, a shop, a tree, benches
      for (let c = 1; c < n; c += 24) P(rc, gx + c, T + 1, 2, 12, tone('#d0c4a8'));
      P(rc, gx + 5, T + 2, 16, 2, tone('#3a7a5a'));                                       // café stall
      if (clutter(rc)) for (let i = 0; i < 16; i += 4) P(rc, gx + 5 + i, T + 4, 2, 1, tone('#3a7a5a'));
      P(rc, gx + 8, B - 11, 3, 3, tone('#9aa0a8'));
      P(rc, gx + 5, B - 8, 16, 1, tone('#a0703a')); P(rc, gx + 6, B - 7, 14, 4, tone('#7a4a2a'));
      const sx = gx + n - 25;                                                            // shop
      P(rc, sx, T + 2, 22, 2, tone('#b8503a'));
      for (let j = 0; j < 3; j++) {
        P(rc, sx + 1, T + 7 + j * 3, 20, 1, tone('#8a6a4a'));
        for (let i = 0; i < 20; i += 3) P(rc, sx + 1 + i, T + 5 + j * 3, 2, 2, tone(GOODS[j][(i / 3) % 3 | 0]));
      }
      const tx = gx + Math.round(n / 2) - 4;                                            // tree in a planter
      P(rc, tx, B - 6, 9, 3, tone('#8a7a64')); P(rc, tx + 4, B - 10, 1, 4, tone('#6a4a2a'));
      P(rc, tx + 1, T + 2, 7, 6, tone('#5a9a4a')); P(rc, tx + 2, T + 1, 5, 1, tone('#6aac5a')); P(rc, tx, T + 4, 9, 2, tone('#5a9a4a'));
      for (const bx of [tx - 15, tx + 16]) { P(rc, bx, B - 6, 8, 1, tone('#8a5a32')); P(rc, bx + 1, B - 5, 1, 2, tone('#5a3a24')); P(rc, bx + 6, B - 5, 1, 2, tone('#5a3a24')); }
      crowd(rc, r, gx, B, [{ x: 8, face: 1 }, { x: 14, face: 1 }, { x: tx - 14 - gx, sit: true, face: 1 }, { x: tx - 10 - gx, sit: true, face: -1 },
        { x: tx + 17 - gx, sit: true, face: 1 }, { x: tx + 21 - gx, sit: true, face: -1 }, { x: n - 20, face: 1 }, { x: n - 12, face: -1 },
        { x: Math.round(n / 2) - 20 }, { x: Math.round(n / 2) + 26 }], 30);
    }

    function logistics(rc, r, gx, T, B, n, lit, tone, ppl) {      // towel shelves, washing machines, a laundry cart
      P(rc, gx + 2, T + 1, 16, 12, tone('#8a96a2'));
      for (let j = 0; j < 3; j++) {
        P(rc, gx + 3, T + 5 + j * 4, 14, 1, tone('#6a7682'));
        for (let i = 0; i < 14; i += 4) P(rc, gx + 3 + i, T + 2 + j * 4, 3, 3, tone(j % 2 ? '#7aa0d0' : '#f2f2ee'));
      }
      const m = Math.max(1, Math.min(3, Math.floor((n - 34) / 10)));
      for (let k = 0; k < m; k++) {
        const x = gx + 22 + k * 10;
        P(rc, x, B - 11, 8, 8, tone('#e8ecf0')); P(rc, x, B - 11, 8, 1, tone('#b8c0c8'));
        P(rc, x + 2, B - 9, 4, 4, tone('#5a6a7a'));
        P(rc, x + 3, B - 8, 2, 2, !rc.heat && Math.floor(rc.time * 3 + k) % 2 ? '#bfe6f0' : tone('#8ab0c8'));
      }
      const cx = gx + n - 11;
      P(rc, cx, B - 8, 9, 4, tone('#3a6ab0')); P(rc, cx + 1, B - 9, 7, 1, tone('#f2f2ee'));
      P(rc, cx + 1, B - 4, 1, 1, tone('#2a2a30')); P(rc, cx + 7, B - 4, 1, 1, tone('#2a2a30'));
      crowd(rc, r, gx, B, [{ x: 18, face: 1 }, { x: n - 14, face: -1 }, { x: 34 }], 40, id => Object.assign(look(id), { shirt: STAFF.shirt, pants: STAFF.pants }));
    }

    function station(rc, r, gx, T, B, n, lit, tone, ppl) {        // tiled platform, a train that comes and goes, pillars
      P(rc, gx, T + 3, n, 1, tone('#3a5a8a'));
      const ctx = rc.ctx, x0 = gx / G;
      // the train: every 4 game minutes, stays 2½, slides in from the right and out to the left
      const per = 240, ph = (rc.t + U.hash(r.id | 0, 1, 61) * per) % per;
      if (ph < 150 && !rc.heat) {
        const shift = ph < 20 ? Math.pow(1 - ph / 20, 2) * n : ph > 130 ? -Math.pow((ph - 130) / 20, 2) * n : 0;
        ctx.save(); ctx.beginPath(); ctx.rect(rc.sx(x0), rc.sy(T / G), n / G * rc.s, 14 / G * rc.s); ctx.clip();
        for (let x = 2; x < n; x += 38) {
          const cx = Math.round(gx + x + shift);
          P(rc, cx, T + 4, 36, 8, tone('#e4e4dc')); P(rc, cx, T + 4, 36, 1, tone('#b8b8b0'));
          P(rc, cx, T + 9, 36, 1, tone('#3a5a8a'));
          for (let wx = 3; wx < 33; wx += 6) P(rc, cx + wx, T + 6, 4, 2, glow(rc, tone, '#fff0c0'));
          P(rc, cx + 16, T + 6, 4, 6, tone('#9aa0a8'));
        }
        ctx.restore();
      } else P(rc, gx, T + 10, n, 1, tone('#5a5a5e'));                                  // empty track: the rail shows
      P(rc, gx, B - 4, n, 1, tone('#e0c040'));                                            // platform edge
      for (let c = 20; c < n - 4; c += 40) P(rc, gx + c, T + 1, 3, 12, tone('#c8c8be'));
      P(rc, gx + 4, T + 1, 6, 6, tone('#2a5aa8'));                                        // "U" sign
      P(rc, gx + 5, T + 2, 1, 4, glow(rc, tone, '#ffffff')); P(rc, gx + 8, T + 2, 1, 4, glow(rc, tone, '#ffffff')); P(rc, gx + 6, T + 5, 2, 1, glow(rc, tone, '#ffffff'));
      crowd(rc, r, gx, B, spread(n, Math.min(12, Math.floor(n / 9)), 8, 8), 20);
    }

    const AWN = ['#c8503a', '#3a7a8a', '#d8a040', '#6a8a4a'];
    function passage(rc, r, gx, T, B, n, lit, tone, ppl) {        // glass roof, shop fronts with awnings
      P(rc, gx, T + 1, n, 1, tone('#bfe0ee'));
      const units = Math.max(1, Math.round(n / 30)), uw = Math.floor(n / units);
      for (let u = 0; u < units; u++) {
        const x = gx + u * uw + 2, w = uw - 4, col = AWN[(u + (r.id | 0)) % AWN.length];
        P(rc, x, T + 3, w, 2, tone(col));
        if (clutter(rc)) for (let i = 1; i < w; i += 4) P(rc, x + i, T + 3, 2, 2, tone('#f0ece0'));
        P(rc, x, T + 5, w, 1, tone(U.mix(col, '#000000', 0.25)));
        const dw = Math.max(6, w - 10);
        P(rc, x + 1, T + 6, dw, 6, tone(lit ? '#e8f4f8' : '#a8bcc8'));
        for (let i = 2; i + 2 < dw; i += 4) P(rc, x + 1 + i, T + 9, 2, 3, tone(GOODS[u % 3][(i / 4) % 3 | 0]));
        if (w - dw >= 6) { P(rc, x + dw + 2, T + 6, 6, 7, tone('#5a4a3a')); P(rc, x + dw + 3, T + 7, 4, 6, tone('#bfe6f0')); }
      }
      crowd(rc, r, gx, B, spread(n, Math.min(12, Math.floor(n / 9)), 5, 5), 15);
    }

    function clinic(rc, r, gx, T, B, n, lit, tone, ppl) {         // red cross, reception, waiting chairs, exam bed
      P(rc, gx + 3, T + 2, 7, 7, tone('#f4f6f4'));
      P(rc, gx + 5, T + 3, 3, 5, glow(rc, tone, '#d83a3a')); P(rc, gx + 4, T + 4, 5, 3, glow(rc, tone, '#d83a3a'));
      if (!rc.heat) figure(rc, gx + 7, B - 5, NURSE, false, 0, false, 0, 1);
      P(rc, gx + 3, B - 8, 12, 1, tone('#a0b8b0')); P(rc, gx + 4, B - 7, 10, 4, tone('#e8f0ec'));
      const k = Math.max(1, Math.min(4, Math.floor((n - 38) / 5)));
      for (let i = 0; i < k; i++) { const x = gx + 18 + i * 5; P(rc, x, B - 6, 4, 1, tone('#5a90c8')); P(rc, x, B - 9, 1, 3, tone('#5a90c8')); P(rc, x + 3, B - 5, 1, 2, tone('#3a3a48')); }
      const ex = gx + n - 17;
      P(rc, ex - 4, T + 1, 17, 1, tone('#8a9a96')); P(rc, ex - 3, T + 2, 2, 10, tone('#9ac8c0'));
      P(rc, ex, B - 7, 12, 2, tone('#e8eef0')); P(rc, ex, B - 8, 3, 1, tone('#ffffff'));
      P(rc, ex + 1, B - 5, 1, 2, tone('#8a9098')); P(rc, ex + 10, B - 5, 1, 2, tone('#8a9098'));
      const spots = [];
      for (let i = 0; i < k; i++) spots.push({ x: 18 + i * 5, sit: true, face: 1 });
      spots.push({ x: n - 12, face: -1 });
      crowd(rc, r, gx, B, spots, 30);
    }

    function school(rc, r, gx, T, B, n, lit, tone, ppl) {         // blackboard, teacher, desks with children
      const bx = gx + 5, bw = Math.max(12, Math.min(30, n - 46));
      P(rc, bx - 1, T + 1, bw + 2, 1, tone('#8a6a48')); P(rc, bx, T + 2, bw, 8, tone('#3a5a48')); P(rc, bx, T + 10, bw, 1, tone('#8a6a48'));
      if (clutter(rc) || rc.detail >= 1) { P(rc, bx + 3, T + 4, 8, 1, tone('#e8ece0')); P(rc, bx + 3, T + 6, 12, 1, tone('#e8ece0')); P(rc, bx + 16, T + 4, 6, 1, tone('#e8ece0')); }
      P(rc, gx + n - 9, T + 2, 4, 4, tone('#f4f0e8')); P(rc, gx + n - 7, T + 3, 1, 2, tone('#2a2a30'));
      if (r.f >= 0) P(rc, gx + n - 26, T + 2, 12, 6, tone(lit ? '#d8f0ff' : '#9ab0c4'));
      const d0 = bx + bw + 8, desks = [];
      for (let x = d0; x + 8 < gx + n - 2; x += 10) {
        P(rc, x, B - 7, 6, 1, tone('#c09060')); P(rc, x + 1, B - 6, 1, 3, tone('#8a6a48')); P(rc, x + 4, B - 6, 1, 3, tone('#8a6a48'));
        desks.push(x + 6 - gx);
      }
      if (rc.heat || !(r.inside > 0)) return;
      figure(rc, bx + bw + 2, B - 3, look((r.id | 0) * 31 + 99), false, 0, false, 0, 1);
      const k = Math.min(r.inside - 1, desks.length);
      for (let i = 0; i < k; i++) kid(rc, gx + desks[i], B - 3, kidLook((r.id | 0) * 31 + i), -1);
    }

    function townhall(rc, r, gx, T, B, n, lit, tone, ppl) {       // flag, number display, counters with clerks
      P(rc, gx + 3, T + 1, 1, 12, tone('#6a6a72'));
      P(rc, gx + 4, T + 2, 6, 1, glow(rc, tone, '#2a2a2a')); P(rc, gx + 4, T + 3, 6, 1, glow(rc, tone, '#c83a2a')); P(rc, gx + 4, T + 4, 6, 1, glow(rc, tone, '#e8c040'));
      P(rc, gx + 12, T + 2, 12, 4, tone('#1a1a20'));
      const num = Math.floor(rc.t / 180) % 100;
      for (let i = 0; i < 2; i++) if (!rc.heat) { const d = i ? num % 10 : (num / 10) | 0; P(rc, gx + 14 + i * 5, T + 3, 3, 2, d % 2 ? '#ff6a4a' : '#ff4a3a'); }
      P(rc, gx + 9, B - 11, 4, 8, tone('#c8503a')); P(rc, gx + 10, B - 10, 2, 1, glow(rc, tone, '#f0f0e0'));   // ticket machine
      const k = Math.max(1, Math.floor((n - 30) / 16)), spots = [];
      for (let i = 0; i < k; i++) {
        const x = gx + 28 + i * 16;
        if (!rc.heat) figure(rc, x + 5, B - 5, CLERK, false, 0, false, 0, -1);
        P(rc, x, B - 8, 12, 1, tone('#8a7a64')); P(rc, x + 1, B - 7, 10, 4, tone('#b8ad98'));
        P(rc, x + 4, T + 2, 4, 3, tone('#2a2a30')); if (!rc.heat) P(rc, x + 5, T + 3, 2, 1, '#ff6a4a');
        spots.push({ x: x - gx - 3, face: 1 });
      }
      for (let i = 0; i < 3; i++) { const x = gx + 14 + i * 4; P(rc, x, B - 6, 3, 1, tone('#5a6a7a')); spots.push({ x: 14 + i * 4, sit: true, face: 1 }); }
      crowd(rc, r, gx, B, spots, 25);
    }

    // heliport: lounge and stairs inside, the pad cantilevers out of the outer wall with a windsock and a helicopter
    function heliport(rc, r, gx, T, B, n, lit, tone, ppl) {
      const side = edgeSide(rc, r, n / G) || 1, closed = !!r.closed;
      P(rc, gx + 3, B - 9, 10, 2, tone('#4a5a6a')); P(rc, gx + 3, B - 7, 10, 3, tone('#3a4a5a'));
      for (let i = 0; i < 12; i++) P(rc, side > 0 ? gx + n - 16 + i : gx + 15 - i, B - 3 - i, 2, 1, tone('#9a7452'));   // stair up to the deck
      const PW = 32, px = side > 0 ? gx + n : gx - PW, outer = side > 0 ? px + PW - 2 : px + 1;
      P(rc, px, B - 4, PW, 2, tone('#5a5e66')); P(rc, px, B - 4, PW, 1, tone('#7a7e86'));
      P(rc, px + 4, B - 4, PW - 8, 1, glow(rc, tone, closed ? '#c83a2a' : '#e8c040'));
      for (let i = 0; i < 10; i++) P(rc, side > 0 ? gx + n + i * 3 : gx - 3 - i * 3, B - 2 + Math.round((9 - i) * 1.2), 3, 1, tone('#6a6e76'));   // brace
      const blink = Math.floor((rc.time || 0) * 1.5) % 2 === 0;
      for (let i = 2; i < PW; i += 6) P(rc, px + i, B - 5, 1, 1, rc.heat ? tone('#000') : closed ? (blink ? '#ff3a2a' : '#7a2020') : rc.night || blink ? '#ffd23f' : '#c8a840');
      P(rc, outer, B - 13, 1, 9, tone('#6a6a72'));                                       // windsock
      P(rc, side > 0 ? outer + 1 : outer - 4, B - 13, 4, 2, glow(rc, tone, '#e8582a')); P(rc, side > 0 ? outer + 2 : outer - 3, B - 13, 1, 2, glow(rc, tone, '#f2f2ee'));
      const here = !closed && (r.inside > 0 || U.hash(r.id | 0, Math.floor(rc.t / 1200), 63) > 0.5);
      if (!here) return;
      const hx = px + Math.round(PW / 2) - 4, tail = side > 0 ? -1 : 1, spin = r.inside > 0 && !rc.heat;
      P(rc, hx, B - 10, 10, 5, tone('#2a4a7a')); P(rc, hx + 1, B - 11, 7, 1, tone('#2a4a7a'));
      P(rc, side > 0 ? hx + 7 : hx, B - 9, 3, 2, glow(rc, tone, '#bfe6f0'));
      P(rc, tail < 0 ? hx - 9 : hx + 10, B - 9, 9, 1, tone('#2a4a7a')); P(rc, tail < 0 ? hx - 9 : hx + 18, B - 11, 1, 3, tone('#2a4a7a'));
      P(rc, hx - 1, B - 5, 12, 1, tone('#3a3a40'));
      P(rc, hx + 4, B - 12, 1, 1, tone('#2a2a30'));
      const L = spin ? 6 + Math.round(Math.abs(Math.sin(rc.time * 18)) * 12) : 18;
      P(rc, hx + 5 - (L >> 1), B - 12, L, 1, tone('#2a2a30'));
    }

    function checkpoint(rc, r, gx, T, B, n, lit, tone, ppl) {     // walk-through scanner, a tray, a guard
      const ax = gx + Math.max(4, n - 11);
      P(rc, ax, T + 2, 1, 11, tone('#6a7078')); P(rc, ax + 6, T + 2, 1, 11, tone('#6a7078')); P(rc, ax, T + 2, 7, 2, tone('#8a9098'));
      P(rc, ax + 3, T + 3, 1, 1, rc.heat ? tone('#000') : Math.floor(rc.time * 0.7) % 6 === 0 ? '#ff4a3a' : '#5ae07a');
      P(rc, gx + 1, B - 7, Math.max(3, ax - gx - 2), 1, tone('#5a5a62')); P(rc, gx + 2, B - 6, 1, 3, tone('#5a5a62'));
      P(rc, gx + 2, B - 8, 3, 1, tone('#3a6ab0'));
      if (!rc.heat) figure(rc, gx + 3, B - 3, GUARD, false, 0, false, 0, 1);
    }

    // facade gondola: a winch inside; at the outer wall a cradle hangs on two cables and drifts slowly up and down
    function gondola(rc, r, gx, T, B, n, lit, tone, ppl) {
      const side = edgeSide(rc, r, n / G);
      P(rc, gx + 4, B - 9, 12, 6, tone('#5a626c')); P(rc, gx + 6, B - 12, 8, 3, tone('#e0b030'));
      P(rc, gx + 9, B - 11, 2, 1, tone('#2a2a30'));
      P(rc, gx + 16, B - 8, 4, 4, tone('#3a4048'));
      const out = side > 0 ? gx + n : side < 0 ? gx : null;
      P(rc, side < 0 ? gx : gx + 14, T + 3, side < 0 ? 8 : n - 14, 1, tone('#2a2a30'));
      if (out == null) { P(rc, gx + n - 9, B - 8, 8, 4, tone('#e0b030')); return; }
      const cx = side > 0 ? out + 3 : out - 15;
      const k = (Math.sin(rc.t / 900 + (r.id | 0)) + 1) / 2, cy = B + 4 + Math.round(k * FA * 2.5);
      P(rc, side > 0 ? out - 1 : cx + 10, T + 1, side > 0 ? cx + 12 - out : out + 1 - cx - 10, 2, tone('#7a838d'));   // jib
      P(rc, cx + 1, T + 3, 1, cy - T - 6, tone('#3a3a40')); P(rc, cx + 10, T + 3, 1, cy - T - 6, tone('#3a3a40'));
      if (!rc.heat) worker(rc, cx + 4, cy + 2, (r.id | 0) * 7 + 3, false, side > 0 ? -1 : 1, false);
      P(rc, cx, cy - 3, 12, 1, tone('#c09020')); P(rc, cx, cy - 3, 1, 3, tone('#c09020')); P(rc, cx + 11, cy - 3, 1, 3, tone('#c09020'));
      P(rc, cx, cy, 12, 4, tone('#e0b030')); P(rc, cx, cy + 3, 12, 1, tone('#a07818'));
    }

    function server(rc, r, gx, T, B, n, lit, tone, ppl) {         // racks with blinking lights, a blue cold aisle
      P(rc, gx, B - 4, n, 1, tone('#3a6a9a'));
      const k = Math.max(1, Math.floor((n - 4) / 9));
      const slow = rc.world && typeof rc.world.powerK === 'number' && rc.world.powerK < 1;
      for (let i = 0; i < k; i++) {
        const x = gx + 3 + i * 9;
        P(rc, x, T + 1, 7, 12, tone('#1e2228')); P(rc, x, T + 1, 7, 1, tone('#4a525c'));
        for (let j = 0; j < 5; j++) {
          P(rc, x + 1, T + 3 + j * 2, 5, 1, tone('#2e343c'));
          if (rc.heat || rc.detail === 0) continue;
          const h = U.hash(x * 7 + j, Math.floor(rc.time * (1 + U.hash(i, j, 3) * 3)), 61);
          if (h > 0.35) P(rc, x + 1 + ((h * 40) | 0) % 5, T + 3 + j * 2, 1, 1, slow && h > 0.75 ? '#ffb030' : h > 0.9 ? '#7fd8ff' : '#5ae07a');
        }
      }
    }

    function storage(rc, r, gx, T, B, n, lit, tone, ppl) {        // roll-up doors with numbers, a hand truck
      const k = Math.max(1, Math.floor((n - 6) / 13));
      for (let i = 0; i < k; i++) {
        const x = gx + 3 + i * 13, up = !rc.heat && r.inside > 0 && U.hash(r.id | 0, i + Math.floor(rc.t / 1800), 67) > 0.7;
        P(rc, x, T + 1, 11, 1, tone('#2a2a30'));
        P(rc, x, T + 2, 11, up ? 3 : 11, tone('#d87a2a'));
        for (let j = 0; j < (up ? 1 : 5); j++) P(rc, x, T + 3 + j * 2, 11, 1, tone('#b0601e'));
        if (up) { P(rc, x, T + 5, 11, 8, tone('#4a4038')); P(rc, x + 2, B - 8, 4, 5, tone('#a07848')); P(rc, x + 6, B - 6, 3, 3, tone('#8a6a40')); }
        else P(rc, x + 5, B - 5, 1, 1, tone('#2a2a30'));
      }
      P(rc, gx + n - 4, B - 10, 1, 7, tone('#5a5a62')); P(rc, gx + n - 6, B - 4, 3, 1, tone('#5a5a62'));
      crowd(rc, r, gx, B, spread(n, 3, 6, 6), 30);
    }

    // sky bridge (E43): a glass tube with mullions, a truss below the deck; closed in a storm (r.closed)
    function bridge(rc, r, gx, T, B, n, lit, tone, ppl, open) {
      const closed = !!r.closed;
      if (!rc.heat) P(rc, gx, T + 1, n, 12, closed ? 'rgba(80,90,110,.4)' : rc.night ? 'rgba(255,214,140,.16)' : 'rgba(200,232,244,.3)');
      P(rc, gx, T, n, 2, tone('#6a7a88'));
      for (let c = 0; c < n; c += 10) P(rc, gx + c, T + 1, 1, 12, tone('#7a8a98'));
      P(rc, gx + n - 1, T + 1, 1, 12, tone('#7a8a98'));
      P(rc, gx, B - 8, n, 1, tone('#8a9aa8'));
      P(rc, gx, B - 3, n, 1, tone('#5a646e'));
      for (let c = 0; c + 8 <= n; c += 8) for (let i = 0; i < 4; i++) { P(rc, gx + c + i, B + i, 1, 1, tone('#6a7a88')); P(rc, gx + c + 7 - i, B + i, 1, 1, tone('#6a7a88')); }
      P(rc, gx, B + 4, n, 1, tone('#5a6a78'));
      if (!closed) return;
      for (const x of [gx + 2, gx + n - 5]) for (let j = 0; j < 6; j++) P(rc, x, B - 9 + j, 3, 1, glow(rc, tone, j % 2 ? '#f2f2ee' : '#e8383a'));
    }

    // cloud garden (E50): beds, two trees, benches over the clouds; open to the sky unless built over
    function skygarden(rc, r, gx, T, B, n, lit, tone, ppl, open) {
      P(rc, gx, B - 4, n, 1, tone('#6aa850')); P(rc, gx, B - 3, n, 1, tone('#7a5a3a'));
      for (const x of [gx, gx + n - 6]) {
        P(rc, x + 1, B - 8, 4, 4, rc.heat ? tone('#c8e8f4') : open ? 'rgba(200,232,244,.5)' : 'rgba(200,232,244,.25)');
        P(rc, x, B - 9, 1, 5, tone('#6a7078')); P(rc, x + 5, B - 9, 1, 5, tone('#6a7078')); P(rc, x, B - 9, 6, 1, tone('#8a9098'));
      }
      for (const tx of [gx + 10, gx + n - 18]) {
        P(rc, tx + 3, B - 8, 2, 4, tone('#6a4a2a'));
        P(rc, tx, T + 3, 8, 6, tone('#4a8a3a')); P(rc, tx + 1, T + 2, 6, 1, tone('#5aa04a')); P(rc, tx + 2, T + 9, 4, 1, tone('#4a8a3a'));
      }
      const mid = gx + Math.round(n / 2) - 5;
      for (let i = 0; i < 10; i += 2) P(rc, mid + i, B - 5, 1, 1, tone(['#e85a7a', '#f0d040', '#9a6ad8'][i % 3]));
      P(rc, mid - 1, B - 7, 12, 1, tone('#8a5a32'));
      if (r.closed) return;
      crowd(rc, r, gx, B, [{ x: mid - gx, sit: true, face: 1 }, { x: mid - gx + 6, sit: true, face: -1 }, { x: 22, face: 1 }, { x: n - 24, face: -1 }, { x: n - 10 }], 40);
    }

    // antenna (E50): equipment cabinet, a lattice mast three floors up, a dish, a red light on top
    function antenna(rc, r, gx, T, B, n, lit, tone, ppl, open) {
      P(rc, gx + 2, B - 9, 7, 6, tone('#8a9098')); P(rc, gx + 3, B - 8, 2, 1, glow(rc, tone, '#5ae07a'));
      const cx = gx + Math.round(n / 2) + 1, tp = T - 3 * FA + 2;
      for (let y = tp; y < B - 3; y++) {
        const w = 1 + Math.round((y - tp) / (B - tp) * 3);
        P(rc, cx - w, y, 1, 1, tone('#7a8088')); P(rc, cx + w, y, 1, 1, tone('#7a8088'));
        if ((y - tp) % 4 === 0) P(rc, cx - w, y, 2 * w + 1, 1, tone('#8a9098'));
      }
      P(rc, cx + 2, T - FA + 2, 3, 4, tone('#e0e4e8')); P(rc, cx + 1, T - FA + 3, 1, 2, tone('#9aa0a8'));
      const on = !rc.heat && (rc.night || Math.floor(rc.time * 1.2) % 2 === 0);
      P(rc, cx, tp - 2, 1, 2, on ? '#ff3a2a' : tone('#8a2a2a'));
      if (on && rc.night && rc.detail === 2) P(rc, cx - 1, tp - 3, 3, 3, 'rgba(255,58,42,.35)');
    }

    // airship port (E48): lounge with a gangway; outside a mooring arm and, when one is in, the airship bobbing
    function airship(rc, r, gx, T, B, n, lit, tone, ppl) {
      const side = edgeSide(rc, r, n / G) || 1;
      P(rc, gx + 6, B - 6, 14, 1, tone('#8a5a32')); P(rc, gx + 7, B - 5, 1, 2, tone('#5a3a24')); P(rc, gx + 18, B - 5, 1, 2, tone('#5a3a24'));
      P(rc, side > 0 ? gx + n - 7 : gx + 2, T + 3, 5, 10, tone('#5a4a3a'));
      P(rc, side > 0 ? gx + n - 6 : gx + 3, T + 4, 3, 8, tone(lit ? '#ffe8b0' : '#8a7a62'));
      const ax = side > 0 ? gx + n : gx - 20;
      P(rc, ax, T + 1, 20, 2, tone('#7a7466'));
      for (let i = 0; i < 20; i += 4) P(rc, ax + i, T + 3, 1, 2, tone('#7a7466'));
      const tip = side > 0 ? ax + 19 : ax;
      P(rc, tip, T - 2, 1, 5, tone('#5a5448'));
      crowd(rc, r, gx, B, [{ x: 10, face: side }, { x: 15, face: side }, { x: 24, face: side }], 30);
      const here = !r.closed && (r.inside > 0 || U.hash(r.id | 0, Math.floor(rc.t / 2400), 69) > 0.35);
      if (!here) return;
      const L = 56, H = 16, bob = rc.heat ? 0 : Math.round(Math.sin(rc.time * 0.6 + (r.id | 0)) * 1.5);
      const x0 = side > 0 ? tip + 1 : tip - L, yc = T + 2 + bob;
      for (let j = 0; j < H; j++) {
        const v = (j + 0.5 - H / 2) / (H / 2), half = Math.round(L / 2 * Math.sqrt(Math.max(0, 1 - v * v)));
        P(rc, x0 + L / 2 - half, yc - H / 2 + j, 2 * half, 1, tone(j < H * 0.35 ? '#eceff2' : j < H * 0.7 ? '#d4d9df' : '#b4bcc6'));
      }
      P(rc, x0 + 10, yc - 1, L - 20, 1, tone('#c8503a'));
      const tx = side > 0 ? x0 + L - 5 : x0 + 1;
      P(rc, tx, yc - H / 2 - 2, 4, 4, tone('#a8b0ba')); P(rc, tx, yc + H / 2 - 2, 4, 4, tone('#a8b0ba'));
      P(rc, x0 + L / 2 - 7, yc + H / 2, 14, 3, tone('#5a5048'));
      for (let i = 1; i < 13; i += 3) P(rc, x0 + L / 2 - 7 + i, yc + H / 2 + 1, 2, 1, glow(rc, tone, '#ffe8b0'));
    }

    // geothermal (E52, deepest floor): a glowing borehole into the rock, wellhead, pipes, turbine, steam
    function geothermal(rc, r, gx, T, B, n, lit, tone, ppl) {
      const bx = gx + 12;
      P(rc, bx, B - 2, 4, 8, glow(rc, tone, '#e0702a')); P(rc, bx + 1, B + 6, 2, 8, glow(rc, tone, '#b04a1e'));
      P(rc, bx - 2, B - 9, 8, 6, tone('#6a5a50')); P(rc, bx - 1, B - 10, 6, 1, tone('#8a7a70'));
      P(rc, bx + 1, B - 12, 2, 2, glow(rc, tone, '#c83a2a'));
      P(rc, bx + 6, B - 8, Math.max(4, n - 52), 2, tone('#a86a3a')); P(rc, bx + 6, T + 3, Math.max(4, n - 52), 2, tone('#a86a3a'));
      P(rc, bx + 4, T + 3, 2, 8, tone('#a86a3a'));
      const tx = gx + n - 34;
      P(rc, tx, B - 11, 24, 8, tone('#7a8a96')); P(rc, tx, B - 11, 24, 1, tone('#9aaab6'));
      for (let i = 3; i < 22; i += 4) P(rc, tx + i, B - 9, 1, 5, tone('#5a6a76'));
      P(rc, tx + 25, B - 9, 6, 6, tone('#4a5a66')); P(rc, tx + 27, B - 7, 2, 2, glow(rc, tone, '#ffd23f'));
      if (rc.heat) return;
      for (let i = 0; i < 3; i++) {
        const age = (rc.time * 0.45 + i / 3) % 1;
        P(rc, bx + 1 + i, T + 8 - Math.round(age * 6), 2 + Math.round(age * 2), 2, `rgba(240,240,240,${(0.55 * (1 - age)).toFixed(2)})`);
      }
      if (rc.detail === 2) P(rc, gx + 1, T + 1, n - 2, 13, 'rgba(255,140,60,.07)');
    }

    // wind turbine (E52): a mast from the roof, the rotor one floor up; stands still in a storm (shut down)
    function wind(rc, r, gx, T, B, n, lit, tone, ppl, open) {
      P(rc, gx + 3, B - 8, n - 6, 5, tone('#a8b0b8'));
      const cx = gx + Math.round(n / 2), hub = T - FA + 2;
      P(rc, cx - 1, hub, 2, B - 8 - hub, tone('#e8ecf0'));
      P(rc, cx - 3, hub - 2, 6, 3, tone('#d8dce0'));
      const wx = rc.world && rc.world.weatherToday, stop = rc.heat || r.closed || (wx && wx.storm) || (r.inside != null && r.inside < 0);
      const a0 = stop ? 0.5 : (rc.time || 0) * 1.8 + (r.id | 0);
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 2.0944, ca = Math.cos(a), sa = Math.sin(a);
        for (let i = 2; i < 17; i++) P(rc, Math.round(cx + ca * i), Math.round(hub + sa * i), i < 10 ? 2 : 1, 1, tone('#f2f4f6'));
      }
      P(rc, cx - 1, hub - 1, 2, 2, tone('#9aa0a8'));
    }

    // space elevator station (E54/E55): white hall with round windows; on the roof the platform, the rope out of the
    // picture and the cabin – docked, or climbing after world.launchT (TowerRender.launchState, 90 s real time)
    function spacestation(rc, r, gx, T, B, n, lit, tone, ppl) {
      for (let x = 8; x + 10 < n; x += 18) {
        P(rc, gx + x + 1, T + 2, 6, 1, tone('#2a3048')); P(rc, gx + x, T + 3, 8, 4, tone('#2a3048')); P(rc, gx + x + 1, T + 7, 6, 1, tone('#2a3048'));
        if (!rc.heat) { P(rc, gx + x + 2, T + 4, 1, 1, '#ffffff'); P(rc, gx + x + 5, T + 5, 1, 1, '#c8d0ff'); }
      }
      P(rc, gx + 3, B - 7, 10, 4, tone('#5a6e8a')); P(rc, gx + 4, B - 6, 3, 1, glow(rc, tone, '#7fd8ff')); P(rc, gx + 8, B - 6, 3, 1, glow(rc, tone, '#5ae07a'));
      crowd(rc, r, gx, B, spread(n, Math.min(10, Math.floor(n / 11)), 16, 6), 25);
      const cx = gx + Math.round(n / 2);
      if (!r.platform) {
        P(rc, cx - 1, T - 8, 2, 8, tone('#8a94a0'));
        P(rc, cx, T - 9, 1, 1, rc.heat ? tone('#000') : Math.floor(rc.time) % 2 ? '#ff3a2a' : '#7a2020');
        return;
      }
      P(rc, gx + 10, T - 3, n - 20, 2, tone('#5a6e8a')); P(rc, gx + 10, T - 3, n - 20, 1, tone('#8a9ab0'));
      for (let x = 10; x <= n - 11; x += 4) P(rc, gx + x, T - 6, 1, 3, tone('#8a94a0'));
      P(rc, gx + 10, T - 6, n - 20, 1, tone('#8a94a0'));
      const yTop = Math.floor(rc.view.y * G) - 4;
      if (T - 3 > yTop) { P(rc, cx - 1, yTop, 2, T - 3 - yTop, tone('#2c2c36')); P(rc, cx, yTop, 1, T - 3 - yTop, tone('#6a6e7a')); }
      const R0 = root.TowerRender, ls = R0 && R0.launchState ? R0.launchState(rc.world, rc.time) : { climbing: false };
      const dock = T - 3 - 15;
      const cab = y => {
        P(rc, cx - 5, y, 10, 14, tone('#e8ecf0')); P(rc, cx - 3, y - 2, 6, 2, tone('#c8d0d8'));
        P(rc, cx - 4, y + 4, 8, 3, glow(rc, tone, '#ffd890')); P(rc, cx - 5, y + 12, 10, 2, tone('#5a6e8a'));
        P(rc, cx - 1, y - 3, 2, 1, tone('#2c2c36'));
      };
      if (ls.climbing) {
        const climb = Math.round(ls.k * ls.k * (dock - yTop + 24));
        cab(dock - climb);
        if (!rc.heat && Math.floor(rc.time * 3) % 2) P(rc, cx - 1, dock - climb + 15, 2, 1, '#ff3a2a');
      }
      if (!ls.climbing || ls.k > 0.25) cab(dock);
    }
    const SKY = { lockers, cinema, pool, library, district, logistics, station, passage, clinic, school, townhall, heliport,
      checkpoint, gondola, server, storage, bridge, skygarden, antenna, airship, geothermal, wind, spacestation };
    // no back wall, the sky shows: always (glass bridge, masts) or while nothing is built on top (terraces)
    const OPEN_ALWAYS = new Set(['bridge', 'antenna', 'wind']), OPEN_COVER = new Set(['rooftop', 'skygarden']);
    // infrastructure without tenants: drawn as built even if the engine reports no tenant (status not vacant/occupied)
    const INFRA = new Set(['bridge', 'antenna', 'wind', 'gondola', 'checkpoint', 'geothermal', 'district', 'logistics', 'lockers', 'tech', 'damper']);
    const SIGNS = { district: ['STADTVIERTEL', '#2c3a5a', '#ffd23f'], station: ['TIEFBAHNHOF', '#2a5aa8', '#ffffff'], heliport: ['HELIPORT', '#2c2c36', '#ffd23f'],
      airship: ['LUFTSCHIFF', '#2c2c36', '#ffd23f'], spacestation: ['STATION', '#0e1a3a', '#ffffff'], townhall: ['BÜRGERAMT', '#f6f2e0', '#2c2c36'] };

    // rooms over two floors (E37 Viererblock, r.h = 2): each floor is drawn as the type, the slab between them opens
    // on the right into a gallery with a short stair – one room, one sign (upper floor), the people shared out
    function tallRoom(rc, r, st, hs, hh) {
      const inside = r.inside | 0, per = Math.ceil(inside / hh);
      for (let k = 0; k < hh; k++) {
        const f = r.f + k;
        if (f < rc.fBot || f > rc.fTop) continue;
        const up = k === hh - 1;
        self.room(rc, Object.assign({}, r, { f, h: 1, _part: k + 1, inside: Math.max(0, Math.min(per, inside - k * per)),
          tenantType: up ? r.tenantType : null, merged: up ? r.merged : 1, whole: up ? r.whole : false, warn: up ? r.warn : 0 }), st, hs);
      }
      if (rc.heat || rc.detail === 0) return;
      const def = roomDef(r.type), rw = r.w > 0 ? r.w : def.w > 0 ? def.w : 1;
      const gx = Math.round(r.x * G), n = Math.round(rw * G);
      let pal = th.PAL[r.type] || PAL_STARS[r.type] || genericPal(r.type);
      if (r.tier) pal = tierPal(pal, r.tier | 0);
      for (let k = 1; k < hh; k++) {
        const f = r.f + k - 1;
        if (f + 1 < rc.fBot || f > rc.fTop) continue;
        const ys = top(f) - 2, g0 = gx + Math.round(n * 0.55), gw = gx + n - 1 - g0;
        P(rc, g0, ys, gw, 2, pal.wall);                                                 // the opening
        P(rc, g0, ys, 1, 2, SLAB_B);
        for (let i = 0; i < gw; i += 3) P(rc, g0 + i, ys - 4, 1, 4, '#6a6a72');          // gallery rail
        P(rc, g0, ys - 4, gw, 1, '#8a8a92');
        for (let i = 0; i < 14; i++) P(rc, g0 - 14 + i, bot(f) - 4 - Math.round(i * 15 / 14), 2, 1, '#9a7452');   // stair
        if (rc.night && !(r.f < 0)) P(rc, g0, ys, gw, 2, r.inside > 0 ? th.nightLit : th.nightDark);
      }
    }
    // facade look on the outer tower walls (world.look.facade): brick, glass, art deco; plain = the room edge as before
    function facade(rc, x0, x1, f, h) {
      const lk = rc.world && rc.world.look, fa = lk && FACADE[lk.facade];
      if (!fa || rc.heat) return;
      const c = CFG(), tw = towerW(rc), bx = c && c.TWIN_X && x0 >= c.TWIN_X ? c.TWIN_X : 0;
      const L = x0 <= bx, Rt = x1 >= bx + tw;
      if (!L && !Rt) return;
      if (rc.detail === 0) {
        const y = rc.floorTop(f + h - 1), hh = rc.FH * h;
        if (L) rc.rect(x0, y, 0.2, hh, fa.far);
        if (Rt) rc.rect(x1 - 0.2, y, 0.2, hh, fa.far);
        return;
      }
      const T = top(f + h - 1), H = h * FA;
      for (const gx of [L ? Math.round(x0 * G) : null, Rt ? Math.round(x1 * G) - 2 : null]) {
        if (gx == null) continue;
        P(rc, gx, T, 2, H, fa.a);
        if (lk.facade === 'brick') for (let y = 1; y < H; y += 3) P(rc, gx + ((y / 3) & 1), T + y, 1, 1, fa.b);
        else if (lk.facade === 'glass') P(rc, gx + (L && gx === Math.round(x0 * G) ? 1 : 0), T, 1, H, fa.b);
        else for (let y = 3; y < H; y += 8) { P(rc, gx, T + y, 2, 1, fa.b); P(rc, gx, T + y + 2, 2, 1, fa.b); }
      }
    }
    const windowsLit = rc => !!(rc.world && rc.world.look && rc.world.look.windows === 'lit');

    function generic(rc, r, gx, T, B, n, lit, tone, ppl) {
      P(rc, gx + 2, T + 2, n - 4, 8, tone('#f2efe8')); P(rc, gx + 2, T + 2, n - 4, 1, tone('#9a968e'));
      P(rc, gx + 2, T + 9, n - 4, 1, tone('#9a968e'));
      if (!ppl) return;
      const k = Math.min(r.inside, Math.max(1, Math.floor((n - 6) / 6)));
      for (let i = 0; i < k; i++) figure(rc, gx + 4 + Math.round(i * (n - 9) / Math.max(1, k - 1 || 1)), B - 3, look((r.id | 0) * 31 + i), false, 0, false, 0, i % 2 ? -1 : 1);
    }
    // merged flats (E12): the first three tiles are the flat as before, every further three tiles a
    // living area – dining with a kitchen, or a lounge with a bookcase – without walls between
    function living(rc, r, gx, T, B, lit, tone, tier, k, ppl) {
      const det = clutter(rc);
      if (k % 2) {
        P(rc, gx + 6, T + 1, 1, 2, tone('#3a3a3a')); P(rc, gx + 5, T + 3, 3, 1, tone(lit ? '#ffe08a' : '#b89a5a'));   // pendant
        P(rc, gx + 2, B - 7, 10, 1, tone('#8a5a32')); P(rc, gx + 3, B - 6, 1, 3, tone('#6a4224')); P(rc, gx + 10, B - 6, 1, 3, tone('#6a4224'));   // table
        P(rc, gx + 1, B - 9, 1, 6, tone('#6a4224')); P(rc, gx + 12, B - 9, 1, 6, tone('#6a4224'));                 // chairs
        P(rc, gx + 16, T + 2, 12, 3, tone('#e8e2d4')); P(rc, gx + 16, T + 4, 12, 1, tone('#c8c0b0'));             // kitchen: wall cupboards
        P(rc, gx + 16, B - 8, 12, 1, tone('#5a5a62')); P(rc, gx + 16, B - 7, 12, 4, tone('#e8e2d4'));             // counter
        if (det) { P(rc, gx + 19, B - 9, 2, 1, tone('#3a3a3a')); P(rc, gx + 24, B - 10, 1, 2, tone('#9ab8c8')); for (let i = 0; i < 3; i++) P(rc, gx + 18 + i * 4, B - 6, 1, 1, tone('#8a8478')); }
        if (ppl) { figure(rc, gx + 2, B - 6, look((r.id | 0) * 37 + k), true, 0, false, 0, 1); if (r.inside > 4) figure(rc, gx + 21, B - 3, look((r.id | 0) * 37 + k + 9), false, 0, false, 0, -1); }
      } else {
        P(rc, gx + 2, T + 2, 9, 11, tone('#6a4024'));                                    // bookcase
        for (let j = 0; j < 4; j++) { P(rc, gx + 3, T + 4 + j * 2 + 1, 7, 1, tone('#4a2c18')); if (det) for (let i = 0; i < 7; i++) P(rc, gx + 3 + i, T + 3 + j * 2, 1, 1, tone(['#8a3a3a', '#3a5a8a', '#c8a040', '#4a7a4a'][(i + j) % 4])); }
        if (tier > 1) art(rc, gx + 15, T + 2, 6, 4, tone, (r.id | 0) + k); else P(rc, gx + 15, T + 3, 5, 3, tone('#7ab0d0'));
        P(rc, gx + 13, B - 3, 14, 1, tone(tier > 1 ? '#8a3a40' : '#a0704a'));             // rug, two armchairs, side table
        P(rc, gx + 13, B - 7, 4, 4, tone('#5a7a6a')); P(rc, gx + 24, B - 7, 4, 4, tone('#5a7a6a'));
        P(rc, gx + 19, B - 5, 3, 2, tone('#8a5a32'));
        if (tier > 1) floorLamp(rc, gx + 26, B, lit, tone); else plant(rc, gx + 27, B, tone);
        if (ppl) figure(rc, gx + 14, B - 6, look((r.id | 0) * 37 + k), true, 0, false, 0, 1);
      }
    }

    // ---------- marks on rooms: damage cracks, tenant sign, artificial light below ground ----------
    function cracks(rc, r, gx, T, B, n) {
      const id = r.id | 0, k = Math.max(2, Math.min(5, Math.round(n / 14)));
      const ink = '#3a3430', dust = '#d8d0c4';
      for (let c = 0; c < k; c++) {
        let x = gx + 3 + Math.floor(U.hash(id, c, 81) * (n - 6)), y = T;
        const len = 5 + Math.floor(U.hash(id, c, 83) * 6);
        P(rc, x - 1, T, 3, 1, ink);                                                      // broken edge in the ceiling
        for (let i = 0; i < len; i++) {
          P(rc, x, y + i, 1, 1, ink);
          const h = U.hash(id * 7 + c, i, 85);
          if (h < 0.35) x--; else if (h > 0.65) x++;
          if (rc.detail === 2 && i === 3 && U.hash(id, c, 87) > 0.4) { P(rc, x + 1, y + i + 1, 1, 1, ink); P(rc, x + 2, y + i + 2, 1, 1, ink); }
        }
        P(rc, gx + 3 + Math.floor(U.hash(id, c, 89) * (n - 8)), B - 4, 2, 1, dust);     // plaster on the floor
      }
    }
    function tenantSign(rc, r, rw) {
      const info = tenantInfo(r.tenantType);
      const merged = (r.merged | 0) > 1;
      if (!info && !merged) return;
      const ctx = rc.ctx, px = Math.max(8, Math.round(rc.s * 0.42));
      const text = info ? info.label : r.whole ? 'LUXUS-ETAGE' : 'LUXUS ×' + (r.merged | 0);
      ctx.font = `bold ${px}px ` + (info && info.serif ? 'Georgia,"Times New Roman",serif' : '"Lucida Console","Courier New",monospace');
      const room = rw * rc.s - rc.s * 0.6;
      let t = (info && info.icon && rc.detail === 2 ? info.icon + ' ' : '') + text;
      if (ctx.measureText(t).width > room) t = info ? info.short : text;
      if (ctx.measureText(t).width > room) { if (!info || !info.icon) return; t = info.icon; }
      const w = Math.round(ctx.measureText(t).width + rc.s * 0.3), h = Math.round(rc.s * 0.62);
      const X = Math.round(rc.sx(r.x + rw / 2) - w / 2), Y = Math.round(rc.sy(rc.floorTop(r.f) + 0.14));
      const bg = info ? info.bg : '#2c2c36', fg = info ? info.fg : '#e0b850';
      ctx.fillStyle = EDGE; ctx.fillRect(X - 1, Y - 1, w + 2, h + 2);
      ctx.fillStyle = bg; ctx.fillRect(X, Y, w, h);
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.fillText(t, X + w / 2, Y + h / 2 + 1); ctx.textAlign = 'left';
    }
    function tubes(rc, gx, T, n, on) {                     // fluorescent tubes on a concrete ceiling
      P(rc, gx, T, n, 1, CONCRETE);
      for (let x = 5; x + 6 < n; x += 15) {
        P(rc, gx + x, T + 1, 6, 1, on ? '#f2fbff' : '#8e969e');
        if (on && rc.detail === 2) P(rc, gx + x - 1, T + 2, 8, 2, 'rgba(225,242,255,.22)');
      }
    }

    const TABLES = [6, 17, 28, 39];
    function restaurant(rc, r, gx, T, B, lit, tone) {
      if (texture(rc)) for (let i = 0; i < 60; i += 2) P(rc, gx + i, B - 4, 1, 2, tone('#c07a62'));          // tiles
      TABLES.forEach((t, ti) => {
        P(rc, gx + t + 2, T + 1, 1, 3, tone('#3a3a3a'));                                    // pendant lamp
        P(rc, gx + t + 1, T + 4, 3, 1, tone(lit ? '#ffe08a' : '#b89a5a'));
        P(rc, gx + t, B - 7, 5, 1, tone('#f6f2ea')); P(rc, gx + t, B - 6, 1, 1, tone('#e8e0d0')); P(rc, gx + t + 4, B - 6, 1, 1, tone('#e8e0d0'));
        P(rc, gx + t + 2, B - 6, 1, 4, tone('#5a3a22'));
        P(rc, gx + t - 2, B - 9, 1, 7, tone('#6a4224')); P(rc, gx + t - 2, B - 5, 2, 1, tone('#6a4224'));  // chairs
        P(rc, gx + t + 6, B - 9, 1, 7, tone('#6a4224')); P(rc, gx + t + 5, B - 5, 2, 1, tone('#6a4224'));
        if (fine && !rc.heat && r.inside > ti * 2) {              // plates and a glass on tables with guests
          P(rc, gx + t + 0.5, B - 7.5, 1.5, 0.5, '#ffffff'); P(rc, gx + t + 3, B - 7.5, 1.5, 0.5, '#ffffff');
          P(rc, gx + t + 2, B - 8.5, 0.5, 1, 'rgba(200,232,240,.9)');
        }
      });
      P(rc, gx + 50, B - 8, 9, 6, tone('#7a4a2a'));   // bar
      P(rc, gx + 49, B - 9, 11, 1, tone('#a0703a'));
      if (clutter(rc)) for (let i = 0; i < 4; i++) P(rc, gx + 51 + i * 2, T + 4, 1, 3, tone(['#3a8a4a', '#8a2a2a', '#c8a040', '#4a4ac0'][i]));
      P(rc, gx + 50, T + 7, 9, 1, tone('#6a4224'));
    }
    function plant(rc, gx, B, tone) {
      P(rc, gx, B - 5, 3, 3, tone('#a0522d'));
      P(rc, gx - 1, B - 9, 5, 4, tone('#3f8a3a')); P(rc, gx, B - 11, 3, 2, tone('#5aac4a')); P(rc, gx + 1, B - 12, 1, 1, tone('#5aac4a'));
    }
    function marble(rc, gx, B, n) {
      if (!texture(rc)) return;
      for (let i = 0; i < n; i += 2) P(rc, gx + i, B - 2, 1, 1, (i / 2) % 2 ? '#e8e0d0' : '#a89c88');
    }
    // warm variant: soft lamp light from the ceiling in lit rooms after dusk
    function lampLight(rc, r) {
      const h = rc.t / 3600;
      if (!(h > 17.5 || h < 7)) return;
      const ctx = rc.ctx, x0 = rc.sx(r.x), x1 = rc.sx(r.x + r.w), y0 = rc.sy(rc.floorTop(r.f)), y1 = rc.sy(rc.floorTop(r.f) + rc.FH);
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,214,140,.30)'); g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    function plate(rc, x, y, text, bg, fg) {      // small sign, world coords (tiles), text in px
      const ctx = rc.ctx;
      ctx.font = `bold ${Math.max(8, Math.round(rc.s * 0.42))}px "Lucida Console","Courier New",monospace`;
      const w = ctx.measureText(text).width + rc.s * 0.24, h = rc.s * 0.55;
      const X = Math.round(rc.sx(x)), Y = Math.round(rc.sy(y));
      ctx.fillStyle = EDGE; ctx.fillRect(X - 1, Y - 1, Math.round(w) + 2, Math.round(h) + 2);
      ctx.fillStyle = bg; ctx.fillRect(X, Y, Math.round(w), Math.round(h));
      ctx.fillStyle = fg; ctx.fillText(text, X + rc.s * 0.12, Y + h / 2 + 1);
    }
    function pixText(rc, text, X, Y, col, size, align) {
      const ctx = rc.ctx;
      ctx.font = `bold ${size}px "Lucida Console","Courier New",monospace`;
      ctx.textAlign = align || 'left';
      ctx.fillStyle = '#101018'; ctx.fillText(text, X + 1, Y + 1);
      ctx.fillStyle = col; ctx.fillText(text, X, Y);
      ctx.textAlign = 'left';
    }

    // ---------- overlays: provider tint, penalty mark, penalty radius ----------
    function onTop(rc, fn) {                       // after draw() the context is restored, so set the transform again
      const c = rc.ctx; c.save(); c.setTransform(rc.dpr || 1, 0, 0, rc.dpr || 1, 0, 0);
      try { fn(); } finally { c.restore(); }
    }
    function frameBox(rc, gx, gy, w, h, t, col) {
      P(rc, gx, gy, w, t, col); P(rc, gx, gy + h - t, w, t, col); P(rc, gx, gy, t, h, col); P(rc, gx + w - t, gy, t, h, col);
    }
    function shareColor(s) {                       // 0 red → 0.5 yellow → 1 green
      s = Math.max(0, Math.min(1, +s || 0));
      return s < 0.5 ? U.mix('#d8483a', '#e8c040', s * 2) : U.mix('#e8c040', '#3fa65a', (s - 0.5) * 2);
    }
    // provider colouring while a room is selected: share 0..1 of what it gives that room, null = unreachable
    function tint(rc, r, share) {
      if (!r || typeof r.f !== 'number') return;     // e.g. providerShares' street entry (room: null)
      onTop(rc, () => {
        const gx = Math.round(r.x * G), n = r.w * G, T = top(r.f), col = share == null ? '#8e939a' : shareColor(share);
        rc.ctx.globalAlpha = 0.42; P(rc, gx + 1, T + 1, n - 2, 13, col); rc.ctx.globalAlpha = 1;
        frameBox(rc, gx, T, n, 14, rc.detail === 0 ? 3 : 1, col);
        if (rc.detail === 2) plate(rc, r.x + 0.2, rc.floorTop(r.f) + 0.2, share == null ? 'KEIN WEG' : Math.round(share * 100) + ' %', col, INK);
      });
    }
    // penalty source or affected room: red frame, penalty in % (pen 0..1)
    function mark(rc, r, pen) {
      if (!r || typeof r.f !== 'number') return;
      onTop(rc, () => {
        const gx = Math.round(r.x * G), n = r.w * G, T = top(r.f);
        frameBox(rc, gx, T, n, 14, rc.detail === 0 ? 3 : 2, WARN_R);
        if (rc.detail > 0 && pen != null) plate(rc, r.x + 0.2, rc.floorTop(r.f) + 0.85, '-' + Math.round(pen * 100) + ' %', WARN_R, '#ffffff');
      });
    }
    // ghost of a disturber: src {type, f, x, w, r}; area where d = max(|Δfloor|, |Δtiles| / 6) < r,
    // stronger near the source; hits [{room, pen}] get mark()
    function radius(rc, src, hits) {
      if (!src || typeof src.f !== 'number') return;
      onTop(rc, () => {
        const R = +src.r || 0, kmax = Math.ceil(R) - 1;
        for (let k = -kmax; k <= kmax; k++) {
          const fl = src.f + k;
          if (fl < rc.fBot || fl > rc.fTop) continue;
          for (let c = 0; c < rc.W; c++) {
            const gap = Math.max(0, src.x - (c + 1), c - (src.x + src.w));
            const d = Math.max(Math.abs(k), gap / 6);
            if (d >= R) continue;
            rc.ctx.globalAlpha = 0.14 + 0.36 * (1 - d / R);
            P(rc, c * G, top(fl), G, 14, WARN_R);
          }
        }
        rc.ctx.globalAlpha = 1;
        frameBox(rc, Math.round(src.x * G), top(src.f), Math.round(src.w * G), 14, 1, WARN_Y);
      });
      for (const h of hits || []) if (h && h.room) mark(rc, h.room, h.pen);
    }

    // easter egg: a tapped cloud turns grey and rains for a while (screen coords, set by sky())
    const RAIN_SECS = 6, DROP_V = 220;
    let clouds = [];
    const rain = new Map();                                // cloud index -> { from, until }

    // ---------- weather (TOWER-a0011 E33/E49): world.weatherToday {fog, ice, storm}, cloud line CFG.weather.line ----------
    function weatherOf(rc) {
      const w = rc.world || {}, t = w.weatherToday || {}, c = CFG();
      const line = w.cloudLine != null ? w.cloudLine : c && c.weather && c.weather.line != null ? c.weather.line : null;
      const top = w.maxFloors || w.maxFloor || 0;
      return { fog: !!t.fog, ice: !!t.ice, storm: !!t.storm, line: line != null && top > line ? line : null };
    }
    // a bank of clouds along the cloud line, behind the tower; thick in fog
    function cloudBank(rc, line, fog, ap, T) {
      const ctx = rc.ctx, W = rc.cssW, y = Math.round(rc.sy(rc.floorTop(line)));
      if (y < -ap * 24 || y > rc.cssH + ap * 24) return;
      const step = ap * 10, rows = fog ? 3 : 1;
      for (let r = 0; r < rows; r++) {
        const drift = T * (1.5 + r), shift = Math.floor(drift / step), off = drift - shift * step;
        ctx.globalAlpha = 0.85 - r * 0.2;
        ctx.fillStyle = rc.night ? (r ? '#3a4060' : '#4a5274') : (r ? '#e6eaf0' : '#ffffff');
        for (let i = -2; i < W / step + 2; i++) {
          const k = i - shift, h = ap * (2 + Math.round(U.hash(k, r, 71) * 3));
          ctx.fillRect(Math.round(i * step + off), y - h + r * ap * 3, ap * 12, h + ap * 2);
        }
      }
      ctx.globalAlpha = 1;
    }
    // in front of the tower: fog veils everything above the line, ice glitters there, storm rain
    function weatherFront(rc) {
      const wx = weatherOf(rc);
      if (!wx.storm && (wx.line == null || !(wx.fog || wx.ice))) return;
      const ctx = rc.ctx, H = rc.cssH, W = rc.cssW;
      if (wx.line != null && (wx.fog || wx.ice)) {
        const yl = rc.sy(rc.floorTop(wx.line));
        if (wx.fog && yl > 0) {
          const y1 = Math.min(H, yl), g = ctx.createLinearGradient(0, y1, 0, Math.max(0, y1 - rc.s * rc.FH * 8));
          g.addColorStop(0, 'rgba(226,230,236,.55)'); g.addColorStop(1, 'rgba(226,230,236,.28)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, y1);
        }
        if (wx.ice && yl > 0) {                                       // a cold, frosty light over everything above the line
          ctx.fillStyle = 'rgba(214,236,255,.16)'; ctx.fillRect(0, 0, W, Math.min(H, yl));
        }
        if (wx.ice && rc.detail > 0) {
          const f0 = Math.max(wx.line + 1, rc.fBot), f1 = Math.min(rc.fTop, f0 + 60), wk = rc.world.walkable;
          for (let f = f0; f <= f1; f++) {
            for (let k = 0; k < 6; k++) {
              const h = U.hash(f, k, 79);
              if (Math.sin((rc.time || 0) * 3 + h * 40) < 0.55) continue;
              const x = Math.floor(h * rc.W);
              if (wk && !wk.call(rc.world, f, x)) continue;
              const px = x * G + Math.floor(U.hash(f, k, 81) * 9), py = top(f) + 1 + Math.floor(U.hash(f, k, 83) * 4);
              P(rc, px - 1, py, 3, 1, 'rgba(220,240,255,.85)'); P(rc, px, py - 1, 1, 3, 'rgba(220,240,255,.85)');
              P(rc, px, py, 1, 1, '#ffffff');
            }
            const edges = [0, towerW(rc)], bx = twinX(rc);
            if (bx != null) edges.push(bx, rc.W);
            for (let e = 0; e < edges.length; e++) {
              const ex = edges[e], left = e % 2 === 0;
              if (wk && !wk.call(rc.world, f, left ? ex : ex - 1)) continue;
              const gx = left ? ex * G - 2 : ex * G;
              P(rc, gx, bot(f) - 2, 2, 2, '#e4f2fa'); P(rc, gx + (left ? 1 : 0), bot(f), 1, 3 + ((f + e) % 3), '#cfe6f4');
              P(rc, gx + (left ? 0 : 1), bot(f), 1, 2, '#e4f2fa');
            }
          }
        }
      }
      if (wx.storm) {
        ctx.fillStyle = 'rgba(190,206,230,.38)';
        const T = rc.time || 0, ap = Math.max(2, Math.round(rc.s / G * 1.5)), dw = Math.max(1, Math.round(ap / 2)), dh = ap * 5;
        for (let i = 0; i < 40; i++) {
          const sp = 520 + 160 * U.hash(i, 1, 85);
          const y = ((U.hash(i, 2, 85) * (H + dh) + T * sp) % (H + dh)) - dh;
          const x = (((U.hash(i, 3, 85) * (W + 40) - y * 0.3) % (W + 40)) + W + 40) % (W + 40) - 20;
          ctx.fillRect(Math.round(x), Math.round(y), dw, dh);
        }
      }
    }

    // ---------- shafts and cars by kind (TOWER-a0011) ----------
    const SHAFT_LOOK = {
      normal:  { body: '#20222a', side: '#3e4250', stop: '#9aa4b2', far: '#262a34', farStop: '#8a96a6' },
      express: { body: '#2e1e14', side: '#5a3a24', stop: '#ff8c42', far: '#3a2418', farStop: '#ff8c42' },
      double:  { body: '#1e2430', side: '#46506a', stop: '#7fb0e8', far: '#262e40', farStop: '#7fb0e8' },
      fire:    { body: '#2a1616', side: '#7a2a24', stop: '#e8483a', far: '#3a1a18', farStop: '#e8483a' },
      service: { body: '#26282a', side: '#5a5e62', stop: '#b8bcc0', far: '#2e3034', farStop: '#9a9ea2' },
      twin:    { body: '#18262a', side: '#3a5a60', stop: '#5ac8c0', far: '#1e2e32', farStop: '#5ac8c0' },
      multi:   { body: '#221a2e', side: '#5a4278', stop: '#b88ae8', far: '#2a2038', farStop: '#b88ae8', noRope: true },
      maglev:  { body: '#14181e', side: '#2a3a4a', stop: '#7fe0ff', far: '#181e26', farStop: '#7fe0ff', noRope: true, rail: '#3ab8f0' },
    };
    const CAR_LOOK = {
      normal:  { frame: '#d8b030', door: '#9a7a18' },
      express: { frame: '#e07a30', door: '#a8501c' },
      double:  { frame: '#6a9ad8', door: '#3a5a8a' },
      fire:    { frame: '#d8382a', door: '#8a1e18', stripe: '#f2f2ee' },
      service: { frame: '#8a9096', door: '#5a6066', hazard: true },
      twin:    { frame: '#3aa8a0', door: '#1e6a64' },
      multi:   { frame: '#9a6ad8', door: '#5a3a8a' },
      maglev:  { frame: '#e8ecf0', door: '#3a8ad8', stripe: '#3ab8f0' },
    };
    const PUBLIC_CARS = new Set(['normal', 'express', 'double', 'twin', 'multi']);
    function shaftCol(rc, c, f0s, f1s, L, serves) {
      const gx = c * G, f0 = Math.max(f0s, rc.fBot), f1 = Math.min(f1s, rc.fTop);
      if (f0 > f1) return;
      if (rc.detail === 0) {
        rc.rect(c + 0.12, rc.floorTop(f1), 0.76, (f1 - f0 + 1) * rc.FH, L.far);
        for (let f = f0; f <= f1; f++) if (serves(f)) rc.rect(c + 0.12, rc.floorTop(f) + rc.FH - 0.2, 0.76, 0.2, L.farStop);
        return;
      }
      const H = (f1 - f0 + 1) * FA;
      P(rc, gx + 1, top(f1), 8, H, L.body);
      P(rc, gx + 1, top(f1), 1, H, L.side);
      P(rc, gx + 8, top(f1), 1, H, L.side);
      if (L.rail) { P(rc, gx + 2, top(f1), 1, H, L.rail); P(rc, gx + 7, top(f1), 1, H, L.rail); }
      else if (texture(rc) && !L.noRope) P(rc, gx + 5, top(f1), 1, H, '#4a4a52');
      for (let f = f0; f <= f1; f++) {
        const B = bot(f), T = top(f);
        if (serves(f)) { P(rc, gx + 1, B - 2, 8, 2, L.stop); P(rc, gx + 1, T, 8, 1, L.stop); }
        else P(rc, gx + 1, B - 1, 8, 1, '#141418');
      }
    }

    let self = null;
    self = {
      id: o.id, label: o.label, grid: o.grid || 0,
      // types this style draws; others get the UI's placeholder. Every CFG.rooms type is in it: what has no sprite of its
      // own gets the generic look (box, icon, label – also over two floors, also without people), so new engine types
      // never wait for the graphics track (TOWER-a0011)
      get roomTypes() { const c = CFG(); return c && c.rooms ? Array.from(new Set(ROOM_TYPES.concat(Object.keys(c.rooms)))) : ROOM_TYPES; },
      tenantSigns: true,

      sky(rc) {
        const ctx = rc.ctx, N = 14, H = rc.cssH, W = rc.cssW, T = rc.time;
        let [a, b] = U.skyColors(rc.t);
        const tint = SEASON_SKY[rc.season];
        if (tint) { a = U.mix(a, tint[0], tint[1]); b = U.mix(b, tint[0], tint[1]); }
        const wx = weatherOf(rc);                                     // storm: dark sky, fog: a pale horizon
        if (wx.storm) { a = U.mix(a, '#3a4050', 0.5); b = U.mix(b, '#5a6070', 0.5); }
        else if (wx.fog) b = U.mix(b, '#d8dce0', 0.3);
        for (let i = 0; i < N; i++) {
          ctx.fillStyle = U.mix(a, b, i / (N - 1));
          const y0 = Math.round(H * i / N), y1 = Math.round(H * (i + 1) / N);
          ctx.fillRect(0, y0, rc.cssW, y1 - y0);
        }
        const ap = Math.max(2, Math.round(rc.s / G * 1.5));
        const dp = v => Math.round(v * rc.dpr) / rc.dpr;            // smooth motion on whole device px
        clouds = [];
        if (rc.night) {
          rain.clear();
          for (let i = 0; i < 70; i++) {                              // stars twinkle slowly
            const x = Math.floor(U.hash(i, 3, 1) * rc.cssW / ap) * ap, y = Math.floor(U.hash(i, 5, 2) * rc.cssH * 0.8 / ap) * ap;
            ctx.globalAlpha = 0.55 + 0.45 * Math.sin(T * (0.3 + 0.5 * U.hash(i, 7, 7)) + i * 1.7);
            ctx.fillStyle = U.hash(i, 9, 9) > 0.7 ? '#fff6c0' : '#c8d0ff';
            ctx.fillRect(x, y, ap, ap);
          }
          ctx.globalAlpha = 1;
        } else {
          const cloud = (cx, cy, grey) => {
            ctx.fillStyle = grey ? '#b4bccb' : '#ffffff';
            ctx.fillRect(cx, cy, ap * 12, ap * 2); ctx.fillRect(cx + ap * 2, cy - ap * 2, ap * 6, ap * 2); ctx.fillRect(cx + ap * 4, cy - ap * 3, ap * 3, ap);
            ctx.fillStyle = grey ? '#959eaf' : '#dfe8f4'; ctx.fillRect(cx, cy + ap * 2, ap * 12, ap);
          };
          const drops = (i, cx, cy, r) => {                            // fall from the cloud to the ground, behind the tower
            const top = cy + ap * 3, len = Math.min(H, rc.sy(0)) - top;
            if (len < ap * 4) return;
            const per = len / DROP_V, lanes = 9, m = Math.ceil(len / (ap * 22));
            const dw = Math.max(1, Math.round(ap / 2)), dh = ap * 2;
            ctx.fillStyle = '#7fa8d8';
            for (let k = 0; k < lanes; k++) for (let j = 0; j < m; j++) {
              const age = ((T - r.from) / per + U.hash(i * 31 + k, j, 41) / m + j / m) % 1 * per;
              const born = T - age;                                    // only drops that left the cloud while it rained
              if (born < r.from || born > r.until) continue;
              ctx.fillRect(dp(cx + ap * (0.5 + 11 * U.hash(i, k, 42))), dp(top + age * DROP_V), dw, dh);
            }
          };
          const span = W + ap * 26;                                    // clouds drift slowly to the right
          for (let i = 0; i < 5; i++) {
            const v = (2 + 4 * U.hash(i, 21, 3)) * (wx.storm ? 7 : 1);   // a storm drives them
            const x = dp(((U.hash(i, 22, 3) * span + T * v) % span) - ap * 13), y = Math.round(H * (0.06 + 0.42 * U.hash(i, 23, 3)));
            const r = rain.get(i);
            if (r && T > r.until + H / DROP_V) rain.delete(i);
            const raining = r && T <= r.until;
            if (r) drops(i, x, y, r);
            cloud(x, y, raining || wx.storm);
            clouds.push({ i, x, y: y - ap * 3, w: ap * 12, h: ap * 6, pad: ap * 2 });
          }
          if (rc.season < 2) {                                         // spring/summer: a few birds now and then
            const per = 40, ph = (T % per) / per, bp = Math.max(1, Math.round(ap / 2));
            const bx = -60 + ph * (W + 120), by = H * 0.2 + Math.sin(T * 0.9) * 5;
            ctx.fillStyle = '#3a3a48';
            for (let k = 0; k < 3; k++) {
              const x = dp(bx - k * 14 * bp / 2), y = dp(by + (k % 2) * 5 * bp / 2), up = Math.sin(T * 6 + k) > 0 ? -bp : 0;
              ctx.fillRect(x - 2 * bp, y + up, bp, bp); ctx.fillRect(x - bp, y + bp, bp, bp);
              ctx.fillRect(x, y + bp, bp, bp); ctx.fillRect(x + bp, y + up, bp, bp);
            }
          }
        }
        // falling snow (winter), leaves (autumn), petals (spring) – behind the tower
        const fx = [
          { n: 10, col: ['#f6c8d8', '#fbe0ea'], v: [6, 10], sway: 10 },
          null,
          { n: 14, col: ['#c8742c', '#b0502a', '#d8a040'], v: [14, 24], sway: 14 },
          { n: 60, col: ['#ffffff', '#eef2f8'], v: [10, 22], sway: 6 },
        ][rc.season];
        if (fx) {
          const sz = Math.max(1, Math.round(ap * 0.6));
          for (let i = 0; i < fx.n; i++) {
            const v = fx.v[0] + (fx.v[1] - fx.v[0]) * U.hash(i, 31, 5);
            const y = (U.hash(i, 32, 5) * H + T * v) % H;
            const x = U.hash(i, 33, 5) * W + Math.sin(T * 0.6 + i * 2.3) * fx.sway;
            ctx.fillStyle = fx.col[i % fx.col.length];
            ctx.fillRect(dp(x), dp(y), sz, rc.season === 3 ? sz : Math.max(1, Math.round(sz / 2)));
          }
        }
        // weather (TOWER-a0011 E33/E49): the cloud line behind the tower, storm rain and now and then lightning
        if (wx.line != null) cloudBank(rc, wx.line, wx.fog, ap, T);
        if (wx.storm) {
          ctx.fillStyle = 'rgba(170,190,220,.55)';
          const dw = Math.max(1, Math.round(ap / 2)), dh = ap * 4;
          for (let i = 0; i < 90; i++) {
            const sp = 380 + 120 * U.hash(i, 1, 73);
            const y = ((U.hash(i, 2, 73) * (H + dh) + T * sp) % (H + dh)) - dh;
            const x = (((U.hash(i, 3, 73) * (W + 40) - y * 0.25) % (W + 40)) + W + 40) % (W + 40) - 20;
            ctx.fillRect(dp(x), dp(y), dw, dh);
          }
          if (U.hash(Math.floor(T * 3), 5, 77) > 0.992) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, 0, W, H); }
        }
      },

      // tap at screen px (css px): a cloud there starts raining; true if one was hit
      rainAt(px, py, time) {
        const c = clouds.find(c => px >= c.x - c.pad && px <= c.x + c.w + c.pad && py >= c.y - c.pad && py <= c.y + c.h + c.pad);
        if (!c) return false;
        const r = rain.get(c.i);
        if (r && time <= r.until) r.until = time + RAIN_SECS;            // tapping again keeps it going
        else rain.set(c.i, { from: time, until: time + RAIN_SECS });
        return true;
      },

      ground(rc) {
        // earth down to the bottom of the view (the view may scroll below the ground)
        const x0 = rc.view.x, w = rc.cssW / rc.s + 1, d = Math.max(4, Math.ceil(rc.view.y + rc.cssH / rc.s) + 1);
        rc.rect(x0, 0, w, d, STRATA[1].col);
        // cross-section (TOWER-a0010): topsoil, earth, clay, gravel, bedrock – calm horizontal layers with
        // a slow wave in their borders; only the layers in view are drawn
        const yTop = Math.max(0, rc.view.y), gx0 = Math.floor(x0 * G / 2) * 2, gx1 = Math.ceil((x0 + w) * G);
        if (yTop < STRATA[1].d) rc.rect(x0, 0, w, STRATA[1].d, STRATA[0].col);
        for (let i = 2; i < STRATA.length; i++) {
          const L = STRATA[i];
          if (L.d - 0.4 > yTop + rc.cssH / rc.s || L.d + 0.4 < 0) continue;
          if (rc.detail === 0) { rc.rect(x0, L.d, w, d - L.d, L.col); continue; }
          for (let gx = gx0; gx < gx1; gx += 2) {
            const wave = Math.round(1.6 * Math.sin(gx * 0.045 + i * 1.7) + 0.9 * Math.sin(gx * 0.13 + i));
            const y = Math.round(L.d * G) + wave;
            P(rc, gx, y, 2, d * G - y, L.col);
          }
        }
        if (rc.detail > 0 && calm) {                          // a few pebbles per layer, fixed per place
          const yb = Math.min(d, yTop + rc.cssH / rc.s + 1);
          for (let cy = Math.floor(Math.max(0.3, yTop) / 0.8) * 0.8; cy < yb; cy += 0.8) {
            let k = 0; while (k + 1 < STRATA.length && STRATA[k + 1].d <= cy) k++;
            const peb = STRATA[k].peb, row = Math.round(cy * 10);
            for (let cx = Math.floor(x0); cx < x0 + w; cx++) {
              const hv = U.hash(cx, row, 19);
              if (hv > 0.78) P(rc, cx * G + Math.floor(hv * 40) % 8, Math.round(cy * G) + 3, hv > 0.93 ? 3 : 2, 1, peb);
            }
          }
        }
        if (rc.detail > 0 && texture(rc)) {
          const gx0 = Math.floor(x0 * G);
          for (let i = 0; i < w * G; i += 3) for (let j = 3; j < d * G - 4; j += 4) {
            if (U.hash(gx0 + i, j, 4) > 0.8) P(rc, gx0 + i, j, 1, 1, '#54381f');
          }
        }
        const gr = GRASS[rc.season];
        rc.rect(x0, 0, w, rc.season === 3 ? 0.3 : 0.2, gr[1]);
        rc.rect(x0, 0, w, 0.1, gr[0]);
      },

      // basement floor f (optional hook, TOWER-a0010): the dug-out spans get a concrete box against the
      // earth – ceiling slab, side walls, the dark void behind; rooms and shells are drawn over it
      basement(rc, f, spans) {
        if (!spans || !spans.length) return;
        const T = top(f), B = bot(f);
        for (const sp of spans) {
          const a = Math.round(sp[0] * G), b = Math.round(sp[1] * G);
          if (rc.detail === 0) { rc.rect(sp[0] - 0.15, rc.floorTop(f) - 0.15, sp[1] - sp[0] + 0.3, rc.FH + 0.15, CONCRETE_D); continue; }
          P(rc, a - 2, T - 2, b - a + 4, B - T + 2, CONCRETE_D);
          P(rc, a - 2, T - 2, b - a + 4, 1, CONCRETE_L);
          P(rc, a - 2, T - 1, 1, B - T + 1, CONCRETE); P(rc, b + 1, T - 1, 1, B - T + 1, CONCRETE);
          P(rc, a, T, b - a, 14, VOID);
        }
      },

      // falling plaster while the tower shakes (TowerRender.quakeOffset; nothing without a quake)
      post(rc) {
        const R = root.TowerRender;
        if (!rc.heat) weatherFront(rc);
        if (!R.quakeOffset || rc.detail === 0 || rc.heat) return;
        const q = R.quakeOffset(rc.world, rc.time);
        if (!q.level) return;
        const ctx = rc.ctx, f0 = Math.max(rc.fBot, rc.fTop - 30), per = 6 * q.level;
        ctx.globalAlpha = Math.min(1, 0.4 + q.k);
        for (let f = f0; f <= rc.fTop; f++) for (let i = 0; i < per; i++) {
          const x = U.hash(f, i, 91) * rc.W, fall = ((rc.time * (0.9 + U.hash(f, i, 93)) + U.hash(f, i, 95)) % 1) * 12;
          P(rc, Math.round(x * G), top(f) + 1 + Math.round(fall), 1, 1, i % 3 ? '#d8d0c4' : '#a8a096');
        }
        ctx.globalAlpha = 1;
      },

      // shell floor ("Rohbau"): bare concrete, a few columns, no furniture
      // hs: heat status from the caller (money map colours bare floors too, they cost upkeep)
      shell(rc, sh, hs) {
        const heat = rc.heat && hs ? HEAT[hs] || null : null;
        if (rc.detail === 0) {
          rc.rect(sh.x, rc.floorTop(sh.f) + 0.12, sh.w, rc.FH - 0.12, heat || (rc.night && !rc.heat ? '#3a3e48' : '#b8b4ac'));
          if (heat) heatMark(rc, hs, sh.x, sh.f, sh.w);
          return;
        }
        const gx = sh.x * G, n = sh.w * G, T = top(sh.f), B = bot(sh.f);
        P(rc, gx, T, n, 14, heat || (rc.heat ? '#a4a7ad' : '#c6c2ba'));
        if (heat) heatPattern(rc, hs, gx, T, n);
        else for (let c = 0; c < sh.w; c++) if ((sh.x + c) % 3 === 1) P(rc, gx + c * G + 4, T + 1, 2, 13, '#b4b0a7');
        P(rc, gx, T, n, 1, heat ? U.mix(heat, '#000000', 0.32) : '#a29e95');
        P(rc, gx, B - 2, n, 1, SLAB_T); P(rc, gx, B - 1, n, 1, SLAB_B);
        if (!rc.heat && rc.night && sh.f >= 0) P(rc, gx, T + 1, n, 13, th.nightDark);
        else if (!rc.heat && sh.f < 0) P(rc, gx, T + 1, n, 13, 'rgba(18,22,34,.3)');   // bare basement: no light yet
        facade(rc, sh.x, sh.x + sh.w, sh.f, 1);
        roofSnow(rc, sh.f, sh.x, sh.w);
      },

      label(rc, f, text, lobby) {
        const size = Math.max(8, Math.min(12, Math.round(rc.s * 0.62)));
        if (f < 0) {                                   // "1. UG" does not fit the left margin when zoomed out: "U1"
          rc.ctx.font = `bold ${size}px "Lucida Console","Courier New",monospace`;
          if (rc.ctx.measureText(text).width > rc.sx(-0.3) - 2) text = 'U' + -f;
        }
        pixText(rc, text,Math.round(rc.sx(-0.3)), Math.round(rc.sy(rc.floorTop(f) + rc.FH / 2)), lobby ? '#ffd23f' : '#ffffff', size, 'right');
      },

      limit(rc, y) {
        for (let gx = 0; gx < rc.W * G; gx += 6) P(rc, gx, y * G - 1, 3, 1, 'rgba(255,255,255,.75)');
      },

      lobby(rc, ex) {
        const T = top(0), B = bot(0), n = rc.W * G, E = ex * G;
        const L = th.lobby, lt = c => soft(c, L);
        if (rc.detail === 0) {
          rc.rect(0, rc.floorTop(0) + 0.1, rc.W, rc.FH - 0.1, rc.heat ? HEAT.lobby : (th.mute ? L : '#e6dbc2'));
          rc.rect(ex - 1, rc.floorTop(0) + 0.5, 2, rc.FH - 0.5, '#4a3a2a');
          const bx0 = twinX(rc);
          if (bx0 != null) rc.rect(bx0 + (ex | 0) - 1, rc.floorTop(0) + 0.5, 2, rc.FH - 0.5, '#4a3a2a');
          facade(rc, 0, rc.W, 0, 1);
          return;
        }
        P(rc, 0, T, n, 14, L);
        P(rc, 0, B - 6, n, 4, lt('#d6c6a4'));
        P(rc, 0, T, n, 1, lt('#9c8a66'));
        for (let c = 6; c < n; c += 40) { P(rc, c, T + 1, 3, 11, lt('#d0c09c')); P(rc, c - 1, T + 1, 5, 1, lt('#b8a680')); P(rc, c - 1, B - 3, 5, 1, lt('#b8a680')); }
        for (let c = 26; c < n; c += 40) { P(rc, c + 1, T + 1, 1, 2, lt('#3a3a3a')); P(rc, c, T + 3, 3, 1, '#ffe58a'); }     // lamps
        // entrance: awning, frame, glass doors – tower B (E41) has its own street door, the gap between the
        // towers is a glass atrium of the shared lobby (TOWER-a0011)
        const door = E => {
          P(rc, E - 13, T + 1, 26, 2, lt('#b8322a'));
          if (texture(rc)) for (let i = 0; i < 26; i += 4) P(rc, E - 13 + i, T + 3, 2, 1, '#e8e0d0');
          P(rc, E - 11, T + 4, 22, 10, lt('#4a3a2a'));
          P(rc, E - 10, T + 5, 9, 9, lt('#bfe6f0')); P(rc, E + 1, T + 5, 9, 9, lt('#bfe6f0'));
          P(rc, E - 9, T + 6, 2, 3, '#e8f8ff'); P(rc, E + 2, T + 6, 2, 3, '#e8f8ff');
          P(rc, E - 2, T + 9, 1, 2, '#c8a040'); P(rc, E + 1, T + 9, 1, 2, '#c8a040');
        };
        door(E);
        const bx0 = twinX(rc);
        if (bx0 != null) {
          door(Math.round((bx0 + ex) * G));
          const a = towerW(rc) * G, w = bx0 * G - a;
          if (w > 0) {
            P(rc, a, T, w, 3, lt('#bfe0ee')); for (let i = 0; i < w; i += 5) P(rc, a + i, T, 1, 3, lt('#8a9aa8'));
            plant(rc, a + Math.round(w / 2) - 1, B, lt);
          }
        }
        // reception desk + plants (the receptionist sits behind it)
        if (fine) figure(rc, E + 56, B - 9, look(9001), true);
        P(rc, E + 40, B - 9, 34, 1, lt('#a0703a')); P(rc, E + 41, B - 8, 32, 6, lt('#7a4a2a')); P(rc, E + 43, B - 6, 28, 1, lt('#5a3418'));
        plant(rc, E - 20, B, lt); plant(rc, E + 18, B, lt); plant(rc, 3, B, lt);
        marble(rc, 0, B, n);
        P(rc, 0, B - 1, n, 1, SLAB_B);
        roofSnow(rc, 0, 0, rc.W);
        facade(rc, 0, rc.W, 0, 1);
        if (rc.detail === 2) plate(rc, 0.9, rc.floorTop(0) + 0.35, 'LOBBY', '#2c3a5a', '#ffd23f');
      },

      // block mode (E7/E71): render.js picks rc.block (5 or 10 floors) and the most common category per tile x
      // (0 empty, 1 shell, 2 office, 3 condo, 4 provider, 5 lobby, 6 tech, 7 public/entrance); one rectangle per run
      block(rc, f0, f1, cats) {
        if (!cats || !cats.length) return;
        const y = rc.floorTop(f1), h = (f1 - f0 + 1) * rc.FH, night = rc.night && !rc.heat && f0 >= 0, lit = windowsLit(rc);
        const n = cats.length;
        for (let x = 0; x < n;) {
          const c = cats[x]; let e = x + 1;
          while (e < n && cats[e] === c) e++;
          if (c) {
            let col = BLOCK_COLS[c] || '#a0a0a8';
            if (night && c >= 2 && c <= 4) col = U.mix(col, lit ? '#f2d27a' : '#2a3048', lit ? 0.45 : 0.55);
            else if (night) col = U.mix(col, '#2a3048', 0.35);
            rc.rect(x + 0.04, y + 0.05, e - x - 0.08, h - 0.1, col);
          }
          x = e;
        }
      },

      room(rc, r, st, hs) {
        const hh = r.h | 0;
        if (hh > 1 && !r._part) { tallRoom(rc, r, st, hs, hh); return; }         // E37: over two floors
        const def = roomDef(r.type), rw = r.w > 0 ? r.w : def.w > 0 ? def.w : 1;   // merged rooms: r.w = the sum
        const gx = Math.round(r.x * G), n = Math.round(rw * G), T = top(r.f), B = bot(r.f);
        const lit = r.inside > 0;
        const occ = st !== 'vacant' && st !== 'unreachable' || (INFRA.has(r.type) && st !== 'unreachable');
        const under = r.f < 0;                                  // basement: no windows, no day/night, tube light
        const own = ROOM_TYPES.includes(r.type);
        const hk = rc.heat ? hs || st : null;                  // hs: heat status from the caller (energy/money map)
        const heat = rc.heat ? HEAT[hk] || HEAT.none : null;
        const tier = occ && (r.type === 'office' || r.type === 'condo') ? r.tier | 0 : 0;   // missing tier = standard
        let pal = occ ? th.PAL[r.type] || PAL_STARS[r.type] || (own ? null : genericPal(r.type)) : th.PAL[st];
        pal = pal || th.PAL.vacant;
        if (tier && !heat) pal = tierPal(pal, tier);
        if (under && !heat) pal = cellarPal(pal);
        const open = occ && !heat && (OPEN_ALWAYS.has(r.type) || (OPEN_COVER.has(r.type) && !covered(rc, r, rw)));   // the sky shows
        const winLit = windowsLit(rc);
        const tn = r.tenantType != null ? tenantInfo(r.tenantType) : null;
        if (rc.detail === 0) {
          let c = heat || pal.wall;
          if (!heat && rc.night && !under) c = lit ? (tier ? '#f4c870' : '#f2d27a') : winLit ? '#7a6650' : '#2a3048';
          if (open) {                                           // deck and railing only (masts: a thin line up)
            rc.rect(r.x + 0.06, rc.floorTop(r.f) + rc.FH - 0.4, rw - 0.12, 0.28, r.type === 'bridge' ? '#6a7a88' : '#8a6a48');
            if (r.type === 'bridge') rc.rect(r.x, rc.floorTop(r.f) + 0.1, rw, rc.FH - 0.4, r.closed ? 'rgba(80,90,110,.5)' : 'rgba(200,232,244,.35)');
            else if (r.type === 'antenna' || r.type === 'wind') rc.rect(r.x + rw / 2 - 0.1, rc.floorTop(r.f) - rc.FH * (r.type === 'wind' ? 1 : 2), 0.2, rc.FH * (r.type === 'wind' ? 2 : 3), '#c8ccd2');
            else rc.rect(r.x + 0.06, rc.floorTop(r.f) + rc.FH - 0.75, rw - 0.12, 0.08, '#c8d8e0');
          } else rc.rect(r.x + 0.06, rc.floorTop(r.f) + 0.12, rw - 0.12, rc.FH - 0.12, c);
          if (!heat && (def.edge || r.type === 'heliport' || r.type === 'airship')) {   // anchors: the pad / arm outside
            const sd = edgeSide(rc, r, rw), ax = sd > 0 ? r.x + rw : r.x - 3;
            if (sd) rc.rect(ax, rc.floorTop(r.f) + rc.FH - 0.4, 3, 0.25, '#7a7e86');
          }
          if (!open) facade(rc, r.x, r.x + rw, r.f, 1);
          if (heat) heatMark(rc, hk, r.x, r.f, rw);
          else if (tn) rc.rect(r.x + 0.06, rc.floorTop(r.f) + 0.12, rw - 0.12, 0.2, tn.bg);   // tenant colour line
          else if (tier) rc.rect(r.x + 0.06, rc.floorTop(r.f) + 0.12, rw - 0.12, 0.16, tier > 1 ? '#b8862e' : '#dcb878');   // gold / warm ceiling line
          if (!heat && r.type === 'damper') for (let i = 0; i < Math.max(1, Math.min(3, Math.round(+r.damperLevel || 1))); i++)
            rc.rect(r.x + 0.3 + i * 0.4, rc.floorTop(r.f) + 0.5, 0.25, 0.7, DAMP_ACC[Math.max(1, Math.min(3, Math.round(+r.damperLevel || 1)))]);
          if (r.damaged && !heat) for (let i = 0; i < 3; i++) rc.rect(r.x + rw * 0.35 + i * 0.12, rc.floorTop(r.f) + 0.2 + i * 0.35, 0.12, 0.4, '#3a3430');
          const wl = warnOf(r);   // whole tower: a small bar on a dark rim, readable at any zoom
          if (wl) { rc.rect(r.x + rw - 0.56, rc.floorTop(r.f) + 0.24, 0.48, 0.72, INK); rc.rect(r.x + rw - 0.5, rc.floorTop(r.f) + 0.3, 0.36, 0.6, wl > 1 ? WARN_R : WARN_Y); }
          return;
        }
        const dark = heat ? U.mix(heat, '#000000', 0.32) : null;
        const tone = heat ? () => dark : c => soft(c, pal.wall);
        const ppl = !heat && r.inside > 0;
        if (!open) {
          P(rc, gx, T, n, 14, heat || pal.wall);
          P(rc, gx, B - 5, n, 3, heat ? U.mix(heat, '#000000', 0.12) : pal.low);
          P(rc, gx, T, n, 1, heat ? dark : pal.trim);
          if (!heat && o.theme === 'warm') P(rc, gx, T + 1, n, 1, U.mix(pal.wall, '#5a4030', 0.18));   // ceiling shade
        }
        if (heat) heatPattern(rc, hk, gx, T, n);
        if (occ) {
          if (r.type === 'office') office(rc, gx, T, B, n, lit, tone, tier);
          else if (r.type === 'condo') {
            condo(rc, r, gx, T, B, lit, tone, tier);
            for (let k = 1; k < Math.floor(n / 30); k++) living(rc, r, gx + k * 30, T, B, lit, tone, tier, k, ppl && r.inside > 2 + k);
          }
          else if (r.type === 'restaurant') restaurant(rc, r, gx, T, B, lit, tone);
          else if (r.type === 'rooftop') rooftop(rc, r, gx, T, B, n, lit, tone, ppl, open);
          else if (PROVIDERS[r.type]) PROVIDERS[r.type](rc, r, gx, T, B, n, lit, tone, ppl);
          else if (SKY[r.type]) SKY[r.type](rc, r, gx, T, B, n, lit, tone, ppl, open);
          else if (!own) generic(rc, r, gx, T, B, n, lit, tone, ppl);
          else if (r.type === 'skylobby') {
            for (let c = 4; c < n; c += 20) P(rc, gx + c, T + 1, 2, 11, tone('#cbbd9c'));
            P(rc, gx + 22, B - 7, 14, 3, tone('#3a6a8a')); P(rc, gx + 22, B - 9, 14, 2, tone('#4a7a9a')); P(rc, gx + 22, B - 4, 1, 2, tone('#2a2a2a')); P(rc, gx + 35, B - 4, 1, 2, tone('#2a2a2a'));
            plant(rc, gx + 10, B, tone); plant(rc, gx + 46, B, tone);
            if (!heat) marble(rc, gx, B, n);
          }
        } else {
          P(rc, gx + 3, B - 3, n - 6, 1, tone('#8a8a92'));          // dust line
        }
        // people inside
        if (!heat && occ && r.inside > 0) {
          const feet = B - 3;
          if (r.type === 'office') officePeople(rc, r, gx, n, feet);
          else if (r.type === 'condo') condoPeople(rc, r, gx, B, feet, tone);
          else if (r.type === 'restaurant') {
            const seats = [];
            for (const t of TABLES) seats.push(t - 3, t + 5);
            for (let i = 0; i < r.inside; i++) {
              if (i < seats.length) figure(rc, gx + seats[i], feet - 3, look(r.id * 31 + i), true);
              else if (i < seats.length + 6) figure(rc, gx + 4 + (i - seats.length) * 9 + ((i % 2) * 2), feet, look(r.id * 31 + i));
            }
            const waiter = { hair: '#2a2018', skin: SKIN[1], shirt: '#f4f0e8', pants: '#2a2a32' };
            if (fine) {                                  // waiter with a tray behind the bar
              figure(rc, gx + 53, feet - 2, waiter);
              P(rc, gx + 55.5, B - 8, 2.5, 0.5, '#c8c8d0');
            } else {                                     // waiter: at the bar, now and then between the tables
              const k = Math.floor(U.hash(r.id, slot(rc, r.id, 0, 20), 17) * 5);
              figure(rc, gx + [53, 12, 23, 34, 53][k], feet, waiter, false, 0, false, 0, k ? -1 : 1);
            }
          }
        }
        if (r.damaged && !heat && !open) cracks(rc, r, gx, T, B, n);
        if (under && !heat) tubes(rc, gx, T, n, occ);           // artificial light, on while the room runs
        if (!open) { P(rc, gx, T, 1, 14, EDGE); P(rc, gx + n - 1, T, 1, 14, EDGE); facade(rc, r.x, r.x + rw, r.f, 1); }
        P(rc, gx, B - 2, n, 1, SLAB_T); P(rc, gx, B - 1, n, 1, SLAB_B);
        if (!open) roofSnow(rc, r.f, r.x, rw);
        if (!heat && o.theme === 'warm' && lit && !under) lampLight(rc, r);
        // night: windows dark or lit – not below ground (no daylight there: same look day and night),
        // not on the open terrace (the sky is dark already), the hotel lights its rooms one by one
        if (!heat && rc.night && !under && !open && r.type !== 'hotel' && r.type !== 'cinema' && r.type !== 'server')
          P(rc, gx + 1, T + 1, n - 2, 13, lit ? (tier ? 'rgba(255,176,84,.18)' : th.nightLit) : winLit ? 'rgba(255,200,120,.10)' : th.nightDark);
        if (!heat && under && !occ) P(rc, gx + 1, T + 1, n - 2, 13, 'rgba(18,22,34,.42)');   // lights off
        if (rc.detail >= 1 && !heat && (r.tenantType != null || (r.merged | 0) > 1) && (rc.detail === 2 || rw >= 4)) tenantSign(rc, r, rw);
        if (!own && occ && rc.detail >= 1) {                    // generic look: icon in the middle, label on a plate
          const c = rc.ctx;
          if (rc.s * rc.FH >= 14 && def.icon) {
            c.font = Math.round(rc.s * rc.FH * 0.42) + 'px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillStyle = '#000'; c.fillText(def.icon, rc.sx(r.x + rw / 2), rc.sy(rc.floorTop(r.f) + 0.1 + rc.FH * 0.42));
            c.textAlign = 'left';
          }
          const lab = String(def.label || labelOf(r.type)).toUpperCase();
          c.font = `bold ${Math.max(8, Math.round(rc.s * 0.42))}px "Lucida Console","Courier New",monospace`;
          if (c.measureText(lab).width + rc.s * 0.5 <= rw * rc.s) plate(rc, r.x + 0.2, rc.floorTop(r.f) + 0.12, lab, '#f6f2e0', '#2c2c36');
        }
        if (rc.detail === 2 && occ && !heat) {                   // type plates of the new rooms
          if (r.type === 'hotel') plate(rc, r.x + 1.1, rc.floorTop(r.f) + 0.14, '★ HOTEL', '#2c3a5a', '#ffd23f');   // the others read by their sprite
          if (r.type === 'rooftop' && !open) plate(rc, r.x + 0.3, rc.floorTop(r.f) + 0.14, 'ÜBERBAUT', '#2c2c36', '#ffd23f');
          const sg = SIGNS[r.type];
          if (sg && rw >= 4) plate(rc, r.x + (r.type === 'station' ? 1.2 : 0.3), rc.floorTop(r.f) + 0.14, sg[0], sg[1], sg[2]);
        }
        if (r.closed && occ && !heat && rc.detail >= 1) plate(rc, r.x + 0.2, rc.floorTop(r.f) + 0.5, 'GESPERRT', '#e8383a', '#ffffff');   // storm / fog
        if (rc.detail === 2 || (rc.detail === 1 && rw >= 3)) {
          if (st === 'vacant' && !occ) plate(rc, r.x + 0.35, rc.floorTop(r.f) + 0.45, 'FREI', '#f6f2e0', '#2c2c36');
          if (st === 'unreachable') {
            const cx = gx + Math.round(n / 2) - 4, cy = T + 4;
            for (let i = 0; i < 5; i++) P(rc, cx + 4 - i, cy + i * 1.6, 1 + i * 2, 2, '#ffd23f');
            P(rc, cx + 4, cy + 2, 1, 3, '#2c2c36'); P(rc, cx + 4, cy + 6, 1, 1, '#2c2c36');
            if (rc.detail === 2) plate(rc, r.x + 0.25, rc.floorTop(r.f) + 1.0, 'KEIN WEG', '#2c2c36', '#ffd23f');
          }
          if (r.type === 'skylobby' && rc.detail === 2) plate(rc, r.x + 1.6, rc.floorTop(r.f) + 0.25, 'SKY-LOBBY', '#2c3a5a', '#ffd23f');
        }
        const wl = warnOf(r);   // yellow: close to the threshold · red: below it, the tenants may go any hour
        if (wl) warnSign(rc, gx + n - 6, T + 2, wl > 1 ? WARN_R : WARN_Y);
      },

      link(rc, kind, f, x, w) {
        const gx0 = Math.round(x * G), gx1 = Math.round((x + w) * G), yb = bot(f) - 2, yt = top(f);
        if (rc.detail === 0) { diag(rc, gx0, yb - 2, gx1, yt, 2, kind === 'stairs' ? '#a06a38' : '#8a96a6'); return; }
        if (calm) {
          // links lie on their own layer over rooms: an opaque band 3 art px thick (notched for
          // stairs, smooth for escalators) instead of rails, balusters and see-through glass over the
          // furniture (PO picked look 3 of the stairs study, TOWER-a0004)
          const st = kind === 'stairs', n = gx1 - gx0;
          const body = st ? '#9a7452' : '#8e98a4', edge = st ? '#cfa97c' : '#c6ced8';
          if (st) {
            const steps = 7, rise = (yb - yt) / steps, dw = n / steps;
            for (let k = 0; k < steps; k++) {
              const sx0 = Math.round(gx0 + k * dw), sx1 = Math.round(gx0 + (k + 1) * dw), ty = Math.round(yb - (k + 1) * rise);
              P(rc, sx0, ty, sx1 - sx0, Math.round(rise) + 2, body);
              P(rc, sx0, ty, sx1 - sx0, 1, edge);
            }
          } else {
            for (let i = 0; i < n; i++) {
              const y = Math.round(yb - (yb - yt) * (i + 1) / n);
              P(rc, gx0 + i, y, 1, 3, body); P(rc, gx0 + i, y, 1, 1, edge);
            }
          }
          return;
        }
        if (kind === 'stairs') {
          const steps = 7, rise = (yb - yt) / steps, dw = (gx1 - gx0) / steps;
          for (let k = 0; k < steps; k++) {
            const sx0 = Math.round(gx0 + k * dw), sx1 = Math.round(gx0 + (k + 1) * dw), ty = Math.round(yb - (k + 1) * rise);
            P(rc, sx0, ty, sx1 - sx0, 1, '#d09a5a');
            P(rc, sx0, ty + 1, sx1 - sx0, 2, '#8a5a32');
            P(rc, sx0, ty + 3, sx1 - sx0, 1, '#5a3a20');
          }
          diag(rc, gx0 + 1, yb - 7, gx1 - 1, yt - 5, 1, '#3a2414');
          for (let i = 2; i < gx1 - gx0 - 1; i += 4) {
            const yR = Math.round(yb - 7 + (yt - yb + 2) * i / (gx1 - gx0)), yS = Math.round(yb - (yb - yt) * i / (gx1 - gx0));
            P(rc, gx0 + i, yR, 1, Math.max(1, yS - yR - 1), '#6a4224');
          }
        } else {
          diag(rc, gx0, yb - 9, gx1, yt - 7, 7, 'rgba(200,236,246,.55)', 1);
          diag(rc, gx0, yb - 2, gx1, yt, 3, '#6a7480');
          if (texture(rc)) diag(rc, gx0, yb - 2, gx1, yt, 1, '#c0c8d2', 2);
          diag(rc, gx0, yb, gx1, yt + 2, 1, '#3c424c');
          diag(rc, gx0, yb - 9, gx1, yt - 7, 1, '#141414');
          P(rc, gx0 - 2, yb - 9, 2, 2, '#141414'); P(rc, gx1, yt - 7, 2, 2, '#141414');
          P(rc, gx0 - 3, yb - 1, 4, 1, '#8a96a6'); P(rc, gx1 - 1, yt + 1, 4, 1, '#8a96a6');
        }
      },

      // shafts by kind (TOWER-a0011: double, fire, service, twin, multi, maglev; unknown kinds look like the normal one)
      shaft(rc, sh, serves) {
        const L = SHAFT_LOOK[sh.kind] || (sh.kind === 'express' ? SHAFT_LOOK.express : SHAFT_LOOK.normal);
        const multi2 = sh.c2 != null && sh.fb != null && sh.c2 !== sh.c;
        if (multi2) {                                   // MULTI running on over a bridge: column c up to fb, c2 above
          shaftCol(rc, sh.c, sh.f0, Math.min(sh.fb, sh.f1), L, serves);
          shaftCol(rc, sh.c2, Math.max(sh.fb, sh.f0), sh.f1, L, serves);
          if (sh.fb >= rc.fBot && sh.fb <= rc.fTop) {
            const a = Math.min(sh.c, sh.c2), b = Math.max(sh.c, sh.c2);
            if (rc.detail === 0) rc.rect(a + 0.5, rc.floorTop(sh.fb) + rc.FH * 0.45, b - a, 0.25, L.stop);
            else { P(rc, a * G + 5, top(sh.fb) + 5, (b - a) * G, 2, L.side); P(rc, a * G + 5, top(sh.fb) + 7, (b - a) * G, 1, L.stop); }
          }
        } else shaftCol(rc, sh.c, sh.f0, sh.f1, L, serves);
        // TWIN: the split floor, where one car ends and the other begins (s.split)
        if (sh.kind === 'twin' && sh.split != null && sh.split >= rc.fBot && sh.split <= rc.fTop) {
          if (rc.detail === 0) rc.rect(sh.c, rc.floorTop(sh.split) - 0.08, 1, 0.16, '#ffd23f');
          else for (let i = 0; i < 10; i += 2) P(rc, sh.c * G + i, top(sh.split) - 1, 1, 1, i % 4 ? INK : '#ffd23f');
        }
      },

      car(rc, sh, car, full) {
        let col = sh.c;
        if (sh.c2 != null && sh.fb != null) col = typeof car.x === 'number' ? car.x : car.y > sh.fb + 0.001 ? sh.c2 : sh.c;
        const gx = Math.round(col * G) + 1;
        const T = Math.round(-(car.y + 1) * FA) + 1;
        const kind = sh.kind, ex = kind === 'express';
        // car.cond (depth run): slow / wear ≥ 70 = steady yellow sign, waiting = blinking sign,
        // repair = mechanic in the open car, broken = lights out, sparks and a red sign; missing = as before
        const cond = car.cond || 'ok', broken = cond === 'broken', repair = cond === 'repair';
        const worn = cond === 'slow' || (car.wear || 0) >= 70, blink = Math.floor((rc.time || 0) * 1.6) % 2 === 0;
        // colours: the kind's own (fire red, service grey, …); public cars take the cabin look (world.look.cabin)
        const K = CAR_LOOK[kind] || CAR_LOOK.normal;
        const lk = rc.world && rc.world.look, cab = lk && CABIN[lk.cabin] && PUBLIC_CARS.has(kind) ? CABIN[lk.cabin] : null;
        const frame = cab && !ex ? cab.frame : K.frame, door0 = cab ? cab.door : K.door;
        const door = broken ? U.mix(door0, '#000000', 0.4) : door0;
        const decks = kind === 'double' ? 2 : 1;
        if (rc.detail === 0) {
          for (let d = 0; d < decks; d++) {
            const Td = T - d * FA;
            P(rc, gx, Td, 8, 13, frame);
            P(rc, gx, Td + Math.round(13 * (1 - full)), 8, Math.round(13 * full), door);
          }
          if (decks > 1) P(rc, gx, T - 3, 8, 3, frame);
          if (broken) P(rc, gx, T, 8, 6, WARN_R);
          else if (repair) P(rc, gx, T, 8, 6, MECH.far[1]);
          else if (cond === 'waiting') { if (blink) P(rc, gx, T, 8, 6, WARN_Y); }
          else if (worn) P(rc, gx, T, 8, 3, WARN_Y);
          return;
        }
        const open = car.state === 'doors' || repair;
        for (let d = decks - 1; d >= 0; d--) {
          const Td = T - d * FA;
          P(rc, gx, Td, 8, 13, frame);
          P(rc, gx + 1, Td + 2, 6, 10, broken ? '#2a2a30' : open ? '#fff4c8' : '#6a5a3a');
          P(rc, gx, Td, 8, 1, '#2c2c36');
          if (K.stripe) P(rc, gx, Td + 1, 8, 1, K.stripe);
          const shown = broken || repair ? 0 : Math.round(full * 6);          // up to 6 figures stand for the load
          for (let i = 0; i < shown; i++) {
            const row = i < 3 ? 0 : 1, k = i % 3;
            const fx = gx + 1 + k * 2, feet = Td + 11 - row * 2;
            P(rc, fx, feet - 5, 2, 1, HAIR[i % HAIR.length]); P(rc, fx, feet - 4, 2, 1, SKIN[(i * 7) % 4]); P(rc, fx, feet - 3, 2, 3, SHIRT[(i * 3 + sh.c + d) % SHIRT.length]);
          }
          if (!open) {
            if (texture(rc)) {                         // closed: dithered door panels with a seam
              for (let j = 0; j < 10; j++) for (let i = (j % 2); i < 6; i += 2) P(rc, gx + 1 + i, Td + 2 + j, 1, 1, door);
            } else {                                   // calm: two flat panels, the load shows through a window
              P(rc, gx + 1, Td + 2, 6, 10, door);
              if (shown) P(rc, gx + 2, Td + 3, 4, 2, U.mix(door, '#fff4c8', 0.45));
            }
            P(rc, gx + 4, Td + 2, 1, 10, '#2c2c36');
          } else {
            P(rc, gx + 1, Td + 2, 1, 10, door); P(rc, gx + 6, Td + 2, 1, 10, door);
          }
          if (K.hazard && rc.detail === 2) for (let i = 0; i < 8; i += 2) { P(rc, gx + i, Td + 12, 1, 1, '#ffd23f'); P(rc, gx + i + 1, Td + 12, 1, 1, INK); }
        }
        if (decks > 1) { P(rc, gx, T - 3, 8, 3, frame); P(rc, gx + 1, T - 2, 6, 1, U.mix(frame, '#000000', 0.3)); }
        if (repair) {                                // the mechanic works in the open car, case at the feet
          const m = car.mech, emg = !!(m && m.emergency);
          worker(rc, gx + 2, T + 11, m && m.id != null ? m.id : sh.c * 97 + 1, emg, 1, false);
          P(rc, gx + 5, T + 10, 2, 2, (emg ? EMG : MECH).box);
          P(rc, gx, T + 12, 8, 1, WARN_Y);
          for (let i = 1; i < 8; i += 2) P(rc, gx + i, T + 12, 1, 1, INK);
        }
        const TT = T - (decks - 1) * FA;
        if (broken) {                                // sparks flicker around the roof (real time)
          const k = Math.floor((rc.time || 0) * 8);
          for (let i = 0; i < 5; i++) {
            if (U.hash(sh.c * 7 + i, k, 3) < 0.4) continue;
            P(rc, gx - 1 + Math.floor(U.hash(i, k, sh.c) * 10), TT - 1 + Math.floor(U.hash(k, i, 9) * 4), 1, 1, i % 2 ? '#fff4a0' : '#ffb030');
          }
          warnSign(rc, gx + 3, TT - 8, WARN_R);
        } else if (cond === 'waiting') { if (blink) warnSign(rc, gx + 3, TT - 8, WARN_Y); }
        else if (worn && !repair) warnSign(rc, gx + 3, TT - 8, WARN_Y);
      },

      person(rc, x, f, o2) {
        const feet = Math.round(-f * FA) - 3;
        const gx = Math.round(x * G) - 1;
        // mechanics and the emergency service keep their work clothes (no stress or tired colours)
        const staff = o2.role === 'mechanic' || !!o2.emergency;
        const stress = o2.mode === 'wait' && !staff ? o2.level : 0;
        if (rc.detail === 0) {
          if (staff) { const c = o2.emergency ? EMG : MECH; P(rc, gx, feet - 8, 3, 3, c.far[0]); P(rc, gx, feet - 5, 3, 6, c.far[1]); return; }
          const c = stress ? STRESS[stress][0] : TIRED_FAR[o2.tired || 0];
          P(rc, gx, feet - 8, 3, 9, c);
          return;
        }
        if (staff) { worker(rc, gx, feet, o2.id, !!o2.emergency, o2.mode === 'wait' && o2.dir ? -o2.dir : 1); return; }
        figure(rc, gx, feet, look(o2.id), false, stress, false, o2.tired || 0);
      },

      // ---------- optional overlays (depth run); the game UI calls them after draw() with its rc ----------
      tint, mark, radius,

      overflow(rc, text, x, f, dir) {
        const size = Math.max(9, Math.round(rc.s * 0.5));
        pixText(rc, text, Math.round(rc.sx(x)), Math.round(rc.sy(rc.floorTop(f) + rc.FH * 0.4)), '#ffffff', size, dir < 0 ? 'right' : 'left');
      },
    };
    return self;
  }

  const reg = o => (root.TowerStyles[o.id] = make(o));
  reg({ id: 'pixel', label: 'A · Pixel' });
  reg({ id: 'pixel_calm', label: 'A2 · Pixel ruhig', theme: 'calm', calm: true, grid: G });
  reg({ id: 'pixel_fine', label: 'A3 · Pixel fein', theme: 'calm', calm: true, fine: true, grid: 2 * G });
  reg({ id: 'pixel_warm', label: 'A×C · Pixel-Diorama', theme: 'warm', calm: true, fine: true, grid: 2 * G });
})(typeof window !== 'undefined' ? window : globalThis);
