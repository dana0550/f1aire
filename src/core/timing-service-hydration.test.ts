import { describe, expect, it } from 'vitest';
import {
  hydrateTimingServiceFromStore,
  TimingService,
} from './timing-service.js';

function buildStore(raw: {
  subscribe: Record<string, unknown>;
  live: Array<{ type: string; json: unknown; dateTime: Date }>;
  keyframes: Record<string, unknown> | null;
}) {
  return {
    raw: {
      subscribe: raw.subscribe,
      live: raw.live,
      download: null,
      keyframes: raw.keyframes,
    },
    topic: () => ({ latest: null, timeline: () => [] }),
  } as const;
}

describe('hydrateTimingServiceFromStore', () => {
  it('hydrates keyframe-only feeds into processors when the live stream is missing', () => {
    const service = new TimingService();
    const store = buildStore({
      subscribe: {
        SessionInfo: {
          Name: 'Race',
          Path: '2025/2025-03-01_Test_Weekend/2025-03-01_Race/',
        },
        Heartbeat: {
          Utc: '2025-03-01T10:00:00Z',
        },
      },
      live: [],
      keyframes: {
        AudioStreams: {
          Streams: [
            {
              Name: 'FX',
              Language: 'en',
              Path: 'AudioStreams/FX.m3u8',
            },
          ],
        },
      },
    });

    const result = hydrateTimingServiceFromStore({ service, store });

    expect(result).toEqual({
      subscribeTopics: ['SessionInfo', 'Heartbeat'],
      keyframeTopics: ['AudioStreams'],
      livePoints: 0,
    });
    expect(service.processors.extraTopics.AudioStreams.state).toEqual({
      Streams: {
        '0': {
          Name: 'FX',
          Language: 'en',
          Path: 'AudioStreams/FX.m3u8',
        },
      },
    });
  });

  it('does not hydrate a keyframe when live updates already exist for that topic', () => {
    const service = new TimingService();
    const store = buildStore({
      subscribe: {
        SessionInfo: {
          Name: 'Race',
          Path: '2025/2025-03-01_Test_Weekend/2025-03-01_Race/',
        },
        Heartbeat: {
          Utc: '2025-03-01T10:00:00Z',
        },
      },
      live: [
        {
          type: 'TimingData',
          json: {
            Lines: {
              '4': {
                Line: 1,
                NumberOfLaps: 12,
                BestLapTime: { Value: '1:30.000', Lap: 12 },
                LastLapTime: { Value: '1:30.000' },
              },
            },
          },
          dateTime: new Date('2025-03-01T10:12:00Z'),
        },
      ],
      keyframes: {
        AudioStreams: {
          Streams: [
            {
              Name: 'FX',
              Language: 'en',
              Path: 'AudioStreams/FX.m3u8',
            },
          ],
        },
        TimingData: {
          Lines: {
            '4': {
              Line: 99,
              NumberOfLaps: 1,
              BestLapTime: { Value: '1:40.000', Lap: 1 },
            },
          },
        },
      },
    });

    const result = hydrateTimingServiceFromStore({ service, store });

    expect(result.keyframeTopics).toEqual(['AudioStreams']);
    expect(service.processors.timingData.state).toMatchObject({
      Lines: {
        '4': {
          Line: 1,
          NumberOfLaps: 12,
          BestLapTime: { Value: '1:30.000', Lap: 12 },
        },
      },
    });
    expect(service.processors.timingData.bestLaps.get('4')).toMatchObject({
      time: '1:30.000',
      lap: 12,
    });
  });
});
