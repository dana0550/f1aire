import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { SessionStore } from './session-store.js';
import { hydrateTimingServiceFromStore, type TimingService } from './timing-service.js';
import { TOPIC_REGISTRY } from './topic-registry.js';
import type { RawPoint } from './processors/types.js';

export const LIVE_TIMING_SIGNALR_URL =
  'wss://livetiming.formula1.com/signalrcore';

export const DEFAULT_LIVE_TIMING_TOPICS = Array.from(
  new Set(TOPIC_REGISTRY.map((definition) => definition.streamName)),
);

export type Formula1SubscriptionTokenPayload = {
  subscriptionStatus: string;
  subscribedProduct: string | null;
  exp: number;
  iat: number;
  expiry: string;
  issuedAt: string;
};

export type Formula1AccessTokenStatus =
  | 'usable'
  | 'no-token'
  | 'invalid'
  | 'inactive'
  | 'expired';

export type Formula1AccessTokenInspection = {
  status: Formula1AccessTokenStatus;
  subscriptionToken: string | null;
  payload: Formula1SubscriptionTokenPayload | null;
};

export type LiveTimingConnection = {
  on: (
    eventName: 'feed',
    callback: (type: string, json: unknown, dateTime: unknown) => void,
  ) => void;
  start: () => Promise<void>;
  invoke: <T = unknown>(methodName: string, ...args: unknown[]) => Promise<T>;
  stop?: () => Promise<void>;
};

export type LiveTimingConnectionFactory = (opts: {
  url: string;
  accessToken: string | null;
}) => Promise<LiveTimingConnection> | LiveTimingConnection;

export type LiveTimingSession = {
  sessionKey: string;
  sessionDir: string | null;
  topics: string[];
  subscription: Record<string, unknown>;
  accessTokenStatus: Formula1AccessTokenStatus;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asFiniteInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toBase64Padded(part: string): string {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  if (remainder === 0) {
    return normalized;
  }
  return normalized.padEnd(normalized.length + (4 - remainder), '=');
}

function decodeJsonBase64Part(part: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(toBase64Padded(part), 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toSubscriptionTokenPayload(
  value: Record<string, unknown>,
): Formula1SubscriptionTokenPayload | null {
  const subscriptionStatus = asText(
    value.subscriptionStatus ?? value.SubscriptionStatus,
  );
  const subscribedProduct =
    asText(value.subscribedProduct ?? value.SubscribedProduct) ?? null;
  const exp = asFiniteInteger(value.exp ?? value.Exp);
  const iat = asFiniteInteger(value.iat ?? value.Iat);

  if (!subscriptionStatus || exp === null || iat === null) {
    return null;
  }

  return {
    subscriptionStatus,
    subscribedProduct,
    exp,
    iat,
    expiry: new Date(exp * 1000).toISOString(),
    issuedAt: new Date(iat * 1000).toISOString(),
  };
}

export function extractFormula1SubscriptionToken(
  accessToken: string | null | undefined,
): string | null {
  if (!accessToken || accessToken.trim().length === 0) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(accessToken);
    const parsed = JSON.parse(decoded) as unknown;
    if (!isPlainObject(parsed)) {
      return null;
    }
    const data = parsed.data;
    if (!isPlainObject(data)) {
      return null;
    }
    return asText(data.subscriptionToken) ?? null;
  } catch {
    return null;
  }
}

export function decodeFormula1AccessToken(
  accessToken: string | null | undefined,
): Formula1SubscriptionTokenPayload | null {
  const subscriptionToken = extractFormula1SubscriptionToken(accessToken);
  if (!subscriptionToken) {
    return null;
  }

  const parts = subscriptionToken.split('.');
  if (parts.length < 2) {
    return null;
  }

  const payload = decodeJsonBase64Part(parts[1] ?? '');
  if (!payload) {
    return null;
  }

  return toSubscriptionTokenPayload(payload);
}

export function inspectFormula1AccessToken(
  accessToken: string | null | undefined,
  now: Date = new Date(),
): Formula1AccessTokenInspection {
  const subscriptionToken = extractFormula1SubscriptionToken(accessToken);
  const payload = decodeFormula1AccessToken(accessToken);

  if (!subscriptionToken) {
    return {
      status: accessToken && accessToken.trim().length > 0 ? 'invalid' : 'no-token',
      subscriptionToken: null,
      payload: null,
    };
  }

  if (!payload) {
    return { status: 'invalid', subscriptionToken, payload: null };
  }

  if (payload.subscriptionStatus.toLowerCase() !== 'active') {
    return { status: 'inactive', subscriptionToken, payload };
  }

  if (new Date(payload.expiry).getTime() <= now.getTime()) {
    return { status: 'expired', subscriptionToken, payload };
  }

  return { status: 'usable', subscriptionToken, payload };
}

function deriveSessionKey(
  subscription: Record<string, unknown>,
  now: Date,
): string {
  const sessionInfo = isPlainObject(subscription.SessionInfo)
    ? subscription.SessionInfo
    : null;
  const meeting = isPlainObject(sessionInfo?.Meeting) ? sessionInfo.Meeting : null;
  const location = asText(meeting?.Location) ?? 'UnknownLocation';
  const sessionName = asText(sessionInfo?.Name) ?? 'UnknownSession';
  const pathValue = asText(sessionInfo?.Path);
  const year = pathValue?.split('/')[0]?.trim() || String(now.getUTCFullYear());
  return `${year}_${location}_${sessionName}`.replace(/\s+/g, '_');
}

function createHydrationStore(
  subscription: Record<string, unknown>,
): SessionStore {
  return {
    raw: {
      subscribe: subscription,
      live: [],
      download: null,
      keyframes: null,
    },
    topic: () => ({
      latest: null,
      timeline: () => [],
    }),
  };
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createDefaultConnection(opts: {
  url: string;
  accessToken: string | null;
}): Promise<LiveTimingConnection> {
  const signalr = await import('@microsoft/signalr');
  const builder = new signalr.HubConnectionBuilder()
    .withUrl(
      opts.url,
      opts.accessToken
        ? {
            accessTokenFactory: () => opts.accessToken as string,
          }
        : {},
    )
    .withAutomaticReconnect()
    .configureLogging(signalr.LogLevel.Warning);

  return builder.build() as unknown as LiveTimingConnection;
}

export class LiveTimingClient {
  connection: LiveTimingConnection | null = null;
  session: LiveTimingSession | null = null;

  private readonly service: TimingService | null;
  private readonly dataRoot: string | null;
  private readonly accessToken: string | null;
  private readonly topics: string[];
  private readonly connectionFactory: LiveTimingConnectionFactory;
  private readonly now: () => Date;
  private ingestChain: Promise<void> = Promise.resolve();
  private sessionDir: string | null = null;

  constructor(
    options: {
      service?: TimingService | null;
      dataRoot?: string | null;
      accessToken?: string | null;
      topics?: string[];
      connectionFactory?: LiveTimingConnectionFactory;
      now?: () => Date;
    } = {},
  ) {
    this.service = options.service ?? null;
    this.dataRoot = options.dataRoot ?? null;
    this.accessToken = options.accessToken ?? null;
    this.topics = Array.from(
      new Set(
        (options.topics ?? DEFAULT_LIVE_TIMING_TOPICS)
          .map((topic) => topic.trim())
          .filter((topic) => topic.length > 0),
      ),
    );
    this.connectionFactory = options.connectionFactory ?? createDefaultConnection;
    this.now = options.now ?? (() => new Date());
  }

  async start() {
    await this.stop();

    const access = inspectFormula1AccessToken(this.accessToken, this.now());
    const connection = await this.connectionFactory({
      url: LIVE_TIMING_SIGNALR_URL,
      accessToken: access.subscriptionToken,
    });
    this.connection = connection;

    let ready = false;
    const buffered: RawPoint[] = [];

    connection.on('feed', (type, json, dateTime) => {
      const point: RawPoint = {
        type,
        json,
        dateTime: asDate(dateTime) ?? this.now(),
      };

      if (!ready) {
        buffered.push(point);
        return;
      }

      void this.queuePoint(point);
    });

    await connection.start();

    const subscriptionRaw = await connection.invoke<unknown>(
      'Subscribe',
      this.topics,
    );
    const subscription = isPlainObject(subscriptionRaw)
      ? (structuredClone(subscriptionRaw) as Record<string, unknown>)
      : {};

    const sessionKey = deriveSessionKey(subscription, this.now());
    const sessionDir = this.dataRoot ? path.join(this.dataRoot, sessionKey) : null;
    this.sessionDir = sessionDir;

    if (sessionDir) {
      await fs.mkdir(sessionDir, { recursive: true });
      const subscribePath = path.join(sessionDir, 'subscribe.json');
      if (!(await fileExists(subscribePath))) {
        await fs.writeFile(
          subscribePath,
          `${JSON.stringify(subscription, null, 2)}\n`,
          'utf-8',
        );
      }
    }

    if (this.service) {
      hydrateTimingServiceFromStore({
        service: this.service,
        store: createHydrationStore(subscription),
      });
    }

    this.session = {
      sessionKey,
      sessionDir,
      topics: [...this.topics],
      subscription,
      accessTokenStatus: access.status,
    };

    ready = true;
    for (const point of buffered) {
      await this.queuePoint(point);
    }

    return this.session;
  }

  async stop() {
    await this.ingestChain;
    if (this.connection?.stop) {
      await this.connection.stop();
    }
    this.connection = null;
    this.session = null;
    this.sessionDir = null;
    this.ingestChain = Promise.resolve();
  }

  private queuePoint(point: RawPoint) {
    this.ingestChain = this.ingestChain.then(async () => {
      if (this.service) {
        this.service.enqueue(point);
      }

      if (!this.sessionDir) {
        return;
      }

      const livePath = path.join(this.sessionDir, 'live.jsonl');
      await fs.appendFile(
        livePath,
        `${JSON.stringify({
          type: point.type,
          json: point.json,
          dateTime: point.dateTime.toISOString(),
        })}\n`,
        'utf-8',
      );
    });

    return this.ingestChain;
  }
}
