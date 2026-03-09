import { describe, expect, it } from 'vitest';
import {
  getHeartbeatDate,
  getHeartbeatSnapshot,
  getHeartbeatUtc,
  replaceHeartbeatState,
} from './heartbeat.js';

describe('heartbeat helpers', () => {
  it('canonicalizes alternate UTC field names to a single ISO Utc value', () => {
    expect(
      replaceHeartbeatState({ UtcTime: '2025-03-09T12:34:56Z', Sequence: 7 }),
    ).toEqual({
      Utc: '2025-03-09T12:34:56.000Z',
      Sequence: 7,
    });

    expect(getHeartbeatUtc({ utc: '2025-03-09T12:34:57Z' })).toBe(
      '2025-03-09T12:34:57.000Z',
    );
  });

  it('returns parsed date and snapshot values when a valid UTC is present', () => {
    const state = { Utc: '2025-03-09T12:34:56.123Z' };

    expect(getHeartbeatDate(state)?.toISOString()).toBe(
      '2025-03-09T12:34:56.123Z',
    );
    expect(getHeartbeatSnapshot(state)).toEqual({
      utc: '2025-03-09T12:34:56.123Z',
    });
  });
});
