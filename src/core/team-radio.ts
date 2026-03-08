import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { SessionStore } from './session-store.js';
import { getDataDir } from './xdg.js';

const STATIC_BASE_URL = 'https://livetiming.formula1.com/static/';
const USER_AGENT = 'f1aire/0.1.0';
const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_APP_NAME = 'f1aire';
const TEAM_RADIO_CACHE_DIR = 'team-radio';

type ObjectRecord = Record<string, unknown>;

type SessionRawLike = Pick<SessionStore['raw'], 'download' | 'subscribe' | 'keyframes'>;

export type TeamRadioCapture = {
  Utc?: string;
  RacingNumber?: string;
  Path?: string;
  DownloadedFilePath?: string;
  Transcription?: string;
};

export type TeamRadioState = {
  Captures?: Record<string, TeamRadioCapture> | TeamRadioCapture[];
};

export type TeamRadioCaptureSummary = {
  captureId: string;
  utc: string | null;
  driverNumber: string | null;
  path: string | null;
  assetUrl: string | null;
};

export type TeamRadioDownloadResult = TeamRadioCaptureSummary & {
  filePath: string;
  bytes: number;
  reused: boolean;
  sessionPrefix: string | null;
  destinationDir: string;
};

function isPlainObject(value: unknown): value is ObjectRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function asObject(value: unknown): ObjectRecord | null {
  return isPlainObject(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStaticPrefix(value: unknown): string | null {
  const prefix = asNonEmptyString(value);
  if (!prefix) {
    return null;
  }

  if (/^https?:\/\//i.test(prefix)) {
    return prefix.endsWith('/') ? prefix : `${prefix}/`;
  }

  const normalized = prefix.replace(/^\/+/, '');
  return `${STATIC_BASE_URL}${normalized.endsWith('/') ? normalized : `${normalized}/`}`;
}

function getSessionRaw(value: unknown): SessionRawLike | null {
  const source = asObject(value);
  if (!source) {
    return null;
  }

  const raw = asObject(source.raw);
  if (raw) {
    return raw as SessionRawLike;
  }

  return source as SessionRawLike;
}

function getSessionInfoPath(value: unknown): string | null {
  const source = asObject(value);
  const sessionInfo = asObject(source?.SessionInfo);
  return normalizeStaticPrefix(sessionInfo?.Path);
}

function getSessionRelativePath(value: unknown): string | null {
  const raw = getSessionRaw(value);
  if (!raw) {
    return null;
  }

  const download = asObject(raw.download);
  const downloadSession = asObject(download?.session);
  const downloadPath = asNonEmptyString(downloadSession?.path);
  if (downloadPath) {
    return downloadPath.replace(/^\/+/, '');
  }

  const subscribe = asObject(raw.subscribe);
  const subscribePath = asNonEmptyString(
    asObject(subscribe?.SessionInfo)?.Path,
  );
  if (subscribePath) {
    return subscribePath.replace(/^\/+/, '');
  }

  const keyframes = asObject(raw.keyframes);
  const keyframePath = asNonEmptyString(asObject(keyframes?.SessionInfo)?.Path);
  if (keyframePath) {
    return keyframePath.replace(/^\/+/, '');
  }

  const staticPrefix = getSessionStaticPrefix(raw);
  if (!staticPrefix) {
    return null;
  }

  try {
    const url = new URL(staticPrefix);
    const marker = '/static/';
    const index = url.pathname.indexOf(marker);
    if (index === -1) {
      return null;
    }
    return url.pathname.slice(index + marker.length).replace(/^\/+/, '');
  } catch {
    return null;
  }
}

function toSafePathSegments(relativePath: string | null): string[] {
  if (!relativePath) {
    return [];
  }

  return relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(
      (segment) =>
        segment.length > 0 && segment !== '.' && segment !== '..',
    );
}

function getCaptureFilename(capture: TeamRadioCaptureSummary): string {
  const basename = capture.path
    ? path.posix.basename(capture.path.replace(/\\/g, '/')).trim()
    : '';
  if (basename.length > 0 && basename !== '.' && basename !== '..') {
    return basename;
  }
  return `capture-${capture.captureId}.mp3`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

function pickCapture(
  captures: TeamRadioCaptureSummary[],
  options: {
    captureId?: string | number;
    driverNumber?: string | number;
  } = {},
): TeamRadioCaptureSummary | null {
  if (options.captureId !== undefined) {
    const selected = captures.find(
      (capture) => capture.captureId === String(options.captureId),
    );
    return selected ?? null;
  }

  if (options.driverNumber !== undefined) {
    const selected = captures.find(
      (capture) => capture.driverNumber === String(options.driverNumber),
    );
    return selected ?? null;
  }

  return captures[0] ?? null;
}

export function getDefaultTeamRadioDownloadDir(
  source: unknown,
  options: { appName?: string } = {},
): string {
  const appName = options.appName ?? DEFAULT_APP_NAME;
  const base = path.join(getDataDir(appName), TEAM_RADIO_CACHE_DIR);
  const segments = toSafePathSegments(getSessionRelativePath(source));
  if (segments.length === 0) {
    return path.join(base, 'unknown-session');
  }
  return path.join(base, ...segments);
}

function parseCaptureTime(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function compareCaptureIds(a: string, b: string): number {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) {
    return right - left;
  }
  return b.localeCompare(a);
}

export function getSessionStaticPrefix(source: unknown): string | null {
  const raw = getSessionRaw(source);
  if (!raw) {
    return null;
  }

  const manifestPrefix = normalizeStaticPrefix(asObject(raw.download)?.prefix);
  if (manifestPrefix) {
    return manifestPrefix;
  }

  const subscribePath = getSessionInfoPath(raw.subscribe);
  if (subscribePath) {
    return subscribePath;
  }

  return getSessionInfoPath(raw.keyframes);
}

export function resolveStaticAssetUrl(
  staticPrefix: string | null | undefined,
  assetPath: unknown,
): string | null {
  const path = asNonEmptyString(assetPath);
  if (!path) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const prefix = normalizeStaticPrefix(staticPrefix);
  if (!prefix) {
    return null;
  }

  return new URL(path.replace(/^\/+/, ''), prefix).toString();
}

export function getTeamRadioCaptures(
  state: unknown,
  options: { staticPrefix?: string | null } = {},
): TeamRadioCaptureSummary[] {
  const root = asObject(state);
  if (!root) {
    return [];
  }

  const capturesValue = root.Captures;
  const entries = Array.isArray(capturesValue)
    ? capturesValue.map((capture, index) => [String(index), capture] as const)
    : isPlainObject(capturesValue)
      ? Object.entries(capturesValue)
      : [];

  const captures = entries
    .map(([captureId, capture]) => {
      const record = asObject(capture);
      if (!record) {
        return null;
      }
      const utc = asNonEmptyString(record.Utc);
      return {
        captureId,
        utc,
        driverNumber: asNonEmptyString(record.RacingNumber),
        path: asNonEmptyString(record.Path),
        assetUrl: resolveStaticAssetUrl(options.staticPrefix ?? null, record.Path),
        sortTime: parseCaptureTime(utc),
      };
    })
    .filter((capture) => capture !== null);

  captures.sort((left, right) => {
    if (left.sortTime !== null || right.sortTime !== null) {
      if (left.sortTime === null) {
        return 1;
      }
      if (right.sortTime === null) {
        return -1;
      }
      if (left.sortTime !== right.sortTime) {
        return right.sortTime - left.sortTime;
      }
    }
    return compareCaptureIds(left.captureId, right.captureId);
  });

  return captures.map((capture) => ({
    captureId: capture.captureId,
    utc: capture.utc,
    driverNumber: capture.driverNumber,
    path: capture.path,
    assetUrl: capture.assetUrl,
  }));
}

export async function downloadTeamRadioCapture(opts: {
  source: unknown;
  state: unknown;
  captureId?: string | number;
  driverNumber?: string | number;
  destinationDir?: string;
  appName?: string;
  overwrite?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<TeamRadioDownloadResult> {
  const sessionPrefix = getSessionStaticPrefix(opts.source);
  const captures = getTeamRadioCaptures(opts.state, {
    staticPrefix: sessionPrefix,
  });
  const capture = pickCapture(captures, {
    captureId: opts.captureId,
    driverNumber: opts.driverNumber,
  });

  if (!capture) {
    throw new Error('No matching team radio capture was found.');
  }
  if (!capture.assetUrl) {
    throw new Error('Unable to resolve a static asset URL for the selected team radio capture.');
  }

  const destinationDir =
    opts.destinationDir
    ?? getDefaultTeamRadioDownloadDir(opts.source, { appName: opts.appName });
  await fs.mkdir(destinationDir, { recursive: true });

  const filePath = path.join(destinationDir, getCaptureFilename(capture));
  if (!opts.overwrite) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > 0) {
        return {
          ...capture,
          filePath,
          bytes: stats.size,
          reused: true,
          sessionPrefix,
          destinationDir,
        };
      }
    } catch {
      // File missing or unreadable; continue to download.
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const fetchImpl = opts.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(capture.assetUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to download ${capture.assetUrl}: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return {
      ...capture,
      filePath,
      bytes: buffer.byteLength,
      reused: false,
      sessionPrefix,
      destinationDir,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `Timed out downloading ${capture.assetUrl} after ${FETCH_TIMEOUT_MS}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
