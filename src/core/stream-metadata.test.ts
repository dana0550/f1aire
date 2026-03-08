import { describe, expect, it } from 'vitest';
import { getStreamMetadataRecords } from './stream-metadata.js';

describe('getStreamMetadataRecords', () => {
  it('builds deterministic audio stream records and resolves relative URLs', () => {
    expect(
      getStreamMetadataRecords({
        topic: 'AudioStreams',
        state: {
          Streams: {
            '10': {
              Name: 'FX',
              Language: 'en',
              Path: 'AudioStreams/FX.m3u8',
            },
            '2': {
              Name: 'Driver',
              Language: 'de',
              Uri: 'https://cdn.example.test/driver.m3u8',
            },
          },
        },
        staticPrefix:
          'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/',
      }),
    ).toEqual([
      {
        streamId: '2',
        name: 'Driver',
        language: 'de',
        type: null,
        uri: 'https://cdn.example.test/driver.m3u8',
        path: null,
        resolvedUrl: 'https://cdn.example.test/driver.m3u8',
      },
      {
        streamId: '10',
        name: 'FX',
        language: 'en',
        type: null,
        uri: null,
        path: 'AudioStreams/FX.m3u8',
        resolvedUrl:
          'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/AudioStreams/FX.m3u8',
      },
    ]);
  });

  it('filters content streams by language and search text', () => {
    expect(
      getStreamMetadataRecords({
        topic: 'ContentStreams',
        state: {
          Streams: {
            '0': {
              Type: 'Commentary',
              Language: 'en',
              Path: 'Content/commentary-en.json',
            },
            '1': {
              Type: 'Telemetry',
              Language: 'es',
              Uri: 'https://cdn.example.test/telemetry-es.json',
            },
          },
        },
        language: 'en',
        search: 'commentary',
        staticPrefix:
          'https://livetiming.formula1.com/static/2025/Test_Weekend/Race/',
      }),
    ).toEqual([
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
    ]);
  });
});
