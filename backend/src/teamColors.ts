/**
 * Team banner colours. Hand-picked to look clearly different from each other (hue and
 * lightness both vary), so every team gets a colour nobody else has. Stored on the team as the
 * hex value; the app shows the name next to the swatch.
 */
export const TEAM_COLORS: ReadonlyArray<{ hex: string; name: string }> = [
  { hex: '#9B1B30', name: 'Cherry' },
  { hex: '#FF9AA2', name: 'Bubblegum' },
  { hex: '#8B0000', name: 'Blood Red' },
  { hex: '#FF6F59', name: 'Coral' },
  { hex: '#E8A598', name: 'Rose Gold' },
  { hex: '#B7410E', name: 'Rust' },
  { hex: '#D2691E', name: 'Cinnamon' },
  { hex: '#FF6B00', name: 'Tangerine' },
  { hex: '#FF4500', name: 'Fire Orange' },
  { hex: '#5D3A1A', name: 'Chocolate' },
  { hex: '#C68642', name: 'Caramel' },
  { hex: '#FF9F1C', name: 'Mango' },
  { hex: '#E3C9A1', name: 'Sand' },
  { hex: '#C9A227', name: 'Mustard' },
  { hex: '#FFC300', name: 'Sunflower' },
  { hex: '#BDB76B', name: 'Khaki' },
  { hex: '#FFE45C', name: 'Lemon' },
  { hex: '#FFF3B0', name: 'Butter' },
  { hex: '#7A7A1F', name: 'Olive' },
  { hex: '#A4DE02', name: 'Lime' },
  { hex: '#4CBB17', name: 'Grass' },
  { hex: '#9CAF88', name: 'Sage' },
  { hex: '#B5D99C', name: 'Pistachio' },
  { hex: '#39FF14', name: 'Neon Green' },
  { hex: '#1E5631', name: 'Forest' },
  { hex: '#14A44D', name: 'Emerald' },
  { hex: '#2E8B57', name: 'Jungle' },
  { hex: '#00897B', name: 'Teal' },
  { hex: '#5EE6C2', name: 'Mint' },
  { hex: '#005F6A', name: 'Petrol' },
  { hex: '#20B2AA', name: 'Lagoon' },
  { hex: '#00B8D9', name: 'Cyan' },
  { hex: '#00E5FF', name: 'Electric Blue' },
  { hex: '#0077B6', name: 'Ocean' },
  { hex: '#4FC3F7', name: 'Sky Blue' },
  { hex: '#D6F0FF', name: 'Ice Blue' },
  { hex: '#0B2E6B', name: 'Navy' },
  { hex: '#6495ED', name: 'Cornflower' },
  { hex: '#1E5BFF', name: 'Royal Blue' },
  { hex: '#191970', name: 'Midnight' },
  { hex: '#3F2FB8', name: 'Indigo' },
  { hex: '#7B3FE4', name: 'Grape' },
  { hex: '#B39DFF', name: 'Lavender' },
  { hex: '#3D1F4F', name: 'Eggplant' },
  { hex: '#6A1B9A', name: 'Plum' },
  { hex: '#8F00FF', name: 'Violet' },
  { hex: '#E0B0FF', name: 'Wisteria' },
  { hex: '#DCC6F0', name: 'Lilac' },
  { hex: '#FF00FF', name: 'Fuchsia' },
  { hex: '#DA70D6', name: 'Orchid' },
  { hex: '#C2008F', name: 'Magenta' },
  { hex: '#B784A7', name: 'Mauve' },
  { hex: '#D6246E', name: 'Raspberry' },
  { hex: '#FF2E93', name: 'Hot Pink' },
  { hex: '#5C0A1E', name: 'Maroon' },
  { hex: '#E4002B', name: 'Tomato Red' },
  { hex: '#FFD1DC', name: 'Pastel Pink' },
  { hex: '#2E2E2E', name: 'Charcoal' },
  { hex: '#5B6770', name: 'Slate' },
  { hex: '#967969', name: 'Mocha' },
  { hex: '#A39E93', name: 'Stone' },
  { hex: '#BFC5CC', name: 'Silver' },
];

const BY_HEX = new Map(TEAM_COLORS.map((c) => [c.hex.toUpperCase(), c]));

/** The palette entry for a hex value (any case), or undefined if it is not one of ours. */
export function findTeamColor(hex: string): { hex: string; name: string } | undefined {
  return BY_HEX.get(hex.trim().toUpperCase());
}

export const COLOR_TAKEN = 'Another team already has this colour. Pick a different one.';
