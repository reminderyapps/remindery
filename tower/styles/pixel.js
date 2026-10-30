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

  const HEAT = { good: '#4a8cff', ok: '#ffc94d', bad: '#ff4d5e', vacant: '#8e959e', unreachable: '#7a2633', lobby: '#d9c9a8', none: '#c3c8d0' };
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
    function office(rc, gx, T, B, n, lit, tone) {
      const units = Math.round(n / G), tx = texture(rc);
      for (let u = 0; u < units; u++) {             // window strip on the back wall
        P(rc, gx + u * G + 2, T + 2, 6, 3, tone(lit ? '#d8f0ff' : '#7a90a8'));
        if (tx) { P(rc, gx + u * G + 2, T + 2, 6, 1, tone('#eef8ff')); P(rc, gx + u * G + 4, T + 2, 1, 3, tone('#8aa0b8')); }
      }
      for (let u = 0; u < units; u++) {
        const x = gx + u * G + 1;
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
      if (clutter(rc)) { P(rc, gx + n - 6, T + 6, 4, 6, tone('#6a4224')); P(rc, gx + n - 6, T + 8, 4, 1, tone('#4a2c18')); }  // file cabinet
    }
    function condo(rc, r, gx, T, B, lit, tone) {
      if (texture(rc)) for (let i = 3; i < 30; i += 4) P(rc, gx + i, T + 1, 1, 9, tone('#e0c08a'));   // wallpaper
      P(rc, gx + 1, B - 10, 1, 8, tone('#6a4024'));     // bed
      P(rc, gx + 2, B - 5, 10, 3, tone('#8a5a32'));
      P(rc, gx + 2, B - 6, 10, 1, tone('#f4f0e8'));
      P(rc, gx + 6, B - 7, 6, 2, tone('#5a7ac8'));
      P(rc, gx + 2, B - 7, 3, 1, tone('#ffffff'));
      P(rc, gx + 9, T + 3, 4, 3, tone('#6a4024')); P(rc, gx + 10, T + 4, 2, 1, tone('#7ab0d0'));  // picture
      P(rc, gx + 14, B - 5, 3, 3, tone('#8a5a32'));     // night table + lamp
      P(rc, gx + 15, B - 7, 1, 2, tone('#3a3a3a'));
      P(rc, gx + 14, B - 9, 3, 2, tone(lit ? '#ffe58a' : '#c8b890'));
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

    return {
      id: o.id, label: o.label, grid: o.grid || 0,

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
      shell(rc, sh) {
        if (rc.detail === 0) {
          rc.rect(sh.x, rc.floorTop(sh.f) + 0.12, sh.w, rc.FH - 0.12, rc.night && !rc.heat ? '#3a3e48' : '#b8b4ac');
          return;
        }
        const gx = sh.x * G, n = sh.w * G, T = top(sh.f), B = bot(sh.f);
        P(rc, gx, T, n, 14, rc.heat ? '#a4a7ad' : '#c6c2ba');
        for (let c = 0; c < sh.w; c++) if ((sh.x + c) % 3 === 1) P(rc, gx + c * G + 4, T + 1, 2, 13, '#b4b0a7');
        P(rc, gx, T, n, 1, '#a29e95');
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
        const heat = rc.heat ? HEAT[hs || st] || HEAT.none : null;   // hs: heat status from the caller (energy map)
        const pal = th.PAL[st === 'vacant' || st === 'unreachable' ? st : r.type];
        if (rc.detail === 0) {
          let c = heat || pal.wall;
          if (!heat && rc.night) c = lit ? '#f2d27a' : '#2a3048';
          rc.rect(r.x + 0.06, rc.floorTop(r.f) + 0.12, r.w - 0.12, rc.FH - 0.12, c);
          if (heat === HEAT.bad) for (let i = 0; i < r.w * 2; i += 2) rc.rect(r.x + 0.1 + i * 0.5, rc.floorTop(r.f) + 0.5, 0.45, 0.4, '#b8202e');
          return;
        }
        const dark = heat ? U.mix(heat, '#000000', 0.32) : null;
        const tone = heat ? () => dark : c => soft(c, pal.wall);
        P(rc, gx, T, n, 14, heat || pal.wall);
        P(rc, gx, B - 5, n, 3, heat ? U.mix(heat, '#000000', 0.12) : pal.low);
        P(rc, gx, T, n, 1, heat ? dark : pal.trim);
        if (!heat && o.theme === 'warm') P(rc, gx, T + 1, n, 1, U.mix(pal.wall, '#5a4030', 0.18));   // ceiling shade
        if (heat === HEAT.bad) for (let i = 1; i < n; i += 2) for (let j = 1; j < 13; j += 2) P(rc, gx + i + (j % 4 === 1 ? 0 : 1), T + j, 1, 1, '#d8303e');
        const occ = st !== 'vacant' && st !== 'unreachable';
        if (occ) {
          if (r.type === 'office') office(rc, gx, T, B, n, lit, tone);
          else if (r.type === 'condo') condo(rc, r, gx, T, B, lit, tone);
          else if (r.type === 'restaurant') restaurant(rc, r, gx, T, B, lit, tone);
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
        if (!heat && rc.night) P(rc, gx + 1, T + 1, n - 2, 13, lit ? th.nightLit : th.nightDark);
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
        const frame = ex ? '#e07a30' : '#d8b030', door = ex ? '#a8501c' : '#9a7a18';
        if (rc.detail === 0) {
          P(rc, gx, T, 8, 13, frame);
          P(rc, gx, T + Math.round(13 * (1 - full)), 8, Math.round(13 * full), door);
          return;
        }
        P(rc, gx, T, 8, 13, frame);
        P(rc, gx + 1, T + 2, 6, 10, car.state === 'doors' ? '#fff4c8' : '#6a5a3a');
        P(rc, gx, T, 8, 1, '#2c2c36');
        const shown = Math.round(full * 6);          // up to 6 figures stand for the load
        for (let i = 0; i < shown; i++) {
          const row = i < 3 ? 0 : 1, k = i % 3;
          const fx = gx + 1 + k * 2, feet = T + 11 - row * 2;
          P(rc, fx, feet - 5, 2, 1, HAIR[i % HAIR.length]); P(rc, fx, feet - 4, 2, 1, SKIN[(i * 7) % 4]); P(rc, fx, feet - 3, 2, 3, SHIRT[(i * 3 + sh.c) % SHIRT.length]);
        }
        if (car.state !== 'doors') {
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
      },

      person(rc, x, f, o2) {
        const feet = Math.round(-f * FA) - 3;
        const gx = Math.round(x * G) - 1;
        const stress = o2.mode === 'wait' ? o2.level : 0;
        if (rc.detail === 0) {
          const c = stress ? STRESS[stress][0] : TIRED_FAR[o2.tired || 0];
          P(rc, gx, feet - 8, 3, 9, c);
          return;
        }
        figure(rc, gx, feet, look(o2.id), false, stress, false, o2.tired || 0);
      },

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
