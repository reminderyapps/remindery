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

  // Abtauchen: hell (Website) → Maschinenraum (dunkel), gesteuert vom Scrollen, Code-Regen dazwischen
  const dive = document.getElementById('dive');
  if (!dive) return;
  const stage = dive.querySelector('.stage'), cv = dive.querySelector('canvas'), ctx = cv.getContext('2d');
  const sayA = dive.querySelector('.say-a'), sayB = dive.querySelector('.say-b');
  const darkScheme = matchMedia('(prefers-color-scheme: dark)').matches;
  const FROM = darkScheme ? [33, 26, 21] : [250, 247, 242], TO = [11, 15, 20];
  const TXT_FROM = darkScheme ? [244, 237, 228] : [43, 38, 34], TXT_TO = [230, 237, 243];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);
  const lines = D.dive;  // [Prompt, Antwort]
  const GLYPHS = '01アイウエオカキクケコサシスセソ{}[]<>/=+*#$;:✓abcdef0123456789'.split('');
  let p = 0, cols = [], fs = 16, running = false;

  function size() {
    const r = devicePixelRatio || 1;
    cv.width = stage.clientWidth * r; cv.height = stage.clientHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0);
    cols = Array.from({ length: Math.ceil(stage.clientWidth / fs) }, () => Math.random() * -60);
  }
  function progress() {
    const r = dive.getBoundingClientRect();
    p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    const t = ease(clamp((p - .12) / .55, 0, 1));
    const bg = mix(FROM, TO, t);
    stage.style.background = rgb(bg);
    sayA.style.color = rgb(mix(TXT_FROM, TXT_TO, t));
    sayA.style.opacity = 1 - clamp((p - .55) / .2, 0, .65);
    const typed = clamp((p - .45) / .4, 0, 1);
    const full = lines[0] + '\n' + lines[1], n = Math.round(full.length * typed);
    sayB.innerHTML = full.slice(0, n).replace('\n', '<br>') + (typed > 0 ? '<span class="cur">&nbsp;</span>' : '');
    document.body.classList.toggle('deep', r.top < -(r.height - innerHeight) * .6);
    if (still) ctx.clearRect(0, 0, cv.width, cv.height);
    return bg;
  }
  function frame() {
    if (!running) return;
    const bg = progress();
    const rain = clamp((p - .08) / .3, 0, 1) * (1 - clamp((p - .88) / .12, 0, .7));
    ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},.16)`;
    ctx.fillRect(0, 0, stage.clientWidth, stage.clientHeight);
    ctx.font = `600 ${fs - 2}px ui-monospace, Consolas, monospace`;
    cols.forEach((y, i) => {
      const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      ctx.fillStyle = Math.random() < .08 ? `rgba(255,107,85,${rain})` : `rgba(61,220,151,${rain * .85})`;
      ctx.fillText(ch, i * fs, y * fs);
      cols[i] = y * fs > stage.clientHeight && Math.random() > .975 ? 0 : y + .5 + p * .5;
    });
    requestAnimationFrame(frame);
  }
  size(); progress();
  addEventListener('resize', size);
  addEventListener('scroll', () => { if (still || !running) progress(); }, { passive: true });
  if (!still) new IntersectionObserver(es => {
    running = es[0].isIntersecting;
    if (running) requestAnimationFrame(frame);
  }).observe(dive);
})();
