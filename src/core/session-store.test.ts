import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { loadSessionStore } from './session-store.js';

function createSessionDir() {
  return mkdtempSync(path.join(tmpdir(), 'f1aire-store-'));
}

describe('SessionStore', () => {
  it('loads raw files and exposes topic latest + timeline', async () => {
    const base = createSessionDir();
    writeFileSync(
      path.join(base, 'subscribe.json'),
      JSON.stringify({
        SessionInfo: { Name: 'Test' },
        Heartbeat: { Utc: '2025-01-01T00:00:00Z' },
      }),
      'utf-8',
    );
    writeFileSync(
      path.join(base, 'live.jsonl'),
      [
        JSON.stringify({
          type: 'DriverList',
          json: { '4': { FullName: 'Lando Norris' } },
          dateTime: '2025-01-01T00:00:01Z',
        }),
        JSON.stringify({
          type: 'TimingData',
          json: { Lines: { '4': { Position: '1' } } },
          dateTime: '2025-01-01T00:00:02Z',
        }),
      ].join('\n'),
      'utf-8',
    );

    const store = await loadSessionStore(base);

    expect(store.raw.subscribe.SessionInfo.Name).toBe('Test');
    expect(store.raw.keyframes).toBeNull();
    expect(store.topic('DriverList').latest?.json).toHaveProperty('4');
    expect(store.topic('TimingData').timeline()).toHaveLength(1);
  });

  it('falls back to legacy subscribe.txt/live.txt recordings from undercut-f1', async () => {
    const base = createSessionDir();
    const compressedCarData = deflateRawSync(
      Buffer.from(
        JSON.stringify({ Entries: [{ Utc: '2025-01-01T00:00:02Z' }] }),
      ),
    ).toString('base64');

    writeFileSync(
      path.join(base, 'subscribe.txt'),
      JSON.stringify({
        SessionInfo: { Name: 'Legacy Replay' },
        Heartbeat: { Utc: '2025-01-01T00:00:00Z', _kf: true },
      }),
      'utf-8',
    );
    writeFileSync(
      path.join(base, 'live.txt'),
      [
        JSON.stringify({
          H: 'Streaming',
          M: 'feed',
          A: [
            'DriverList',
            { '4': { FullName: 'Lando Norris' } },
            '2025-01-01T00:00:01Z',
          ],
        }),
        JSON.stringify({
          H: 'Streaming',
          M: 'feed',
          A: ['CarData.z', compressedCarData, '2025-01-01T00:00:02Z'],
        }),
      ].join('\n'),
      'utf-8',
    );

    const store = await loadSessionStore(base);

    expect(store.raw.subscribe.SessionInfo.Name).toBe('Legacy Replay');
    expect(store.raw.live).toHaveLength(2);
    expect(store.topic('DriverList').latest).toMatchObject({
      json: { '4': { FullName: 'Lando Norris' } },
    });
    expect(store.topic('DriverList').latest?.dateTime.toISOString()).toBe(
      '2025-01-01T00:00:01.000Z',
    );
    expect(store.topic('CarData.z').latest).toMatchObject({
      type: 'CarData.z',
      json: compressedCarData,
    });
  });

  it('parses BOM-prefixed PascalCase legacy replay dumps from the reference repo', async () => {
    const base = createSessionDir();

    writeFileSync(
      path.join(base, 'subscribe.txt'),
      `\uFEFF${JSON.stringify({
        SessionInfo: { Name: 'Sakhir Race' },
        Heartbeat: { Utc: '2025-04-13T14:08:16.000Z' },
      })}`,
      'utf-8',
    );
    writeFileSync(
      path.join(base, 'live.txt'),
      [
        `\uFEFF${JSON.stringify({
          Type: 'TrackStatus',
          Json: { Status: '1', Message: 'AllClear' },
          DateTime: '2025-04-13T14:08:16.2570245+00:00',
        })}`,
        JSON.stringify({
          Type: 'ExtrapolatedClock',
          Json: {
            Utc: '2025-04-13T14:08:17.393Z',
            Remaining: '00:00:00',
            Extrapolating: false,
          },
          DateTime: '2025-04-13T14:08:19.3840245+00:00',
        }),
      ].join('\n'),
      'utf-8',
    );

    const store = await loadSessionStore(base);

    expect(store.raw.subscribe.SessionInfo.Name).toBe('Sakhir Race');
    expect(store.raw.live).toHaveLength(2);
    expect(store.topic('TrackStatus').latest).toMatchObject({
      type: 'TrackStatus',
      json: { Status: '1', Message: 'AllClear' },
    });
    expect(store.topic('ExtrapolatedClock').latest?.dateTime.toISOString()).toBe(
      '2025-04-13T14:08:19.384Z',
    );
  });
});
