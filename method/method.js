// Remindery Method: Pipeline-Lauf, Tempo-Kurve und Nacht-Replay. Daten stehen je Sprache im JSON-Block #m-data.
(function () {
  const D = JSON.parse(document.getElementById('m-data').textContent);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onView = (el, fn, t) => new IntersectionObserver((es, o) => {
    if (es[0].isIntersecting) { o.disconnect(); fn(); }
  }, { threshold: t || .3 }).observe(el);

  // Pipeline: läuft durch die Phasen und verweilt dort, wo ein Mensch entscheidet
  const nodes = [...document.querySelectorAll('#pipe .node')];
  let pi = 0;
  (function step() {
    nodes.forEach((n, i) => n.classList.toggle('on', i === pi));
    const wait = nodes[pi].classList.contains('gate') ? 2200 : 900;
    pi = (pi + 1) % nodes.length;
    if (!still) setTimeout(step, wait);
  })();

  // Tempo-Kurve: Bautage (aktiv) vor Kalendertagen
  const speed = document.getElementById('speed');
  const max = Math.max(...D.speed.map(a => a[3]));
  speed.innerHTML = D.speed.map(([name, when, act, cal, note]) =>
    `<div class="row"><div class="name">${name}<small>${when}${note ? ' · ' + note : ''}</small></div>
     <div class="track"><div class="cal" data-w="${cal / max * 100}"></div><div class="act" data-w="${act / max * 100}"></div>
     <div class="val" style="left:calc(${cal / max * 100}% + 10px)">${act} ${D.days} <span style="color:var(--soft)">/ ${cal}</span></div></div></div>`).join('');
  onView(speed, () => {
    speed.querySelectorAll('[data-w]').forEach(el => el.style.width = el.dataset.w + '%');
    speed.classList.add('go');
  });

  // Nacht-Replay: echte Commit-Zeiten aus dem Rätselheft-Repo
  const log = document.getElementById('log'), clock = document.getElementById('clock'), cc = document.getElementById('cc'),
        hist = document.getElementById('hist'), morning = document.getElementById('morning');
  const H = [6, 18, 45, 19, 1, 23, 3, 6], TOTAL = 121, HMAX = 45;
  hist.innerHTML = H.map(() => '<div></div>').join('');
  const bars = [...hist.children];
  let timer = null;
  function play() {
    clearTimeout(timer); log.innerHTML = ''; bars.forEach(b => b.style.height = 0); morning.style.opacity = .25;
    let i = 0;
    (function tick() {
      const [t, msg, cls] = D.night[i];
      const row = document.createElement('div');
      row.innerHTML = `<time>${t}</time><span class="${cls || ''}">${msg}</span>`;
      log.appendChild(row);
      while (log.children.length > 16) log.firstChild.remove();
      clock.textContent = t;
      const h = +t.slice(0, 2), hi = h === 23 ? 0 : h + 1;
      let done = 0;
      H.forEach((n, k) => { if (k <= hi) bars[k].style.height = (n / HMAX * 100) + '%'; if (k < hi) done += n; });
      cc.textContent = i === D.night.length - 1 ? TOTAL : Math.min(TOTAL, Math.round(done + H[hi] * .6));
      i++;
      if (i < D.night.length) timer = setTimeout(tick, still ? 0 : 700);
      else morning.style.opacity = 1;
    })();
  }
  document.getElementById('replay').onclick = play;
  onView(log, play, .35);

  { // eigener Block: Namen wie nodes/H gibt es oben schon
  // Abtauchen: hell (Website) → Maschinenraum (dunkel), gesteuert vom Scrollen.
  // Bild: Denoising – verstreutes Rauschen ordnet sich zu einem neuronalen Netz (6 Schichten = 6 Phasen), Impulse laufen durch.
  const dive = document.getElementById('dive');
  if (!dive) return;
  const stage = dive.querySelector('.stage'), cv = dive.querySelector('canvas'), ctx = cv.getContext('2d');
  const sayA = dive.querySelector('.say-a'), sayB = dive.querySelector('.say-b');
  const darkScheme = matchMedia('(prefers-color-scheme: dark)').matches;
  const FROM = darkScheme ? [33, 26, 21] : [250, 247, 242], TO = [11, 15, 20];
  const TXT_FROM = darkScheme ? [244, 237, 228] : [43, 38, 34], TXT_TO = [230, 237, 243];
  const hero = document.querySelector('.hero-light');
  const SOFT_FROM = darkScheme ? [179, 166, 151] : [110, 98, 88], LINE_FROM = darkScheme ? [59, 49, 41] : [234, 226, 216];
  const DOT_FROM = darkScheme ? [179, 166, 151] : [110, 98, 88], DOT_TO = [230, 237, 243];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);
  const lines = D.dive;  // [Prompt, Antwort]
  const LAYERS = [3, 5, 6, 6, 5, 3];
  let p = 0, SW = 0, SH = 0, nodes = [], edges = [], pulses = [], dust = [], running = false;

  function build() {
    const r = devicePixelRatio || 1;
    SW = stage.clientWidth; SH = stage.clientHeight;
    cv.width = SW * r; cv.height = SH * r; ctx.setTransform(r, 0, 0, r, 0, 0);
    const padX = Math.max(24, SW * .08), spanX = SW - 2 * padX, top = SH * .34, spanY = SH * .6;
    nodes = []; edges = [];
    LAYERS.forEach((n, li) => {
      for (let k = 0; k < n; k++) nodes.push({
        layer: li, tx: padX + spanX * li / (LAYERS.length - 1), ty: top + spanY * (k + 1) / (n + 1),
        nx: Math.random() * SW, ny: Math.random() * SH, ph: Math.random() * 6.28, gate: li === 1 || li === 4 || li === 5
      });
    });
    nodes.forEach((a, i) => nodes.forEach((b, j) => {
      if (b.layer === a.layer + 1 && Math.random() < .55) edges.push([i, j]);
    }));
    dust = Array.from({ length: Math.round(SW * SH / 9000) }, () => ({ x: Math.random() * SW, y: Math.random() * SH, ph: Math.random() * 6.28 }));
    pulses = [];
  }
  function progress() {
    const r = dive.getBoundingClientRect();
    // beginnt schon, während die Bühne hereinscrollt – aber ganz oben auf der Seite immer bei 0 %
    const top = r.top + scrollY, startY = Math.max(0, top - innerHeight * .65), endY = top + r.height - innerHeight;
    p = clamp((scrollY - startY) / Math.max(1, endY - startY), 0, 1);
    const t = ease(clamp(p / .5, 0, 1));
    const bg = rgba(mix(FROM, TO, t), 1);
    stage.style.background = bg;
    // der helle Kopfbereich dunkelt mit ab, damit keine Kante entsteht
    hero.style.background = bg;
    hero.style.setProperty('--p-text', rgba(mix(TXT_FROM, TXT_TO, t), 1));
    hero.style.setProperty('--p-soft', rgba(mix(SOFT_FROM, [139, 152, 165], t), 1));
    hero.style.setProperty('--p-line', rgba(mix(LINE_FROM, [34, 48, 64], t), 1));
    sayA.style.color = rgba(mix(TXT_FROM, TXT_TO, t), 1);
    sayA.style.opacity = 1 - clamp((p - .6) / .2, 0, .6);
    const typed = clamp((p - .38) / .32, 0, 1);
    const full = lines[0] + '\n' + lines[1], n = Math.round(full.length * typed);
    sayB.innerHTML = full.slice(0, n).replace('\n', '<br>') + (typed > 0 ? '<span class="cur">&nbsp;</span>' : '');
    document.body.classList.toggle('deep', r.top < -(r.height - innerHeight) * .6);
    return t;
  }
  function draw(now) {
    const t = progress(), time = now / 1000;
    ctx.clearRect(0, 0, SW, SH);
    const k = ease(clamp((p - .12) / .38, 0, 1));          // Rauschen → Struktur
    const linkA = ease(clamp((p - .4) / .22, 0, 1));      // Verbindungen
    const fade = 1 - clamp((p - .9) / .1, 0, .5);
    const dot = mix(DOT_FROM, DOT_TO, t);
    // Rest-Rauschen, das beim Entrauschen verschwindet
    dust.forEach(d => {
      const a = (.14 + .25 * t) * (1 - k);
      if (a <= .01) return;
      ctx.fillStyle = rgba(dot, a);
      ctx.fillRect(d.x + Math.sin(time + d.ph) * 3, d.y + Math.cos(time * .8 + d.ph) * 3, 1.6, 1.6);
    });
    const pos = nodes.map(nd => {
      const j = (1 - k) * 14;
      return [nd.nx + (nd.tx - nd.nx) * k + Math.sin(time * 1.3 + nd.ph) * j,
              nd.ny + (nd.ty - nd.ny) * k + Math.cos(time * 1.1 + nd.ph) * j];
    });
    if (linkA > 0) {
      ctx.lineWidth = 1;
      edges.forEach(([i, j]) => {
        ctx.strokeStyle = rgba([120, 160, 200], .16 * linkA * fade);
        ctx.beginPath(); ctx.moveTo(pos[i][0], pos[i][1]); ctx.lineTo(pos[j][0], pos[j][1]); ctx.stroke();
      });
      if (!still && Math.random() < .25 * linkA && edges.length) {
        const start = edges.filter(e => nodes[e[0]].layer === 0);
        pulses.push({ e: start[(Math.random() * start.length) | 0], s: 0 });
      }
    }
    pulses = pulses.filter(pl => {
      pl.s += .028;
      if (pl.s >= 1) {
        const next = edges.filter(e => e[0] === pl.e[1]);
        if (!next.length) return false;
        pl.e = next[(Math.random() * next.length) | 0]; pl.s = 0;
      }
      const [a, b] = [pos[pl.e[0]], pos[pl.e[1]]];
      const x = a[0] + (b[0] - a[0]) * pl.s, y = a[1] + (b[1] - a[1]) * pl.s;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, rgba([255, 200, 140], .9 * linkA * fade)); g.addColorStop(1, rgba([255, 107, 85], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.28); ctx.fill();
      return true;
    });
    nodes.forEach((nd, i) => {
      const [x, y] = pos[i], glow = .35 + .65 * k;
      const c = nd.gate && k > .6 ? mix(dot, [255, 200, 87], (k - .6) / .4) : dot;
      ctx.fillStyle = rgba(c, (.25 + .6 * t) * glow * fade);
      ctx.beginPath(); ctx.arc(x, y, 2 + 2.5 * k, 0, 6.28); ctx.fill();
      if (k > .5) { ctx.strokeStyle = rgba(c, .25 * (k - .5) * 2 * fade); ctx.beginPath(); ctx.arc(x, y, 7 + 3 * k, 0, 6.28); ctx.stroke(); }
    });
    if (running && !still) requestAnimationFrame(draw);
  }
  build(); draw(0);
  addEventListener('resize', () => { build(); draw(performance.now()); });
  addEventListener('scroll', () => { if (still || !running) draw(performance.now()); }, { passive: true });
  if (!still) new IntersectionObserver(es => {
    running = es[0].isIntersecting;
    if (running) requestAnimationFrame(draw);
  }).observe(dive);
  }
})();

/* Organigramm: aufklappbare Funktionen */
(function () {
  document.querySelectorAll('.orgc').forEach(function (org) {
    function open(tile) {
      org.querySelectorAll('.tile').forEach(function (t) { t.setAttribute('aria-expanded', t === tile ? 'true' : 'false'); });
      org.querySelectorAll('.panel').forEach(function (p) { p.hidden = true; p.innerHTML = ''; });
      if (!tile) return;
      var panel = tile.closest('.org-row').nextElementSibling;
      panel.innerHTML = tile.querySelector('.det').innerHTML;
      panel.hidden = false;
    }
    function toggle(t) { open(t.getAttribute('aria-expanded') === 'true' ? null : t); }
    org.addEventListener('click', function (e) { var t = e.target.closest('.tile'); if (t) toggle(t); });
    org.addEventListener('keydown', function (e) {
      var t = e.target.closest('.tile');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(t); }
    });
    open(org.querySelector('.tile[data-open]'));
  });
})();
