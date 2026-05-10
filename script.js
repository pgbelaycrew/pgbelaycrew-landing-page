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
