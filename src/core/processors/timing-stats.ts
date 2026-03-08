import {
  getTimingStatsDriver,
  getTimingStatsTrapTable,
  getTimingStatsTrapTables,
  mergeTimingStatsState,
  type TimingStatsState,
} from '../timing-stats.js';
import type { Processor, RawPoint } from './types.js';

export class TimingStatsProcessor implements Processor<TimingStatsState> {
  latest: TimingStatsState | null = null;
  state: TimingStatsState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'TimingStats') {
      return;
    }

    this.state = mergeTimingStatsState(this.state, point.json ?? null);
    this.latest = this.state;
  }

  getDriver(
    opts: {
      driverListState?: Record<string, unknown> | null;
      driverNumber: string | number;
    },
  ) {
    return getTimingStatsDriver({
      state: this.state,
      driverListState: opts.driverListState,
      driverNumber: opts.driverNumber,
    });
  }

  getTrapTable(
    opts: {
      driverListState?: Record<string, unknown> | null;
      trap: string;
      limit?: number;
    },
  ) {
    return getTimingStatsTrapTable({
      state: this.state,
      driverListState: opts.driverListState,
      trap: opts.trap,
      limit: opts.limit,
    });
  }

  getTrapTables(
    opts: {
      driverListState?: Record<string, unknown> | null;
      limit?: number;
    } = {},
  ) {
    return getTimingStatsTrapTables({
      state: this.state,
      driverListState: opts.driverListState,
      limit: opts.limit,
    });
  }
}
