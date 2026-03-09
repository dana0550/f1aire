import {
  mergePitLaneTimeCollectionState,
  type PitLaneTimeCollectionState,
} from '../pit-lane-time-collection.js';
import type { Processor, RawPoint } from './types.js';

export class PitLaneTimeCollectionProcessor implements Processor<PitLaneTimeCollectionState> {
  latest: PitLaneTimeCollectionState | null = null;
  state: PitLaneTimeCollectionState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'PitLaneTimeCollection') return;
    this.state = mergePitLaneTimeCollectionState(this.state, point.json);
    this.latest = this.state;
  }
}
