import type { SessionStore } from './session-store.js';

const STATIC_BASE_URL = 'https://livetiming.formula1.com/static/';

type ObjectRecord = Record<string, unknown>;

type SessionRawLike = Pick<SessionStore['raw'], 'download' | 'subscribe' | 'keyframes'>;

export type TeamRadioCaptureSummary = {
  captureId: string;
  utc: string | null;
  driverNumber: string | null;
  path: string | null;
  assetUrl: string | null;
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
