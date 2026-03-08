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
});
