export interface Theme {
  id: string;
  colors: [string, string, string, string, string];
}

export const THEMES: Theme[] = [
  { id: 'berry', colors: ['#ff9ab0', '#f4456b', '#c31e46', '#4a0d26', '#ffd166'] },
  { id: 'leaf', colors: ['#b8f26b', '#6cc832', '#2f8a2a', '#123a16', '#ffe066'] },
  { id: 'ocean', colors: ['#8fd6ff', '#3a9fe0', '#1e5f9e', '#0d2a45', '#a8f0d8'] },
  { id: 'grape', colors: ['#cbb6ff', '#8a6cf0', '#5a3cbf', '#241247', '#ffc0e0'] },
  { id: 'ember', colors: ['#ffc38a', '#f78c3f', '#c4551a', '#3f1a08', '#ffe08a'] },
  { id: 'mint', colors: ['#a8f0d8', '#45c49b', '#1d8a6c', '#073026', '#f7f7b0'] },
  { id: 'rose', colors: ['#ffd0e2', '#ff8ab5', '#d24f88', '#3d0f28', '#ffe9a8'] },
  { id: 'slate', colors: ['#c7d2e8', '#7f92b8', '#4a5b80', '#1b2233', '#ffe3a3'] },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
