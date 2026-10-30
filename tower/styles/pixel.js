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
  const ROOM_TYPES = ['office', 'condo', 'restaurant', 'skylobby', 'workshop', 'cafe', 'daycare', 'supermarket', 'gym'];
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
      if (rc.season !== 3 || rc.detail === 0 || !rc.world.walkable) return;
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
          if (fl < Math.max(0, rc.fBot) || fl > rc.fTop) continue;
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

    return {
      id: o.id, label: o.label, grid: o.grid || 0,
      roomTypes: ROOM_TYPES,                         // types this style draws; others get the UI's placeholder

      sky(rc) {
        const ctx = rc.ctx, N = 14, H = rc.cssH, W = rc.cssW, T = rc.time;
        let [a, b] = U.skyColors(rc.t);
        const tint = SEASON_SKY[rc.season];
        if (tint) { a = U.mix(a, tint[0], tint[1]); b = U.mix(b, tint[0], tint[1]); }
        for (let i = 0; i < N; i++) {
          ctx.fillStyle = U.mix(a, b, i / (N - 1));
          const y0 = Math.round(H * i / N), y1 = Math.round(H * (i + 1) / N);
          ctx.fillRect(0, y0, rc.cssW, y1 - y0);
        }
        const ap = Math.max(2, Math.round(rc.s / G * 1.5));
        const dp = v => Math.round(v * rc.dpr) / rc.dpr;            // smooth motion on whole device px
        if (rc.night) {
          for (let i = 0; i < 70; i++) {                              // stars twinkle slowly
            const x = Math.floor(U.hash(i, 3, 1) * rc.cssW / ap) * ap, y = Math.floor(U.hash(i, 5, 2) * rc.cssH * 0.8 / ap) * ap;
            ctx.globalAlpha = 0.55 + 0.45 * Math.sin(T * (0.3 + 0.5 * U.hash(i, 7, 7)) + i * 1.7);
            ctx.fillStyle = U.hash(i, 9, 9) > 0.7 ? '#fff6c0' : '#c8d0ff';
            ctx.fillRect(x, y, ap, ap);
          }
          ctx.globalAlpha = 1;
        } else {
          const cloud = (cx, cy) => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(cx, cy, ap * 12, ap * 2); ctx.fillRect(cx + ap * 2, cy - ap * 2, ap * 6, ap * 2); ctx.fillRect(cx + ap * 4, cy - ap * 3, ap * 3, ap);
            ctx.fillStyle = '#dfe8f4'; ctx.fillRect(cx, cy + ap * 2, ap * 12, ap);
          };
          const span = W + ap * 26;                                    // clouds drift slowly to the right
          for (let i = 0; i < 5; i++) {
            const v = 2 + 4 * U.hash(i, 21, 3);
            const x = ((U.hash(i, 22, 3) * span + T * v) % span) - ap * 13;
            cloud(dp(x), Math.round(H * (0.06 + 0.42 * U.hash(i, 23, 3))));
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
      },

      ground(rc) {
        const x0 = rc.view.x, w = rc.cssW / rc.s + 1;
        rc.rect(x0, 0, w, 4, '#6a4a30');
        if (rc.detail > 0 && texture(rc)) {
          const gx0 = Math.floor(x0 * G);
          for (let i = 0; i < w * G; i += 3) for (let j = 3; j < 36; j += 4) {
            if (U.hash(gx0 + i, j, 4) > 0.8) P(rc, gx0 + i, j, 1, 1, '#54381f');
          }
        }
        const gr = GRASS[rc.season];
        rc.rect(x0, 0, w, rc.season === 3 ? 0.3 : 0.2, gr[1]);
        rc.rect(x0, 0, w, 0.1, gr[0]);
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
        if (!rc.heat && rc.night) P(rc, gx, T + 1, n, 13, th.nightDark);
        roofSnow(rc, sh.f, sh.x, sh.w);
      },

      label(rc, f, text, lobby) {
        const size = Math.max(8, Math.min(12, Math.round(rc.s * 0.62)));
        pixText(rc, text, Math.round(rc.sx(-0.3)), Math.round(rc.sy(rc.floorTop(f) + rc.FH / 2)), lobby ? '#ffd23f' : '#ffffff', size, 'right');
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
          return;
        }
        P(rc, 0, T, n, 14, L);
        P(rc, 0, B - 6, n, 4, lt('#d6c6a4'));
        P(rc, 0, T, n, 1, lt('#9c8a66'));
        for (let c = 6; c < n; c += 40) { P(rc, c, T + 1, 3, 11, lt('#d0c09c')); P(rc, c - 1, T + 1, 5, 1, lt('#b8a680')); P(rc, c - 1, B - 3, 5, 1, lt('#b8a680')); }
        for (let c = 26; c < n; c += 40) { P(rc, c + 1, T + 1, 1, 2, lt('#3a3a3a')); P(rc, c, T + 3, 3, 1, '#ffe58a'); }     // lamps
        // entrance: awning, frame, glass doors
        P(rc, E - 13, T + 1, 26, 2, lt('#b8322a'));
        if (texture(rc)) for (let i = 0; i < 26; i += 4) P(rc, E - 13 + i, T + 3, 2, 1, '#e8e0d0');
        P(rc, E - 11, T + 4, 22, 10, lt('#4a3a2a'));
        P(rc, E - 10, T + 5, 9, 9, lt('#bfe6f0')); P(rc, E + 1, T + 5, 9, 9, lt('#bfe6f0'));
        P(rc, E - 9, T + 6, 2, 3, '#e8f8ff'); P(rc, E + 2, T + 6, 2, 3, '#e8f8ff');
        P(rc, E - 2, T + 9, 1, 2, '#c8a040'); P(rc, E + 1, T + 9, 1, 2, '#c8a040');
        // reception desk + plants (the receptionist sits behind it)
        if (fine) figure(rc, E + 56, B - 9, look(9001), true);
        P(rc, E + 40, B - 9, 34, 1, lt('#a0703a')); P(rc, E + 41, B - 8, 32, 6, lt('#7a4a2a')); P(rc, E + 43, B - 6, 28, 1, lt('#5a3418'));
        plant(rc, E - 20, B, lt); plant(rc, E + 18, B, lt); plant(rc, 3, B, lt);
        marble(rc, 0, B, n);
        P(rc, 0, B - 1, n, 1, SLAB_B);
        roofSnow(rc, 0, 0, rc.W);
        if (rc.detail === 2) plate(rc, 0.9, rc.floorTop(0) + 0.35, 'LOBBY', '#2c3a5a', '#ffd23f');
      },

      room(rc, r, st, hs) {
        const gx = Math.round(r.x * G), n = r.w * G, T = top(r.f), B = bot(r.f);
        const lit = r.inside > 0;
        const occ = st !== 'vacant' && st !== 'unreachable';
        const hk = rc.heat ? hs || st : null;                  // hs: heat status from the caller (energy/money map)
        const heat = rc.heat ? HEAT[hk] || HEAT.none : null;
        const tier = occ && (r.type === 'office' || r.type === 'condo') ? r.tier | 0 : 0;   // missing tier = standard
        let pal = th.PAL[occ ? r.type : st] || th.PAL.vacant;
        if (tier && !heat) pal = tierPal(pal, tier);
        if (rc.detail === 0) {
          let c = heat || pal.wall;
          if (!heat && rc.night) c = lit ? (tier ? '#f4c870' : '#f2d27a') : '#2a3048';
          rc.rect(r.x + 0.06, rc.floorTop(r.f) + 0.12, r.w - 0.12, rc.FH - 0.12, c);
          if (heat) heatMark(rc, hk, r.x, r.f, r.w);
          else if (tier) rc.rect(r.x + 0.06, rc.floorTop(r.f) + 0.12, r.w - 0.12, 0.16, tier > 1 ? '#b8862e' : '#dcb878');   // gold / warm ceiling line
          const wl = warnOf(r);   // whole tower: a small bar on a dark rim, readable at any zoom
          if (wl) { rc.rect(r.x + r.w - 0.56, rc.floorTop(r.f) + 0.24, 0.48, 0.72, INK); rc.rect(r.x + r.w - 0.5, rc.floorTop(r.f) + 0.3, 0.36, 0.6, wl > 1 ? WARN_R : WARN_Y); }
          return;
        }
        const dark = heat ? U.mix(heat, '#000000', 0.32) : null;
        const tone = heat ? () => dark : c => soft(c, pal.wall);
        P(rc, gx, T, n, 14, heat || pal.wall);
        P(rc, gx, B - 5, n, 3, heat ? U.mix(heat, '#000000', 0.12) : pal.low);
        P(rc, gx, T, n, 1, heat ? dark : pal.trim);
        if (!heat && o.theme === 'warm') P(rc, gx, T + 1, n, 1, U.mix(pal.wall, '#5a4030', 0.18));   // ceiling shade
        if (heat) heatPattern(rc, hk, gx, T, n);
        if (occ) {
          if (r.type === 'office') office(rc, gx, T, B, n, lit, tone, tier);
          else if (r.type === 'condo') condo(rc, r, gx, T, B, lit, tone, tier);
          else if (r.type === 'restaurant') restaurant(rc, r, gx, T, B, lit, tone);
          else if (PROVIDERS[r.type]) PROVIDERS[r.type](rc, r, gx, T, B, n, lit, tone, !heat && r.inside > 0);
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
        P(rc, gx, T, 1, 14, EDGE); P(rc, gx + n - 1, T, 1, 14, EDGE);
        P(rc, gx, B - 2, n, 1, SLAB_T); P(rc, gx, B - 1, n, 1, SLAB_B);
        roofSnow(rc, r.f, r.x, r.w);
        if (!heat && o.theme === 'warm' && lit) lampLight(rc, r);
        if (!heat && rc.night) P(rc, gx + 1, T + 1, n - 2, 13, lit ? (tier ? 'rgba(255,176,84,.18)' : th.nightLit) : th.nightDark);
        if (rc.detail === 2 || (rc.detail === 1 && r.w >= 3)) {
          if (st === 'vacant') plate(rc, r.x + 0.35, rc.floorTop(r.f) + 0.45, 'FREI', '#f6f2e0', '#2c2c36');
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

      shaft(rc, sh, serves) {
        const ex = sh.kind === 'express', gx = sh.c * G;
        const f0 = Math.max(sh.f0, rc.fBot), f1 = Math.min(sh.f1, rc.fTop);
        if (rc.detail === 0) {
          rc.rect(sh.c + 0.12, rc.floorTop(sh.f1), 0.76, (sh.f1 - sh.f0 + 1) * rc.FH, ex ? '#3a2418' : '#262a34');
          for (let f = f0; f <= f1; f++) if (serves(f)) rc.rect(sh.c + 0.12, rc.floorTop(f) + rc.FH - 0.2, 0.76, 0.2, ex ? '#ff8c42' : '#8a96a6');
          return;
        }
        P(rc, gx + 1, top(f1), 8, (f1 - f0 + 1) * FA, ex ? '#2e1e14' : '#20222a');
        P(rc, gx + 1, top(f1), 1, (f1 - f0 + 1) * FA, ex ? '#5a3a24' : '#3e4250');
        P(rc, gx + 8, top(f1), 1, (f1 - f0 + 1) * FA, ex ? '#5a3a24' : '#3e4250');
        if (texture(rc)) P(rc, gx + 5, top(f1), 1, (f1 - f0 + 1) * FA, '#4a4a52');
        for (let f = f0; f <= f1; f++) {
          const B = bot(f), T = top(f);
          if (serves(f)) {
            P(rc, gx + 1, B - 2, 8, 2, ex ? '#ff8c42' : '#9aa4b2');
            P(rc, gx + 1, T, 8, 1, ex ? '#ff8c42' : '#9aa4b2');
          } else P(rc, gx + 1, B - 1, 8, 1, '#141418');
        }
      },

      car(rc, sh, car, full) {
        const ex = sh.kind === 'express', gx = sh.c * G + 1;
        const T = Math.round(-(car.y + 1) * FA) + 1;
        // car.cond (depth run): slow / wear ≥ 70 = steady yellow sign, waiting = blinking sign,
        // repair = mechanic in the open car, broken = lights out, sparks and a red sign; missing = as before
        const cond = car.cond || 'ok', broken = cond === 'broken', repair = cond === 'repair';
        const worn = cond === 'slow' || (car.wear || 0) >= 70, blink = Math.floor((rc.time || 0) * 1.6) % 2 === 0;
        const frame = ex ? '#e07a30' : '#d8b030', door0 = ex ? '#a8501c' : '#9a7a18';
        const door = broken ? U.mix(door0, '#000000', 0.4) : door0;
        if (rc.detail === 0) {
          P(rc, gx, T, 8, 13, frame);
          P(rc, gx, T + Math.round(13 * (1 - full)), 8, Math.round(13 * full), door);
          if (broken) P(rc, gx, T, 8, 6, WARN_R);
          else if (repair) P(rc, gx, T, 8, 6, MECH.far[1]);
          else if (cond === 'waiting') { if (blink) P(rc, gx, T, 8, 6, WARN_Y); }
          else if (worn) P(rc, gx, T, 8, 3, WARN_Y);
          return;
        }
        const open = car.state === 'doors' || repair;
        P(rc, gx, T, 8, 13, frame);
        P(rc, gx + 1, T + 2, 6, 10, broken ? '#2a2a30' : open ? '#fff4c8' : '#6a5a3a');
        P(rc, gx, T, 8, 1, '#2c2c36');
        const shown = broken || repair ? 0 : Math.round(full * 6);          // up to 6 figures stand for the load
        for (let i = 0; i < shown; i++) {
          const row = i < 3 ? 0 : 1, k = i % 3;
          const fx = gx + 1 + k * 2, feet = T + 11 - row * 2;
          P(rc, fx, feet - 5, 2, 1, HAIR[i % HAIR.length]); P(rc, fx, feet - 4, 2, 1, SKIN[(i * 7) % 4]); P(rc, fx, feet - 3, 2, 3, SHIRT[(i * 3 + sh.c) % SHIRT.length]);
        }
        if (repair) {                                // the mechanic works in the open car, case at the feet
          const m = car.mech, emg = !!(m && m.emergency);
          worker(rc, gx + 2, T + 11, m && m.id != null ? m.id : sh.c * 97 + 1, emg, 1, false);
          P(rc, gx + 5, T + 10, 2, 2, (emg ? EMG : MECH).box);
          P(rc, gx, T + 12, 8, 1, WARN_Y);
          for (let i = 1; i < 8; i += 2) P(rc, gx + i, T + 12, 1, 1, INK);
        }
        if (!open) {
          if (texture(rc)) {                         // closed: dithered door panels with a seam
            for (let j = 0; j < 10; j++) for (let i = (j % 2); i < 6; i += 2) P(rc, gx + 1 + i, T + 2 + j, 1, 1, door);
          } else {                                   // calm: two flat panels, the load shows through a window
            P(rc, gx + 1, T + 2, 6, 10, door);
            if (shown) P(rc, gx + 2, T + 3, 4, 2, U.mix(door, '#fff4c8', 0.45));
          }
          P(rc, gx + 4, T + 2, 1, 10, '#2c2c36');
        } else {
          P(rc, gx + 1, T + 2, 1, 10, door); P(rc, gx + 6, T + 2, 1, 10, door);
        }
        if (broken) {                                // sparks flicker around the roof (real time)
          const k = Math.floor((rc.time || 0) * 8);
          for (let i = 0; i < 5; i++) {
            if (U.hash(sh.c * 7 + i, k, 3) < 0.4) continue;
            P(rc, gx - 1 + Math.floor(U.hash(i, k, sh.c) * 10), T - 1 + Math.floor(U.hash(k, i, 9) * 4), 1, 1, i % 2 ? '#fff4a0' : '#ffb030');
          }
          warnSign(rc, gx + 3, T - 8, WARN_R);
        } else if (cond === 'waiting') { if (blink) warnSign(rc, gx + 3, T - 8, WARN_Y); }
        else if (worn && !repair) warnSign(rc, gx + 3, T - 8, WARN_Y);
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
  }

  const reg = o => (root.TowerStyles[o.id] = make(o));
  reg({ id: 'pixel', label: 'A · Pixel' });
  reg({ id: 'pixel_calm', label: 'A2 · Pixel ruhig', theme: 'calm', calm: true, grid: G });
  reg({ id: 'pixel_fine', label: 'A3 · Pixel fein', theme: 'calm', calm: true, fine: true, grid: 2 * G });
  reg({ id: 'pixel_warm', label: 'A×C · Pixel-Diorama', theme: 'warm', calm: true, fine: true, grid: 2 * G });
})(typeof window !== 'undefined' ? window : globalThis);
