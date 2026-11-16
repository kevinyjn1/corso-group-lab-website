/**
 * Client-side filtering for the publications page. Every publication is in the
 * HTML already; this only toggles visibility and keeps the URL in sync so that
 * a filtered view can be linked to (for example /publications/?topic=health).
 */

interface State {
  q: string;
  topic: string;
  type: string;
}

export function mountPublicationFilter(root: HTMLElement): void {
  const search = root.querySelector<HTMLInputElement>('[data-filter-search]');
  const typeSelect = root.querySelector<HTMLSelectElement>('[data-filter-type]');
  const topicButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter-topic]')];
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  const empty = root.querySelector<HTMLElement>('[data-filter-empty]');
  const groups = [...root.querySelectorAll<HTMLElement>('[data-year-group]')];
  const items = [...root.querySelectorAll<HTMLElement>('[data-pub]')];
  if (!search || !typeSelect || !status || !empty) return;

  const topics = new Set(topicButtons.map((b) => b.dataset.filterTopic ?? ''));
  const types = new Set([...typeSelect.options].map((o) => o.value));
  const params = new URLSearchParams(window.location.search);
  const state: State = {
    q: params.get('q') ?? '',
    topic: topics.has(params.get('topic') ?? '') ? (params.get('topic') ?? '') : '',
    type: types.has(params.get('type') ?? '') ? (params.get('type') ?? '') : '',
  };

  function apply() {
    const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const match =
        (!state.topic || (item.dataset.topics ?? '').split(' ').includes(state.topic)) &&
        (!state.type || item.dataset.type === state.type) &&
        terms.every((term) => (item.dataset.search ?? '').includes(term));
      item.hidden = !match;
      if (match) shown++;
    }
    for (const group of groups) {
      const visible = group.querySelectorAll('[data-pub]:not([hidden])').length;
      group.hidden = visible === 0;
      const count = group.querySelector('[data-year-count]');
      if (count) count.textContent = String(visible);
    }
    empty!.hidden = shown !== 0;
    status!.textContent =
      shown === items.length
        ? `${items.length} publications`
        : `${shown} of ${items.length} publications`;

    search!.value = state.q;
    typeSelect!.value = state.type;
    for (const button of topicButtons) {
      button.setAttribute(
        'aria-pressed',
        String((button.dataset.filterTopic ?? '') === state.topic),
      );
    }

    const next = new URLSearchParams();
    if (state.q) next.set('q', state.q);
    if (state.topic) next.set('topic', state.topic);
    if (state.type) next.set('type', state.type);
    const query = next.toString();
    history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  }

  search.addEventListener('input', () => {
    state.q = search.value;
    apply();
  });
  typeSelect.addEventListener('change', () => {
    state.type = typeSelect.value;
    apply();
  });
  for (const button of topicButtons) {
    button.addEventListener('click', () => {
      const topic = button.dataset.filterTopic ?? '';
      state.topic = state.topic === topic ? '' : topic;
      apply();
    });
  }
  root.querySelector('[data-filter-reset]')?.addEventListener('click', () => {
    state.q = state.topic = state.type = '';
    apply();
    search.focus();
  });

  // Jumping to a year from the chart clears the filters first, so the year is on the page.
  for (const link of root.querySelectorAll('[data-year-link]')) {
    link.addEventListener('click', () => {
      state.q = state.topic = state.type = '';
      apply();
    });
  }

  apply();
}
