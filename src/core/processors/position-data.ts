import type { PositionBatch, PositionState } from '../feed-models.js';
import { getPositionBatches, getPositionEntries } from '../feed-models.js';
import type { Processor, RawPoint } from './types.js';

export class PositionDataProcessor implements Processor<PositionState> {
  latest: PositionState | null = null;
  state: PositionState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'Position') return;
    const updates = getPositionBatches(point.json);
    if (!this.state) this.state = { Position: [] };
    if (this.state.Position.length === 0) {
      this.state.Position.push({ Entries: {} });
    }
    const current = this.state.Position[
      this.state.Position.length - 1
    ] as PositionBatch;
    for (const update of updates) {
      const updateEntries = getPositionEntries(update);
      if (Object.keys(updateEntries).length > 0) {
        current.Entries = {
          ...(current.Entries ?? {}),
          ...structuredClone(updateEntries),
        };
      }
      if (update?.Timestamp) current.Timestamp = update.Timestamp;
    }
    this.latest = this.state;
  }
}
