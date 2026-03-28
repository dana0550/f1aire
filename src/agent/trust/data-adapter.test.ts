import { describe, expect, it } from 'vitest';
import {
  DataAdapterRegistry,
  capabilityAvailable,
  type CapabilityStatus,
} from './data-adapter.js';

describe('DataAdapterRegistry', () => {
  it('registers adapters and returns normalized payload and capabilities', () => {
    const registry = new DataAdapterRegistry();
    registry.register({
      topic: 'timing',
      version: '1',
      normalize: (input) => ({ ...(input as Record<string, unknown>), normalized: true }),
      capabilities: () => ({
        'timing-data-fresh': {
          freshness: 'fresh',
          coverage: 0.9,
          stalenessMs: 1000,
        },
      }),
    });

    expect(registry.normalize('timing', { x: 1 })).toEqual({ x: 1, normalized: true });
    expect(registry.getCapabilities('timing', {})).toHaveProperty('timing-data-fresh');
  });

  it('returns unavailable when capability is missing/insufficient', () => {
    const good: CapabilityStatus = {
      freshness: 'fresh',
      coverage: 0.8,
      stalenessMs: 500,
    };
    const stale: CapabilityStatus = {
      freshness: 'stale',
      coverage: 0.8,
      stalenessMs: 20_000,
    };

    expect(capabilityAvailable(undefined)).toBe(false);
    expect(capabilityAvailable(good, { minCoverage: 0.7 })).toBe(true);
    expect(capabilityAvailable(good, { minCoverage: 0.9 })).toBe(false);
    expect(capabilityAvailable(stale)).toBe(false);
    expect(capabilityAvailable(stale, { allowStale: true })).toBe(true);
  });
});
