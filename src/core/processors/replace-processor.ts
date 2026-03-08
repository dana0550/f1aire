import type { Processor, RawPoint } from './types.js';

export class ReplaceProcessor<T = unknown> implements Processor<T> {
  latest: T | null = null;
  state: T | null = null;
  private readonly matchType: string;

  constructor(matchType: string) {
    this.matchType = matchType;
  }

  process(point: RawPoint) {
    if (point.type !== this.matchType) return;
    const next = structuredClone(point.json ?? null) as T;
    this.state = next;
    this.latest = next;
  }
}
