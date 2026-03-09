import path from 'node:path';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVE_TIMING_TOPICS,
  LiveTimingClient,
  inspectFormula1AccessToken,
  type LiveTimingConnection,
} from './live-timing-client.js';
import { TimingService } from './timing-service.js';

function encodeBase64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeAccessToken(payload: {
  subscriptionStatus: string;
  subscribedProduct?: string | null;
  exp: number;
  iat: number;
}) {
  const subscriptionToken = `${encodeBase64Url({ alg: 'none', typ: 'JWT' })}.${encodeBase64Url(
    payload,
  )}.sig`;
  return encodeURIComponent(JSON.stringify({ data: { subscriptionToken } }));
}

class FakeConnection implements LiveTimingConnection {
  handler:
    | ((type: string, json: unknown, dateTime: unknown) => void)
    | null = null;
  started = false;
  stopped = false;
  invokeCalls: Array<{ methodName: string; args: unknown[] }> = [];

  constructor(
    private readonly subscription: Record<string, unknown>,
    private readonly onStart?: () => void,
  ) {}

  on(
    eventName: 'feed',
    callback: (type: string, json: unknown, dateTime: unknown) => void,
  ) {
    expect(eventName).toBe('feed');
    this.handler = callback;
  }

  async start() {
    this.started = true;
    this.onStart?.();
  }

  async invoke<T = unknown>(methodName: string, ...args: unknown[]): Promise<T> {
    this.invokeCalls.push({ methodName, args });
    return this.subscription as T;
  }

  async stop() {
    this.stopped = true;
  }

  emit(type: string, json: unknown, dateTime: unknown) {
    this.handler?.(type, json, dateTime);
  }
}

describe('live-timing-client token inspection', () => {
  it('classifies usable, inactive, expired, and invalid Formula 1 access tokens', () => {
    const now = new Date('2026-03-09T12:00:00.000Z');

    expect(inspectFormula1AccessToken(null, now)).toMatchObject({
      status: 'no-token',
      subscriptionToken: null,
      payload: null,
    });

    expect(inspectFormula1AccessToken('not-a-token', now)).toMatchObject({
      status: 'invalid',
      subscriptionToken: null,
      payload: null,
    });

    expect(
      inspectFormula1AccessToken(
        makeAccessToken({
          subscriptionStatus: 'active',
          subscribedProduct: 'F1TV Pro',
          exp: Math.trunc(new Date('2026-03-10T00:00:00.000Z').getTime() / 1000),
          iat: Math.trunc(new Date('2026-03-01T00:00:00.000Z').getTime() / 1000),
        }),
        now,
      ),
    ).toMatchObject({
      status: 'usable',
      payload: {
        subscriptionStatus: 'active',
        subscribedProduct: 'F1TV Pro',
        expiry: '2026-03-10T00:00:00.000Z',
        issuedAt: '2026-03-01T00:00:00.000Z',
      },
    });

    expect(
      inspectFormula1AccessToken(
        makeAccessToken({
          subscriptionStatus: 'inactive',
          exp: Math.trunc(new Date('2026-03-10T00:00:00.000Z').getTime() / 1000),
          iat: Math.trunc(new Date('2026-03-01T00:00:00.000Z').getTime() / 1000),
        }),
        now,
      ),
    ).toMatchObject({
      status: 'inactive',
      payload: {
        subscriptionStatus: 'inactive',
      },
    });

    expect(
      inspectFormula1AccessToken(
        makeAccessToken({
          subscriptionStatus: 'active',
          exp: Math.trunc(new Date('2026-03-08T00:00:00.000Z').getTime() / 1000),
          iat: Math.trunc(new Date('2026-03-01T00:00:00.000Z').getTime() / 1000),
        }),
        now,
      ),
    ).toMatchObject({
      status: 'expired',
      payload: {
        subscriptionStatus: 'active',
        expiry: '2026-03-08T00:00:00.000Z',
      },
    });
  });
});

describe('LiveTimingClient', () => {
  it('subscribes to live timing, hydrates processors, and records incoming feed data', async () => {
    const dataRoot = mkdtempSync(path.join(tmpdir(), 'f1aire-live-client-'));
    const timingService = new TimingService();
    let connection: FakeConnection | null = null;

    try {
      const accessToken = makeAccessToken({
        subscriptionStatus: 'active',
        subscribedProduct: 'F1TV Pro',
        exp: Math.trunc(new Date('2026-03-10T00:00:00.000Z').getTime() / 1000),
        iat: Math.trunc(new Date('2026-03-01T00:00:00.000Z').getTime() / 1000),
      });

      const client = new LiveTimingClient({
        service: timingService,
        dataRoot,
        accessToken,
        topics: ['SessionInfo', 'DriverList', 'TimingData', 'TeamRadio'],
        now: () => new Date('2026-03-09T12:00:00.000Z'),
        connectionFactory: async ({ accessToken: subscriptionToken, url }) => {
          expect(url).toBe('wss://livetiming.formula1.com/signalrcore');
          expect(subscriptionToken).toMatch(/^ey/);

          connection = new FakeConnection(
            {
              SessionInfo: {
                Name: 'Race',
                Path: '2026/2026-03-09_Australian_Grand_Prix/2026-03-09_Race/',
                Meeting: { Location: 'Melbourne' },
              },
              Heartbeat: { Utc: '2026-03-09T12:00:00.000Z' },
              DriverList: {
                '4': { FullName: 'Lando Norris' },
              },
            },
            () => {
              connection?.emit(
                'TimingData',
                {
                  Lines: {
                    '4': {
                      NumberOfLaps: 1,
                      Position: '1',
                      BestLapTime: { Value: '1:30.000' },
                    },
                  },
                },
                '2026-03-09T12:00:01.000Z',
              );
            },
          );
          return connection;
        },
      });

      const session = await client.start();

      expect(connection?.started).toBe(true);
      expect(connection?.invokeCalls).toEqual([
        {
          methodName: 'Subscribe',
          args: [['SessionInfo', 'DriverList', 'TimingData', 'TeamRadio']],
        },
      ]);
      expect(session).toMatchObject({
        sessionKey: '2026_Melbourne_Race',
        sessionDir: path.join(dataRoot, '2026_Melbourne_Race'),
        accessTokenStatus: 'usable',
        topics: ['SessionInfo', 'DriverList', 'TimingData', 'TeamRadio'],
      });
      expect(DEFAULT_LIVE_TIMING_TOPICS).toContain('CarData.z');
      expect(DEFAULT_LIVE_TIMING_TOPICS).toContain('Position.z');

      expect(timingService.processors.driverList.getName('4')).toBe('Lando Norris');
      expect(timingService.processors.timingData.getLapSnapshot('4', 1)).toMatchObject({
        Position: '1',
        BestLapTime: { Value: '1:30.000' },
      });

      connection?.emit(
        'TeamRadio',
        {
          Captures: {
            '0': {
              Utc: '2026-03-09T12:01:00.000Z',
              RacingNumber: '4',
              Path: 'TeamRadio/LANNOR01_4_20260309_120100.mp3',
            },
          },
        },
        '2026-03-09T12:01:00.000Z',
      );

      await client.stop();

      expect(connection?.stopped).toBe(true);
      expect(timingService.processors.teamRadio.getLatestCapture()).toMatchObject({
        captureId: '0',
        driverNumber: '4',
        path: 'TeamRadio/LANNOR01_4_20260309_120100.mp3',
      });

      const subscribePath = path.join(dataRoot, '2026_Melbourne_Race', 'subscribe.json');
      const livePath = path.join(dataRoot, '2026_Melbourne_Race', 'live.jsonl');

      expect(JSON.parse(readFileSync(subscribePath, 'utf-8'))).toMatchObject({
        SessionInfo: {
          Name: 'Race',
          Meeting: { Location: 'Melbourne' },
        },
      });

      const liveLines = readFileSync(livePath, 'utf-8')
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line));

      expect(liveLines).toMatchObject([
        {
          type: 'TimingData',
          json: {
            Lines: {
              '4': {
                NumberOfLaps: 1,
                Position: '1',
                BestLapTime: { Value: '1:30.000' },
              },
            },
          },
          dateTime: '2026-03-09T12:00:01.000Z',
        },
        {
          type: 'TeamRadio',
          json: {
            Captures: {
              '0': {
                Utc: '2026-03-09T12:01:00.000Z',
                RacingNumber: '4',
                Path: 'TeamRadio/LANNOR01_4_20260309_120100.mp3',
              },
            },
          },
          dateTime: '2026-03-09T12:01:00.000Z',
        },
      ]);
    } finally {
      rmSync(dataRoot, { recursive: true, force: true });
    }
  });
});
