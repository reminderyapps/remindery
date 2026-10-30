// Tower game – style B "flat": clean flat vector look in the spirit of Mini Metro.
// Calm colour fields with soft shadows, a bold symbol per room type, people as simple figures,
// elevators as transit lines with stops. State before decoration: occupancy as dots, waiting time
// as a traffic-light colour plus a small timer ring at the head of each queue.
(function (root) {
  'use strict';
  const U = root.TowerRender.util;
  const TYPE = {
    office:     { fill: '#d7e5f6', accent: '#3f74b8' },
    condo:      { fill: '#fbe3c0', accent: '#dd861a' },
    restaurant: { fill: '#f8d3c5', accent: '#d2482a' },
    skylobby:   { fill: '#e6e0f4', accent: '#6c5bc4' },
  };
  const HEAT = { good: '#3b82f6', ok: '#f5b82e', bad: '#e5484d', vacant: '#b8bcc4', unreachable: '#7a2633', lobby: '#d8cfc0' };
  const WAIT = ['#2fb36b', '#f2a60c', '#e5484d'];
  const LINE = { normal: '#5b6475', express: '#f08a24' };
  const SKY = [[0, '#1b1f35', '#252a45'], [5.5, '#1b1f35', '#252a45'], [6.5, '#f3cdb6', '#f8e6d6'], [8, '#d9eaf2', '#eef5f7'],
    [17, '#d9eaf2', '#eef5f7'], [18.5, '#f1c3a8', '#f8dfcc'], [20, '#232843', '#2f3552'], [24, '#1b1f35', '#252a45']];
  const NIGHT_ROOM = '#2a3150';
  const font = (rc, k, w) => `${w || 600} ${Math.max(9, Math.round(rc.s * k))}px system-ui, "Segoe UI", sans-serif`;

  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shadow(rc, on, col, blur, dy) {
    const ctx = rc.ctx;
    if (!on) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; return; }
    ctx.shadowColor = col; ctx.shadowBlur = blur * rc.s; ctx.shadowOffsetY = dy * rc.s;
  }
  const inkCol = rc => (rc.night ? '#e9edf5' : '#353c4c');

  // ---------- room symbols (centre cx, cy in px, size g in px) ----------
  function glyph(ctx, type, cx, cy, g, col) {
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, g * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (type === 'office') {
      rr(ctx, cx - g * 0.5, cy - g * 0.25, g, g * 0.62, g * 0.12); ctx.fill();
      rr(ctx, cx - g * 0.2, cy - g * 0.45, g * 0.4, g * 0.26, g * 0.08); ctx.stroke();
    } else if (type === 'condo') {
      ctx.beginPath(); ctx.moveTo(cx, cy - g * 0.5); ctx.lineTo(cx + g * 0.5, cy - g * 0.05); ctx.lineTo(cx + g * 0.36, cy - g * 0.05);
      ctx.lineTo(cx + g * 0.36, cy + g * 0.42); ctx.lineTo(cx - g * 0.36, cy + g * 0.42); ctx.lineTo(cx - g * 0.36, cy - g * 0.05);
      ctx.lineTo(cx - g * 0.5, cy - g * 0.05); ctx.closePath(); ctx.fill();
    } else if (type === 'restaurant') {
      ctx.beginPath();
      ctx.moveTo(cx - g * 0.22, cy - g * 0.45); ctx.lineTo(cx - g * 0.22, cy + g * 0.45);
      for (const d of [-0.36, -0.08]) { ctx.moveTo(cx + d * g, cy - g * 0.45); ctx.lineTo(cx + d * g, cy - g * 0.12); }
      ctx.moveTo(cx - g * 0.36, cy - g * 0.12); ctx.lineTo(cx - g * 0.08, cy - g * 0.12);
      ctx.moveTo(cx + g * 0.25, cy + g * 0.45); ctx.lineTo(cx + g * 0.25, cy - g * 0.45); ctx.quadraticCurveTo(cx + g * 0.45, cy - g * 0.2, cx + g * 0.25, cy);
      ctx.stroke();
    } else if (type === 'skylobby') {
      rr(ctx, cx - g * 0.45, cy - g * 0.45, g * 0.9, g * 0.9, g * 0.18); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(cx, cy - g * 0.3); ctx.lineTo(cx + g * 0.2, cy - g * 0.06); ctx.lineTo(cx - g * 0.2, cy - g * 0.06); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy + g * 0.3); ctx.lineTo(cx + g * 0.2, cy + g * 0.06); ctx.lineTo(cx - g * 0.2, cy + g * 0.06); ctx.fill();
    } else if (type === 'warn') {
      ctx.beginPath(); ctx.arc(cx, cy, g * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - g * 0.06, cy - g * 0.28, g * 0.12, g * 0.32); ctx.fillRect(cx - g * 0.06, cy + g * 0.12, g * 0.12, g * 0.12);
    }
  }

  function figure(rc, px, base, col, hgt) {
    const ctx = rc.ctx, w = hgt * 0.3;
    ctx.fillStyle = col;
    rr(ctx, px - w / 2, base - hgt * 0.62, w, hgt * 0.62, w * 0.45); ctx.fill();
    ctx.beginPath(); ctx.arc(px, base - hgt * 0.8, hgt * 0.14, 0, Math.PI * 2); ctx.fill();
  }

  const style = {
    id: 'flat', label: 'B · Flach',

    sky(rc) {
      const [a, b] = U.skyColors(rc.t, SKY);
      const g = rc.ctx.createLinearGradient(0, 0, 0, rc.cssH);
      g.addColorStop(0, a); g.addColorStop(1, b);
      rc.ctx.fillStyle = g; rc.ctx.fillRect(0, 0, rc.cssW, rc.cssH);
    },

    ground(rc) {
      const x0 = rc.view.x, w = rc.cssW / rc.s + 1;
      rc.rect(x0, 0, w, 4, rc.night ? '#30354d' : '#d6cebe');
      rc.rect(x0, 0, w, 0.12, rc.night ? '#454b68' : '#bdb29d');
    },

    label(rc, f, text, lobby) {
      const ctx = rc.ctx, cx = rc.sx(-0.85), cy = rc.sy(rc.floorTop(f) + rc.FH / 2);
      ctx.font = `600 ${Math.max(8, Math.min(12, Math.round(rc.s * 0.55)))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      if (lobby) {
        const w = ctx.measureText(text).width + 8, h = Math.max(12, Math.min(17, rc.s * 0.75));
        ctx.fillStyle = '#f2c94c'; rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fill();
        ctx.fillStyle = '#3a3220';
      } else ctx.fillStyle = rc.night ? '#9aa3bd' : '#6a7386';
      ctx.fillText(text, cx, cy + 0.5);
      ctx.textAlign = 'left';
    },

    limit(rc, y) {
      const ctx = rc.ctx;
      ctx.strokeStyle = rc.night ? 'rgba(233,237,245,.5)' : 'rgba(53,60,76,.45)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(rc.sx(0), rc.sy(y)); ctx.lineTo(rc.sx(rc.W), rc.sy(y)); ctx.stroke(); ctx.setLineDash([]);
    },

    lobby(rc, ex) {
      const ctx = rc.ctx, s = rc.s, y = rc.floorTop(0);
      shadow(rc, rc.detail > 0, 'rgba(40,50,70,.16)', 0.3, 0.06);
      ctx.fillStyle = rc.heat ? HEAT.lobby : rc.night ? '#3a4060' : '#efe8da';
      rr(ctx, rc.sx(0.03), rc.sy(y + 0.07), (rc.W - 0.06) * s, (rc.FH - 0.14) * s, 0.16 * s); ctx.fill();
      shadow(rc, false);
      if (rc.detail === 0) { rc.rect(ex - 0.9, y + 0.5, 1.8, rc.FH - 0.57, '#2a9d8f'); return; }
      ctx.strokeStyle = rc.night ? 'rgba(255,255,255,.08)' : 'rgba(53,60,76,.08)'; ctx.lineWidth = Math.max(1, s * 0.06);
      for (let c = 2; c < rc.W; c += 4) { ctx.beginPath(); ctx.moveTo(rc.sx(c), rc.sy(y + 0.3)); ctx.lineTo(rc.sx(c), rc.sy(y + rc.FH - 0.12)); ctx.stroke(); }
      // entrance: teal doorway with an inward arrow
      ctx.fillStyle = '#2a9d8f';
      rr(ctx, rc.sx(ex - 0.95), rc.sy(y + 0.32), 1.9 * s, (rc.FH - 0.39) * s, 0.14 * s); ctx.fill();
      ctx.fillStyle = rc.night ? '#3a4060' : '#efe8da';
      ctx.fillRect(rc.sx(ex - 0.03), rc.sy(y + 0.42), 0.06 * s, (rc.FH - 0.55) * s);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.lineCap = 'round';
      const ay = rc.sy(y + 0.62);
      ctx.beginPath(); ctx.moveTo(rc.sx(ex - 0.25), ay - s * 0.12); ctx.lineTo(rc.sx(ex), ay + s * 0.08); ctx.lineTo(rc.sx(ex + 0.25), ay - s * 0.12); ctx.stroke();
      if (rc.s * rc.FH >= 15) {
        ctx.fillStyle = rc.night ? '#e9edf5' : '#353c4c'; ctx.font = font(rc, 0.5);
        ctx.fillText('Lobby', rc.sx(0.35), rc.sy(y + 0.5));
      }
    },

    room(rc, r, st) {
      const ctx = rc.ctx, s = rc.s, y0 = rc.floorTop(r.f) + 0.07, h = rc.FH - 0.14;
      const X = rc.sx(r.x + 0.05), Y = rc.sy(y0), Wd = (r.w - 0.1) * s, Hd = h * s, rad = 0.16 * s;
      const T = TYPE[r.type], lit = r.inside > 0;
      const vacant = st === 'vacant', unreach = st === 'unreachable', occ = !vacant && !unreach;
      let fill, glyphCol, dash = null;
      if (rc.heat) { fill = HEAT[st] || T.fill; glyphCol = 'rgba(255,255,255,.9)'; }
      else if (unreach) { fill = rc.night ? '#3a2433' : '#f6e1e1'; glyphCol = '#d64545'; dash = '#d64545'; }
      else if (vacant) { fill = rc.night ? '#232941' : '#f8f6f1'; glyphCol = rc.night ? '#5b6380' : '#b2b7c2'; dash = rc.night ? '#5b6380' : '#a6acb8'; }
      else if (rc.night && !lit) { fill = NIGHT_ROOM; glyphCol = U.mix(T.accent, NIGHT_ROOM, 0.45); }
      else { fill = rc.night ? U.mix(T.fill, '#fff1c2', 0.35) : T.fill; glyphCol = T.accent; }
      const glow = !rc.heat && rc.night && lit && occ;
      shadow(rc, rc.detail > 0 && (!rc.night || glow), glow ? 'rgba(255,205,110,.55)' : 'rgba(40,50,70,.16)', glow ? 0.5 : 0.3, glow ? 0 : 0.06);
      ctx.fillStyle = fill; rr(ctx, X, Y, Wd, Hd, rad); ctx.fill();
      shadow(rc, false);
      if (rc.detail === 0) return;
      if (dash) { ctx.strokeStyle = dash; ctx.lineWidth = Math.max(1, s * 0.06); ctx.setLineDash([s * 0.18, s * 0.12]); rr(ctx, X + 1, Y + 1, Wd - 2, Hd - 2, rad); ctx.stroke(); ctx.setLineDash([]); }
      const g = Math.min(0.62, h * 0.42) * s;
      const gcx = X + 0.45 * s, gcy = Y + 0.46 * s;
      glyph(ctx, unreach && !rc.heat ? 'warn' : r.type, gcx, gcy, g, glyphCol);
      if (rc.s * rc.FH >= 15 && !rc.heat) {
        let text = vacant ? 'frei' : unreach ? 'kein Weg' : r.type === 'skylobby' ? 'Sky-Lobby' : null;
        if (text) { ctx.fillStyle = unreach ? '#c03a3a' : rc.night ? '#aab2c8' : '#6a7386'; ctx.font = font(rc, 0.4); ctx.fillText(text, gcx + g * 0.75, gcy); }
      }
      // occupancy dots
      if (occ && !rc.heat && r.inside > 0 && r.type !== 'skylobby') {
        const perRow = r.type === 'restaurant' ? 12 : 6, rows = Math.ceil(r.inside / perRow);
        const pts = U.slots(r.inside, r.w - 0.5, perRow);
        const dr = Math.min(0.11, (r.w - 0.5) / perRow * 0.32) * s;
        ctx.fillStyle = rc.night ? '#3a3f55' : T.accent;
        for (const p of pts) {
          ctx.beginPath(); ctx.arc(rc.sx(r.x + 0.25 + p.x), rc.sy(y0 + h - 0.2 - (rows - 1 - p.row) * 0.28), dr, 0, Math.PI * 2); ctx.fill();
        }
      }
    },

    link(rc, kind, f, x, w) {
      const ctx = rc.ctx, s = rc.s;
      const yb = rc.floorTop(f) + rc.FH - 0.12, yt = rc.floorTop(f + 1) + rc.FH - 0.12;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (kind === 'stairs') {
        const n = 6;
        ctx.strokeStyle = rc.night ? '#c9a27e' : '#9a7350'; ctx.lineWidth = Math.max(1.5, s * 0.1);
        ctx.beginPath(); ctx.moveTo(rc.sx(x), rc.sy(yb));
        for (let k = 0; k < n; k++) {
          const xx = x + w * (k + 0.5) / n, y1 = yb + (yt - yb) * (k + 1) / n;
          ctx.lineTo(rc.sx(xx), rc.sy(yb + (yt - yb) * k / n)); ctx.lineTo(rc.sx(xx), rc.sy(y1));
        }
        ctx.lineTo(rc.sx(x + w), rc.sy(yt));
        ctx.stroke();
      } else {
        ctx.strokeStyle = rc.night ? '#8d98ab' : '#7c8796'; ctx.lineWidth = Math.max(3, s * 0.22);
        ctx.beginPath(); ctx.moveTo(rc.sx(x + 0.1), rc.sy(yb - 0.08)); ctx.lineTo(rc.sx(x + w - 0.1), rc.sy(yt - 0.08)); ctx.stroke();
        if (rc.detail > 0) {
          const ang = Math.atan2((yt - yb), w), c = Math.max(2, s * 0.09);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, s * 0.05);
          for (const k of [0.3, 0.5, 0.7]) {
            const cx = rc.sx(x + 0.1 + (w - 0.2) * k), cy = rc.sy(yb - 0.08 + (yt - yb) * k);
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
            ctx.beginPath(); ctx.moveTo(-c * 0.6, -c); ctx.lineTo(c * 0.6, 0); ctx.lineTo(-c * 0.6, c); ctx.stroke();
            ctx.restore();
          }
        }
      }
    },

    shaft(rc, sh, serves) {
      const ctx = rc.ctx, s = rc.s, col = LINE[sh.kind];
      const yTop = rc.floorTop(sh.f1), H = (sh.f1 - sh.f0 + 1) * rc.FH;
      ctx.fillStyle = U.rgba(col, rc.night ? 0.22 : 0.13);
      rr(ctx, rc.sx(sh.c + 0.14), rc.sy(yTop + 0.1), 0.72 * s, (H - 0.2) * s, 0.3 * s); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, s * 0.14); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rc.sx(sh.c + 0.5), rc.sy(yTop + 0.5)); ctx.lineTo(rc.sx(sh.c + 0.5), rc.sy(yTop + H - 0.5)); ctx.stroke();
      const r = rc.detail === 0 ? Math.max(1.2, s * 0.12) : Math.max(2.5, s * 0.17);
      for (let f = Math.max(sh.f0, rc.fBot); f <= Math.min(sh.f1, rc.fTop); f++) {
        if (!serves(f)) continue;
        const cy = rc.sy(rc.floorTop(f) + rc.FH / 2);
        if (rc.detail === 0) { ctx.fillStyle = rc.night ? '#262b47' : '#ffffff'; ctx.beginPath(); ctx.arc(rc.sx(sh.c + 0.5), cy, r, 0, Math.PI * 2); ctx.fill(); continue; }
        ctx.fillStyle = rc.night ? '#262b47' : '#ffffff'; ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.beginPath(); ctx.arc(rc.sx(sh.c + 0.5), cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    },

    car(rc, sh, car, full) {
      const ctx = rc.ctx, s = rc.s, col = LINE[sh.kind];
      const top = -(car.y + 1) * rc.FH + 0.17, h = rc.FH - 0.34;
      const X = rc.sx(sh.c + 0.17), Y = rc.sy(top), Wd = 0.66 * s, Hd = h * s, rad = 0.22 * s;
      const open = car.state === 'doors';
      if (open && rc.detail > 0) {               // halo while doors are open
        ctx.fillStyle = U.rgba(col, 0.28);
        rr(ctx, X - 0.12 * s, Y - 0.12 * s, Wd + 0.24 * s, Hd + 0.24 * s, rad + 0.12 * s); ctx.fill();
      }
      shadow(rc, rc.detail > 0, 'rgba(30,40,60,.25)', 0.25, 0.05);
      ctx.fillStyle = rc.night ? '#eef1f7' : '#ffffff'; rr(ctx, X, Y, Wd, Hd, rad); ctx.fill();
      shadow(rc, false);
      ctx.save(); rr(ctx, X, Y, Wd, Hd, rad); ctx.clip();
      ctx.fillStyle = U.rgba(col, 0.85); ctx.fillRect(X, Y + Hd * (1 - full), Wd, Hd * full);
      ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.09);
      ctx.save();
      if (open) {                                // outline with gaps where the doors are
        const gw = ctx.lineWidth + 2;
        ctx.beginPath(); ctx.rect(0, 0, rc.cssW, rc.cssH);
        ctx.rect(X - gw / 2, Y + Hd * 0.3, gw, Hd * 0.42); ctx.rect(X + Wd - gw / 2, Y + Hd * 0.3, gw, Hd * 0.42);
        ctx.clip('evenodd');
      }
      rr(ctx, X, Y, Wd, Hd, rad); ctx.stroke();
      ctx.restore();
      if (rc.detail === 2 && car.pax.length) {
        ctx.font = `700 ${Math.round(s * 0.36)}px system-ui, sans-serif`; ctx.textAlign = 'center';
        ctx.fillStyle = full > 0.45 ? '#ffffff' : col;
        ctx.fillText(String(car.pax.length), X + Wd / 2, Y + Hd * 0.72);
        ctx.textAlign = 'left';
      }
    },

    person(rc, x, f, o) {
      const s = rc.s, base = rc.sy(rc.floorTop(f) + rc.FH - 0.1);
      const hgt = Math.max(5, s * 0.78);
      const col = o.mode === 'wait' ? WAIT[o.level] : inkCol(rc);
      figure(rc, rc.sx(x), base, col, hgt);
    },

    queueInfo(rc, x0, f, dir, n, maxWait) {
      if (rc.detail === 0) return;
      const ctx = rc.ctx, s = rc.s, lv = U.waitLevel(maxWait);
      const cx = rc.sx(x0 + dir * 0.25), cy = rc.sy(rc.floorTop(f) + 0.34), r = Math.max(3.5, s * 0.17);
      ctx.fillStyle = rc.night ? '#1b1f35' : '#ffffff';
      ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WAIT[lv];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, maxWait / 15)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = WAIT[lv]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    },

    overflow(rc, text, x, f, dir) {
      const ctx = rc.ctx, s = rc.s;
      ctx.font = `700 ${Math.max(9, Math.round(s * 0.42))}px system-ui, sans-serif`;
      const w = ctx.measureText(text).width + 8, h = Math.max(13, s * 0.55);
      const X = dir < 0 ? rc.sx(x) - w : rc.sx(x), Y = rc.sy(rc.floorTop(f) + rc.FH * 0.62) - h / 2;
      ctx.fillStyle = rc.night ? '#e9edf5' : '#353c4c'; rr(ctx, X, Y, w, h, h / 2); ctx.fill();
      ctx.fillStyle = rc.night ? '#1b1f35' : '#ffffff'; ctx.fillText(text, X + 4, Y + h / 2 + 0.5);
    },
  };
  root.TowerStyles.flat = style;
})(typeof window !== 'undefined' ? window : globalThis);
