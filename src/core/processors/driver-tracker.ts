import {
  getDriverTrackerMeta,
  getDriverTrackerRows,
  mergeDriverTrackerState,
  type DriverTrackerState,
} from '../driver-tracker.js';
import type { Processor, RawPoint } from './types.js';

export class DriverTrackerProcessor implements Processor<DriverTrackerState> {
  latest: DriverTrackerState | null = null;
  state: DriverTrackerState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'DriverTracker') {
      return;
    }

    this.state = mergeDriverTrackerState(this.state, point.json ?? null);
    this.latest = this.state;
  }

  getMeta() {
    return getDriverTrackerMeta(this.state);
  }

  getRows(
    opts: {
      driverListState?: Record<string, unknown> | null;
      driverNumber?: string | number;
    } = {},
  ) {
    return getDriverTrackerRows({
      state: this.state,
      driverListState: opts.driverListState,
      driverNumber: opts.driverNumber,
    });
  }
}
