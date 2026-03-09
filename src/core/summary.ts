import { getTotalLaps } from './lap-count.js';

export type Summary = {
  winner: { number: string; name: string } | null;
  fastestLap: { number: string; name: string; time: string } | null;
  totalLaps: number | null;
};

type TimingEntry = {
  Position?: string;
  BestLapTime?: { Value?: string };
};

type TimingLines = Record<string, TimingEntry>;

type BestLap = { num: string; timeMs: number; time: string };

const SUPPORTED_TIMING_SUMMARY_TYPES = new Set(['TimingData', 'TimingDataF1']);

export function summarizeFromLines(raw: string): Summary {
  const driverNames = new Map<string, string>();
  let totalLaps: number | null = null;
  // TimingData and TimingDataF1 are incremental patch feeds; keep a merged state of only the
  // fields we need for a lightweight summary (Position/Line and BestLapTime.Value).
  const timingState: TimingLines = {};

  for (const line of raw.split('\n').filter((value) => value.trim().length > 0)) {
    let entry: { type: string; json: any } | null = null;
    try {
      entry = JSON.parse(line) as { type: string; json: any };
    } catch {
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    if (entry.type === 'DriverList') {
      for (const [num, data] of Object.entries(entry.json ?? {})) {
        const name = (data as { FullName?: string; BroadcastName?: string }).FullName
          ?? (data as { FullName?: string; BroadcastName?: string }).BroadcastName;
        if (name) driverNames.set(num, name);
      }
    }
    if (SUPPORTED_TIMING_SUMMARY_TYPES.has(entry.type)) {
      const patchLines = entry.json?.Lines as Record<string, unknown> | undefined;
      if (patchLines && typeof patchLines === 'object') {
        for (const [num, patch] of Object.entries(patchLines)) {
          if (!patch || typeof patch !== 'object') continue;
          const patchDriver = patch as any;
          const current = timingState[num] ?? {};
          const next: TimingEntry = { ...current };

          const positionValue = patchDriver.Position ?? patchDriver.Line;
          if (positionValue !== null && positionValue !== undefined) {
            const normalizedPosition = String(positionValue).trim();
            if (normalizedPosition.length > 0) {
              next.Position = normalizedPosition;
            }
          }

          const bestLapValue = patchDriver?.BestLapTime?.Value;
          if (typeof bestLapValue === 'string' && bestLapValue.trim().length > 0) {
            next.BestLapTime = { ...(next.BestLapTime ?? {}), Value: bestLapValue };
          }

          timingState[num] = next;
        }
      }
    }
    if (entry.type === 'LapCount') {
      const value = getTotalLaps(entry.json);
      if (value !== null) totalLaps = value;
    }
  }

  let winnerNum: string | null = null;
  let winnerPos = 999;
  for (const [num, driver] of Object.entries(timingState)) {
    const pos = parsePositionValue(driver.Position);
    if (pos < winnerPos) {
      winnerPos = pos;
      winnerNum = num;
    }
  }
  if (winnerPos !== 1) winnerNum = null;

  let bestLap: BestLap | null = null;
  for (const [num, driver] of Object.entries(timingState)) {
    const time = driver.BestLapTime?.Value;
    if (typeof time !== 'string' || time.trim().length === 0) continue;
    const ms = parseLapTimeMs(time);
    if (ms === null) continue;
    if (!bestLap || ms < bestLap.timeMs) bestLap = { num, timeMs: ms, time };
  }

  return {
    winner: winnerNum
      ? { number: winnerNum, name: driverNames.get(winnerNum) ?? winnerNum }
      : null,
    fastestLap: bestLap
      ? {
          number: bestLap.num,
          name: driverNames.get(bestLap.num) ?? bestLap.num,
          time: bestLap.time,
        }
      : null,
    totalLaps,
  };
}

function parsePositionValue(position?: string): number {
  if (!position) return 999;
  const trimmed = position.trim();
  if (!trimmed) return 999;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : 999;
}

export function parseLapTimeMs(value: string): number | null {
  const parts = value.split(':');
  if (parts.length === 1) {
    const [sec, ms] = parts[0].split('.');
    if (!sec || !ms) return null;
    const secValue = Number(sec);
    const msValue = Number(ms);
    if (!Number.isFinite(secValue) || !Number.isFinite(msValue)) return null;
    return secValue * 1000 + msValue;
  }
  if (parts.length === 2) {
    const [min, rest] = parts;
    const [sec, ms] = rest.split('.');
    if (!min || !sec || !ms) return null;
    const minValue = Number(min);
    const secValue = Number(sec);
    const msValue = Number(ms);
    if (!Number.isFinite(minValue) || !Number.isFinite(secValue) || !Number.isFinite(msValue)) {
      return null;
    }
    return minValue * 60000 + secValue * 1000 + msValue;
  }
  return null;
}
