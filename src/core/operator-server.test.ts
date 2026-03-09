import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionStore } from './session-store.js';
import { createOperatorApi } from './operator-api.js';
import { startOperatorApiServer } from './operator-server.js';
import { TimingService } from './timing-service.js';

type RawPoint = SessionStore['raw']['live'][number];

type BuildStoreOptions = {
  subscribe?: Record<string, unknown>;
};

type StartTestServerOptions = BuildStoreOptions & {
  teamRadioFetchImpl?: typeof fetch;
  teamRadioSpawnImpl?: Parameters<
    typeof createOperatorApi
  >[0]['teamRadioSpawnImpl'];
  teamRadioExecFileImpl?: Parameters<
    typeof createOperatorApi
  >[0]['teamRadioExecFileImpl'];
};

function buildStore(
  points: RawPoint[],
  options: BuildStoreOptions = {},
): SessionStore {
  const byTopic = new Map<string, RawPoint[]>();
  for (const point of points) {
    const items = byTopic.get(point.type) ?? [];
    items.push(point);
    byTopic.set(point.type, items);
  }
  for (const items of byTopic.values()) {
    items.sort(
      (left, right) => left.dateTime.getTime() - right.dateTime.getTime(),
    );
  }
  return {
    raw: {
      subscribe: options.subscribe ?? {},
      live: points,
      download: {
        prefix:
          'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/',
      },
      keyframes: null,
    },
    topic: (name) => {
      const items = byTopic.get(name) ?? [];
      return {
        latest: items.length > 0 ? items[items.length - 1]! : null,
        timeline: (from?: Date, to?: Date) =>
          items.filter(
            (point) =>
              (!from || point.dateTime >= from) &&
              (!to || point.dateTime <= to),
          ),
      };
    },
  };
}

const points: RawPoint[] = [
  {
    type: 'DriverList',
    json: {
      '4': { FullName: 'Lando Norris' },
      '81': { FullName: 'Oscar Piastri' },
    },
    dateTime: new Date('2025-01-01T00:00:01Z'),
  },
  {
    type: 'TeamRadio',
    json: {
      Captures: {
        '0': {
          Utc: '2025-01-01T00:00:10.500Z',
          RacingNumber: '81',
          Path: 'TeamRadio/OSCPIA01_81_20250101_000010.mp3',
        },
        '1': {
          Utc: '2025-01-01T00:00:11.700Z',
          RacingNumber: '4',
          Path: 'TeamRadio/LANNOR01_4_20250101_000011.mp3',
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:11.700Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': {
          Line: 2,
          NumberOfLaps: 11,
          BestLapTime: { Value: '1:31.500', Lap: 11 },
          LastLapTime: { Value: '1:31.500' },
        },
        '81': {
          Line: 1,
          NumberOfLaps: 11,
          BestLapTime: { Value: '1:30.900', Lap: 11 },
          LastLapTime: { Value: '1:30.900' },
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:11Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': {
          Line: 1,
          NumberOfLaps: 12,
          BestLapTime: { Value: '1:30.100', Lap: 12 },
          LastLapTime: { Value: '1:30.100' },
        },
        '81': {
          Line: 2,
          NumberOfLaps: 12,
          BestLapTime: { Value: '1:30.900', Lap: 11 },
          LastLapTime: { Value: '1:31.200' },
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12Z'),
  },
];

const positionPoints: RawPoint[] = [
  ...points,
  {
    type: 'Position',
    json: {
      Position: [
        {
          Timestamp: '2025-01-01T00:00:11.500Z',
          Entries: {
            '4': { Status: 'OnTrack', X: '10', Y: '20', Z: '1' },
            '81': { Status: 'OffTrack', X: '30', Y: '40', Z: '2' },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:11.500Z'),
  },
  {
    type: 'CarData',
    json: {
      Entries: [
        {
          Utc: '2025-01-01T00:00:11.500Z',
          Cars: {
            '4': { Channels: { '2': '301', '3': '8' } },
            '81': { Channels: { '2': '299', '3': '7' } },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:11.500Z'),
  },
  {
    type: 'Position',
    json: {
      Position: [
        {
          Timestamp: '2025-01-01T00:00:12.500Z',
          Entries: {
            '4': { Status: 'OffTrack', X: '11', Y: '21', Z: '1' },
            '81': { Status: 'OnTrack', X: '31', Y: '41', Z: '2' },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:12.500Z'),
  },
  {
    type: 'CarData',
    json: {
      Entries: [
        {
          Utc: '2025-01-01T00:00:12.500Z',
          Cars: {
            '4': { Channels: { '2': '305', '3': '8' } },
            '81': { Channels: { '2': '300', '3': '7' } },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:12.500Z'),
  },
];

const raceControlPoints: RawPoint[] = [
  ...points,
  {
    type: 'RaceControlMessages',
    json: {
      Messages: [
        {
          Utc: '2025-01-01T00:00:10.500Z',
          Lap: '11',
          Category: 'Flag',
          Flag: 'YELLOW',
          Scope: 'Track',
          Sector: 1,
          RacingNumber: '81',
          Message: 'Yellow flag in sector 1',
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:10.500Z'),
  },
  {
    type: 'RaceControlMessages',
    json: {
      Messages: {
        '1': {
          Utc: '2025-01-01T00:00:11.800Z',
          Lap: '12',
          Category: 'Flag',
          Flag: 'GREEN',
          Scope: 'Track',
          Sector: 1,
          RacingNumber: '4',
          Message: 'Track clear',
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:11.800Z'),
  },
];

const tyrePoints: RawPoint[] = [
  {
    type: 'DriverList',
    json: {
      '4': { FullName: 'Lando Norris' },
      '81': { FullName: 'Oscar Piastri' },
    },
    dateTime: new Date('2025-01-01T00:00:01Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 1, NumberOfLaps: 12 },
        '81': { Line: 2, NumberOfLaps: 12 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 1, NumberOfLaps: 13 },
        '81': { Line: 2, NumberOfLaps: 13 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:13Z'),
  },
  {
    type: 'CurrentTyres',
    json: {
      Tyres: {
        '81': { Compound: 'HARD', New: 'false' },
      },
    },
    dateTime: new Date('2025-01-01T00:00:13.100Z'),
  },
  {
    type: 'TyreStintSeries',
    json: {
      Stints: {
        '4': {
          '1': {
            Compound: 'MEDIUM',
            New: 'true',
            StartLaps: 1,
            TotalLaps: 12,
            LapNumber: 12,
          },
          '2': {
            Compound: 'HARD',
            New: 'false',
            StartLaps: 12,
            TotalLaps: 20,
            LapNumber: 13,
          },
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:13.200Z'),
  },
];

const timingStatsPoints: RawPoint[] = [
  {
    type: 'DriverList',
    json: {
      '4': { FullName: 'Lando Norris' },
      '81': { FullName: 'Oscar Piastri' },
    },
    dateTime: new Date('2025-01-01T00:00:01Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 2, NumberOfLaps: 11 },
        '81': { Line: 1, NumberOfLaps: 11 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:11Z'),
  },
  {
    type: 'TimingStats',
    json: {
      Lines: {
        '4': {
          BestSpeeds: {
            FL: { Value: '338.5', Position: 2 },
            I1: { Value: '295.1', Position: 1 },
          },
        },
        '81': {
          BestSpeeds: {
            FL: { Value: '340.0', Position: 1 },
            I1: { Value: '294.4', Position: 2 },
          },
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:10.900Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 1, NumberOfLaps: 12 },
        '81': { Line: 2, NumberOfLaps: 12 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12Z'),
  },
  {
    type: 'TimingStats',
    json: {
      Lines: {
        '4': {
          BestSpeeds: {
            ST: { Value: '319.0', Position: 2 },
          },
        },
        '81': {
          BestSpeeds: {
            ST: { Value: '320.1', Position: 1 },
          },
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:11.900Z'),
  },
];

const championshipPredictionPoints: RawPoint[] = [
  ...points,
  {
    type: 'DriverList',
    json: {
      '1': {
        FullName: 'Max Verstappen',
        TeamName: 'Red Bull Racing',
      },
      '4': {
        FullName: 'Lando Norris',
        TeamName: 'McLaren Mercedes',
      },
    },
    dateTime: new Date('2025-01-01T00:00:01.500Z'),
  },
  {
    type: 'ChampionshipPrediction',
    json: {
      Drivers: {
        '4': {
          PredictedPosition: 1,
          PredictedPoints: 109,
        },
      },
      Teams: {
        'McLaren Mercedes': {
          PredictedPosition: 1,
          PredictedPoints: 190,
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:10.500Z'),
  },
  {
    type: 'ChampionshipPrediction',
    json: {
      Drivers: {
        '1': {
          PredictedPosition: 2,
          PredictedPoints: 107,
        },
      },
      Teams: {
        'Red Bull Racing': {
          PredictedPosition: 2,
          PredictedPoints: 186,
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12.500Z'),
  },
];

const championshipPredictionSubscribe = {
  ChampionshipPrediction: {
    Drivers: {
      '1': {
        RacingNumber: '1',
        TeamName: 'Red Bull Racing',
        CurrentPosition: 1,
        PredictedPosition: 1,
        CurrentPoints: 100,
        PredictedPoints: 108,
      },
      '4': {
        RacingNumber: '4',
        TeamName: 'McLaren Mercedes',
        CurrentPosition: 2,
        PredictedPosition: 2,
        CurrentPoints: 95,
        PredictedPoints: 101,
      },
    },
    Teams: {
      'Red Bull Racing': {
        TeamName: 'Red Bull Racing',
        CurrentPosition: 1,
        PredictedPosition: 1,
        CurrentPoints: 180,
        PredictedPoints: 188,
      },
      'McLaren Mercedes': {
        TeamName: 'McLaren Mercedes',
        CurrentPosition: 2,
        PredictedPosition: 2,
        CurrentPoints: 170,
        PredictedPoints: 181,
      },
    },
  },
};

const streamPoints: RawPoint[] = [
  ...points,
  {
    type: 'AudioStreams',
    json: {
      Streams: {
        '0': {
          Name: 'FX',
          Language: 'en',
          Path: 'AudioStreams/FX.m3u8',
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:11.000Z'),
  },
  {
    type: 'AudioStreams',
    json: {
      Streams: {
        '1': {
          Name: 'Driver',
          Language: 'de',
          Uri: 'https://cdn.example.test/driver.m3u8',
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12.500Z'),
  },
  {
    type: 'ContentStreams',
    json: {
      Streams: {
        '0': {
          Type: 'Commentary',
          Language: 'en',
          Path: 'Content/commentary-en.json',
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:11.500Z'),
  },
  {
    type: 'ContentStreams',
    json: {
      Streams: {
        '1': {
          Type: 'Telemetry',
          Language: 'es',
          Uri: 'https://cdn.example.test/telemetry-es.json',
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12.200Z'),
  },
];

const pitStopPoints: RawPoint[] = [
  {
    type: 'DriverList',
    json: {
      '4': { FullName: 'Lando Norris' },
      '81': { FullName: 'Oscar Piastri' },
    },
    dateTime: new Date('2025-01-01T00:00:01Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 1, NumberOfLaps: 12 },
        '81': { Line: 2, NumberOfLaps: 12 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 2, NumberOfLaps: 13 },
        '81': { Line: 1, NumberOfLaps: 13 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:13Z'),
  },
  {
    type: 'TyreStintSeries',
    json: {
      Stints: {
        '4': {
          '1': {
            Compound: 'MEDIUM',
            New: 'true',
            StartLaps: 1,
            TotalLaps: 12,
            LapNumber: 12,
          },
          '2': {
            Compound: 'HARD',
            New: 'false',
            StartLaps: 12,
            TotalLaps: 20,
            LapNumber: 13,
          },
        },
        '81': {
          '1': {
            Compound: 'HARD',
            New: 'false',
            StartLaps: 1,
            TotalLaps: 13,
            LapNumber: 13,
          },
          '2': {
            Compound: 'SOFT',
            New: 'true',
            StartLaps: 13,
            TotalLaps: 20,
            LapNumber: 14,
          },
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:13.100Z'),
  },
  {
    type: 'PitStopSeries',
    json: {
      PitTimes: {
        '4': {
          '0': {
            Timestamp: '2025-01-01T00:00:12.500Z',
            PitStop: {
              RacingNumber: '4',
              Lap: '12',
              PitStopTime: '2.45',
              PitLaneTime: '22.10',
            },
          },
        },
        '81': {
          '0': {
            Timestamp: '2025-01-01T00:00:13.500Z',
            PitStop: {
              RacingNumber: '81',
              Lap: '13',
              PitStopTime: '3.10',
              PitLaneTime: '23.50',
            },
          },
        },
      },
    },
    dateTime: new Date('2025-01-01T00:00:13.500Z'),
  },
];

const exactTimePositionPoints: RawPoint[] = [
  {
    type: 'DriverList',
    json: {
      '4': { FullName: 'Lando Norris' },
      '81': { FullName: 'Oscar Piastri' },
    },
    dateTime: new Date('2025-01-01T00:00:01.000Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 2, NumberOfLaps: 12 },
        '81': { Line: 1, NumberOfLaps: 12 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12.000Z'),
  },
  {
    type: 'TimingDataF1',
    json: {
      Lines: {
        '4': { Line: 1 },
        '81': { Line: 2 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12.250Z'),
  },
  {
    type: 'Position',
    json: {
      Position: [
        {
          Timestamp: '2025-01-01T00:00:12.260Z',
          Entries: {
            '4': { Status: 'OnTrack', X: 10, Y: 20, Z: 1 },
            '81': { Status: 'OnTrack', X: 30, Y: 40, Z: 2 },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:12.260Z'),
  },
  {
    type: 'CarData',
    json: {
      Entries: [
        {
          Utc: '2025-01-01T00:00:12.270Z',
          Cars: {
            '4': { Channels: { '2': '302', '3': '8' } },
            '81': { Channels: { '2': '298', '3': '7' } },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:12.270Z'),
  },
  {
    type: 'TimingData',
    json: {
      Lines: {
        '4': { Line: 2 },
        '81': { Line: 1 },
      },
    },
    dateTime: new Date('2025-01-01T00:00:12.900Z'),
  },
  {
    type: 'Position',
    json: {
      Position: [
        {
          Timestamp: '2025-01-01T00:00:12.950Z',
          Entries: {
            '4': { Status: 'OnTrack', X: 11, Y: 21, Z: 1 },
            '81': { Status: 'OnTrack', X: 31, Y: 41, Z: 2 },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:12.950Z'),
  },
  {
    type: 'CarData',
    json: {
      Entries: [
        {
          Utc: '2025-01-01T00:00:12.960Z',
          Cars: {
            '4': { Channels: { '2': '290', '3': '7' } },
            '81': { Channels: { '2': '305', '3': '8' } },
          },
        },
      ],
    },
    dateTime: new Date('2025-01-01T00:00:12.960Z'),
  },
];

const activeServers = new Set<
  Awaited<ReturnType<typeof startOperatorApiServer>>
>();

afterEach(async () => {
  for (const server of activeServers) {
    await server.close();
  }
  activeServers.clear();
});

async function startTestServer(
  testPoints: RawPoint[] = points,
  options: StartTestServerOptions = {},
) {
  const service = new TimingService();
  testPoints.forEach((point) => service.enqueue(point));
  const api = createOperatorApi({
    store: buildStore(testPoints, options),
    service,
    teamRadioFetchImpl: options.teamRadioFetchImpl,
    teamRadioSpawnImpl: options.teamRadioSpawnImpl,
    teamRadioExecFileImpl: options.teamRadioExecFileImpl,
  });
  const server = await startOperatorApiServer({ api });
  activeServers.add(server);
  return server;
}

describe('operator-server', () => {
  it('serves latest topic snapshots and timing endpoints', async () => {
    const server = await startTestServer();

    const latestResponse = await fetch(
      `${server.origin}/data/DriverList/latest`,
    );
    expect(latestResponse.status).toBe(200);
    await expect(latestResponse.json()).resolves.toEqual({
      topic: 'DriverList',
      streamName: 'DriverList',
      availability: 'all-sessions',
      semantics: 'patch',
      source: 'processor',
      dateTime: '2025-01-01T00:00:01.000Z',
      data: {
        '4': { FullName: 'Lando Norris' },
        '81': { FullName: 'Oscar Piastri' },
      },
    });

    const lapResponse = await fetch(
      `${server.origin}/data/TimingData/laps/11?driverNumber=81`,
    );
    expect(lapResponse.status).toBe(200);
    await expect(lapResponse.json()).resolves.toMatchObject({
      requestedLap: 11,
      resolvedLap: 11,
      source: 'lap',
      totalDrivers: 1,
      drivers: [
        {
          driverNumber: '81',
          driverName: 'Oscar Piastri',
        },
      ],
    });

    const radioResponse = await fetch(
      `${server.origin}/data/TeamRadio/events?driverNumber=4&limit=1`,
    );
    expect(radioResponse.status).toBe(200);
    await expect(radioResponse.json()).resolves.toEqual({
      sessionPrefix:
        'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/',
      total: 1,
      returned: 1,
      captures: [
        {
          captureId: '1',
          utc: '2025-01-01T00:00:11.700Z',
          driverNumber: '4',
          driverName: 'Lando Norris',
          path: 'TeamRadio/LANNOR01_4_20250101_000011.mp3',
          assetUrl:
            'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/TeamRadio/LANNOR01_4_20250101_000011.mp3',
          downloadedFilePath: null,
          hasTranscription: false,
          context: {
            captureTime: '2025-01-01T00:00:11.700Z',
            matchedTimingTime: '2025-01-01T00:00:11.000Z',
            matchMode: 'at-or-before',
            lap: 11,
            position: 2,
            gapToLeaderSec: null,
            intervalToAheadSec: null,
            traffic: 'unknown',
            trackStatus: null,
            flags: {
              pit: false,
              pitIn: false,
              pitOut: false,
              inPit: false,
            },
            stint: null,
          },
        },
      ],
    });

    const bestResponse = await fetch(
      `${server.origin}/data/TimingData/laps/best?includeSnapshot=true&limit=1`,
    );
    expect(bestResponse.status).toBe(200);
    await expect(bestResponse.json()).resolves.toMatchObject({
      totalDrivers: 1,
      records: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          time: '1:30.100',
          timeMs: 90100,
          lap: 12,
          snapshot: {
            Line: 1,
            NumberOfLaps: 12,
            BestLapTime: { Value: '1:30.100', Lap: 12 },
            LastLapTime: { Value: '1:30.100' },
            __dateTime: '2025-01-01T00:00:12.000Z',
          },
        },
      ],
    });
  });

  it('serves replay-aware race control events over HTTP', async () => {
    const service = new TimingService();
    raceControlPoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(raceControlPoints),
      service,
      timeCursor: { lap: 11 },
    });
    const server = await startOperatorApiServer({ api });
    activeServers.add(server);

    const historicalResponse = await fetch(
      `${server.origin}/data/RaceControlMessages/events`,
    );
    expect(historicalResponse.status).toBe(200);
    await expect(historicalResponse.json()).resolves.toEqual({
      asOf: {
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        source: 'lap',
        includeFuture: false,
      },
      total: 1,
      returned: 1,
      events: [
        {
          messageId: '0',
          utc: '2025-01-01T00:00:10.500Z',
          dateTime: '2025-01-01T00:00:10.500Z',
          lap: 11,
          category: 'Flag',
          flag: 'YELLOW',
          scope: 'Track',
          sector: 1,
          status: null,
          driverNumber: '81',
          message: 'Yellow flag in sector 1',
        },
      ],
    });

    const includeFutureResponse = await fetch(
      `${server.origin}/data/RaceControlMessages/events?includeFuture=true&category=Flag&limit=1`,
    );
    expect(includeFutureResponse.status).toBe(200);
    await expect(includeFutureResponse.json()).resolves.toEqual({
      asOf: {
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        source: 'lap',
        includeFuture: true,
      },
      total: 2,
      returned: 1,
      events: [
        {
          messageId: '1',
          utc: '2025-01-01T00:00:11.800Z',
          dateTime: '2025-01-01T00:00:11.800Z',
          lap: 12,
          category: 'Flag',
          flag: 'GREEN',
          scope: 'Track',
          sector: 1,
          status: null,
          driverNumber: '4',
          message: 'Track clear',
        },
      ],
    });
  });

  it('serves replay-aware position snapshots over HTTP', async () => {
    const latestServer = await startTestServer(positionPoints);

    const latestResponse = await fetch(
      `${latestServer.origin}/data/Position/snapshot`,
    );
    expect(latestResponse.status).toBe(200);
    await expect(latestResponse.json()).resolves.toEqual({
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'latest',
      },
      positionTimestamp: '2025-01-01T00:00:12.500Z',
      telemetryUtc: '2025-01-01T00:00:12.500Z',
      totalDrivers: 2,
      drivers: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          timingPosition: 1,
          status: 'OffTrack',
          offTrack: true,
          coordinates: { x: 11, y: 21, z: 1 },
          telemetry: {
            rpm: null,
            speed: 305,
            gear: 8,
            throttle: null,
            brake: null,
            drs: null,
          },
        },
        {
          driverNumber: '81',
          driverName: 'Oscar Piastri',
          timingPosition: 2,
          status: 'OnTrack',
          offTrack: false,
          coordinates: { x: 31, y: 41, z: 2 },
          telemetry: {
            rpm: null,
            speed: 300,
            gear: 7,
            throttle: null,
            brake: null,
            drs: null,
          },
        },
      ],
    });

    const service = new TimingService();
    positionPoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(positionPoints),
      service,
      timeCursor: { lap: 11 },
    });
    const historicalServer = await startOperatorApiServer({ api });
    activeServers.add(historicalServer);

    const historicalResponse = await fetch(
      `${historicalServer.origin}/data/Position/snapshot?driverNumber=4`,
    );
    expect(historicalResponse.status).toBe(200);
    await expect(historicalResponse.json()).resolves.toEqual({
      asOf: {
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        source: 'lap',
      },
      positionTimestamp: '2025-01-01T00:00:11.500Z',
      telemetryUtc: '2025-01-01T00:00:11.500Z',
      totalDrivers: 1,
      drivers: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          timingPosition: 2,
          status: 'OnTrack',
          offTrack: false,
          coordinates: { x: 10, y: 20, z: 1 },
          telemetry: {
            rpm: null,
            speed: 301,
            gear: 8,
            throttle: null,
            brake: null,
            drs: null,
          },
        },
      ],
    });
  });

  it('serves replay-aware tyre views over HTTP', async () => {
    const latestServer = await startTestServer(tyrePoints);

    const currentResponse = await fetch(
      `${latestServer.origin}/data/CurrentTyres/current`,
    );
    expect(currentResponse.status).toBe(200);
    await expect(currentResponse.json()).resolves.toEqual({
      asOf: {
        lap: 13,
        dateTime: '2025-01-01T00:00:13.000Z',
        source: 'latest',
      },
      totalDrivers: 2,
      records: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          position: 1,
          compound: 'HARD',
          isNew: false,
          tyresNotChanged: null,
          stint: 2,
          startLaps: 12,
          totalLaps: 20,
          lapsOnTyre: 8,
          source: 'TyreStintSeries',
        },
        {
          driverNumber: '81',
          driverName: 'Oscar Piastri',
          position: 2,
          compound: 'HARD',
          isNew: false,
          tyresNotChanged: null,
          stint: null,
          startLaps: null,
          totalLaps: null,
          lapsOnTyre: null,
          source: 'CurrentTyres',
        },
      ],
    });

    const stintsResponse = await fetch(
      `${latestServer.origin}/data/TyreStintSeries/stints?driverNumber=4`,
    );
    expect(stintsResponse.status).toBe(200);
    await expect(stintsResponse.json()).resolves.toEqual({
      asOf: {
        lap: 13,
        dateTime: '2025-01-01T00:00:13.000Z',
        source: 'latest',
      },
      totalRecords: 2,
      records: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          stint: 1,
          compound: 'MEDIUM',
          isNew: true,
          tyresNotChanged: null,
          startLaps: 1,
          totalLaps: 12,
          lapsOnTyre: 11,
          lapTime: null,
          lapNumber: 12,
          source: 'TyreStintSeries',
        },
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          stint: 2,
          compound: 'HARD',
          isNew: false,
          tyresNotChanged: null,
          startLaps: 12,
          totalLaps: 20,
          lapsOnTyre: 8,
          lapTime: null,
          lapNumber: 13,
          source: 'TyreStintSeries',
        },
      ],
    });

    const service = new TimingService();
    tyrePoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(tyrePoints),
      service,
      timeCursor: { lap: 12 },
    });
    const historicalServer = await startOperatorApiServer({ api });
    activeServers.add(historicalServer);

    const historicalCurrentResponse = await fetch(
      `${historicalServer.origin}/data/CurrentTyres/current`,
    );
    expect(historicalCurrentResponse.status).toBe(200);
    await expect(historicalCurrentResponse.json()).resolves.toEqual({
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'lap',
      },
      totalDrivers: 1,
      records: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          position: 1,
          compound: 'MEDIUM',
          isNew: true,
          tyresNotChanged: null,
          stint: 1,
          startLaps: 1,
          totalLaps: 12,
          lapsOnTyre: 11,
          source: 'TyreStintSeries',
        },
      ],
    });
  });

  it('serves replay-aware timing stats over HTTP', async () => {
    const latestServer = await startTestServer(timingStatsPoints);

    const trapResponse = await fetch(
      `${latestServer.origin}/data/TimingStats/stats?trap=st&limit=1`,
    );
    expect(trapResponse.status).toBe(200);
    await expect(trapResponse.json()).resolves.toEqual({
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'latest',
      },
      requestedTrap: 'ST',
      requestedDriverNumber: null,
      limit: 1,
      totalDrivers: 2,
      driver: null,
      trapTable: {
        trap: 'ST',
        totalDrivers: 2,
        fastest: {
          trap: 'ST',
          driverNumber: '81',
          driverName: 'Oscar Piastri',
          position: 1,
          value: '320.1',
          speedKph: 320.1,
          raw: {
            Value: '320.1',
            Position: 1,
          },
        },
        records: [
          {
            trap: 'ST',
            driverNumber: '81',
            driverName: 'Oscar Piastri',
            position: 1,
            value: '320.1',
            speedKph: 320.1,
            raw: {
              Value: '320.1',
              Position: 1,
            },
          },
        ],
      },
      trapTables: null,
    });

    const service = new TimingService();
    timingStatsPoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(timingStatsPoints),
      service,
      timeCursor: { lap: 11 },
    });
    const historicalServer = await startOperatorApiServer({ api });
    activeServers.add(historicalServer);

    const driverResponse = await fetch(
      `${historicalServer.origin}/data/TimingStats/stats?driverNumber=4`,
    );
    expect(driverResponse.status).toBe(200);
    await expect(driverResponse.json()).resolves.toEqual({
      asOf: {
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        source: 'lap',
      },
      requestedTrap: null,
      requestedDriverNumber: '4',
      limit: null,
      totalDrivers: 2,
      driver: {
        driverNumber: '4',
        driverName: 'Lando Norris',
        bestSpeeds: [
          {
            trap: 'FL',
            position: 2,
            value: '338.5',
            speedKph: 338.5,
            raw: {
              Value: '338.5',
              Position: 2,
            },
          },
          {
            trap: 'I1',
            position: 1,
            value: '295.1',
            speedKph: 295.1,
            raw: {
              Value: '295.1',
              Position: 1,
            },
          },
        ],
        raw: {
          BestSpeeds: {
            FL: { Value: '338.5', Position: 2 },
            I1: { Value: '295.1', Position: 1 },
          },
        },
      },
      trapTable: null,
      trapTables: null,
    });
  });

  it('serves replay-aware championship prediction standings over HTTP', async () => {
    const latestServer = await startTestServer(championshipPredictionPoints, {
      subscribe: championshipPredictionSubscribe,
    });

    const latestResponse = await fetch(
      `${latestServer.origin}/data/ChampionshipPrediction/standings?teamName=mclaren&limit=1`,
    );
    expect(latestResponse.status).toBe(200);
    await expect(latestResponse.json()).resolves.toEqual({
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'latest',
        includeFuture: false,
      },
      totalDrivers: 2,
      totalTeams: 2,
      returnedDrivers: 1,
      returnedTeams: 1,
      drivers: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          teamName: 'McLaren Mercedes',
          currentPosition: 2,
          predictedPosition: 1,
          positionsGained: 1,
          currentPoints: 95,
          predictedPoints: 109,
          pointsDelta: 14,
          gapToLeaderPoints: 0,
          raw: {
            RacingNumber: '4',
            TeamName: 'McLaren Mercedes',
            CurrentPosition: 2,
            PredictedPosition: 1,
            CurrentPoints: 95,
            PredictedPoints: 109,
          },
        },
      ],
      teams: [
        {
          teamName: 'McLaren Mercedes',
          currentPosition: 2,
          predictedPosition: 1,
          positionsGained: 1,
          currentPoints: 170,
          predictedPoints: 190,
          pointsDelta: 20,
          gapToLeaderPoints: 0,
          raw: {
            TeamName: 'McLaren Mercedes',
            CurrentPosition: 2,
            PredictedPosition: 1,
            CurrentPoints: 170,
            PredictedPoints: 190,
          },
        },
      ],
    });

    const service = new TimingService();
    championshipPredictionPoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(championshipPredictionPoints, {
        subscribe: championshipPredictionSubscribe,
      }),
      service,
      timeCursor: { lap: 11 },
    });
    const historicalServer = await startOperatorApiServer({ api });
    activeServers.add(historicalServer);

    const historicalResponse = await fetch(
      `${historicalServer.origin}/data/ChampionshipPrediction/standings?driverNumber=1&includeFuture=true`,
    );
    expect(historicalResponse.status).toBe(200);
    await expect(historicalResponse.json()).resolves.toEqual({
      asOf: {
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        source: 'lap',
        includeFuture: true,
      },
      totalDrivers: 2,
      totalTeams: 2,
      returnedDrivers: 1,
      returnedTeams: 2,
      drivers: [
        {
          driverNumber: '1',
          driverName: 'Max Verstappen',
          teamName: 'Red Bull Racing',
          currentPosition: 1,
          predictedPosition: 2,
          positionsGained: -1,
          currentPoints: 100,
          predictedPoints: 107,
          pointsDelta: 7,
          gapToLeaderPoints: 0,
          raw: {
            RacingNumber: '1',
            TeamName: 'Red Bull Racing',
            CurrentPosition: 1,
            PredictedPosition: 2,
            CurrentPoints: 100,
            PredictedPoints: 107,
          },
        },
      ],
      teams: [
        {
          teamName: 'McLaren Mercedes',
          currentPosition: 2,
          predictedPosition: 1,
          positionsGained: 1,
          currentPoints: 170,
          predictedPoints: 190,
          pointsDelta: 20,
          gapToLeaderPoints: 0,
          raw: {
            TeamName: 'McLaren Mercedes',
            CurrentPosition: 2,
            PredictedPosition: 1,
            CurrentPoints: 170,
            PredictedPoints: 190,
          },
        },
        {
          teamName: 'Red Bull Racing',
          currentPosition: 1,
          predictedPosition: 2,
          positionsGained: -1,
          currentPoints: 180,
          predictedPoints: 186,
          pointsDelta: 6,
          gapToLeaderPoints: 4,
          raw: {
            TeamName: 'Red Bull Racing',
            CurrentPosition: 1,
            PredictedPosition: 2,
            CurrentPoints: 180,
            PredictedPoints: 186,
          },
        },
      ],
    });
  });

  it('serves replay-aware driver tracker rows over HTTP', async () => {
    const trackerPoints: RawPoint[] = [
      {
        type: 'DriverList',
        json: {
          '4': { FullName: 'Lando Norris' },
          '81': { FullName: 'Oscar Piastri' },
        },
        dateTime: new Date('2025-01-01T00:00:01Z'),
      },
      {
        type: 'DriverTracker',
        json: {
          Withheld: false,
          SessionPart: 1,
          Lines: {
            '0': {
              Position: '1',
              RacingNumber: '81',
              ShowPosition: true,
              DiffToLeader: 'LEADER',
              OverallFastest: true,
            },
            '1': {
              Position: '2',
              RacingNumber: '4',
              ShowPosition: true,
              DiffToAhead: '+0.900',
              DiffToLeader: '+0.900',
            },
          },
        },
        dateTime: new Date('2025-01-01T00:00:10Z'),
      },
      {
        type: 'TimingData',
        json: {
          Lines: {
            '4': { Line: 2, NumberOfLaps: 11 },
            '81': { Line: 1, NumberOfLaps: 11 },
          },
        },
        dateTime: new Date('2025-01-01T00:00:11Z'),
      },
      {
        type: 'DriverTracker',
        json: {
          SessionPart: 2,
          Lines: {
            '0': {
              Position: '2',
              RacingNumber: '81',
              DiffToAhead: '+1.100',
              DiffToLeader: '+1.100',
              OverallFastest: false,
            },
            '1': {
              Position: '1',
              RacingNumber: '4',
              DiffToAhead: 'LEADER',
              DiffToLeader: 'LEADER',
              PersonalFastest: true,
            },
          },
        },
        dateTime: new Date('2025-01-01T00:00:12Z'),
      },
    ];

    const service = new TimingService();
    trackerPoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(trackerPoints),
      service,
      timeCursor: { lap: 11 },
    });
    const server = await startOperatorApiServer({ api });
    activeServers.add(server);

    const filteredResponse = await fetch(
      `${server.origin}/data/DriverTracker/rows?driverNumber=4&limit=1`,
    );
    expect(filteredResponse.status).toBe(200);
    await expect(filteredResponse.json()).resolves.toEqual({
      asOf: {
        source: 'lap',
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        includeFuture: false,
      },
      withheld: false,
      sessionPart: 1,
      driverNumber: '4',
      driverName: 'Lando Norris',
      total: 1,
      returned: 1,
      rows: [
        {
          lineIndex: 1,
          driverNumber: '4',
          driverName: 'Lando Norris',
          position: 2,
          showPosition: true,
          lapTime: null,
          lapState: null,
          diffToAhead: '+0.900',
          diffToAheadSeconds: 0.9,
          diffToLeader: '+0.900',
          diffToLeaderSeconds: 0.9,
          overallFastest: null,
          personalFastest: null,
          raw: {
            Position: '2',
            RacingNumber: '4',
            ShowPosition: true,
            DiffToAhead: '+0.900',
            DiffToLeader: '+0.900',
          },
        },
      ],
      row: {
        lineIndex: 1,
        driverNumber: '4',
        driverName: 'Lando Norris',
        position: 2,
        showPosition: true,
        lapTime: null,
        lapState: null,
        diffToAhead: '+0.900',
        diffToAheadSeconds: 0.9,
        diffToLeader: '+0.900',
        diffToLeaderSeconds: 0.9,
        overallFastest: null,
        personalFastest: null,
        raw: {
          Position: '2',
          RacingNumber: '4',
          ShowPosition: true,
          DiffToAhead: '+0.900',
          DiffToLeader: '+0.900',
        },
      },
    });

    const futureResponse = await fetch(
      `${server.origin}/data/DriverTracker/rows?includeFuture=true&limit=1`,
    );
    expect(futureResponse.status).toBe(200);
    await expect(futureResponse.json()).resolves.toEqual({
      asOf: {
        source: 'lap',
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        includeFuture: true,
      },
      withheld: false,
      sessionPart: 2,
      driverNumber: null,
      driverName: null,
      total: 2,
      returned: 1,
      rows: [
        {
          lineIndex: 0,
          driverNumber: '81',
          driverName: 'Oscar Piastri',
          position: 2,
          showPosition: true,
          lapTime: null,
          lapState: null,
          diffToAhead: '+1.100',
          diffToAheadSeconds: 1.1,
          diffToLeader: '+1.100',
          diffToLeaderSeconds: 1.1,
          overallFastest: false,
          personalFastest: null,
          raw: {
            Position: '2',
            RacingNumber: '81',
            ShowPosition: true,
            DiffToLeader: '+1.100',
            OverallFastest: false,
            DiffToAhead: '+1.100',
          },
        },
      ],
      row: null,
    });
  });

  it('serves replay-aware stream metadata over HTTP', async () => {
    const latestServer = await startTestServer(streamPoints);

    const latestResponse = await fetch(
      `${latestServer.origin}/data/AudioStreams/streams?language=de`,
    );
    expect(latestResponse.status).toBe(200);
    await expect(latestResponse.json()).resolves.toEqual({
      topic: 'AudioStreams',
      sessionPrefix:
        'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/',
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'latest',
      },
      total: 1,
      returned: 1,
      languages: ['de'],
      types: [],
      streams: [
        {
          streamId: '1',
          name: 'Driver',
          language: 'de',
          type: null,
          uri: 'https://cdn.example.test/driver.m3u8',
          path: null,
          resolvedUrl: 'https://cdn.example.test/driver.m3u8',
        },
      ],
    });

    const historicalApi = createOperatorApi({
      store: buildStore(streamPoints),
      service: (() => {
        const service = new TimingService();
        streamPoints.forEach((point) => service.enqueue(point));
        return service;
      })(),
      timeCursor: { iso: '2025-01-01T00:00:11.800Z' },
    });
    const historicalServer = await startOperatorApiServer({
      api: historicalApi,
    });
    activeServers.add(historicalServer);

    const historicalResponse = await fetch(
      `${historicalServer.origin}/data/ContentStreams/streams?limit=5`,
    );
    expect(historicalResponse.status).toBe(200);
    await expect(historicalResponse.json()).resolves.toEqual({
      topic: 'ContentStreams',
      sessionPrefix:
        'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/',
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'time',
      },
      total: 1,
      returned: 1,
      languages: ['en'],
      types: ['Commentary'],
      streams: [
        {
          streamId: '0',
          name: null,
          language: 'en',
          type: 'Commentary',
          uri: null,
          path: 'Content/commentary-en.json',
          resolvedUrl:
            'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/Content/commentary-en.json',
        },
      ],
    });
  });

  it('serves replay-aware pit stop events over HTTP', async () => {
    const service = new TimingService();
    pitStopPoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(pitStopPoints),
      service,
      timeCursor: { lap: 12 },
    });
    const server = await startOperatorApiServer({ api });
    activeServers.add(server);

    const historicalResponse = await fetch(
      `${server.origin}/data/PitStopSeries/events?driverNumber=4`,
    );
    expect(historicalResponse.status).toBe(200);
    await expect(historicalResponse.json()).resolves.toEqual({
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'lap',
        includeFuture: false,
      },
      total: 1,
      returned: 1,
      events: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          stopNumber: 0,
          lap: 12,
          timestamp: '2025-01-01T00:00:12.500Z',
          dateTime: '2025-01-01T00:00:12.500Z',
          pitStopTime: '2.45',
          pitStopTimeMs: 2450,
          pitLaneTime: '22.10',
          pitLaneTimeMs: 22100,
          tyreBefore: {
            stint: 1,
            compound: 'MEDIUM',
            isNew: true,
            tyresNotChanged: null,
            startLaps: 1,
            totalLaps: 12,
            lapsOnTyre: 11,
            lapNumber: 12,
            source: 'TyreStintSeries',
          },
          tyreAfter: {
            stint: 2,
            compound: 'HARD',
            isNew: false,
            tyresNotChanged: null,
            startLaps: 12,
            totalLaps: 20,
            lapsOnTyre: 8,
            lapNumber: 13,
            source: 'TyreStintSeries',
          },
          source: 'PitStopSeries',
        },
      ],
    });

    const includeFutureResponse = await fetch(
      `${server.origin}/data/PitStopSeries/events?includeFuture=true&order=desc&limit=1`,
    );
    expect(includeFutureResponse.status).toBe(200);
    await expect(includeFutureResponse.json()).resolves.toEqual({
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'lap',
        includeFuture: true,
      },
      total: 2,
      returned: 1,
      events: [
        {
          driverNumber: '81',
          driverName: 'Oscar Piastri',
          stopNumber: 0,
          lap: 13,
          timestamp: '2025-01-01T00:00:13.500Z',
          dateTime: '2025-01-01T00:00:13.500Z',
          pitStopTime: '3.10',
          pitStopTimeMs: 3100,
          pitLaneTime: '23.50',
          pitLaneTimeMs: 23500,
          tyreBefore: {
            stint: 1,
            compound: 'HARD',
            isNew: false,
            tyresNotChanged: null,
            startLaps: 1,
            totalLaps: 13,
            lapsOnTyre: 12,
            lapNumber: 13,
            source: 'TyreStintSeries',
          },
          tyreAfter: {
            stint: 2,
            compound: 'SOFT',
            isNew: true,
            tyresNotChanged: null,
            startLaps: 13,
            totalLaps: 20,
            lapsOnTyre: 7,
            lapNumber: 14,
            source: 'TyreStintSeries',
          },
          source: 'PitStopSeries',
        },
      ],
    });
  });

  it('serves team radio download and playback workflows over HTTP', async () => {
    const destinationDir = mkdtempSync(
      path.join(tmpdir(), 'f1aire-team-radio-http-'),
    );
    const fetchImpl = async () => new Response('radio-bytes');
    const spawnImpl = () => ({
      pid: 2468,
      once: () => undefined,
      unref: () => undefined,
    });

    try {
      const server = await startTestServer(points, {
        teamRadioFetchImpl: fetchImpl as typeof fetch,
        teamRadioSpawnImpl: spawnImpl,
      });

      const downloadResponse = await fetch(
        `${server.origin}/data/TeamRadio/download`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ captureId: '1', destinationDir }),
        },
      );
      expect(downloadResponse.status).toBe(200);
      await expect(downloadResponse.json()).resolves.toMatchObject({
        captureId: '1',
        driverNumber: '4',
        reused: false,
        bytes: 11,
        filePath: path.join(destinationDir, 'LANNOR01_4_20250101_000011.mp3'),
      });
      expect(
        readFileSync(
          path.join(destinationDir, 'LANNOR01_4_20250101_000011.mp3'),
          'utf-8',
        ),
      ).toBe('radio-bytes');

      const playResponse = await fetch(`${server.origin}/data/TeamRadio/play`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ captureId: '1', destinationDir, player: 'mpv' }),
      });
      expect(playResponse.status).toBe(200);
      await expect(playResponse.json()).resolves.toMatchObject({
        captureId: '1',
        driverNumber: '4',
        reused: true,
        player: 'mpv',
        command: 'mpv',
        args: [
          '--really-quiet',
          '--force-window=no',
          path.join(destinationDir, 'LANNOR01_4_20250101_000011.mp3'),
        ],
        pid: 2468,
      });

      const notFoundResponse = await fetch(
        `${server.origin}/data/TeamRadio/download`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ captureId: '999' }),
        },
      );
      expect(notFoundResponse.status).toBe(404);
      await expect(notFoundResponse.json()).resolves.toEqual({
        errorCode: 'not-found',
        errorMessage: 'No matching team radio capture was found.',
      });
    } finally {
      rmSync(destinationDir, { recursive: true, force: true });
    }
  });

  it('serves team radio transcription workflows over HTTP', async () => {
    const destinationDir = mkdtempSync(
      path.join(tmpdir(), 'f1aire-team-radio-http-transcribe-'),
    );
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('.mp3')) {
        return new Response('radio-bytes');
      }

      expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
      expect(init?.method).toBe('POST');

      return new Response(JSON.stringify({ text: 'Copy, box this lap.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const server = await startTestServer(points, {
        teamRadioFetchImpl: fetchImpl as typeof fetch,
      });

      const transcribeResponse = await fetch(
        `${server.origin}/data/TeamRadio/transcribe`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            captureId: '1',
            destinationDir,
            apiKey: 'sk-test',
          }),
        },
      );
      expect(transcribeResponse.status).toBe(200);
      const first = await transcribeResponse.json();
      expect(first).toMatchObject({
        captureId: '1',
        driverNumber: '4',
        reused: false,
        backend: 'openai',
        transcription: 'Copy, box this lap.',
        transcriptionReused: false,
        filePath: path.join(destinationDir, 'LANNOR01_4_20250101_000011.mp3'),
      });
      expect(readFileSync(first.filePath, 'utf-8')).toBe('radio-bytes');

      const cachedResponse = await fetch(
        `${server.origin}/data/TeamRadio/transcribe`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            captureId: '1',
            destinationDir,
            apiKey: 'sk-test',
          }),
        },
      );
      expect(cachedResponse.status).toBe(200);
      await expect(cachedResponse.json()).resolves.toMatchObject({
        captureId: '1',
        reused: true,
        backend: 'openai',
        transcription: 'Copy, box this lap.',
        transcriptionReused: true,
        transcriptionFilePath: first.transcriptionFilePath,
      });

      const previousOpenAiApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      try {
        const invalidResponse = await fetch(
          `${server.origin}/data/TeamRadio/transcribe`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              captureId: '1',
              destinationDir,
              forceTranscription: true,
            }),
          },
        );
        expect(invalidResponse.status).toBe(400);
        await expect(invalidResponse.json()).resolves.toEqual({
          errorCode: 'invalid-request',
          errorMessage:
            'OpenAI API key is required to transcribe team radio clips. Set OPENAI_API_KEY or save a key in f1aire settings.',
        });
      } finally {
        if (previousOpenAiApiKey === undefined) {
          delete process.env.OPENAI_API_KEY;
        } else {
          process.env.OPENAI_API_KEY = previousOpenAiApiKey;
        }
      }
    } finally {
      rmSync(destinationDir, { recursive: true, force: true });
    }
  });

  it('serves local team radio transcription workflows over HTTP', async () => {
    const destinationDir = mkdtempSync(
      path.join(tmpdir(), 'f1aire-team-radio-http-local-'),
    );
    const fetchImpl = async () => new Response('radio-bytes');
    const execFileImpl = (file, args, _options, callback) => {
      expect(file).toBe('whisper');
      const inputPath = String(args[0]);
      const outputDir = String(args[args.indexOf('--output_dir') + 1]);
      writeFileSync(
        path.join(outputDir, `${path.parse(inputPath).name}.json`),
        JSON.stringify({ text: 'Local HTTP copy.' }),
      );
      callback(null, '', '');
    };

    try {
      const server = await startTestServer(points, {
        teamRadioFetchImpl: fetchImpl as typeof fetch,
        teamRadioExecFileImpl: execFileImpl,
      });

      const response = await fetch(
        `${server.origin}/data/TeamRadio/transcribe`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            captureId: '1',
            destinationDir,
            backend: 'local',
          }),
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        captureId: '1',
        backend: 'local',
        transcription: 'Local HTTP copy.',
        transcriptionReused: false,
        model: 'base',
      });
    } finally {
      rmSync(destinationDir, { recursive: true, force: true });
    }
  });

  it('serves exact-time position snapshots over HTTP', async () => {
    const service = new TimingService();
    exactTimePositionPoints.forEach((point) => service.enqueue(point));
    const api = createOperatorApi({
      store: buildStore(exactTimePositionPoints),
      service,
      timeCursor: { iso: '2025-01-01T00:00:12.300Z' },
    });
    const server = await startOperatorApiServer({ api });
    activeServers.add(server);

    const response = await fetch(`${server.origin}/data/Position/snapshot`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      asOf: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.300Z',
        source: 'time',
      },
      positionTimestamp: '2025-01-01T00:00:12.260Z',
      telemetryUtc: '2025-01-01T00:00:12.270Z',
      totalDrivers: 2,
      drivers: [
        {
          driverNumber: '4',
          driverName: 'Lando Norris',
          timingPosition: 1,
          status: 'OnTrack',
          offTrack: false,
          coordinates: { x: 10, y: 20, z: 1 },
          telemetry: {
            rpm: null,
            speed: 302,
            gear: 8,
            throttle: null,
            brake: null,
            drs: null,
          },
        },
        {
          driverNumber: '81',
          driverName: 'Oscar Piastri',
          timingPosition: 2,
          status: 'OnTrack',
          offTrack: false,
          coordinates: { x: 30, y: 40, z: 2 },
          telemetry: {
            rpm: null,
            speed: 298,
            gear: 7,
            throttle: null,
            brake: null,
            drs: null,
          },
        },
      ],
    });
  });

  it('serves structured session lifecycle events over HTTP', async () => {
    const lifecyclePoints: RawPoint[] = [
      ...points,
      {
        type: 'SessionData',
        json: {
          StatusSeries: {
            '0': {
              Utc: '2025-01-01T00:00:02.000Z',
              SessionStatus: 'Started',
            },
          },
        },
        dateTime: new Date('2025-01-01T00:00:02Z'),
      },
      {
        type: 'SessionData',
        json: {
          StatusSeries: {
            '1': {
              Utc: '2025-01-01T00:00:03.000Z',
              TrackStatus: 'Yellow',
            },
          },
        },
        dateTime: new Date('2025-01-01T00:00:03Z'),
      },
      {
        type: 'SessionStatus',
        json: {
          Utc: '2025-01-01T00:00:04.000Z',
          Status: 'Started',
        },
        dateTime: new Date('2025-01-01T00:00:04Z'),
      },
      {
        type: 'SessionData',
        json: {
          StatusSeries: {
            '2': {
              Utc: '2025-01-01T00:00:13.000Z',
              SessionStatus: 'Finished',
            },
          },
        },
        dateTime: new Date('2025-01-01T00:00:13Z'),
      },
      {
        type: 'ArchiveStatus',
        json: {
          Status: 'Complete',
        },
        dateTime: new Date('2025-01-01T00:00:14Z'),
      },
    ];

    const server = await startTestServer(lifecyclePoints, {
      subscribe: {
        SessionInfo: {
          SessionStatus: 'Inactive',
          ArchiveStatus: { Status: 'Generating' },
        },
      },
    });

    const lifecycleResponse = await fetch(
      `${server.origin}/data/SessionLifecycle/events?limit=2&order=desc&includeFuture=true`,
    );
    expect(lifecycleResponse.status).toBe(200);
    await expect(lifecycleResponse.json()).resolves.toEqual({
      asOf: {
        source: 'latest',
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        includeFuture: true,
      },
      sessionStatus: {
        status: 'Finished',
        utc: '2025-01-01T00:00:13.000Z',
        source: 'SessionData',
      },
      trackStatus: {
        status: 'Yellow',
        utc: '2025-01-01T00:00:03.000Z',
        source: 'SessionData',
      },
      archiveStatus: {
        status: 'Complete',
        source: 'ArchiveStatus',
        raw: { Status: 'Complete' },
      },
      total: 4,
      returned: 2,
      order: 'desc',
      events: [
        {
          eventId: '2',
          utc: '2025-01-01T00:00:13.000Z',
          sessionStatus: 'Finished',
          trackStatus: null,
          source: 'SessionData',
        },
        {
          eventId: 'latest',
          utc: '2025-01-01T00:00:04.000Z',
          sessionStatus: 'Started',
          trackStatus: null,
          source: 'SessionStatus',
        },
      ],
    });
  });

  it('mirrors replay control state and structured control errors over HTTP', async () => {
    const server = await startTestServer();

    const stateResponse = await fetch(`${server.origin}/control`);
    expect(stateResponse.status).toBe(200);
    await expect(stateResponse.json()).resolves.toMatchObject({
      cursor: { latest: true },
      resolved: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'latest',
      },
      lapRange: {
        firstLap: 11,
        lastLap: 12,
        totalLaps: 2,
      },
    });

    const controlResponse = await fetch(`${server.origin}/control`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'set-lap', lap: 999 }),
    });
    expect(controlResponse.status).toBe(200);
    await expect(controlResponse.json()).resolves.toMatchObject({
      cursor: { lap: 12 },
      resolved: {
        lap: 12,
        dateTime: '2025-01-01T00:00:12.000Z',
        source: 'lap',
      },
    });

    const stepTimeResponse = await fetch(`${server.origin}/control`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'step-time',
        deltaMs: -600,
      }),
    });
    expect(stepTimeResponse.status).toBe(200);
    await expect(stepTimeResponse.json()).resolves.toMatchObject({
      cursor: {
        lap: 11,
        iso: '2025-01-01T00:00:11.400Z',
        latest: false,
      },
      resolved: {
        lap: 11,
        dateTime: '2025-01-01T00:00:11.000Z',
        source: 'time',
      },
    });

    const invalidResponse = await fetch(`${server.origin}/control`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'set-time', iso: 'nope' }),
    });
    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toEqual({
      errorCode: 'invalid-request',
      errorMessage: 'set-time requires a valid ISO timestamp.',
    });

    const invalidStepTimeResponse = await fetch(`${server.origin}/control`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'step-time', deltaMs: 'bad' }),
    });
    expect(invalidStepTimeResponse.status).toBe(400);
    await expect(invalidStepTimeResponse.json()).resolves.toEqual({
      errorCode: 'invalid-request',
      errorMessage: 'step-time requires a finite deltaMs value.',
    });
  });
});
