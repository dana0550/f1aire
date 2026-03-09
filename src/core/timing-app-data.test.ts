import { describe, expect, it } from 'vitest';
import {
  buildTimingAppDataState,
  getTimingAppDataLine,
  getTimingAppDataStint,
  getTimingAppDataStints,
  mergeTimingAppDataState,
} from './timing-app-data.js';

describe('timing-app-data', () => {
  it('merges stint patches and exposes ordered typed accessors', () => {
    const state = buildTimingAppDataState({
      baseState: {
        Lines: {
          '4': {
            Stints: {
              '1': {
                Compound: 'MEDIUM',
                StartLaps: 12,
                TotalLaps: 14,
              },
            },
          },
        },
      },
      timeline: [
        {
          json: {
            Lines: {
              '4': {
                Line: 1,
                Stints: {
                  '2': {
                    Compound: 'HARD',
                    StartLaps: 14,
                    TotalLaps: 18,
                  },
                },
              },
              '81': {
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
        },
      ],
    });

    expect(getTimingAppDataLine(state, '4')).toMatchObject({
      Line: 1,
      Stints: {
        '1': {
          Compound: 'MEDIUM',
          StartLaps: 12,
          TotalLaps: 14,
        },
        '2': {
          Compound: 'HARD',
          StartLaps: 14,
          TotalLaps: 18,
        },
      },
    });
    expect(getTimingAppDataStints(getTimingAppDataLine(state, '4'))).toEqual([
      [
        '1',
        {
          Compound: 'MEDIUM',
          StartLaps: 12,
          TotalLaps: 14,
        },
      ],
      [
        '2',
        {
          Compound: 'HARD',
          StartLaps: 14,
          TotalLaps: 18,
        },
      ],
    ]);
    expect(getTimingAppDataStint(state, '81', 0)).toEqual({
      Compound: 'SOFT',
      StartLaps: 0,
      TotalLaps: 10,
    });
  });

  it('returns a cloned current state when the patch is invalid', () => {
    const current = mergeTimingAppDataState(null, {
      Lines: {
        '4': {
          Stints: {
            '0': {
              Compound: 'SOFT',
            },
          },
        },
      },
    });

    const next = mergeTimingAppDataState(current, null);

    expect(next).toEqual(current);
    expect(next).not.toBe(current);
  });
});
