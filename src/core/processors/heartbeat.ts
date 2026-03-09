import {
  replaceHeartbeatState,
  type HeartbeatState,
} from '../heartbeat.js';
import type { Processor, RawPoint } from './types.js';

export class HeartbeatProcessor implements Processor<HeartbeatState> {
  latest: HeartbeatState | null = null;
  state: HeartbeatState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'Heartbeat') {
      return;
    }

    const next = replaceHeartbeatState(point.json);
    this.state = next;
    this.latest = next;
  }
}
