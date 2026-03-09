import { replaceLapCountState, type LapCountState } from '../lap-count.js';
import type { Processor, RawPoint } from './types.js';

export class LapCountProcessor implements Processor<LapCountState> {
  latest: LapCountState | null = null;
  state: LapCountState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'LapCount') {
      return;
    }

    const next = replaceLapCountState(point.json);
    this.state = next;
    this.latest = next;
  }
}
