import { describe, expect, it } from 'vitest';
import {
  getOrderedTimingLines,
  getTimingLineBestLapNumber,
  getTimingLineBestLapTime,
  getTimingLineDateTime,
  getTimingLineLapNumber,
  getTimingLineSpeeds,
  getTimingLinesRoot,
  getTimingSegments,
  getTimingSectors,
  getTimingSessionPart,
  isTimingDataPointType,
  isTimingFlagActive,
  toTimingBoolean,
} from './timing-data.js';

describe('timing-data helpers', () => {
  it('normalizes line roots from arrays and strips keyframe markers', () => {
    const lines = getTimingLinesRoot({
      Lines: [
        {
          Position: '2',
          NumberOfLaps: '11',
        },
        {
          Position: '1',
          NumberOfLaps: 11,
        },
      ],
      _kf: true,
    });

    expect(Object.keys(lines)).toEqual(['0', '1']);
    expect(getTimingLineLapNumber(lines['0'])).toBe(11);
    expect(
      getOrderedTimingLines(lines).map(([driverNumber]) => driverNumber),
    ).toEqual(['1', '0']);
  });

  it('reads typed best-lap, speed, and timestamp fields', () => {
    const line = {
      BestLapTime: { Value: '1:30.100', Lap: '12' },
      Speeds: {
        FL: { Value: '338.5', Position: '2' },
      },
      __dateTime: '2025-01-01T00:00:12.000Z',
    };

    expect(getTimingLineBestLapTime(line)).toBe('1:30.100');
    expect(getTimingLineBestLapNumber(line)).toBe(12);
    expect(getTimingLineDateTime(line)?.toISOString()).toBe(
      '2025-01-01T00:00:12.000Z',
    );
    expect(getTimingLineSpeeds(line)).toEqual({
      FL: { Value: '338.5', Position: '2' },
    });
  });

  it('normalizes sectors, segments, booleans, and session metadata', () => {
    const line = {
      SessionPart: '3',
      Sectors: {
        '2': {
          Value: '30.300',
          Segments: {
            '1': { Status: 2 },
            _kf: true,
            '0': { Status: 1 },
          },
        },
        _kf: true,
        '1': {
          Value: '29.200',
          PreviousValue: '29.400',
          Segments: [{ Status: 2048 }],
        },
      },
    };

    expect(getTimingSessionPart(line)).toBe(3);
    expect(getTimingSectors(line).map((sector) => sector.Value)).toEqual([
      '29.200',
      '30.300',
    ]);
    expect(
      getTimingSegments(getTimingSectors(line)[1]).map(
        (segment) => segment.Status,
      ),
    ).toEqual([1, 2]);
    expect(toTimingBoolean('yes')).toBe(true);
    expect(toTimingBoolean('0')).toBe(false);
    expect(isTimingFlagActive(1)).toBe(true);
    expect(isTimingFlagActive('')).toBe(false);
    expect(isTimingDataPointType('TimingDataF1')).toBe(true);
    expect(isTimingDataPointType('DriverList')).toBe(false);
  });
});
