import type { CarDataState } from '../feed-models.js';
import { getCarDataEntries } from '../feed-models.js';
import type { Processor, RawPoint } from './types.js';

export class CarDataProcessor implements Processor<CarDataState> {
  latest: CarDataState | null = null;
  state: CarDataState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'CarData') return;
    const entries = getCarDataEntries(point.json);
    if (!this.state) this.state = { Entries: [] };
    if (entries.length > 0) {
      this.state.Entries = [structuredClone(entries[entries.length - 1]!)];
    }
    this.latest = this.state;
  }
}
