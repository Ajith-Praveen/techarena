// Turns the `expo export -p web` output into an installable PWA (iOS "Add to Home Screen").
// Idempotent: safe to run more than once on the same dist/.
// Usage: node scripts/pwa-postexport.mjs [distDir]
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, process.argv[2] ?? 'dist');
const indexPath = join(dist, 'index.html');

if (!existsSync(indexPath)) {
  console.error(`[pwa] ${indexPath} not found. Run \`expo export -p web\` first.`);
  process.exit(1);
}

const { expo } = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
const name = expo.web?.name ?? expo.name ?? 'Tech Arena';
const shortName = expo.web?.shortName ?? name;
const themeColor = expo.web?.themeColor ?? '#F2F2F7';
const backgroundColor = expo.web?.backgroundColor ?? themeColor;
const description = expo.web?.description ?? 'Project expo registration, judging and results.';

// 1. Icons
const iconSrc = join(root, 'assets', 'pwa');
const iconDir = join(dist, 'icons');
mkdirSync(iconDir, { recursive: true });
for (const file of readdirSync(iconSrc).filter((f) => f.endsWith('.png'))) {
  copyFileSync(join(iconSrc, file), join(iconDir, file));
}
// iOS also probes /apple-touch-icon.png at the root.
copyFileSync(join(iconSrc, 'apple-touch-icon.png'), join(dist, 'apple-touch-icon.png'));

// 2. Manifest
const manifest = {
  name,
  short_name: shortName,
  description,
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: backgroundColor,
  theme_color: themeColor,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(dist, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

// 3. index.html tags
const START = '<!-- pwa:start -->';
const END = '<!-- pwa:end -->';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let html = readFileSync(indexPath, 'utf8');
html = html.replace(new RegExp(`\\s*${START}[\\s\\S]*?${END}\\s*`, 'g'), '');
html = html.replace(/\s*<meta\s+name="theme-color"[^>]*>/gi, '');

const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />';
if (/<meta\s+name="viewport"[^>]*>/i.test(html)) {
  html = html.replace(/<meta\s+name="viewport"[^>]*>/i, viewport);
} else {
  html = html.replace(/<head>/i, `<head>\n    ${viewport}`);
}

const tags = [
  START,
  '<link rel="manifest" href="/manifest.webmanifest" />',
  `<meta name="theme-color" content="${esc(themeColor)}" />`,
  `<meta name="description" content="${esc(description)}" />`,
  `<meta name="application-name" content="${esc(shortName)}" />`,
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  `<meta name="apple-mobile-web-app-title" content="${esc(shortName)}" />`,
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
  '<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />',
  `<style id="pwa-bg">html,body{background-color:${themeColor};color-scheme:dark;overscroll-behavior:none}</style>`,
  END,
].join('\n    ');

html = html.replace(/\s*<\/head>/i, `\n    ${tags}\n  </head>`);
writeFileSync(indexPath, html);

console.log(`[pwa] manifest, icons and tags written to ${dist}`);
