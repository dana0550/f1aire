import { describe, expect, it } from 'vitest';
import { TimingStatsProcessor } from './timing-stats.js';

describe('TimingStatsProcessor', () => {
  it('merges TimingStats patches and exposes ordered trap tables', () => {
    const processor = new TimingStatsProcessor();

    processor.process({
      type: 'TimingStats',
      json: {
        Lines: {
          '4': {
            BestSpeeds: {
              FL: { Value: '338.5', Position: 2 },
            },
          },
        },
      },
      dateTime: new Date('2025-01-01T00:00:01Z'),
    });
    processor.process({
      type: 'TimingStats',
      json: {
        Lines: {
          '81': {
            BestSpeeds: {
              FL: { Value: '340.0', Position: 1 },
            },
          },
        },
      },
      dateTime: new Date('2025-01-01T00:00:02Z'),
    });

    expect(processor.state).toEqual({
      Lines: {
        '4': {
          BestSpeeds: {
            FL: { Value: '338.5', Position: 2 },
          },
        },
        '81': {
          BestSpeeds: {
            FL: { Value: '340.0', Position: 1 },
          },
        },
      },
    });

    expect(
      processor.getTrapTable({
        trap: 'fl',
        driverListState: {
          '4': { FullName: 'Lando Norris' },
          '81': { FullName: 'Oscar Piastri' },
        },
      }),
    ).toMatchObject({
      trap: 'FL',
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
      ],
    });
  });
});
