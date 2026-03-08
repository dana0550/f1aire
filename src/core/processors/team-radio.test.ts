import { describe, expect, it } from 'vitest';
import { TeamRadioProcessor } from './team-radio.js';

describe('TeamRadioProcessor', () => {
  it('merges captures and exposes ordered capture helpers', () => {
    const processor = new TeamRadioProcessor();

    processor.process({
      type: 'TeamRadio',
      json: {
        Captures: {
          '0': {
            Utc: '2024-05-26T12:15:25.710Z',
            RacingNumber: '81',
            Path: 'TeamRadio/OSCPIA01_81_20240526_121525.mp3',
          },
        },
      },
      dateTime: new Date('2024-05-26T12:15:25.710Z'),
    });

    processor.process({
      type: 'TeamRadio',
      json: {
        Captures: {
          '1': {
            Utc: '2024-05-26T12:16:25.710Z',
            RacingNumber: '4',
            Path: 'TeamRadio/LANNOR01_4_20240526_121625.mp3',
          },
        },
      },
      dateTime: new Date('2024-05-26T12:16:25.710Z'),
    });

    processor.process({
      type: 'TeamRadio',
      json: {
        Captures: {
          '1': {
            DownloadedFilePath: '/tmp/LANNOR01_4_20240526_121625.mp3',
            Transcription: 'Box this lap.',
          },
        },
      },
      dateTime: new Date('2024-05-26T12:16:26.000Z'),
    });

    expect(processor.getCaptureCount()).toBe(2);
    expect(processor.getLatestCapture()).toMatchObject({
      captureId: '1',
      driverNumber: '4',
      hasTranscription: true,
      downloadedFilePath: '/tmp/LANNOR01_4_20240526_121625.mp3',
    });
    expect(
      processor.getCapture('1', {
        staticPrefix:
          'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/',
      }),
    ).toMatchObject({
      captureId: '1',
      assetUrl:
        'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/TeamRadio/LANNOR01_4_20240526_121625.mp3',
      hasTranscription: true,
    });
    expect(
      processor.getCaptures({
        driverNumber: '81',
        staticPrefix:
          'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/',
      }),
    ).toMatchObject([
      {
        captureId: '0',
        driverNumber: '81',
        assetUrl:
          'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/TeamRadio/OSCPIA01_81_20240526_121525.mp3',
      },
    ]);
  });
});
