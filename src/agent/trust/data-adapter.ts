export type FreshnessState = 'fresh' | 'stale' | 'unknown';

export type CapabilityStatus = {
  freshness: FreshnessState;
  coverage: number;
  stalenessMs: number | null;
};

export type DataAdapter = {
  topic: string;
  version: string;
  normalize: (input: unknown) => unknown;
  capabilities: (input: unknown) => Record<string, CapabilityStatus>;
};

export type CapabilityThresholds = {
  minCoverage?: number;
  allowStale?: boolean;
};

export class DataAdapterRegistry {
  private readonly adapters = new Map<string, DataAdapter>();

  register(adapter: DataAdapter) {
    this.adapters.set(adapter.topic, adapter);
  }

  get(topic: string): DataAdapter | undefined {
    return this.adapters.get(topic);
  }

  normalize(topic: string, input: unknown): unknown {
    const adapter = this.adapters.get(topic);
    if (!adapter) return input;
    return adapter.normalize(input);
  }

  getCapabilities(topic: string, input: unknown): Record<string, CapabilityStatus> {
    const adapter = this.adapters.get(topic);
    if (!adapter) return {};
    return adapter.capabilities(input);
  }
}

export function capabilityAvailable(
  status: CapabilityStatus | undefined,
  thresholds: CapabilityThresholds = {},
): boolean {
  if (!status) return false;
  const minCoverage = thresholds.minCoverage ?? 0.5;
  const allowStale = thresholds.allowStale ?? false;
  if (status.coverage < minCoverage) return false;
  if (!allowStale && status.freshness === 'stale') return false;
  return true;
}
