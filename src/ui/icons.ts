const svg = (body: string, size = 24): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  levels: svg(
    '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  ),
  settings: svg(
    '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.6"/><circle cx="8" cy="17" r="2.6"/>',
  ),
  restart: svg('<path d="M4 4v6h6"/><path d="M5.2 15a8 8 0 1 0 1.6-8.2L4 10"/>'),
  hint: svg(
    '<path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/><path d="M9.5 19.5h5M10.5 22h3"/>',
  ),
  fit: svg(
    '<path d="M8 3.5H6A2.5 2.5 0 0 0 3.5 6v2M16 3.5h2A2.5 2.5 0 0 1 20.5 6v2M8 20.5H6A2.5 2.5 0 0 1 3.5 18v-2M16 20.5h2a2.5 2.5 0 0 0 2.5-2.5v-2"/><rect x="9" y="9" width="6" height="6" rx="1.4"/>',
  ),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20),
  next: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 20),
  share: svg(
    '<circle cx="18" cy="5" r="2.8"/><circle cx="6" cy="12" r="2.8"/><circle cx="18" cy="19" r="2.8"/><path d="M8.5 13.4l7 4.1M15.5 6.5l-7 4.1"/>',
    20,
  ),
  dice: svg(
    '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.6" cy="8.6" r="1" fill="currentColor"/><circle cx="15.4" cy="8.6" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="8.6" cy="15.4" r="1" fill="currentColor"/><circle cx="15.4" cy="15.4" r="1" fill="currentColor"/>',
    20,
  ),
  image: svg(
    '<rect x="3" y="4.5" width="18" height="15" rx="3.5"/><circle cx="8.8" cy="10" r="1.7"/><path d="M4 17.5l5.2-4.8 3.8 3.4 2.6-2.1 4.4 3.5"/>',
    20,
  ),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4l2.95 6 6.6.95-4.78 4.66 1.13 6.58L12 17.5l-5.9 3.1 1.13-6.58L2.45 9.35l6.6-.95z"/></svg>',
};
