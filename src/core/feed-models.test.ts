import { describe, expect, it } from 'vitest';
import {
  decodeCarChannels,
  decodePositionEntry,
  getCarDataCars,
  getLatestCarDataEntry,
  getLatestPositionBatch,
  getPositionEntries,
} from './feed-models.js';

describe('feed-models', () => {
  it('decodes car telemetry channels from typed feed keys', () => {
    expect(
      decodeCarChannels({
        '0': '12000',
        '2': 305,
        '3': '8',
        '4': '98',
        '5': 0,
        '45': '10',
      }),
    ).toEqual({
      rpm: 12000,
      speed: 305,
      gear: 8,
      throttle: 98,
      brake: 0,
      drs: 10,
    });
  });

  it('returns the latest batched car and position entries', () => {
    const latestCar = getLatestCarDataEntry({
      Entries: [
        {
          Utc: '2025-01-01T00:00:01Z',
          Cars: { '4': { Channels: { '2': 300 } } },
        },
        {
          Utc: '2025-01-01T00:00:02Z',
          Cars: { '81': { Channels: { '2': '302', '45': '8' } } },
        },
      ],
    });

    expect(latestCar).toMatchObject({ Utc: '2025-01-01T00:00:02Z' });
    expect(getCarDataCars(latestCar)).toMatchObject({
      '81': { Channels: { '2': '302', '45': '8' } },
    });

    const latestPosition = getLatestPositionBatch({
      Position: [
        { Timestamp: '2025-01-01T00:00:01Z', Entries: { '4': { X: 1 } } },
        {
          Timestamp: '2025-01-01T00:00:02Z',
          Entries: {
            '81': { Status: 'OnTrack', X: '10', Y: 20, Z: '30' },
          },
        },
      ],
    });

    expect(latestPosition).toMatchObject({
      Timestamp: '2025-01-01T00:00:02Z',
    });
    expect(getPositionEntries(latestPosition)).toMatchObject({
      '81': { Status: 'OnTrack', X: '10', Y: 20, Z: '30' },
    });
    expect(
      decodePositionEntry(getPositionEntries(latestPosition)['81']),
    ).toEqual({
      status: 'OnTrack',
      x: 10,
      y: 20,
      z: 30,
    });
  });
});
