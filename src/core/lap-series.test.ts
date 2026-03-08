import { describe, expect, it } from 'vitest';
import { getLapSeriesRecords, summarizeLapSeries } from './lap-series.js';

describe('lap-series', () => {
  it('builds deterministic lap-position records from array and patch forms', () => {
    const records = getLapSeriesRecords({
      lapSeriesState: {
        '4': {
          RacingNumber: '4',
          LapPosition: ['2', '3', '1'],
        },
        '81': {
          RacingNumber: '81',
          LapPosition: {
            '0': '4',
            '1': { Value: '5' },
            '2': { Position: '4' },
          },
        },
      },
    });

    expect(records).toEqual([
      { driverNumber: '4', lap: 1, position: 2, source: 'LapSeries' },
      { driverNumber: '4', lap: 2, position: 3, source: 'LapSeries' },
      { driverNumber: '4', lap: 3, position: 1, source: 'LapSeries' },
      { driverNumber: '81', lap: 1, position: 4, source: 'LapSeries' },
      { driverNumber: '81', lap: 2, position: 5, source: 'LapSeries' },
      { driverNumber: '81', lap: 3, position: 4, source: 'LapSeries' },
    ]);

    expect(
      summarizeLapSeries(
        records.filter((record) => record.driverNumber === '4'),
      ),
    ).toEqual({
      driverNumber: '4',
      totalLaps: 3,
      startLap: 1,
      endLap: 3,
      startPosition: 2,
      endPosition: 1,
      bestPosition: 1,
      worstPosition: 3,
      positionsGained: 1,
      changes: 2,
    });
  });

  it('filters lap-series records by driver and lap range', () => {
    const records = getLapSeriesRecords({
      lapSeriesState: {
        '4': {
          RacingNumber: '4',
          LapPosition: ['2', '3', '1'],
        },
        '81': {
          RacingNumber: '81',
          LapPosition: ['4', '5', '4'],
        },
      },
      driverNumber: '81',
      startLap: 2,
      endLap: 3,
    });

    expect(records).toEqual([
      { driverNumber: '81', lap: 2, position: 5, source: 'LapSeries' },
      { driverNumber: '81', lap: 3, position: 4, source: 'LapSeries' },
    ]);
  });
});
