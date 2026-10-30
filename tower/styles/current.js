// Tower game – style "current": today's look of index.html, ported to the style hooks.
// Reference column of the design study; proves the hook interface covers the existing draw().
(function (root) {
  'use strict';
  const U = root.TowerRender.util;
  const TYPE_COL = { office: '#c9d6e6', condo: '#f1d7ae', restaurant: '#f0b29b', skylobby: '#d9c9a8' };
  const HEAT_COL = { good: '#4f8cff', ok: '#ffc94d', bad: '#ff4d5e', vacant: '#8e959e', unreachable: '#7a2633', lobby: '#d9c9a8' };
  const ICON = { office: '💼', condo: '🏠', restaurant: '🍽️', skylobby: '🛋️' };
  const WAIT_COL = ['#7ee0a8', '#ffc94d', '#ff4d5e'];

  const style = {
    id: 'current', label: 'Heute',

    sky(rc) {
      const [top, bot] = U.skyColors(rc.t);
      const g = rc.ctx.createLinearGradient(0, 0, 0, rc.cssH);
      g.addColorStop(0, top); g.addColorStop(1, bot);
      rc.ctx.fillStyle = g; rc.ctx.fillRect(0, 0, rc.cssW, rc.cssH);
    },
    ground(rc) {
      const x0 = rc.view.x, w = rc.cssW / rc.s + 1;
      rc.rect(x0, 0, w, 4, '#4a3b2f');
      rc.rect(x0, 0, w, 0.25, '#3c6b3a');
    },
    label(rc, f, text, lobby) {
      const ctx = rc.ctx;
      ctx.font = Math.max(8, Math.min(12, rc.s * 0.75)) + 'px system-ui';
      ctx.textAlign = 'right';
      ctx.fillStyle = lobby ? '#ffd23f' : 'rgba(255,255,255,.7)';
      ctx.fillText(text, rc.sx(-0.25), rc.sy(rc.floorTop(f) + rc.FH / 2));
      ctx.textAlign = 'left';
    },
    limit(rc, y) {
      const ctx = rc.ctx;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rc.sx(0), rc.sy(y)); ctx.lineTo(rc.sx(rc.W), rc.sy(y)); ctx.stroke(); ctx.setLineDash([]);
    },
    lobby(rc, ex) {
      const y = rc.floorTop(0);
      rc.rect(0, y, rc.W, rc.FH, '#d9c9a8');
      rc.rect(ex - 1, y + rc.FH * 0.25, 2, rc.FH * 0.75, '#5d4a35');
      if (rc.s * rc.FH >= 15) {
        rc.ctx.fillStyle = '#5d4a35'; rc.ctx.font = Math.round(rc.s * 0.7) + 'px system-ui';
        rc.ctx.fillText('Lobby', rc.sx(0.3), rc.sy(y + rc.FH * 0.5));
      }
    },
    room(rc, r, st) {
      const s = rc.s, y0 = rc.floorTop(r.f) + 0.08, h = rc.FH - 0.08;
      let fill = TYPE_COL[r.type] || '#b8b8b8';
      if (rc.heat) fill = HEAT_COL[st] || fill;
      else if (st === 'vacant' || st === 'unreachable') fill = '#9aa3ad';
      rc.rect(r.x + 0.04, y0, r.w - 0.08, h, fill);
      if (r.type !== 'skylobby' && s >= 9) {
        const lit = r.inside > 0;
        for (let i = 0; i < r.w; i++) {
          const wc = lit ? (rc.night ? '#ffe08a' : 'rgba(255,255,255,.55)') : (rc.night ? '#2a3140' : 'rgba(60,80,110,.35)');
          rc.rect(r.x + i + 0.25, y0 + 0.25, 0.5, 0.5, wc);
        }
      }
      if (s * rc.FH >= 15) {
        const ctx = rc.ctx;
        ctx.font = Math.round(s * 0.7) + 'px system-ui';
        ctx.fillText(st === 'unreachable' ? '⚠️' : ICON[r.type] || '', rc.sx(r.x + 0.2), rc.sy(y0 + h * 0.72));
        if (st === 'vacant') { ctx.fillStyle = '#2b2f36'; ctx.fillText('frei', rc.sx(r.x + 1.2), rc.sy(y0 + h * 0.72)); }
        if (r.type === 'skylobby') { ctx.fillStyle = '#5d4a35'; ctx.fillText('Sky-Lobby', rc.sx(r.x + 1.2), rc.sy(y0 + h * 0.72)); }
      }
    },
    link(rc, kind, f, x, w) {
      const ctx = rc.ctx, sx = rc.sx, sy = rc.sy;
      const yb = rc.floorTop(f) + rc.FH - 0.08, yt = rc.floorTop(f + 1) + rc.FH - 0.08, th = 0.32;
      ctx.beginPath();
      ctx.moveTo(sx(x), sy(yb)); ctx.lineTo(sx(x + w), sy(yt));
      ctx.lineTo(sx(x + w), sy(yt + th)); ctx.lineTo(sx(x), sy(yb + th)); ctx.closePath();
      ctx.fillStyle = kind === 'stairs' ? '#a57c4a' : '#8193a8'; ctx.fill();
      ctx.strokeStyle = kind === 'stairs' ? '#6e5230' : '#e8edf4';
      ctx.lineWidth = Math.max(1, rc.s * 0.08);
      if (kind === 'stairs') {
        for (let k = 1; k < 6; k++) {
          const xx = x + w * k / 6, yy = yb + (yt - yb) * k / 6;
          ctx.beginPath(); ctx.moveTo(sx(xx), sy(yy)); ctx.lineTo(sx(xx), sy(yy + th)); ctx.stroke();
        }
      } else {
        ctx.beginPath(); ctx.moveTo(sx(x), sy(yb - 0.45)); ctx.lineTo(sx(x + w), sy(yt - 0.45)); ctx.stroke();
      }
    },
    shaft(rc, sh, serves) {
      const ex = sh.kind === 'express';
      rc.rect(sh.c + 0.08, rc.floorTop(sh.f1), 0.84, (sh.f1 - sh.f0 + 1) * rc.FH, ex ? '#4b3424' : '#353c48');
      for (let f = Math.max(sh.f0, rc.fBot); f <= Math.min(sh.f1, rc.fTop); f++) {
        if (serves(f)) rc.rect(sh.c + 0.08, rc.floorTop(f) + rc.FH - 0.12, 0.84, 0.12, ex ? '#ff8c42' : '#7d8899');
      }
    },
    car(rc, sh, car, full) {
      const ex = sh.kind === 'express';
      const yTop = -(car.y + 1) * rc.FH + 0.15, h = rc.FH - 0.25;
      rc.rect(sh.c + 0.14, yTop, 0.72, h, ex ? '#ff8c42' : '#ffd23f');
      rc.rect(sh.c + 0.14, yTop + h * (1 - full), 0.72, h * full, ex ? '#c2571a' : '#c99a00');
      if (car.state === 'doors') { rc.ctx.strokeStyle = '#fff'; rc.ctx.lineWidth = 1; rc.ctx.strokeRect(rc.sx(sh.c + 0.14), rc.sy(yTop), 0.72 * rc.s, h * rc.s); }
    },
    person(rc, x, f, o) {
      const s = rc.s, base = rc.sy(rc.floorTop(f) + rc.FH - 0.12);
      const px = rc.sx(x), hgt = Math.max(4, s * 0.85), wd = Math.max(2, s * 0.32);
      rc.ctx.fillStyle = o.mode === 'wait' ? WAIT_COL[o.level] : '#f5f7fa';
      rc.ctx.fillRect(px - wd / 2, base - hgt * 0.68, wd, hgt * 0.68);
      rc.ctx.beginPath(); rc.ctx.arc(px, base - hgt * 0.82, Math.max(1.4, hgt * 0.15), 0, Math.PI * 2); rc.ctx.fill();
    },
    overflow(rc, text, x, f, dir) {
      const ctx = rc.ctx;
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(rc.s * 0.6) + 'px system-ui';
      ctx.textAlign = dir < 0 ? 'right' : 'left';
      const tx = rc.sx(x), ty = rc.sy(rc.floorTop(f) + rc.FH * 0.45);
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
      ctx.strokeText(text, tx, ty); ctx.fillText(text, tx, ty);
      ctx.textAlign = 'left';
    },
  };
  root.TowerStyles.current = style;
})(typeof window !== 'undefined' ? window : globalThis);
