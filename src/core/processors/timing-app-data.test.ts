import { describe, expect, it } from 'vitest';
import { TimingAppDataProcessor } from './timing-app-data.js';

describe('TimingAppDataProcessor', () => {
  it('merges patches and exposes typed stint helpers', () => {
    const processor = new TimingAppDataProcessor();

    processor.process({
      type: 'TimingAppData',
      json: {
        Lines: {
          '4': {
            Stints: {
              '0': {
                Compound: 'SOFT',
                StartLaps: 0,
                TotalLaps: 10,
              },
            },
          },
        },
      },
      dateTime: new Date('2025-01-01T00:00:01Z'),
    });

    processor.process({
      type: 'TimingAppData',
      json: {
        Lines: {
          '4': {
            Line: 1,
            Stints: {
              '1': {
                Compound: 'MEDIUM',
                StartLaps: 10,
                TotalLaps: 20,
              },
            },
          },
        },
      },
      dateTime: new Date('2025-01-01T00:00:02Z'),
    });

    expect(processor.getLine('4')).toMatchObject({
      Line: 1,
    });
    expect(processor.getStints('4')).toEqual([
      [
        '0',
        {
          Compound: 'SOFT',
          StartLaps: 0,
          TotalLaps: 10,
        },
      ],
      [
        '1',
        {
          Compound: 'MEDIUM',
          StartLaps: 10,
          TotalLaps: 20,
        },
      ],
    ]);
    expect(processor.getStint('4', 1)).toEqual({
      Compound: 'MEDIUM',
      StartLaps: 10,
      TotalLaps: 20,
    });
  });
});
