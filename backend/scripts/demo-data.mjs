// Demo accounts shared by seed-demo.mjs and e2e-flow.mjs. Local/demo use only.
import { deflateSync } from 'node:zlib';

export const DEMO_TEAM_PASSWORD = 'demo1234';
export const DEMO_JUDGE_PASSWORD = 'judge123';

export const DEMO_JUDGES = [
  { name: 'Dr. Meera Iyer', username: 'judge1', color: [88, 86, 214] },
  { name: 'Prof. Arjun Rao', username: 'judge2', color: [255, 149, 0] },
];

const TEAM_DEFS = [
  ['Circuit Breakers', 'Smart Grid Monitor', 'Low-cost sensors that detect power theft and faults on village distribution lines.', [0, 122, 255]],
  ['Green Thumbs', 'Soil Moisture Mesh', 'A mesh of soil sensors that tells farmers exactly when and where to irrigate.', [52, 199, 89]],
  ['Byte Me', 'Campus Lost & Found', 'Photo-matching app that reunites students with lost items on campus.', [255, 59, 48]],
  ['Neural Ninjas', 'Sign Language Glove', 'A glove with flex sensors that turns Indian Sign Language into speech.', [175, 82, 222]],
  ['Solar Flare', 'Solar Cold Box', 'A solar-powered cold storage box for small vegetable vendors.', [255, 204, 0]],
  ['Rust Busters', 'Bridge Crack Detector', 'A drone camera pipeline that spots cracks in small bridges early.', [90, 200, 250]],
];

/** Six demo teams: lead + two members each. Phones are 10-digit Indian numbers. */
export const DEMO_TEAMS = TEAM_DEFS.map(([teamName, projectTitle, projectDesc, color], i) => {
  const n = i + 1;
  const phone = (k) => `98765${String(n).padStart(2, '0')}0${k}0`.slice(0, 10);
  return {
    teamName,
    projectTitle,
    projectDesc,
    color,
    lead: { name: `Lead ${n} ${teamName.split(' ')[0]}`, usn: `1TA22CS0${String(n).padStart(2, '0')}`, phone: phone(0), email: `lead${n}@demo.test` },
    members: [1, 2].map((k) => ({
      name: `Member ${n}.${k}`,
      phone: phone(k),
      email: `member${n}${k}@demo.test`,
    })),
  };
});

// ---------- Tiny PNG encoder (no dependencies) ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A small RGB PNG: solid `color` with a lighter centered square. Returns base64. */
export function makePng([r, g, b], size = 64) {
  const light = [r, g, b].map((v) => Math.round(v + (255 - v) * 0.55));
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const inner = x > size / 4 && x < (size * 3) / 4 && y > size / 4 && y < (size * 3) / 4;
      const [pr, pg, pb] = inner ? light : [r, g, b];
      raw[row + 1 + x * 3] = pr;
      raw[row + 2 + x * 3] = pg;
      raw[row + 3 + x * 3] = pb;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png.toString('base64');
}

// ---------- CLI + HTTP helpers ----------

/** `node script.mjs [baseUrl] [--admin-password X]`; env ADMIN_PASSWORD / ADMIN_USERNAME also work. */
export function parseArgs(argv) {
  const args = argv.slice(2);
  let baseUrl = 'http://localhost:8787';
  let adminPassword = process.env.ADMIN_PASSWORD ?? '';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--admin-password') adminPassword = args[++i] ?? '';
    else if (a.startsWith('--admin-password=')) adminPassword = a.slice('--admin-password='.length);
    else if (!a.startsWith('--')) baseUrl = a;
  }
  if (!adminPassword) {
    console.error('Admin password missing: pass --admin-password <pw> or set ADMIN_PASSWORD.');
    process.exit(2);
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), adminPassword, adminUsername: process.env.ADMIN_USERNAME || 'admin' };
}

export function client(baseUrl) {
  return async function call(method, path, { token, body } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  };
}

export function describeError(res) {
  const e = res.body?.error;
  return e ? `${res.status} ${e.code}: ${e.message}${e.fields ? ` ${JSON.stringify(e.fields)}` : ''}` : `${res.status} ${JSON.stringify(res.body)}`;
}
