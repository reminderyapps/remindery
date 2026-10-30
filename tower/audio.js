// Tower game – soundscape (Web Audio). Follows the camera like SimTower:
//   1. carpet by time of day (morning birds, day traffic, evening, night crickets + hum), cross-faded,
//   2. room layers by visible area (office, condo, restaurant, lobby), only occupied rooms, quieter at night,
//      zoomed out = carpet only,
//   3. events only when in view (elevator door gong, move-in, move-out), star + day summary always,
//      build / demolish / error / menu clicks.
//   Depth run (TOWER-a0006): layers for workshop, café, daycare, supermarket, gym; events breakdown,
//   emergency, upgrade (always audible), repairStart, repairDone, downgrade, visit {kind} (only in view,
//   at least 0.6 s apart per type). All synthesized, no new sample files.
// Hooks into the game: game.onEvent (engine.js), TowerAudio.frame(...) once per frame and
// TowerAudio.menuHtml() in the menu (index.html). Build, demolish and their errors are picked up by
// wrapping Game.prototype methods below, so tap() in index.html needs no changes.
// Samples (Kenney, CC0) come base64-embedded from sounds.js (file:// blocks fetch); everything else is synthesized.
(function () {
  'use strict';
  const PREF_KEY = 'tower-game-audio-v1';
  const MAX_VOICES = 28;   // simultaneous one-shot voices overall
  const AMB_VOICES = 18;   // carpet and room grains may use at most this many, events keep headroom
  const LAYERS = ['office', 'condo', 'restaurant', 'lobby', 'workshop', 'cafe', 'daycare', 'supermarket', 'gym'];
  const zeroLayers = () => Object.fromEntries(LAYERS.map(k => [k, 0]));
  const TODS = ['morning', 'day', 'evening', 'night'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const Engine = window.TowerEngine || {};

  // ---------- preferences ----------
  let prefs = { vol: 0.7, muted: false };
  try {
    const s = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (s && typeof s.vol === 'number') prefs = { vol: clamp(s.vol, 0, 1), muted: !!s.muted };
  } catch (e) { /* storage blocked */ }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } }
  const masterLevel = () => prefs.muted ? 0 : prefs.vol * prefs.vol;

  // ---------- state ----------
  let ac = null, offline = false;
  let master, busCarpet, busLayer, busSfx, reverbIn, city, cityLP, hum, officeBed;
  const layerOut = {};
  const samples = {};
  let white = null, brown = null;
  let voices = 0;
  let rect = null, zoomF = 0;
  let attached = null;
  let preview = null;                // { kind: 'carpet'|'layer', name, until }
  let lastTick = 0, updAcc = 1;
  const rates = {};                  // grain name -> per second
  const busyHold = {};               // floor -> smoothed number of people walking/waiting
  const lvl = Object.assign({ carpet: 1 }, zeroLayers());
  const last = { door: 0, movein: 0, moveout: 0 };   // event key -> audio time it last played (more keys added on the fly)
  const stats = { door: 0, doorPlayed: 0, movein: 0, moveinPlayed: 0, moveout: 0, moveoutPlayed: 0, star: 0, day: 0, build: 0, demolish: 0, error: 0, click: 0, dropped: 0 };
  const DEPTH_EVENTS = ['breakdown', 'emergency', 'upgrade', 'downgrade', 'repairStart', 'repairDone', 'visit'];
  for (const k of DEPTH_EVENTS) { stats[k] = 0; stats[k + 'Played'] = 0; }

  // ---------- graph ----------
  function gainNode(v, dest) { const g = ac.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
  function filter(type, f, q, dest) { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; if (dest) n.connect(dest); return n; }
  function panned(dest, pan) {
    if (!pan || !ac.createStereoPanner) return dest;
    const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(dest); return p;
  }
  function noiseBuf(kind, secs) {
    const n = Math.floor(ac.sampleRate * secs), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    let lastV = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { lastV = (lastV + 0.02 * w) / 1.02; d[i] = lastV * 3.5; } else d[i] = w;
    }
    return b;
  }
  function impulse(secs, decay) {
    const n = Math.floor(ac.sampleRate * secs), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function loopSrc(buf, dest) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(); return s; }

  function build(context) {
    ac = context;
    master = gainNode(offline ? 1 : masterLevel());
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ac.destination);
    busCarpet = gainNode(1, master); busLayer = gainNode(1, master); busSfx = gainNode(1, master);
    const conv = ac.createConvolver(); conv.buffer = impulse(1.8, 3); conv.connect(gainNode(0.6, master));
    reverbIn = gainNode(1, conv);
    white = noiseBuf('white', 2); brown = noiseBuf('brown', 4);
    // carpet beds: city rumble with a slow swell, and a low night hum
    city = gainNode(0, busCarpet);
    const swell = gainNode(1, city);
    cityLP = filter('lowpass', 500, 0.5, swell);
    loopSrc(brown, cityLP);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07; lfo.connect(gainNode(0.3, swell.gain)); lfo.start();
    hum = gainNode(0, busCarpet);
    const humLP = filter('lowpass', 400, 0.7, hum);
    for (const [f, a] of [[98, 1], [147, 0.5], [196, 0.25]]) { const o = ac.createOscillator(); o.frequency.value = f; o.connect(gainNode(a, humLP)); o.start(); }
    for (const t of LAYERS) layerOut[t] = gainNode(0, busLayer);
    layerOut.lobby.connect(reverbIn);
    // office room tone (air conditioning)
    officeBed = gainNode(0.03, layerOut.office);
    loopSrc(white, filter('bandpass', 900, 0.7, officeBed));
    return decodeSamples();
  }

  function decodeSamples() {
    const src = window.TowerSounds || {};
    return Promise.all(Object.keys(src).map(name => new Promise(res => {
      try {
        const bin = atob(src[name]), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const p = ac.decodeAudioData(u.buffer, b => { samples[name] = b; res(); }, () => res());
        if (p && p.catch) p.catch(() => res());
      } catch (e) { res(); }
    })));
  }

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { build(new AC()); } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended' && !document.hidden) { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
  }
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (!ac || offline) return;
    const p = document.hidden ? ac.suspend() : ac.resume();
    if (p && p.catch) p.catch(() => {});
  });
  const running = () => ac && (offline || ac.state === 'running');

  // ---------- voices ----------
  function claim(amb) {
    if (offline) return true;
    if (voices >= (amb ? AMB_VOICES : MAX_VOICES)) { stats.dropped++; return false; }
    voices++; return true;
  }
  function own(src) {
    if (offline) return;
    if (!src) { voices = Math.max(0, voices - 1); return; }
    let done = false;
    src.onended = () => { if (!done) { done = true; voices = Math.max(0, voices - 1); } };
  }

  // ---------- synth building blocks ----------
  function env(param, t, a, peak, d) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    param.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(dest, f, t, a, d, peak, type, f2) {
    const o = ac.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const g = ac.createGain(); env(g.gain, t, a, peak, d);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function burst(dest, t, a, d, peak, ftype, f, q, buf) {
    const s = ac.createBufferSource(); s.buffer = buf || white;
    const flt = filter(ftype, f, q);
    const g = ac.createGain(); env(g.gain, t, a, peak, d);
    s.connect(flt); flt.connect(g); g.connect(dest);
    s.start(t, Math.random() * Math.max(0, s.buffer.duration - a - d - 0.1)); s.stop(t + a + d + 0.05);
    return { s, flt, g };
  }
  // bell / chime: partials as [ratio, amp, decay factor]; returns the longest-ringing oscillator
  function bell(dest, f, t, peak, d, partials) {
    let first = null;
    for (const [r, a, k] of partials || [[1, 1, 1], [2.0, 0.3, 0.55], [3.0, 0.1, 0.35], [4.16, 0.05, 0.25]]) {
      const o = tone(dest, f * r, t, 0.003, d * k, peak * a);
      if (!first) first = o;
    }
    return first;
  }
  function sample(name, dest, t, gain, rate) {
    const b = samples[name]; if (!b) return null;
    const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = rate || 1;
    s.connect(gainNode(gain, dest)); s.start(t);
    return s;
  }
  // muffled speech: a sawtooth voice through two formant filters, syllable by syllable
  const VOWELS = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [440, 1020], [660, 1720], [390, 1990]];
  const KID_VOWELS = [[600, 2700], [500, 2900], [800, 2400]];
  function murmur(dest, t, peak, o) {
    const osc = ac.createOscillator(); osc.type = 'sawtooth';
    const f0 = o.f0 * rnd(0.85, 1.15);
    osc.frequency.setValueAtTime(f0, t);
    const lp = filter('lowpass', o.wall || 1400, 0.7, dest);
    const g = gainNode(0, lp); g.gain.setValueAtTime(0, t);
    const f1 = filter('bandpass', 500, 5, g), f2 = filter('bandpass', 1500, 6, g);
    osc.connect(f1); osc.connect(f2);
    const n = o.n || 4 + ((Math.random() * 9) | 0), vow = o.vowels || VOWELS;
    let tt = t;
    for (let i = 0; i < n; i++) {
      const d = rnd(o.syl ? o.syl[0] : 0.07, o.syl ? o.syl[1] : 0.2), v = pick(vow);
      f1.frequency.setValueAtTime(v[0], tt); f2.frequency.setValueAtTime(v[1], tt);
      osc.frequency.linearRampToValueAtTime(f0 * (o.fall ? 1 - 0.06 * i : rnd(0.85, 1.2)), tt + d);
      g.gain.setTargetAtTime(peak, tt, 0.012); g.gain.setTargetAtTime(0, tt + d, 0.025);
      tt += d + (o.gap ? rnd(o.gap[0], o.gap[1]) : Math.random() < 0.15 ? rnd(0.2, 0.45) : rnd(0.03, 0.09));
    }
    osc.start(t); osc.stop(tt + 0.2);
    return osc;
  }

  // ---------- grains (carpet + room layers) ----------
  const GRAINS = {
    // carpet
    bird(dest, t) {
      const p = panned(dest, rnd(-0.8, 0.8)), low = Math.random() < 0.3;
      let tt = t, o = null;
      const base = low ? rnd(1700, 2800) : rnd(2800, 4800), n = 2 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const d = rnd(0.04, 0.1), f = base * rnd(0.9, 1.1);
        o = tone(p, f, tt, 0.008, d, rnd(0.02, 0.04), 'sine', f * rnd(0.6, 1.5));
        tt += d + rnd(0.03, 0.12);
      }
      return o;
    },
    cricket(dest, t) {
      const p = panned(dest, rnd(-0.7, 0.7)), f = rnd(4000, 4700);
      let o = null;
      const chirps = 1 + ((Math.random() * 3) | 0);
      for (let c = 0; c < chirps; c++) for (let i = 0; i < 4; i++) o = tone(p, f, t + c * rnd(0.25, 0.35) + i * 0.03, 0.002, 0.014, 0.012);
      return o;
    },
    traffic(dest, t) {
      const d = rnd(2.5, 5), pan = Math.random() < 0.5 ? -1 : 1;
      let p = dest;
      if (ac.createStereoPanner) {
        p = ac.createStereoPanner(); p.connect(dest);
        p.pan.setValueAtTime(-0.8 * pan, t); p.pan.linearRampToValueAtTime(0.8 * pan, t + d);
      }
      const s = ac.createBufferSource(); s.buffer = brown; s.loop = true;
      const lp = filter('lowpass', 250, 0.8);
      lp.frequency.setValueAtTime(250, t); lp.frequency.linearRampToValueAtTime(rnd(700, 1100), t + d * 0.5); lp.frequency.linearRampToValueAtTime(220, t + d);
      const g = gainNode(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rnd(0.07, 0.13), t + d * 0.5); g.gain.linearRampToValueAtTime(0, t + d);
      s.connect(lp); lp.connect(g); g.connect(p);
      s.start(t, Math.random() * 2); s.stop(t + d + 0.05);
      return s;
    },
    // office
    typing(dest, t) {
      const p = panned(dest, rnd(-0.6, 0.6)), n = 3 + ((Math.random() * 9) | 0);
      let tt = t, last = null;
      for (let i = 0; i < n; i++) {
        last = burst(p, tt, 0.001, rnd(0.012, 0.025), rnd(0.3, 0.55), 'bandpass', rnd(1800, 3800), 1.4).s;
        tt += Math.random() < 0.1 ? rnd(0.25, 0.4) : rnd(0.07, 0.15);
      }
      return last;
    },
    phone(dest, t) {
      const p = panned(dest, rnd(-0.6, 0.6));
      const o = ac.createOscillator(); o.frequency.value = 1150;
      const trill = ac.createOscillator(); trill.type = 'square'; trill.frequency.value = 16; trill.connect(gainNode(110, o.frequency));
      const g = gainNode(0, filter('lowpass', 2200, 0.7, p)); g.gain.setValueAtTime(0, t);
      for (const s of [0, 1.1]) { g.gain.setTargetAtTime(0.03, t + s, 0.01); g.gain.setTargetAtTime(0, t + s + 0.7, 0.02); }
      o.connect(g); o.start(t); trill.start(t); o.stop(t + 2); trill.stop(t + 2);
      return o;
    },
    // condo
    tv(dest, t) { return murmur(panned(dest, rnd(-0.5, 0.5)), t, 0.25, { f0: rnd(100, 210), wall: 1100 }); },
    kids(dest, t) {
      return murmur(panned(dest, rnd(-0.6, 0.6)), t, 0.14, { f0: rnd(330, 420), wall: 1800, vowels: KID_VOWELS, n: 3 + ((Math.random() * 4) | 0), syl: [0.05, 0.09], gap: [0.04, 0.08], fall: true });
    },
    // restaurant
    chatter(dest, t) { return murmur(panned(dest, rnd(-0.7, 0.7)), t, 0.14, { f0: rnd(95, 230), wall: 2200 }); },
    clink(dest, t) {
      const p = panned(dest, rnd(-0.7, 0.7)), f = rnd(1800, 3400);
      const o = bell(p, f, t, rnd(0.02, 0.04), rnd(0.15, 0.3), [[1, 1, 1], [2.32, 0.5, 0.6], [4.25, 0.25, 0.3]]);
      if (Math.random() < 0.35) bell(p, f * rnd(1.05, 1.3), t + rnd(0.05, 0.12), 0.03, 0.2, [[1, 1, 1], [2.32, 0.4, 0.5]]);
      return o;
    },
    cutlery(dest, t) { return burst(panned(dest, rnd(-0.7, 0.7)), t, 0.001, 0.03, rnd(0.05, 0.1), 'highpass', 5000, 0.7).s; },
    // lobby
    steps(dest, t) {
      const n = 3 + ((Math.random() * 4) | 0), gap = rnd(0.42, 0.55);
      let pan = rnd(-0.8, 0.8), last = null;
      const dir = pan > 0 ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const p = panned(dest, pan), tt = t + i * gap;
        last = sample('step_' + ((Math.random() * 5) | 0), p, tt, rnd(0.12, 0.2), rnd(0.85, 1.1)) ||
          burst(p, tt, 0.002, 0.05, 0.15, 'lowpass', 600, 0.7).s;
        pan += dir * 0.15;
      }
      return last;
    },
    lobbyTalk(dest, t) { return murmur(panned(dest, rnd(-0.7, 0.7)), t, 0.18, { f0: rnd(95, 230), wall: 2400 }); },
    // workshop: hammer taps on metal, now and then a drill
    hammer(dest, t) {
      const p = panned(dest, rnd(-0.6, 0.6)), n = 2 + ((Math.random() * 3) | 0), f = rnd(1700, 2500), gap = rnd(0.28, 0.4);
      let o = null;
      for (let i = 0; i < n; i++) {
        burst(p, t + i * gap, 0.001, 0.04, 0.35, 'lowpass', 900, 0.7, brown);
        o = bell(p, f * rnd(0.98, 1.02), t + i * gap, 0.05, 0.09, [[1, 1, 1], [2.76, 0.5, 0.5], [5.4, 0.25, 0.3]]);
      }
      return o;
    },
    drill(dest, t) {
      const p = panned(dest, rnd(-0.6, 0.6)), d = rnd(0.6, 1.4), f = rnd(170, 210);
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.6, t); o.frequency.linearRampToValueAtTime(f, t + 0.15); o.frequency.setValueAtTime(f, t + d - 0.1); o.frequency.linearRampToValueAtTime(f * 0.5, t + d + 0.1);
      const g = gainNode(0, filter('bandpass', 1300, 1.2, p)); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.12); g.gain.setValueAtTime(0.06, t + d - 0.1); g.gain.linearRampToValueAtTime(0, t + d + 0.1);
      o.connect(g); o.start(t); o.stop(t + d + 0.15);
      return o;
    },
    // café: talk, cups on saucers, the milk steamer
    cafeTalk(dest, t) { return murmur(panned(dest, rnd(-0.6, 0.6)), t, 0.11, { f0: rnd(110, 240), wall: 2000 }); },
    cup(dest, t) {
      const p = panned(dest, rnd(-0.6, 0.6)), f = rnd(1500, 2300);
      const o = bell(p, f, t, rnd(0.015, 0.03), rnd(0.1, 0.18), [[1, 1, 1], [2.7, 0.45, 0.5]]);
      if (Math.random() < 0.4) bell(p, f * rnd(1.1, 1.25), t + rnd(0.04, 0.09), 0.015, 0.12, [[1, 1, 1], [2.7, 0.4, 0.5]]);
      return o;
    },
    steam(dest, t) {
      const d = rnd(1.2, 1.7), b = burst(panned(dest, rnd(-0.5, 0.5)), t, 0.2, d, 0.03, 'bandpass', 3200, 0.9);
      b.flt.frequency.setValueAtTime(3200, t); b.flt.frequency.linearRampToValueAtTime(5200, t + d);
      return b.s;
    },
    // daycare: children playing, a toy xylophone
    kidsPlay(dest, t) {
      return murmur(panned(dest, rnd(-0.7, 0.7)), t, 0.12, { f0: rnd(300, 440), wall: 1900, vowels: KID_VOWELS, n: 2 + ((Math.random() * 5) | 0), syl: [0.05, 0.11], gap: [0.03, 0.1], fall: Math.random() < 0.5 });
    },
    toy(dest, t) {
      const p = panned(dest, rnd(-0.6, 0.6)), n = 1 + ((Math.random() * 3) | 0);
      let o = null;
      for (let i = 0; i < n; i++) o = tone(p, NOTE(pick([84, 86, 88, 91, 93])), t + i * rnd(0.18, 0.3), 0.002, 0.22, 0.025, 'triangle');
      return o;
    },
    // supermarket: scanner beeps at the till, trolleys, quiet talk
    scan(dest, t) { return tone(filter('lowpass', 3000, 0.7, panned(dest, rnd(-0.5, 0.5))), 1760, t, 0.003, 0.07, 0.018, 'square'); },
    trolley(dest, t) {
      const d = rnd(1, 2), p = panned(dest, rnd(-0.7, 0.7));
      const b = burst(p, t, 0.15, d, 0.035, 'bandpass', rnd(700, 1100), 1.5, brown);
      const am = ac.createOscillator(); am.frequency.value = rnd(14, 20);
      const depth = gainNode(0.025, b.g.gain); am.connect(depth); am.start(t); am.stop(t + d + 0.2);
      return b.s;
    },
    shopTalk(dest, t) { return murmur(panned(dest, rnd(-0.7, 0.7)), t, 0.08, { f0: rnd(100, 230), wall: 1800 }); },
    // gym: steady footfalls on a treadmill, weights set down
    treadmill(dest, t) {
      const p = panned(dest, rnd(-0.5, 0.5)), n = 5 + ((Math.random() * 4) | 0), gap = rnd(0.36, 0.42);
      let s = null;
      for (let i = 0; i < n; i++) s = burst(p, t + i * gap, 0.002, 0.06, 0.22, 'lowpass', 220, 0.8, brown).s;
      return s;
    },
    clank(dest, t) {
      const p = panned(dest, rnd(-0.6, 0.6));
      burst(p, t, 0.002, 0.08, 0.15, 'lowpass', 180, 0.7, brown);
      return bell(p, rnd(480, 620), t, 0.05, 0.3, [[1, 1, 1], [2.76, 0.6, 0.5], [5.4, 0.3, 0.3]]);
    },
  };
  // grain -> which output and which level drives its rate
  const GRAIN_SRC = {
    bird: 'carpet', cricket: 'carpet', traffic: 'carpet',
    typing: 'office', phone: 'office', tv: 'condo', kids: 'condo',
    chatter: 'restaurant', clink: 'restaurant', cutlery: 'restaurant', steps: 'lobby', lobbyTalk: 'lobby',
    hammer: 'workshop', drill: 'workshop', cafeTalk: 'cafe', cup: 'cafe', steam: 'cafe', kidsPlay: 'daycare', toy: 'daycare',
    scan: 'supermarket', trolley: 'supermarket', shopTalk: 'supermarket', treadmill: 'gym', clank: 'gym',
  };
  // per second at full level
  const LAYER_RATE = { typing: 2.4, phone: 0.05, tv: 0.9, kids: 0.07, chatter: 3.2, clink: 2.2, cutlery: 1.5, steps: 1.3, lobbyTalk: 0.5,
    hammer: 0.7, drill: 0.07, cafeTalk: 1.8, cup: 1.2, steam: 0.05, kidsPlay: 1.4, toy: 0.25,
    scan: 0.6, trolley: 0.15, shopTalk: 0.9, treadmill: 0.3, clank: 0.35 };

  function spawn(name, t) {
    if (!claim(true)) return;
    const src = GRAIN_SRC[name], dest = src === 'carpet' ? busCarpet : layerOut[src];
    let s = null;
    try { s = GRAINS[name](dest, t); } catch (e) { s = null; }
    own(s);
  }
  function tickGrains(now, dt) {
    for (const name in GRAINS) {
      const r = rates[name] || 0;
      if (r > 0 && Math.random() < r * dt) spawn(name, now + 0.05 + Math.random() * dt);
    }
  }

  // ---------- mixing ----------
  // trapezoid weight: 0 before a, ramps to 1 at b, 1 until c, ramps to 0 at d (hours, may wrap)
  function trap(h, a, b, c, d) {
    if (h >= b && h <= c) return 1;
    if (h > a && h < b) return (h - a) / (b - a);
    if (h > c && h < d) return 1 - (h - c) / (d - c);
    return 0;
  }
  function todWeights(t) {
    const h = ((t / 3600) % 24 + 24) % 24;
    const w = {
      morning: trap(h, 5, 6, 8, 9.5),
      day: trap(h, 8, 9.5, 16.5, 18),
      evening: trap(h, 16.5, 18, 20, 21.5),
      night: Math.max(trap(h, 20, 21.5, 24, 24.01), trap(h, -1, 0, 5, 6)),
    };
    const s = w.morning + w.day + w.evening + w.night || 1;
    for (const k of TODS) w[k] /= s;
    return w;
  }
  const CARPET = {   // per time of day: city gain, city low-pass Hz, hum gain, grain rates per second
    morning: { city: 0.05, lp: 450, hum: 0.004, bird: 1.0, traffic: 0.12, cricket: 0 },
    day:     { city: 0.065, lp: 650, hum: 0.004, bird: 0.25, traffic: 0.3, cricket: 0 },
    evening: { city: 0.05, lp: 420, hum: 0.006, bird: 0.12, traffic: 0.15, cricket: 0.5 },
    night:   { city: 0.025, lp: 260, hum: 0.012, bird: 0, traffic: 0.03, cricket: 2.0 },
  };
  const mixW = (w, key) => TODS.reduce((a, k) => a + w[k] * CARPET[k][key], 0);

  function computeLayers(game) {
    const out = zeroLayers();
    if (!rect) return out;
    const fh = rect.fh, CFG = Engine.CFG || { W: 24, rooms: {} };
    const visFloors = (rect.y1 - rect.y0) / fh;
    zoomF = clamp((40 - visFloors) / (40 - 12), 0, 1);       // ≤ 12 floors in view: full, ≥ 40: carpet only
    if (zoomF <= 0) return out;
    const viewArea = Math.max(1e-6, (rect.x1 - rect.x0) * visFloors);
    const visF = f => Math.max(0, Math.min(-f * fh, rect.y1) - Math.max(-(f + 1) * fh, rect.y0)) / fh;
    const visX = (x, w) => Math.max(0, Math.min(x + w, rect.x1) - Math.max(x, rect.x0));
    // people walking or waiting per floor = lobby activity
    const busy = {};
    for (const p of game.persons || []) if ((p.state === 'walk' || p.state === 'wait') && typeof p.f === 'number') busy[p.f] = (busy[p.f] || 0) + 1;
    // hold the count for a few seconds so the lobby does not flicker with single passers-by
    for (const f in busy) busyHold[f] = Math.max(busy[f], busyHold[f] || 0);
    for (const f in busyHold) { if (!busy[f]) busyHold[f] *= 0.97; if (busyHold[f] < 0.3) delete busyHold[f]; }
    const lobbyAct = f => busyHold[f] ? 0.3 + 0.7 * Math.min(1, busyHold[f] / 10) : 0;
    const acc = zeroLayers();
    for (const r of game.rooms || []) {
      const a = visF(r.f) * visX(r.x, r.w); if (!a) continue;
      if (r.type === 'skylobby') { acc.lobby += a * lobbyAct(r.f); continue; }
      if (acc[r.type] == null) continue;
      const def = CFG.rooms[r.type] || {}, cap = def.seats || def.cap || 1;
      if (r.inside > 0) acc[r.type] += a * (0.4 + 0.6 * Math.min(1, r.inside / cap));   // empty rooms stay silent
    }
    acc.lobby += visF(0) * visX(0, CFG.W) * lobbyAct(0);
    for (const k of LAYERS) out[k] = Math.min(1, 1.6 * Math.sqrt(acc[k] / viewArea)) * zoomF;
    return out;
  }

  function setP(param, v, tau) { param.setTargetAtTime(v, ac.currentTime, tau || 0.6); }
  function updateMix(game) {
    let w, layers, carpet;
    if (preview && ac.currentTime > preview.until) preview = null;
    if (preview) {
      w = { morning: 0, day: 0, evening: 0, night: 0 };
      layers = zeroLayers();
      if (preview.kind === 'carpet') { w[preview.name] = 1; carpet = 1; }
      else { w.day = 1; layers[preview.name] = 1; carpet = 0.3; }
    } else {
      w = todWeights(game.t);
      layers = computeLayers(game);
      const nightF = 1 - 0.55 * w.night - 0.2 * w.evening;
      for (const k of LAYERS) layers[k] *= nightF;
      carpet = 1 - 0.35 * zoomF;
    }
    const tau = preview ? 0.25 : 0.8;
    setP(city.gain, carpet * mixW(w, 'city'), tau);
    setP(cityLP.frequency, mixW(w, 'lp'), tau);
    setP(hum.gain, carpet * mixW(w, 'hum'), tau);
    for (const g of ['bird', 'traffic', 'cricket']) rates[g] = carpet * mixW(w, g);
    for (const k of LAYERS) { setP(layerOut[k].gain, layers[k], tau); lvl[k] = layers[k]; }
    lvl.carpet = carpet; lvl.w = w;
    for (const g in LAYER_RATE) { const L = layers[GRAIN_SRC[g]]; rates[g] = L > 0.02 ? LAYER_RATE[g] * (0.3 + 0.7 * L) : 0; }
  }

  // ---------- events ----------
  // returns pan (-1..1) if (x, floor) is in view, else null
  function inView(x, f) {
    if (!rect) return null;
    const top = -(f + 1) * rect.fh, bot = -f * rect.fh;
    if (bot < rect.y0 || top > rect.y1 || x < rect.x0 || x > rect.x1) return null;
    return clamp(((x - rect.x0) / (rect.x1 - rect.x0)) * 2 - 1, -1, 1) * 0.6;
  }
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const SFX = {
    door(t, o) {      // elevator gong, slightly varied pitch; express a fourth lower
      const f = (o.express ? 740 : 988) * Math.pow(2, rnd(-0.5, 0.5) / 12);
      return bell(panned(busSfx, o.pan), f, t, 0.16 * (o.level || 1), 1.1);
    },
    movein(t, o) {
      const p = panned(busSfx, o.pan); let s = null;
      [72, 76, 79].forEach((n, i) => { s = bell(p, NOTE(n), t + i * 0.09, 0.1, 0.45, [[1, 1, 1], [4, 0.12, 0.25]]); });
      return s;
    },
    moveout(t, o) {
      const p = filter('lowpass', 1600, 0.7, panned(busSfx, o.pan)); let s = null;
      [76, 72].forEach((n, i) => { s = tone(p, NOTE(n), t + i * 0.17, 0.01, 0.5, 0.12, 'triangle'); });
      return s;
    },
    star(t) {
      let s = null;
      [72, 76, 79, 84].forEach((n, i) => { s = bell(busSfx, NOTE(n), t + i * 0.11, 0.07, 1.1); });
      for (const n of [84, 88, 91]) s = bell(busSfx, NOTE(n), t + 0.5, 0.035, 1.6);
      return s;
    },
    day(t) {          // cash register: two clicks, then "ka-ching"
      burst(busSfx, t, 0.001, 0.03, 0.2, 'bandpass', 2500, 2);
      burst(busSfx, t + 0.07, 0.001, 0.03, 0.2, 'bandpass', 2000, 2);
      bell(busSfx, 2637, t + 0.14, 0.05, 0.7);
      return bell(busSfx, 3136, t + 0.2, 0.05, 0.9);
    },
    build(t) {
      const a = sample('build_wood_' + ((Math.random() * 3) | 0), busSfx, t, 0.6, rnd(0.95, 1.05));
      sample('build_plank', busSfx, t + 0.02, 0.25, 1);
      return a || tone(busSfx, 160, t, 0.003, 0.15, 0.3, 'sine', 70);
    },
    buildShaft(t) {
      const a = sample('build_metal', busSfx, t, 0.55, rnd(0.95, 1.05));
      sample('build_plank', busSfx, t + 0.03, 0.2, 0.9);
      return a || tone(busSfx, 220, t, 0.003, 0.2, 0.25, 'triangle', 110);
    },
    demolish(t) {     // crash: rubble + metal plate + glass + low rumble
      const a = sample('demolish_rubble', busSfx, t, 0.6, rnd(0.9, 1.05));
      sample('demolish_plate', busSfx, t + 0.03, 0.4, rnd(0.9, 1.05));
      sample('demolish_glass', busSfx, t + 0.09, 0.22, rnd(0.95, 1.1));
      const r = burst(busSfx, t, 0.01, 0.8, 0.5, 'lowpass', 220, 0.7, brown).s;
      return a || r;
    },
    demolishSmall(t) { return sample('demolish_plate', busSfx, t, 0.35, 1.1) || burst(busSfx, t, 0.002, 0.2, 0.3, 'lowpass', 900, 0.7).s; },
    click(t) { return sample('ui_click', busSfx, t, 0.35, 1) || tone(busSfx, 1800, t, 0.001, 0.03, 0.08); },
    toggle(t) { return sample('ui_toggle', busSfx, t, 0.3, 1) || tone(busSfx, 1200, t, 0.001, 0.05, 0.08); },
    error(t) { return sample('ui_error', busSfx, t, 0.35, 1) || tone(busSfx, 220, t, 0.005, 0.18, 0.15, 'square', 180); },
    // ----- depth run: maintenance and tiers -----
    breakdown(t, o) {   // power dies (falling whine), a clunk, a few sparks crackle
      const p = panned(busSfx, o.pan);
      const s = tone(filter('lowpass', 900, 0.7, p), 220, t, 0.01, 0.7, 0.09, 'sawtooth', 50);
      burst(p, t + 0.05, 0.002, 0.25, 0.4, 'lowpass', 300, 0.7, brown);
      for (let i = 0; i < 6; i++) burst(p, t + 0.1 + Math.random() * 0.5, 0.001, rnd(0.008, 0.02), rnd(0.08, 0.16), 'highpass', 4000, 0.8);
      return s;
    },
    emergency(t, o) {   // a distant two-tone horn: help is on the way
      const p = filter('lowpass', 1800, 0.7, panned(busSfx, o.pan)); let s = null;
      for (let i = 0; i < 4; i++) s = tone(p, i % 2 ? 659 : 880, t + i * 0.34, 0.03, 0.29, 0.07, 'triangle');
      return s;
    },
    upgrade(t, o) {     // quick rising sparkle over a soft upward swoosh
      const p = panned(busSfx, o.pan); let s = null;
      const sw = burst(p, t, 0.15, 0.3, 0.05, 'bandpass', 500, 1.2);
      sw.flt.frequency.setValueAtTime(500, t); sw.flt.frequency.exponentialRampToValueAtTime(3200, t + 0.45);
      [79, 83, 86, 91, 95].forEach((n, i) => { s = bell(p, NOTE(n), t + 0.05 + i * 0.06, 0.05, 0.6, [[1, 1, 1], [3, 0.1, 0.3]]); });
      return s;
    },
    downgrade(t, o) {   // warning begins: two low falling notes, soft
      const p = filter('lowpass', 1100, 0.7, panned(busSfx, o.pan)); let s = null;
      [[64, 0], [61, 0.24]].forEach(([n, d]) => { s = tone(p, NOTE(n), t + d, 0.03, 0.4, 0.09, 'triangle'); });
      return s;
    },
    repairStart(t, o) { // ratchet wrench, then a tap on metal
      const p = panned(busSfx, o.pan);
      for (let i = 0; i < 7; i++) burst(p, t + i * 0.045, 0.001, 0.012, 0.22, 'bandpass', 3200, 3);
      return bell(p, 1400, t + 0.4, 0.04, 0.25, [[1, 1, 1], [2.76, 0.5, 0.5]]);
    },
    repairDone(t, o) {  // tool set down, then a short rising fifth
      const p = panned(busSfx, o.pan);
      bell(p, 2300, t, 0.03, 0.15, [[1, 1, 1], [2.76, 0.5, 0.5]]);
      tone(p, NOTE(76), t + 0.14, 0.01, 0.25, 0.07, 'triangle');
      return tone(p, NOTE(83), t + 0.28, 0.01, 0.45, 0.07, 'triangle');
    },
    // ----- depth run: arrivals at a provider (quiet, only in view) -----
    visit_cafe(t, o) {   // cup on a saucer, a puff of steam
      const p = panned(busSfx, o.pan);
      bell(p, 2600, t, 0.055, 0.14, [[1, 1, 1], [2.7, 0.5, 0.5]]);
      bell(p, 2950, t + 0.06, 0.05, 0.16, [[1, 1, 1], [2.7, 0.5, 0.5]]);
      return burst(p, t + 0.1, 0.05, 0.25, 0.02, 'bandpass', 5000, 1).s;
    },
    visit_daycare(t, o) { // two toy xylophone notes
      const p = panned(busSfx, o.pan);
      tone(p, NOTE(84), t, 0.002, 0.2, 0.05, 'triangle');
      return tone(p, NOTE(88), t + 0.13, 0.002, 0.28, 0.05, 'triangle');
    },
    visit_supermarket(t, o) { return tone(filter('lowpass', 3000, 0.7, panned(busSfx, o.pan)), 1760, t, 0.003, 0.09, 0.11, 'square'); },   // scanner beep
    visit_gym(t, o) {    // a dumbbell set down
      const p = panned(busSfx, o.pan);
      burst(p, t, 0.002, 0.1, 0.25, 'lowpass', 160, 0.7, brown);
      return bell(p, 540, t + 0.01, 0.06, 0.35, [[1, 1, 1], [2.76, 0.6, 0.5], [5.4, 0.3, 0.3]]);
    },
    visit_restaurant(t, o) { // plate set on the table, a fork
      const p = panned(busSfx, o.pan);
      burst(p, t, 0.001, 0.05, 0.3, 'bandpass', 1100, 2);
      return bell(p, 4200, t + 0.07, 0.05, 0.12, [[1, 1, 1], [2.3, 0.4, 0.4]]);
    },
  };
  function play(name, o) {
    if (!running() || !SFX[name]) return false;
    if (!claim(false)) return false;
    let s = null;
    try { s = SFX[name](ac.currentTime + 0.01, o || {}); } catch (e) { s = null; }
    own(s);
    return !!s;
  }

  function onGameEvent(type, d) {
    if (stats[type] != null) stats[type]++;
    if (!running() || preview) return;
    const now = ac.currentTime;
    if (type === 'door') {
      const s = d && d.shaft; if (!s) return;
      const pan = inView(s.c + 0.5, d.f); if (pan == null) return;
      const gap = 0.2 + 1.0 * (1 - zoomF);      // further out = rarer gongs
      if (now - last.door < gap) return;
      last.door = now;
      if (play('door', { pan, express: s.kind === 'express', level: 0.5 + 0.5 * zoomF })) stats.doorPlayed++;
    } else if (type === 'movein' || type === 'moveout') {
      const r = d && d.room; if (!r) return;
      const pan = inView(r.x + r.w / 2, r.f); if (pan == null) return;
      if (now - last[type] < 0.6) return;
      last[type] = now;
      if (play(type, { pan })) stats[type + 'Played']++;
    } else if (type === 'star' || type === 'day') play(type);
    else if (type === 'breakdown' || type === 'emergency' || type === 'upgrade') {
      // always audible (panned if in view); bursts like a whole floor upgraded play once
      if (now - (last[type] ?? -1e9) < 0.6) return;
      last[type] = now;
      const pos = where(d), pan = pos ? inView(pos.x, pos.f) : null;
      if (play(type, { pan: pan || 0 })) stats[type + 'Played']++;
    } else if (type === 'repairStart' || type === 'repairDone' || type === 'downgrade' || type === 'visit') {
      const key = type === 'visit' ? 'visit_' + (d && d.kind) : type;
      if (!SFX[key]) return;
      const pos = where(d); if (!pos) return;
      const pan = inView(pos.x, pos.f); if (pan == null) return;
      if (now - (last[key] ?? -1e9) < 0.6) return;
      if (type === 'visit' && now - (last.visit ?? -1e9) < 0.25) return;   // several providers in view: still sparse
      last[key] = now; if (type === 'visit') last.visit = now;
      if (play(key, { pan })) stats[type + 'Played']++;
    }
  }
  // where an event happens: a room ({room}) or a car ({shaft, car}); null if unknown
  function where(d) {
    if (!d) return null;
    if (d.room && typeof d.room.f === 'number') return { x: d.room.x + (d.room.w || 1) / 2, f: d.room.f };
    if (d.shaft && typeof d.shaft.c === 'number') return { x: d.shaft.c + 0.5, f: d.car && typeof d.car.y === 'number' ? Math.round(d.car.y) : d.shaft.f0 };
    return null;
  }

  function attach(game) {
    attached = game;
    if (!game) return;
    const prev = game.onEvent;
    game.onEvent = (t, d) => { if (prev) { try { prev(t, d); } catch (e) { /* ignore */ } } onGameEvent(t, d); };
  }

  // build / demolish / errors: wrap the engine's public actions (no change to tap() needed)
  (function wrapActions() {
    const P = Engine.Game && Engine.Game.prototype; if (!P) return;
    const wrap = (name, ok) => {
      const orig = P[name]; if (typeof orig !== 'function') return;
      P[name] = function () {
        const r = orig.apply(this, arguments);
        try {
          if (this === attached && r && typeof r.ok === 'boolean') {
            stats[!r.ok ? 'error' : ok.startsWith('demolish') ? 'demolish' : 'build']++;
            play(r.ok ? ok : 'error');
          }
        } catch (e) { /* ignore */ }
        return r;
      };
    };
    wrap('buildRoom', 'build'); wrap('buildLink', 'build'); wrap('buildShaft', 'buildShaft'); wrap('addCar', 'buildShaft'); wrap('extendShaft', 'buildShaft');
    wrap('demolishAt', 'demolish'); wrap('removeCar', 'demolishSmall');
  })();

  // ---------- per frame ----------
  function frame(game, view, cssW, cssH, fh) {
    if (game !== attached) attach(game);
    if (view && view.s > 0) rect = { x0: view.x, x1: view.x + cssW / view.s, y0: view.y, y1: view.y + cssH / view.s, fh: fh || 1.6 };
    if (!running() || offline) return;
    const now = performance.now() / 1000, dt = Math.min(0.1, Math.max(0, now - (lastTick || now)));
    lastTick = now;
    updAcc += dt;
    if (updAcc >= 0.1) { updAcc = 0; try { updateMix(game); } catch (e) { /* ignore */ } }
    tickGrains(ac.currentTime, dt);
  }

  // ---------- menu ----------
  const muteLabel = () => prefs.muted ? '🔇 Stumm' : '🔊 Ton an';
  function applyMaster() { if (ac && master && !offline) setP(master.gain, masterLevel(), 0.05); }
  function menuHtml() {
    return `<div class="btnrow"><span title="Lautstärke">🔈</span><input type="range" min="0" max="100" step="1" value="${Math.round(prefs.vol * 100)}" data-snd-vol style="flex:1;min-width:0">` +
      `<button class="btn" data-snd="mute">${muteLabel()}</button></div>` +
      `<div class="btnrow"><button class="btn" data-snd="list">🔊 Klänge anhören</button></div>`;
  }
  const CATALOG = [
    ['Grundteppich (folgt der Uhrzeit)', [['carpet:morning', '🌅 Morgen'], ['carpet:day', '🏙️ Tag'], ['carpet:evening', '🌇 Abend'], ['carpet:night', '🌙 Nacht']]],
    ['Räume (nur was im Bild ist, nur belegte)', [['layer:office', '💼 Büro'], ['layer:condo', '🏠 Wohnung'], ['layer:restaurant', '🍽️ Restaurant'], ['layer:lobby', '🛋️ Lobby'],
      ['layer:workshop', '🔧 Werkstatt'], ['layer:cafe', '☕ Café'], ['layer:daycare', '🧸 Kita'], ['layer:supermarket', '🛒 Supermarkt'], ['layer:gym', '🏋️ Fitness']]],
    ['Ereignisse (nur im Bild)', [['sfx:door', '🛗 Aufzugstür'], ['sfx:movein', '🙂 Neue Mieter'], ['sfx:moveout', '🚚 Auszug'], ['sfx:star', '★ Neuer Stern'], ['sfx:day', '💰 Tagesabrechnung']]],
    ['Wartung und Stufen (Panne, Notdienst, Aufwertung immer hörbar)', [['sfx:breakdown', '⚠️ Panne'], ['sfx:emergency', '🚨 Notdienst gerufen'], ['sfx:repairStart', '🔧 Reparatur beginnt'],
      ['sfx:repairDone', '✅ Reparatur fertig'], ['sfx:upgrade', '▲ Aufwertung'], ['sfx:downgrade', '▼ Warnung beginnt']]],
    ['Besuche (nur im Bild)', [['sfx:visit_cafe', '☕ Café'], ['sfx:visit_daycare', '🧸 Kita'], ['sfx:visit_supermarket', '🛒 Supermarkt'], ['sfx:visit_gym', '🏋️ Fitness'], ['sfx:visit_restaurant', '🍽️ Restaurant']]],
    ['Bauen und Menü', [['sfx:build', '🔨 Bauen'], ['sfx:buildShaft', '🛗 Aufzug / Kabine'], ['sfx:demolish', '🧨 Abriss'], ['sfx:demolishSmall', '➖ Kabine weg'], ['sfx:click', '👆 Klick'], ['sfx:toggle', '🔁 Umschalter'], ['sfx:error', '⛔ Fehler']]],
  ];
  function listHtml() {
    let h = `<h3>Klänge anhören<button class="close" data-act="close">✕</button></h3>
      <p>Teppich und Räume laufen 8 Sekunden. Im Spiel mischt sich alles nach Uhrzeit und Kamera.</p>`;
    for (const [title, items] of CATALOG) {
      h += `<p><b>${title}</b></p><div class="btnrow" style="flex-wrap:wrap">` +
        items.map(([id, lb]) => `<button class="btn" data-snd-play="${id}">${lb}</button>`).join('') + '</div>';
    }
    h += `<div class="btnrow"><button class="btn" data-snd="stop">■ Stopp</button><button class="btn" data-snd="menu">← Menü</button></div>`;
    return h;
  }
  function previewPlay(id) {
    unlock();
    if (!ac) return;
    if (prefs.muted) { prefs.muted = false; savePrefs(); applyMaster(); }
    const [kind, name] = id.split(':');
    if (kind === 'sfx') { const keep = preview; preview = null; play(name, {}); preview = keep; return; }
    preview = { kind, name, until: ac.currentTime + 8 };
    updAcc = 1;
  }
  document.addEventListener('input', e => {
    const el = e.target;
    if (!el || !el.matches || !el.matches('[data-snd-vol]')) return;
    prefs.vol = clamp(el.value / 100, 0, 1);
    if (prefs.muted) { prefs.muted = false; const b = document.querySelector('[data-snd="mute"]'); if (b) b.textContent = muteLabel(); }
    applyMaster(); savePrefs();
  });
  document.addEventListener('change', e => { if (e.target && e.target.matches && e.target.matches('[data-snd-vol]')) play('click'); });
  document.addEventListener('click', e => {
    if (!e.target || !e.target.closest) return;
    const sp = e.target.closest('[data-snd-play]');
    if (sp) { previewPlay(sp.dataset.sndPlay); return; }
    const sb = e.target.closest('[data-snd]');
    if (sb) {
      const a = sb.dataset.snd;
      if (a === 'mute') { prefs.muted = !prefs.muted; savePrefs(); applyMaster(); sb.textContent = muteLabel(); if (!prefs.muted) play('toggle'); }
      else if (a === 'list') { play('click'); if (typeof window.openPanel === 'function') window.openPanel(listHtml(), 'sound'); }
      else if (a === 'menu') { play('click'); preview = null; if (typeof window.openMenu === 'function') window.openMenu(); }
      else if (a === 'stop') { preview = null; updAcc = 1; play('click'); }
      return;
    }
    const b = e.target.closest('button, .chip');
    if (!b) return;
    if (b.dataset.act === 'addcar' || b.dataset.act === 'delcar' || b.dataset.act === 'extend') return;   // own sound via addCar/removeCar/extendShaft
    stats.click++;
    play(b.classList.contains('dis') ? 'error' : b.classList.contains('toggle') ? 'toggle' : 'click');
  });

  // ---------- diagnostics (headless smoke test) ----------
  // render one catalog entry offline and measure it: { rms, peak } in dBFS
  async function renderOffline(id, secs) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const live = { ac, master, busCarpet, busLayer, busSfx, reverbIn, city, cityLP, hum, officeBed, preview, white, brown, zoomF };
    const liveLayers = Object.assign({}, layerOut), liveRates = Object.assign({}, rates);
    offline = true;
    try {
      await build(new OAC(2, Math.floor(44100 * secs), 44100));
      const [kind, name] = id.split(':');
      if (kind === 'sfx') { play(name, {}); for (const k in rates) rates[k] = 0; updateMixFixed({ day: 1 }, {}, 0); }
      else {
        preview = { kind, name, until: 1e9 };
        updateMix({ t: 12 * 3600, rooms: [], persons: [] });
        for (let t = 0; t < secs - 0.5; t += 0.05) tickGrains(t, 0.05);
      }
      const buf = await ac.startRendering();
      let sum = 0, peak = 0, n = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); sum += v * v; if (v > peak) peak = v; n++; } }
      const db = v => v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : -999;
      return { rms: db(Math.sqrt(sum / n)), peak: db(peak) };
    } finally {
      offline = false;
      ({ ac, master, busCarpet, busLayer, busSfx, reverbIn, city, cityLP, hum, officeBed, preview, white, brown, zoomF } = live);
      Object.assign(layerOut, liveLayers); Object.assign(rates, liveRates);
    }
  }
  function updateMixFixed(w, layers, carpet) {
    const ww = Object.assign({ morning: 0, day: 0, evening: 0, night: 0 }, w);
    setP(city.gain, carpet * mixW(ww, 'city')); setP(hum.gain, carpet * mixW(ww, 'hum'));
    for (const k of LAYERS) setP(layerOut[k].gain, layers[k] || 0);
  }

  window.TowerAudio = {
    frame, menuHtml, play, unlock,
    debug: {
      state: () => ({ ctx: ac ? ac.state : 'none', voices, zoomF: Math.round(zoomF * 100) / 100, lvl: JSON.parse(JSON.stringify(lvl, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v)), rates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, Math.round(v * 100) / 100])), stats: Object.assign({}, stats), samples: Object.keys(samples).length, prefs: Object.assign({}, prefs) }),
      renderOffline, catalog: () => CATALOG.flatMap(c => c[1].map(i => i[0])),
    },
  };
})();
