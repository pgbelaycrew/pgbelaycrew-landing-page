/* ============================================================
   Constellation backdrop — copied from the login page.
   Sparse drifting stars connected by hairline links, all in the
   accent color. Gives the whole page a calm atmosphere.
   ============================================================ */
(function () {
  const canvas = document.getElementById('constellation');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  let particles = [];
  let width = 0;
  let height = 0;
  let raf = 0;
  let t0 = 0;

  const LINK = 150;
  const LINK2 = LINK * LINK;

  function seed() {
    const target = Math.round((width * height) / 18000);
    const count = Math.max(60, Math.min(160, target));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.10,
      vy: (Math.random() - 0.5) * 0.10,
      r: 0.7 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.7,
    }));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function drawStatic() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 85, 68, 0.5)';
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;

    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK2) {
          const k = 1 - d2 / LINK2;
          const alpha = k * k * 0.14;
          ctx.strokeStyle = `rgba(255, 85, 68, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      const tw = 0.5 + 0.35 * Math.sin(p.phase + t * p.speed);
      ctx.fillStyle = `rgba(255, 85, 68, ${tw})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(frame);
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!reduced) {
      t0 = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  resize();

  if (reduced) {
    drawStatic();
    window.addEventListener('resize', resize);
  } else {
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
  }
})();

/* ============================================================
   Heatmap painter — populates every [data-heatmap] in the carousel.
   7 rows × 24 cols. Deterministic PRNG so the layout is stable.
   ============================================================ */
(function () {
  document.querySelectorAll('[data-heatmap]').forEach((heatmap, idx) => {
    let seed = 42 + idx * 7;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 0xffffffff;
      return seed / 0xffffffff;
    };
    const states = ['ok', 'delta', 'warn', 'fail', 'empty'];
    const weights = [0.55, 0.20, 0.05, 0.02, 0.18];
    const cdf = weights.reduce((acc, w, i) => {
      acc.push((acc[i - 1] || 0) + w);
      return acc;
    }, []);

    const ROWS = 7;
    const COLS = 24;
    const frag = document.createDocumentFragment();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = rand();
        let state = 'empty';
        for (let i = 0; i < cdf.length; i++) {
          if (x <= cdf[i]) { state = states[i]; break; }
        }
        const span = document.createElement('span');
        if (state !== 'empty') span.className = state;
        frag.appendChild(span);
      }
    }
    heatmap.appendChild(frag);
  });
})();

/* ============================================================
   Carousel — prev/next + dots + autoplay (paused on hover/focus).
   ============================================================ */
(function () {
  const root  = document.getElementById('carousel');
  const track = document.getElementById('carouselTrack');
  if (!root || !track) return;

  const slides = Array.from(track.querySelectorAll('.slide'));
  const dots   = Array.from(document.querySelectorAll('#carouselDots .cdot'));
  const prev   = document.getElementById('prevBtn');
  const next   = document.getElementById('nextBtn');
  const idxEl  = document.getElementById('carouselIndex');
  const labEl  = document.getElementById('carouselLabel');

  if (!slides.length) return;

  let current = 0;
  const total = slides.length;
  const AUTOPLAY_MS = 6000;
  let timer = null;
  let paused = false;

  function render() {
    if (idxEl) idxEl.textContent = `${current + 1} / ${total}`;
    if (labEl) labEl.textContent = slides[current].dataset.label || '';
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function go(idx, smooth = true) {
    current = ((idx % total) + total) % total;
    const target = slides[current];
    if (target) {
      track.scrollTo({
        left: target.offsetLeft,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
    render();
    schedule();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    if (paused) return;
    timer = setTimeout(() => go(current + 1), AUTOPLAY_MS);
  }

  function pause()  { paused = true;  if (timer) { clearTimeout(timer); timer = null; } }
  function resume() { paused = false; schedule(); }

  // Keep state in sync if the user scrolls the track manually.
  let scrollSyncRaf = null;
  track.addEventListener('scroll', () => {
    if (scrollSyncRaf) cancelAnimationFrame(scrollSyncRaf);
    scrollSyncRaf = requestAnimationFrame(() => {
      const slideW = track.clientWidth;
      const idx = Math.round(track.scrollLeft / slideW);
      if (idx !== current && idx >= 0 && idx < total) {
        current = idx;
        render();
      }
    });
  }, { passive: true });

  prev?.addEventListener('click', () => go(current - 1));
  next?.addEventListener('click', () => go(current + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));

  root.addEventListener('mouseenter', pause);
  root.addEventListener('mouseleave', resume);
  root.addEventListener('focusin',   pause);
  root.addEventListener('focusout',  resume);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(); else resume();
  });

  // Recompute scroll position on window resize so the active slide stays visible.
  window.addEventListener('resize', () => go(current, false));

  render();
  schedule();
})();

/* ============================================================
   Smooth-scroll anchors (accounts for sticky topbar)
   ============================================================ */
(function () {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

(function () {
  let modal = null;
  let input = null;
  let discoOn = false;
  let discoEls = [];

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'egg-modal-overlay';
    modal.innerHTML =
      '<div class="egg-modal" role="dialog" aria-modal="true" aria-label="Command console">' +
        '<p class="egg-modal-title">// command console</p>' +
        '<div class="egg-input-row">' +
          '<span class="egg-prompt" aria-hidden="true">&gt;</span>' +
          '<input class="egg-input" type="text" autocomplete="off" spellcheck="false" ' +
                 'aria-label="Enter command" placeholder="type a command…" />' +
        '</div>' +
        '<p class="egg-hint">Restricted Access</p>' +
      '</div>';

    const box = modal.querySelector('.egg-modal');
    input = modal.querySelector('.egg-input');

    // Click outside the dialog closes the console.
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) closeModal();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runCommand(input.value.trim(), box);
      }
    });

    document.body.appendChild(modal);
  }

  function modalOpen() {
    return modal && modal.style.display !== 'none';
  }

  function openModal() {
    if (!modal) buildModal();
    modal.style.display = 'flex';
    input.value = '';
    requestAnimationFrame(() => input.focus());
  }

  function closeModal() {
    if (modal) modal.style.display = 'none';
  }

  function runCommand(raw, box) {
    const cmd = raw.toUpperCase();
    if (cmd === 'DISCO') {
      toggleDisco();
      closeModal();
    } else if (cmd === 'STOP' || cmd === 'OFF' || cmd === 'LIGHTS OUT') {
      stopDisco();
      closeModal();
    } else {
      // Unknown command — shake the box and let them try again.
      box.classList.remove('egg-shake');
      void box.offsetWidth; // restart the animation
      box.classList.add('egg-shake');
      input.value = '';
    }
  }

  function toggleDisco() {
    if (discoOn) stopDisco();
    else startDisco();
  }

  function makeBall(modifier) {
    const ball = document.createElement('div');
    ball.className = 'egg-ball ' + modifier;
    ball.setAttribute('aria-hidden', 'true');
    ball.innerHTML = '<span class="egg-ball-cap"></span>';
    return ball;
  }

  function startDisco() {
    if (discoOn) return;
    discoOn = true;

    // Triangular spotlight beams that sweep from the ceiling.
    const lights = document.createElement('div');
    lights.className = 'egg-lights';
    lights.setAttribute('aria-hidden', 'true');
    lights.innerHTML = '<span class="egg-beam"></span>'.repeat(5);
    document.body.appendChild(lights);
    discoEls = [lights];

    // Two mirror balls flanking the hero wordmark (fall back to a single
    // ball hung from the ceiling if the title isn't on the page).
    const title = document.querySelector('.hero-title');
    if (title) {
      const left = makeBall('egg-ball--left');
      const right = makeBall('egg-ball--right');
      title.appendChild(left);
      title.appendChild(right);
      discoEls.push(left, right);
    } else {
      const solo = makeBall('egg-ball--solo');
      document.body.appendChild(solo);
      discoEls.push(solo);
    }

    document.body.classList.add('egg-disco');
  }

  function stopDisco() {
    if (!discoOn) return;
    discoOn = false;
    document.body.classList.remove('egg-disco');
    discoEls.forEach((el) => el.remove());
    discoEls = [];
  }

  document.addEventListener('keydown', (e) => {
    // Ctrl+G opens (or re-closes) the console.
    if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      if (modalOpen()) closeModal();
      else openModal();
      return;
    }
    if (e.key === 'Escape') {
      if (modalOpen()) closeModal();
      else if (discoOn) stopDisco();
    }
  });
})();
