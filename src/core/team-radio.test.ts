import { describe, expect, it } from 'vitest';
import {
  getSessionStaticPrefix,
  getTeamRadioCaptures,
  resolveStaticAssetUrl,
} from './team-radio.js';

describe('team radio helpers', () => {
  it('prefers the download manifest prefix when resolving clip URLs', () => {
    const staticPrefix = getSessionStaticPrefix({
      raw: {
        download: {
          prefix: 'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/',
        },
        subscribe: {},
        keyframes: null,
      },
    });

    expect(staticPrefix).toBe(
      'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/',
    );

    const captures = getTeamRadioCaptures(
      {
        Captures: {
          '0': {
            Utc: '2024-05-26T12:15:25.710Z',
            RacingNumber: '81',
            Path: 'TeamRadio/OSCPIA01_81_20240526_121525.mp3',
          },
          '1': {
            Utc: '2024-05-26T12:16:25.710Z',
            RacingNumber: '4',
            Path: 'TeamRadio/LANNOR01_4_20240526_121625.mp3',
          },
        },
      },
      { staticPrefix },
    );

    expect(captures).toMatchObject([
      {
        captureId: '1',
        driverNumber: '4',
        assetUrl:
          'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/TeamRadio/LANNOR01_4_20240526_121625.mp3',
      },
      {
        captureId: '0',
        driverNumber: '81',
        assetUrl:
          'https://livetiming.formula1.com/static/2024/Test_Weekend/Race/TeamRadio/OSCPIA01_81_20240526_121525.mp3',
      },
    ]);
  });

  it('falls back to SessionInfo.Path when the manifest is unavailable', () => {
    const staticPrefix = getSessionStaticPrefix({
      raw: {
        download: null,
        subscribe: {
          SessionInfo: {
            Path: '2024/2024-05-26_Test_Weekend/2024-05-26_Race/',
          },
        },
        keyframes: null,
      },
    });

    expect(staticPrefix).toBe(
      'https://livetiming.formula1.com/static/2024/2024-05-26_Test_Weekend/2024-05-26_Race/',
    );
    expect(
      resolveStaticAssetUrl(
        staticPrefix,
        'TeamRadio/LANNOR01_4_20240526_121625.mp3',
      ),
    ).toBe(
      'https://livetiming.formula1.com/static/2024/2024-05-26_Test_Weekend/2024-05-26_Race/TeamRadio/LANNOR01_4_20240526_121625.mp3',
    );
  });
});
