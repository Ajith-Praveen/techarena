import { spawn, type ChildProcess, execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BACKEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = join(BACKEND_DIR, 'node_modules', '.bin', 'wrangler');

export const ADMIN_PASSWORD = 'test-admin-password';

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export interface TestServer {
  baseUrl: string;
  api<T = any>(method: string, path: string, opts?: { token?: string; body?: unknown; headers?: Record<string, string>; raw?: string }): Promise<ApiResponse<T>>;
  sql(command: string): Promise<void>;
  stop(): Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => res(port));
    });
  });
}

const childEnv = () => ({ ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' });

/**
 * Starts `wrangler dev --local` against a throwaway config + state dir so tests never touch
 * the developer's .dev.vars, local D1 state or ../app/dist.
 */
export async function startServer(): Promise<TestServer> {
  const dir = await mkdtemp(join(tmpdir(), 'tech-arena-test-'));
  const stateDir = join(dir, 'state');
  const assetsDir = join(dir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  await writeFile(join(assetsDir, 'index.html'), '<!doctype html><title>Tech Arena test</title><p>spa</p>');
  const configPath = join(dir, 'wrangler.json');
  await writeFile(
    configPath,
    JSON.stringify(
      {
        name: 'tech-arena-test',
        main: join(BACKEND_DIR, 'src', 'index.ts'),
        compatibility_date: '2026-10-01',
        assets: {
          directory: assetsDir,
          binding: 'ASSETS',
          not_found_handling: 'single-page-application',
          run_worker_first: ['/api/*'],
        },
        d1_databases: [
          {
            binding: 'DB',
            database_name: 'tech-arena-db',
            database_id: 'local-test-db',
            migrations_dir: join(BACKEND_DIR, 'migrations'),
          },
        ],
        vars: {
          EVENT_NAME: 'Tech Arena',
          DEFAULT_COUNTRY_CODE: '91',
          MAX_TEAM_SIZE: '5',
          APP_URL: 'https://arena.example.com',
          APK_URL: 'https://arena.example.com/tech-arena.apk',
          MAIL_FROM: 'Tech Arena <onboarding@resend.dev>',
        },
      },
      null,
      2,
    ),
  );
  await writeFile(join(dir, '.dev.vars'), `ADMIN_PASSWORD=${ADMIN_PASSWORD}\nRESEND_API_KEY=\n`);

  await execFileAsync(
    WRANGLER,
    ['d1', 'migrations', 'apply', 'tech-arena-db', '--local', '--persist-to', stateDir, '--config', configPath],
    { cwd: dir, env: childEnv() },
  );

  const port = await freePort();
  const inspectorPort = await freePort();
  let output = '';
  const child: ChildProcess = spawn(
    WRANGLER,
    [
      'dev',
      '--config', configPath,
      '--local',
      '--ip', '127.0.0.1',
      '--port', String(port),
      '--inspector-port', String(inspectorPort),
      '--persist-to', stateDir,
      '--show-interactive-dev-session=false',
    ],
    { cwd: dir, env: childEnv(), detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));

  const baseUrl = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null && child.pid) {
      const exited = new Promise((r) => child.once('exit', r));
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // already gone
      }
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      if (child.exitCode === null) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          // already gone
        }
      }
    }
    await rm(dir, { recursive: true, force: true });
  };

  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) {
      await stop();
      throw new Error(`wrangler dev exited early:\n${output}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`wrangler dev did not become ready:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const api: TestServer['api'] = async (method, path, opts = {}) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    let payload: string | undefined = opts.raw;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }
    const res = await fetch(baseUrl + path, { method, headers, body: payload });
    const type = res.headers.get('content-type') ?? '';
    const body = type.includes('application/json') ? await res.json() : new Uint8Array(await res.arrayBuffer());
    return { status: res.status, body: body as any, headers: res.headers };
  };

  const sql = async (command: string) => {
    await execFileAsync(
      WRANGLER,
      ['d1', 'execute', 'tech-arena-db', '--local', '--persist-to', stateDir, '--config', configPath, '--command', command],
      { cwd: dir, env: childEnv() },
    );
  };

  return { baseUrl, api, sql, stop };
}

// 1x1 transparent PNG.
export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
export const JPEG_BASE64 = Buffer.from(JPEG_BYTES).toString('base64');
