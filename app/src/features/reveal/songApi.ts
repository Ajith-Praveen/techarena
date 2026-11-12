import { ApiError, getApiBaseUrl, getAuthToken, request } from '@/api/client';

import type { ShowTimes } from './trackStore';

/**
 * The reveal song and timeline, kept on the server for the Admin account only, so the show has its music on
 * any browser the admin signs in on. Nobody else can download it.
 */
export interface ServerSong {
  name: string;
  mime: string;
  size: number;
  updatedAt: string;
}

export interface RevealInfo {
  song: ServerSong | null;
  times: Partial<ShowTimes> | null;
}

export const revealInfo = () => request<RevealInfo>('GET', '/api/admin/reveal');
export const saveServerTimes = (times: ShowTimes) => request<{ times: ShowTimes }>('PUT', '/api/admin/reveal/times', { body: times });
export const deleteServerSong = () => request<{ ok: boolean }>('DELETE', '/api/admin/reveal/song');

const TRANSFER_TIMEOUT_MS = 180_000;

async function rawFetch(method: 'GET' | 'PUT', path: string, body?: Blob): Promise<Response> {
  const base = getApiBaseUrl();
  if (!base) throw new ApiError(0, 'NETWORK', 'Server address is not configured.');
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = body.type || 'audio/mpeg';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body, signal: controller.signal });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check the internet connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(res.status, data?.error?.code ?? 'BAD_REQUEST', data?.error?.message ?? `Request failed (${res.status}).`);
  }
  return res;
}

/** Uploads (replaces) the song on the server. */
export async function uploadSong(file: File): Promise<ServerSong> {
  const res = await rawFetch('PUT', `/api/admin/reveal/song?name=${encodeURIComponent(file.name)}`, file);
  const data = (await res.json()) as { song: ServerSong };
  return data.song;
}

/** Downloads the song from the server. */
export async function downloadSong(): Promise<Blob> {
  const res = await rawFetch('GET', '/api/admin/reveal/song');
  const blob = await res.blob();
  return blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' });
}
