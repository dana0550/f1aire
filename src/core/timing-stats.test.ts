import { describe, expect, it } from 'vitest';
import {
  buildTimingStatsState,
  getTimingStatsDriver,
  getTimingStatsTrapTable,
  getTimingStatsTrapTables,
} from './timing-stats.js';

describe('timing stats helpers', () => {
  it('builds deterministic trap tables from merged timing stats patches', () => {
    const state = buildTimingStatsState({
      baseState: {
        Lines: {
          '4': {
            BestSpeeds: {
              FL: { Value: '338.5', Position: 2 },
              I1: { Value: '295.1', Position: 1 },
            },
          },
        },
      },
      timeline: [
        {
          json: {
            Lines: {
              '81': {
                BestSpeeds: {
                  FL: { Value: '340.0', Position: 1 },
                  ST: { Value: '320.1', Position: '1' },
                },
              },
              '4': {
                BestSpeeds: {
                  ST: { Value: '319.0', Position: 2 },
                },
              },
            },
          },
        },
        {
          json: {
            Lines: {
              '16': {
                Speeds: {
                  FL: { Value: '337.9' },
                },
              },
            },
          },
        },
      ],
    });

    const driverListState = {
      '4': { FullName: 'Lando Norris' },
      '16': { Tla: 'LEC' },
      '81': { BroadcastName: 'Oscar Piastri' },
    };

    expect(
      getTimingStatsTrapTable({
        state,
        driverListState,
        trap: 'fl',
      }),
    ).toMatchObject({
      trap: 'FL',
      totalDrivers: 3,
      fastest: {
        driverNumber: '81',
        driverName: 'Oscar Piastri',
        position: 1,
        value: '340.0',
        speedKph: 340,
      },
      records: [
        {
          driverNumber: '81',
          driverName: 'Oscar Piastri',
          position: 1,
        },
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          position: 2,
        },
        {
          driverNumber: '16',
          driverName: 'LEC',
          position: null,
          speedKph: 337.9,
        },
      ],
    });

    expect(
      getTimingStatsTrapTables({
        state,
        driverListState,
      }).map((table) => table.trap),
    ).toEqual(['FL', 'I1', 'ST']);
  });

  it('returns normalized per-driver best-speed records', () => {
    const state = buildTimingStatsState({
      baseState: {
        Lines: {
          '4': {
            BestSpeeds: {
              ST: { Value: '319.0', Position: '2' },
              FL: { Value: '338.5', Position: 2 },
            },
          },
        },
      },
    });

    expect(
      getTimingStatsDriver({
        state,
        driverListState: { '4': { FullName: 'Lando Norris' } },
        driverNumber: 4,
      }),
    ).toMatchObject({
      driverNumber: '4',
      driverName: 'Lando Norris',
      bestSpeeds: [
        {
          trap: 'FL',
          position: 2,
          value: '338.5',
          speedKph: 338.5,
        },
        {
          trap: 'ST',
          position: 2,
          value: '319.0',
          speedKph: 319,
        },
      ],
    });
  });
});
