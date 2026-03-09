import { describe, expect, it } from 'vitest';
import {
  getCurrentLap,
  getLapCountSnapshot,
  getTotalLaps,
  replaceLapCountState,
} from './lap-count.js';

describe('lap-count helpers', () => {
  it('coerces lap counters to integers and preserves replacement semantics', () => {
    expect(
      replaceLapCountState({ CurrentLap: '12', TotalLaps: '57', Status: 'Green' }),
    ).toEqual({
      CurrentLap: 12,
      TotalLaps: 57,
      Status: 'Green',
    });
  });

  it('builds a deterministic progress snapshot', () => {
    const state = { CurrentLap: '18', TotalLaps: 57 };

    expect(getCurrentLap(state)).toBe(18);
    expect(getTotalLaps(state)).toBe(57);
    expect(getLapCountSnapshot(state)).toEqual({
      currentLap: 18,
      totalLaps: 57,
      lapsRemaining: 39,
    });
  });
});
