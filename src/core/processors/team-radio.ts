import {
  getTeamRadioCaptures,
  type TeamRadioCaptureSummary,
  type TeamRadioState,
} from '../team-radio.js';
import { isPlainObject, mergeDeep } from './merge.js';
import type { Processor, RawPoint } from './types.js';

export type TeamRadioCaptureQuery = {
  staticPrefix?: string | null;
  captureId?: string | number;
  driverNumber?: string | number;
  limit?: number;
};

function normalizeOptionalKey(value: string | number | undefined) {
  return value === undefined ? null : String(value);
}

export class TeamRadioProcessor implements Processor<TeamRadioState> {
  latest: TeamRadioState | null = null;
  state: TeamRadioState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'TeamRadio') {
      return;
    }

    const patch = (point.json ?? {}) as TeamRadioState;
    if (!this.state) {
      this.state = structuredClone(patch) as TeamRadioState;
    } else if (isPlainObject(patch)) {
      mergeDeep(this.state as Record<string, unknown>, patch);
    } else {
      this.state = structuredClone(patch) as TeamRadioState;
    }
    this.latest = this.state;
  }

  getCaptureCount() {
    const captures = this.state?.Captures;
    if (Array.isArray(captures)) {
      return captures.length;
    }
    if (isPlainObject(captures)) {
      return Object.keys(captures).length;
    }
    return 0;
  }

  getCaptures(options: TeamRadioCaptureQuery = {}): TeamRadioCaptureSummary[] {
    const captureId = normalizeOptionalKey(options.captureId);
    const driverNumber = normalizeOptionalKey(options.driverNumber);

    const captures = getTeamRadioCaptures(this.state, {
      staticPrefix: options.staticPrefix,
    }).filter((capture) => {
      if (captureId !== null && capture.captureId !== captureId) {
        return false;
      }
      if (driverNumber !== null && capture.driverNumber !== driverNumber) {
        return false;
      }
      return true;
    });

    if (typeof options.limit === 'number' && options.limit >= 0) {
      return captures.slice(0, options.limit);
    }

    return captures;
  }

  getCapture(
    captureId: string | number,
    options: Omit<TeamRadioCaptureQuery, 'captureId' | 'limit'> = {},
  ): TeamRadioCaptureSummary | null {
    return (
      this.getCaptures({
        ...options,
        captureId,
        limit: 1,
      })[0] ?? null
    );
  }

  getLatestCapture(
    options: Omit<TeamRadioCaptureQuery, 'captureId' | 'limit'> = {},
  ): TeamRadioCaptureSummary | null {
    return this.getCaptures({ ...options, limit: 1 })[0] ?? null;
  }
}
