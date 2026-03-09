import {
  getTimingAppDataLine,
  getTimingAppDataStint,
  getTimingAppDataStints,
  mergeTimingAppDataState,
  type TimingAppDataLine,
  type TimingAppDataState,
  type TimingAppDataStint,
} from '../timing-app-data.js';
import type { Processor, RawPoint } from './types.js';

export class TimingAppDataProcessor implements Processor<TimingAppDataState> {
  latest: TimingAppDataState | null = null;
  state: TimingAppDataState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'TimingAppData') {
      return;
    }

    this.state = mergeTimingAppDataState(this.state, point.json);
    this.latest = this.state;
  }

  getLine(driverNumber: string | number): TimingAppDataLine | null {
    return getTimingAppDataLine(this.state, driverNumber);
  }

  getStints(
    driverNumber: string | number,
  ): Array<[string, TimingAppDataStint]> {
    return getTimingAppDataStints(this.getLine(driverNumber));
  }

  getStint(
    driverNumber: string | number,
    stint: string | number,
  ): TimingAppDataStint | null {
    return getTimingAppDataStint(this.state, driverNumber, stint);
  }
}
