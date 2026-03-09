import { describe, expect, it } from 'vitest';
import {
  buildPitLaneTimeCollectionState,
  getPitLaneTimeRecords,
  parseDurationMs,
} from './pit-lane-time-collection.js';

describe('pit-lane-time-collection helpers', () => {
  it('builds deterministic per-driver lists from incremental PitTimes patches', () => {
    const state = buildPitLaneTimeCollectionState({
      baseState: {
        PitTimes: {
          '4': { Duration: '22.100', Lap: '12' },
        },
      },
      timeline: [
        {
          json: {
            PitTimes: {
              '81': { RacingNumber: '81', Duration: '23.500', Lap: '18' },
            },
          },
        },
        {
          json: {
            PitTimes: {
              '4': { Duration: '21.950', Lap: '30' },
            },
          },
        },
      ],
    });

    expect(state).toMatchObject({
      PitTimes: {
        '4': { RacingNumber: '4', Duration: '21.950', Lap: '30' },
        '81': { RacingNumber: '81', Duration: '23.500', Lap: '18' },
      },
      PitTimesList: {
        '4': [
          { RacingNumber: '4', Duration: '22.100', Lap: '12' },
          { RacingNumber: '4', Duration: '21.950', Lap: '30' },
        ],
        '81': [{ RacingNumber: '81', Duration: '23.500', Lap: '18' }],
      },
    });

    expect(getPitLaneTimeRecords({ state })).toEqual([
      {
        driverNumber: '4',
        lap: 12,
        duration: '22.100',
        durationMs: 22_100,
        raw: { RacingNumber: '4', Duration: '22.100', Lap: '12' },
      },
      {
        driverNumber: '4',
        lap: 30,
        duration: '21.950',
        durationMs: 21_950,
        raw: { RacingNumber: '4', Duration: '21.950', Lap: '30' },
      },
      {
        driverNumber: '81',
        lap: 18,
        duration: '23.500',
        durationMs: 23_500,
        raw: { RacingNumber: '81', Duration: '23.500', Lap: '18' },
      },
    ]);
  });

  it('uses existing PitTimesList snapshots without duplicating latest PitTimes', () => {
    const state = {
      PitTimes: {
        '4': { RacingNumber: '4', Duration: '21.000', Lap: '20' },
      },
      PitTimesList: {
        '4': [
          { RacingNumber: '4', Duration: '22.000', Lap: '5' },
          { RacingNumber: '4', Duration: '21.000', Lap: '20' },
        ],
      },
    };

    expect(
      getPitLaneTimeRecords({
        state,
        driverNumber: '4',
        startLap: 10,
      }),
    ).toEqual([
      {
        driverNumber: '4',
        lap: 20,
        duration: '21.000',
        durationMs: 21_000,
        raw: { RacingNumber: '4', Duration: '21.000', Lap: '20' },
      },
    ]);
  });
});

describe('parseDurationMs', () => {
  it('parses numeric seconds and clock formats', () => {
    expect(parseDurationMs('22.123')).toBe(22_123);
    expect(parseDurationMs('0:22.123')).toBe(22_123);
    expect(parseDurationMs('1:02.345')).toBe(62_345);
    expect(parseDurationMs(20)).toBe(20_000);
  });
});
