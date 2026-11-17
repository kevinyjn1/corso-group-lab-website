/**
 * Site-wide motion: scroll reveals, count-up numbers, and pointer spotlights.
 *
 * Markup opts in with data attributes:
 *   data-reveal            fade the element up when it scrolls into view
 *   data-reveal="stagger"  do the same for each child, one after another
 *   data-count             count a number up from zero ("170+", "24K+")
 *   data-spotlight         track the pointer for a soft glow (see global.css)
 *
 * The hidden starting state only applies under the `js` class set in the
 * document head, so the page is fully readable without scripts, and all of
 * this is skipped for visitors who ask for reduced motion.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function reveal() {
  const targets = [
    ...document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal="stagger"])'),
    ...document.querySelectorAll<HTMLElement>('[data-reveal="stagger"] > *'),
  ];
  if (reduceMotion || !('IntersectionObserver' in window)) {
    for (const el of targets) el.classList.add('is-visible');
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      // Elements that arrive together are staggered in document order.
      const arriving = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement);
      arriving.forEach((el, i) => {
        el.style.setProperty('--i', String(Math.min(i, 8)));
        el.classList.add('is-visible');
        observer.unobserve(el);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  for (const el of targets) observer.observe(el);
}

function countUp() {
  const targets = document.querySelectorAll<HTMLElement>('[data-count]');
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        const final = el.textContent ?? '';
        const match = final.match(/^(\d+)(.*)$/);
        if (!match) continue;
        const target = Number(match[1]);
        const suffix = match[2];
        const start = performance.now();
        const duration = 1400;
        const step = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 4);
          el.textContent = t < 1 ? `${Math.round(target * eased)}${suffix}` : final;
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    },
    { threshold: 0.6 },
  );
  for (const el of targets) observer.observe(el);
}

function spotlight() {
  if (reduceMotion) return;
  document.addEventListener(
    'pointermove',
    (event) => {
      const el = (event.target as Element | null)?.closest<HTMLElement>('[data-spotlight]');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      el.style.setProperty('--my', `${event.clientY - rect.top}px`);
    },
    { passive: true },
  );
}

reveal();
countUp();
spotlight();
