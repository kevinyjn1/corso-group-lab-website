/**
 * Brings the group's mark to life: the eye in every mark on the page looks toward the pointer,
 * and the gear turns as the page scrolls. Skipped for visitors who ask for reduced motion.
 */

/** How far the iris can travel inside the eye, in the mark's own units. */
const REACH = { x: 12, y: 5 };
/** Pointer distance, in pixels, at which the eye is looking as far as it can. */
const FULL_LOOK = 260;
/** Pixels of scrolling for one full turn of the gear. */
const SCROLL_PER_TURN = 2600;

const logos = [...document.querySelectorAll<SVGSVGElement>('[data-logo]')];

if (logos.length > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, seen: false };
  let queued = false;

  const update = () => {
    queued = false;
    document.documentElement.style.setProperty(
      '--cog-turn',
      `${(window.scrollY / SCROLL_PER_TURN).toFixed(4)}turn`,
    );
    if (!pointer.seen) return;
    for (const logo of logos) {
      const rect = logo.getBoundingClientRect();
      if (rect.width === 0) continue;
      const dx = pointer.x - (rect.left + rect.width / 2);
      const dy = pointer.y - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const amount = Math.min(1, distance / FULL_LOOK);
      logo.style.setProperty('--look-x', ((dx / distance) * amount * REACH.x).toFixed(2));
      logo.style.setProperty('--look-y', ((dy / distance) * amount * REACH.y).toFixed(2));
    }
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.seen = true;
      schedule();
    },
    { passive: true },
  );
  window.addEventListener('scroll', schedule, { passive: true });
  schedule();
}
