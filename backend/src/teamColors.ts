/**
 * Team banner colours. Hand-picked to look clearly different from each other (hue and
 * lightness both vary), so every team gets a colour nobody else has. Stored on the team as the
 * hex value; the app shows the name next to the swatch.
 */
export const TEAM_COLORS: ReadonlyArray<{ hex: string; name: string }> = [
  { hex: '#E4002B', name: 'Tomato Red' },
  { hex: '#9B1B30', name: 'Cherry' },
  { hex: '#FF6F59', name: 'Coral' },
  { hex: '#FF9AA2', name: 'Bubblegum' },
  { hex: '#FF2E93', name: 'Hot Pink' },
  { hex: '#C2008F', name: 'Magenta' },
  { hex: '#6A1B9A', name: 'Plum' },
  { hex: '#B39DFF', name: 'Lavender' },
  { hex: '#7B3FE4', name: 'Grape' },
  { hex: '#3F2FB8', name: 'Indigo' },
  { hex: '#1E5BFF', name: 'Royal Blue' },
  { hex: '#0B2E6B', name: 'Navy' },
  { hex: '#4FC3F7', name: 'Sky Blue' },
  { hex: '#00B8D9', name: 'Cyan' },
  { hex: '#00897B', name: 'Teal' },
  { hex: '#5EE6C2', name: 'Mint' },
  { hex: '#14A44D', name: 'Emerald' },
  { hex: '#1E5631', name: 'Forest' },
  { hex: '#A4DE02', name: 'Lime' },
  { hex: '#7A7A1F', name: 'Olive' },
  { hex: '#FFE45C', name: 'Lemon' },
  { hex: '#FFC300', name: 'Sunflower' },
  { hex: '#FF9F1C', name: 'Mango' },
  { hex: '#FF6B00', name: 'Tangerine' },
  { hex: '#B7410E', name: 'Rust' },
  { hex: '#5D3A1A', name: 'Chocolate' },
  { hex: '#C68642', name: 'Caramel' },
  { hex: '#E3C9A1', name: 'Sand' },
  { hex: '#E8A598', name: 'Rose Gold' },
  { hex: '#BFC5CC', name: 'Silver' },
  { hex: '#5B6770', name: 'Slate' },
  { hex: '#2E2E2E', name: 'Charcoal' },
];

const BY_HEX = new Map(TEAM_COLORS.map((c) => [c.hex.toUpperCase(), c]));

/** The palette entry for a hex value (any case), or undefined if it is not one of ours. */
export function findTeamColor(hex: string): { hex: string; name: string } | undefined {
  return BY_HEX.get(hex.trim().toUpperCase());
}

export const COLOR_TAKEN = 'Another team already has this colour. Pick a different one.';
