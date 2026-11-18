/**
 * Clips of the group's footage (src/components/Clip.astro).
 *
 * A clip plays while most of it is on screen and stops when it leaves, so the page never decodes
 * video nobody is looking at. The button holds it still, and that choice outlasts scrolling. For
 * visitors who ask for reduced motion every clip starts held.
 */
const mounted = new WeakSet<Element>();

export function mountClips() {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  for (const clip of document.querySelectorAll<HTMLElement>('[data-clip]')) {
    if (mounted.has(clip)) continue;
    mounted.add(clip);

    const video = clip.querySelector('video');
    const button = clip.querySelector<HTMLButtonElement>('[data-clip-toggle]');
    if (!video || !button) continue;

    let held = still.matches;
    let visible = false;

    const show = () => {
      const playing = !video.paused;
      button.setAttribute('aria-pressed', String(!playing));
      button.setAttribute('aria-label', playing ? 'Pause the clip' : 'Play the clip');
      clip.dataset.playing = String(playing);
    };

    const sync = () => {
      if (visible && !held) {
        // A refused play (a browser that blocks it, a tab in the background) leaves the poster up.
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };

    video.addEventListener('play', show);
    video.addEventListener('pause', show);
    button.addEventListener('click', () => {
      held = !video.paused;
      visible = true;
      sync();
    });

    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.5 },
    ).observe(clip);

    show();
  }
}
