/* ============================================================
   pgBelayCrew — documentation page behavior
   - Scroll-spy: highlight the sidebar link for the section in view
   - Mobile: toggle the table of contents
   The shared constellation backdrop is handled by script.js; the
   carousel/heatmap blocks there no-op when their elements are absent.
   ============================================================ */
(function () {
  const sidebar = document.getElementById('docsSidebar');
  if (!sidebar) return;

  const links = Array.from(sidebar.querySelectorAll('.docs-nav a'));
  const byId = new Map();
  const targets = [];

  links.forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) {
      byId.set(id, a);
      targets.push(el);
    }
  });
  if (!targets.length) return;

  let activeId = null;
  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    links.forEach((a) => a.classList.remove('active'));
    const a = byId.get(id);
    if (a) {
      a.classList.add('active');
      // Keep the active link visible inside a scrolling sidebar.
      const r = a.getBoundingClientRect();
      const sr = sidebar.getBoundingClientRect();
      if (r.top < sr.top || r.bottom > sr.bottom) {
        a.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  // IntersectionObserver-driven scroll-spy. Track which sections are
  // currently intersecting and activate the topmost one.
  const visible = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      if (visible.size) {
        // Pick the section closest to the top of the viewport.
        let best = null;
        let bestTop = Infinity;
        visible.forEach((id) => {
          const top = document.getElementById(id).getBoundingClientRect().top;
          if (top < bestTop) { bestTop = top; best = id; }
        });
        if (best) setActive(best);
      }
    },
    { rootMargin: '-72px 0px -65% 0px', threshold: 0 }
  );
  targets.forEach((t) => io.observe(t));

  // Fallback for the very top / bottom of the page.
  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY < 120) setActive(targets[0].id);
    },
    { passive: true }
  );

  // ---- Mobile TOC toggle ----
  const toggle = document.getElementById('tocToggle');
  if (toggle) {
    const setOpen = (open) => {
      sidebar.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () =>
      setOpen(!sidebar.classList.contains('open'))
    );
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(!sidebar.classList.contains('open'));
      }
    });
    // Close the TOC after picking a destination on mobile.
    links.forEach((a) =>
      a.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 900px)').matches) setOpen(false);
      })
    );
  }

  // Smooth-scroll with sticky-topbar offset for in-page anchors.
  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', id);
    });
  });
})();
