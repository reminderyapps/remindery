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
})();
