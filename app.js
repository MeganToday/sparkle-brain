(() => {
  'use strict';

  // ---------------- settings ----------------
  const SECRET_CODE = '0406';
  const SECTION_ROUND = 10;       // questions per round for a single section
  const MIX_ROUND = 15;           // questions per round for the mixes
  const WRONG_LOCK_MS = 3000;     // minimum wait after a wrong answer
  const NEXT_DELAY_MS = 3000;     // minimum wait after a right answer before moving on
  const AFTER_REASON_MS = 1000;   // pause after the "Yes, ..." reason finishes reading
  const CHEERS = ['Yes! Good job!', 'Yes! You got it!', 'Yes! Way to keep trying!', 'Yes! Great thinking!',
    'Yes! You figured it out!', 'Yes! Super job!'];

  const SECTIONS = window.SECTIONS || [];
  const QUESTIONS = window.QUESTIONS || [];
  const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
  const BIG3 = SECTIONS.filter((s) => s.big).map((s) => s.id);
  const MIXES = [
    { id: 'mix-big3', name: 'Big 3 Mix', icon: '🌟', sections: BIG3, count: MIX_ROUND,
      blurb: SECTIONS.filter((s) => s.big).map((s) => s.name).join(' · ') },
    { id: 'mix-all', name: 'Everything Mix', icon: '🌈', sections: SECTIONS.map((s) => s.id), count: MIX_ROUND,
      blurb: `All ${SECTIONS.length} kinds of questions` },
  ];

  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }

  // ---------------- background sparkles ----------------
  (function makeSparkles() {
    const box = $('#sparkles');
    const glyphs = ['✦', '✧', '✦', '·', '✶'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.textContent = glyphs[i % glyphs.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.fontSize = 10 + Math.random() * 22 + 'px';
      s.style.setProperty('--d', 2 + Math.random() * 3 + 's');
      s.style.setProperty('--delay', Math.random() * 4 + 's');
      s.style.setProperty('--fd', 10 + Math.random() * 10 + 's');
      box.appendChild(s);
    }
  })();

  // ---------------- sounds (Web Audio, no files) ----------------
  let actx = null;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, start, dur, { type = 'sine', gain = 0.18, glideTo = null } = {}) {
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    pencil() {
      const ctx = audio(); if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * 0.22);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / 90));
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      src.connect(f).connect(g).connect(ctx.destination);
      src.start(t);
    },
    correct() {
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, 0.05 + i * 0.09, 0.35, { type: 'triangle', gain: 0.16 }));
      [2637, 3136, 3520].forEach((f, i) => tone(f, 0.45 + i * 0.06, 0.25, { type: 'sine', gain: 0.06 }));
    },
    wrong() {
      tone(330, 0.02, 0.22, { type: 'sine', gain: 0.22, glideTo: 290 });
      tone(247, 0.24, 0.38, { type: 'sine', gain: 0.22, glideTo: 196 });
    },
    key() { tone(880, 0, 0.08, { type: 'sine', gain: 0.08 }); },
    fanfare() {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        tone(f, i * 0.12, i === 6 ? 0.7 : 0.2, { type: 'triangle', gain: 0.16 }));
    },
  };

  // ---------------- read aloud (iPad's built-in voice) ----------------
  const synth = window.speechSynthesis;
  let voice = null;
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    const prefer = ['Samantha', 'Ava', 'Allison', 'Susan', 'Karen', 'Moira', 'Google US English'];
    for (const name of prefer) {
      const v = vs.find((x) => x.name.includes(name) && x.lang.startsWith('en'));
      if (v) { voice = v; return; }
    }
    voice = vs.find((x) => x.lang === 'en-US') || vs.find((x) => x.lang.startsWith('en')) || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  function stopSpeaking() { if (synth) synth.cancel(); }
  // resolves when speech finishes (or after a safety timeout)
  function speak(text) {
    return new Promise((resolve) => {
      if (!synth || !text) return resolve();
      stopSpeaking();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = 'en-US';
      u.rate = 0.88;
      u.pitch = 1.1;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      setTimeout(finish, 2500 + text.length * 85);
      synth.speak(u);
    });
  }
  // iOS only allows speech/audio after a tap — call this inside a tap handler
  function unlockMedia() {
    audio();
    if (synth) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    }
  }

  // ---------------- lock screen ----------------
  let entered = '';
  const dots = document.querySelectorAll('.code-dots span');
  function renderDots() { dots.forEach((d, i) => d.classList.toggle('on', i < entered.length)); }
  document.querySelectorAll('.keypad button').forEach((b) => {
    b.addEventListener('click', () => {
      unlockMedia();
      sfx.key();
      const k = b.dataset.k;
      if (k === 'del') entered = entered.slice(0, -1);
      else if (entered.length < 4) entered += k;
      renderDots();
      if (entered.length === 4) {
        if (entered === SECRET_CODE) {
          setTimeout(() => { sfx.correct(); show('screen-home'); }, 200);
        } else {
          const box = $('.code-dots');
          box.classList.add('bad');
          sfx.wrong();
          setTimeout(() => { box.classList.remove('bad'); entered = ''; renderDots(); }, 600);
        }
      }
    });
  });

  // ---------------- home ----------------
  const countFor = (ids) => QUESTIONS.filter((q) => ids.includes(q.sec)).length;
  function tile({ icon, name, sub, cls, onTap }) {
    const b = document.createElement('button');
    b.className = 'tile ' + cls;
    b.innerHTML = `<span class="tile-icon">${icon}</span><span class="tile-name">${name}</span>` +
      `<span class="tile-soon">${sub}</span>`;
    b.addEventListener('click', () => { unlockMedia(); onTap(); });
    return b;
  }
  function group(title, cls, tiles) {
    const host = $('#home-body');
    const t = document.createElement('div');
    t.className = 'group-title';
    t.textContent = title;
    host.appendChild(t);
    const grid = document.createElement('div');
    grid.className = 'tiles ' + cls;
    tiles.forEach((x) => grid.appendChild(x));
    host.appendChild(grid);
  }
  (function buildHome() {
    const secTile = (s, cls) => tile({
      icon: s.icon, name: s.name, sub: countFor([s.id]) + ' questions', cls,
      onTap: () => startRound({ id: s.id, sections: [s.id], count: SECTION_ROUND }),
    });
    group('⭐ The Big 3', 'tiles-big', SECTIONS.filter((s) => s.big).map((s) => secTile(s, 'ready big')));
    group('More practice', '', SECTIONS.filter((s) => !s.big).map((s) => secTile(s, 'ready')));
    group('Mix it up!', 'tiles-mix', MIXES.map((m) => tile({
      icon: m.icon, name: m.name, sub: `${m.count} random questions<br><small>${m.blurb}</small>`, cls: 'ready mix',
      onTap: () => startRound(m),
    })));
  })();

  // ---------------- quiz ----------------
  const X_SVG = `<svg class="x" viewBox="0 0 100 100"><g stroke-linecap="round">
    <path d="M22 22 L78 78 M78 22 L22 78" stroke="#fff" stroke-width="22"/>
    <path d="M22 22 L78 78 M78 22 L22 78" stroke="#ef2b48" stroke-width="13"/></g></svg>`;
  const CHECK_SVG = `<svg class="check" viewBox="0 0 100 100"><path d="M28 52 L44 68 L74 34" fill="none"
    stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  let round = null;   // current round state
  let roundToken = 0; // bumps when a round is abandoned, so old timers do nothing

  function startRound(mode) {
    roundToken++;
    const pool = QUESTIONS.filter((q) => (mode.only ? q.id === mode.only : mode.sections.includes(q.sec)));
    const picks = shuffle(pool).slice(0, mode.count);
    picks.forEach((q) => { const im = new Image(); im.src = q.img; }); // preload
    round = {
      mode,
      deck: picks.map((q) => ({ q, everMissed: false })),
      total: picks.length,
      mastered: 0,
      firstTry: 0,
      introduced: new Set(), // sections whose instructions were read this round
      current: null,
      missedNow: false,
      locked: false,
    };
    renderStars();
    show('screen-quiz');
    nextQuestion();
  }

  function renderStars() {
    const host = $('#stars');
    host.innerHTML = '';
    host.classList.toggle('many', round.total > 10);
    for (let i = 0; i < round.total; i++) {
      const s = document.createElement('span');
      s.textContent = '⭐';
      if (i < round.mastered) s.className = 'on';
      host.appendChild(s);
    }
  }

  function setHint(text, oops = false, yay = false) {
    const h = $('#hint');
    if (!text) { h.classList.remove('show'); return; }
    h.textContent = text;
    h.classList.toggle('oops', oops);
    h.classList.toggle('yay', yay);
    h.classList.add('show');
  }

  function pulseSound(on) { $('#btn-sound').classList.toggle('pulse', on); }

  async function nextQuestion() {
    if (!round.deck.length) return finishRound();
    const token = roundToken;
    round.current = round.deck.shift();
    round.missedNow = false;
    round.locked = false;
    const q = round.current.q;
    const sec = SEC[q.sec];
    $('#sec-label').textContent = sec.icon + ' ' + sec.name;
    renderQuestion(q);
    setHint('');

    // instructions: only the first time each kind of question shows up this round
    const parts = [];
    if (!round.introduced.has(q.sec)) {
      round.introduced.add(q.sec);
      parts.push(sec.instructions);
      setHint(sec.instructions);
    }
    if (q.prompt) parts.push(q.prompt); // Sentence Completion: read the question (never shown)
    if (parts.length) {
      pulseSound(true);
      await speak(parts.join(' '));
      if (token === roundToken) pulseSound(false);
    }
  }

  function renderQuestion(q) {
    const card = $('#card');
    const stage = $('#stage');
    // card padding is 2.2% each side; keep whole card inside the screen height
    const r = q.w / q.h;
    card.style.setProperty('--ratio', (1 / (0.956 / r + 0.044)).toFixed(4));
    card.classList.remove('win', 'shake', 'enter');
    void card.offsetWidth;
    card.classList.add('enter');

    stage.className = 'stage';
    stage.innerHTML = '';
    const img = document.createElement('img');
    img.src = q.img;
    img.alt = 'Question';
    img.draggable = false;
    stage.appendChild(img);

    const xs = q.choices.map((c) => c.x).sort((a, b) => a - b);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]).filter((g) => g > 0.03);
    const gap = gaps.length ? Math.min(...gaps) : 0.25;
    const colW = Math.min(gap * 0.96, 0.3);
    const gapH = gap * r;                 // choice spacing, as a fraction of image height
    const bubbleW = Math.min(colW * 0.36, 0.085);

    q.choices.forEach((c, i) => {
      // newer questions carry an explicit tap box (left/right/bottom); older ones are a column around the bubble
      const hasBox = c.left !== undefined && c.right !== undefined;
      const left = hasBox ? c.left : c.x - colW / 2;
      const width = hasBox ? c.right - c.left : colW;
      // c.r = free white space around the printed bubble (fraction of image width), so the bubble never covers a picture
      const bw = c.r ? Math.max(0.026, Math.min(c.r * 1.9, 0.07, width * 0.42))
                     : Math.min(bubbleW, width * 0.42, 0.085);
      const top = hasBox ? Math.max(0, Math.min(c.top, c.y - bw * r * 0.9))
                         : Math.max(0, Math.min(c.top, c.y - gapH * 0.7));
      const bottom = Math.min(1, Math.max(c.bottom || 0, c.y + bw * r * 0.9));
      const b = document.createElement('button');
      b.className = 'choice';
      b.setAttribute('aria-label', 'Answer ' + (i + 1));
      b.style.left = left * 100 + '%';
      b.style.width = width * 100 + '%';
      b.style.top = top * 100 + '%';
      b.style.height = (bottom - top) * 100 + '%';
      const bub = document.createElement('span');
      bub.className = 'bubble';
      bub.style.top = ((c.y - top) / (bottom - top)) * 100 + '%';
      bub.style.left = ((c.x - left) / width) * 100 + '%';
      bub.style.width = (bw / width) * 100 + '%';
      b.appendChild(bub);
      b.addEventListener('click', () => choose(i, b, bub));
      stage.appendChild(b);
    });
  }

  async function choose(i, btn, bub) {
    if (!round || round.locked || btn.disabled) return;
    const token = roundToken;
    const q = round.current.q;
    bub.classList.add('filled');
    sfx.pencil();

    if (i === q.answer) {
      round.locked = true;
      stopSpeaking();
      pulseSound(false);
      document.querySelectorAll('.choice').forEach((c) => (c.disabled = true));
      setTimeout(() => {
        bub.classList.add('correct');
        bub.insertAdjacentHTML('beforeend', CHECK_SVG);
        btn.classList.add('right');
        $('#card').classList.add('win');
        sfx.correct();
        burst(bub);
        bigStar();
      }, 250);

      if (!round.missedNow) {
        // right on the first try this time — done for this round
        round.mastered++;
        if (!round.current.everMissed) round.firstTry++;
        setTimeout(renderStars, 600);
      } else {
        // missed it first — shuffle it back in a few questions later
        round.current.everMissed = true;
        const pos = Math.min(round.deck.length, 2 + Math.floor(Math.random() * 3));
        round.deck.splice(pos, 0, round.current);
      }
      // read the reason ("Yes, ..."), then give it a second to sink in before moving on.
      // If she already heard the hint after a wrong try, just cheer instead.
      const said = round.missedNow && q.hint ? CHEERS[Math.floor(Math.random() * CHEERS.length)] : q.explain;
      setHint(said, false, true);
      const reading = sleep(700).then(() => (token === roundToken ? speak(said) : null))
        .then(() => sleep(AFTER_REASON_MS));
      await Promise.all([reading, sleep(NEXT_DELAY_MS)]);
      if (token === roundToken) nextQuestion();
    } else {
      round.missedNow = true;
      round.locked = true;
      btn.disabled = true;
      stopSpeaking();
      pulseSound(false);
      $('#stage').classList.add('locked');
      setTimeout(() => {
        bub.insertAdjacentHTML('beforeend', X_SVG);
        btn.classList.add('wrong');
        sfx.wrong();
        const card = $('#card');
        card.classList.remove('shake', 'enter'); void card.offsetWidth; card.classList.add('shake');
      }, 200);

      // what to say: a hint, the question again (Sentence Completion), or nothing (Paper Folding)
      let spoken = null, shown = null;
      if (q.hint) { spoken = `Not quite. ${q.hint} Try again!`; shown = spoken; }
      else if (q.prompt) { spoken = `Not quite. Listen again. ${q.prompt} Try again!`; shown = '👂 Listen again… then try again!'; }

      await sleep(900);
      if (token !== roundToken) return;
      if (shown) setHint(shown, true);
      await Promise.all([speak(spoken), sleep(WRONG_LOCK_MS - 900)]);
      if (token !== roundToken || round.current.q !== q) return;
      round.locked = false;
      $('#stage').classList.remove('locked');
    }
  }

  function burst(el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const bits = ['✨', '💖', '⭐', '💜', '✦', '🌸'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      s.className = 'burst';
      s.textContent = bits[i % bits.length];
      const ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 90;
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      s.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg');
      s.style.fontSize = 18 + Math.random() * 16 + 'px';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }
  }

  function bigStar() {
    const s = document.createElement('div');
    s.className = 'big-star';
    s.textContent = ['🌟', '💖', '🦄', '🌈', '⭐'][Math.floor(Math.random() * 5)];
    $('#card').appendChild(s);
    setTimeout(() => s.remove(), 1500);
  }

  function finishRound() {
    stopSpeaking();
    const ds = $('#done-stars');
    ds.innerHTML = '';
    for (let i = 0; i < round.total; i++) {
      const s = document.createElement('span');
      s.textContent = '⭐';
      s.style.animationDelay = i * 0.08 + 's';
      ds.appendChild(s);
    }
    $('#done-text').textContent = round.firstTry === round.total
      ? `All ${round.total} right on the very first try!`
      : `${round.firstTry} of ${round.total} right on the very first try!`;
    show('screen-done');
    sfx.fanfare();
    const c = $('.done-burst');
    for (let k = 0; k < 3; k++) setTimeout(() => burst(c), k * 350);
  }

  // ---------------- buttons ----------------
  // 🔊 replays the Sentence Completion question, or the instructions for other kinds
  $('#btn-sound').addEventListener('click', () => {
    if (!round || !round.current) return;
    unlockMedia();
    const q = round.current.q;
    const text = q.prompt || SEC[q.sec].instructions;
    if (!q.prompt && !(round.locked && round.missedNow)) setHint(text);
    pulseSound(true);
    speak(text).then(() => pulseSound(false));
  });
  function goHome() {
    roundToken++;
    stopSpeaking();
    pulseSound(false);
    setHint('');
    show('screen-home');
  }
  $('#btn-home').addEventListener('click', goHome);
  $('#btn-done-home').addEventListener('click', goHome);
  $('#btn-again').addEventListener('click', () => { unlockMedia(); startRound(round.mode); });

  // test hook: open one specific question by id (used for checking layouts)
  window.__sparkle = { open: (id) => startRound({ id: 'test', sections: [], count: 1, only: id }) };

  // keep iPad from scrolling/bouncing the quiz page
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('#screen-home')) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
})();
