import path from 'node:path';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import {
  downloadTeamRadioCapture,
  getDefaultTeamRadioDownloadDir,
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

  it('derives a stable local cache directory from the session path', () => {
    const previousXdgDataHome = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = '/tmp/f1aire-team-radio-cache';

    try {
      expect(
        getDefaultTeamRadioDownloadDir(
          {
            raw: {
              download: {
                session: {
                  path: '2024/2024-05-26_Test_Weekend/2024-05-26_Race/',
                },
              },
              subscribe: {},
              keyframes: null,
            },
          },
          { appName: 'f1aire' },
        ),
      ).toBe(
        path.join(
          '/tmp/f1aire-team-radio-cache',
          'f1aire',
          'data',
          'team-radio',
          '2024',
          '2024-05-26_Test_Weekend',
          '2024-05-26_Race',
        ),
      );
    } finally {
      if (previousXdgDataHome === undefined) {
        delete process.env.XDG_DATA_HOME;
      } else {
        process.env.XDG_DATA_HOME = previousXdgDataHome;
      }
    }
  });

  it('downloads a radio clip and reuses the local file on subsequent calls', async () => {
    const destinationDir = mkdtempSync(path.join(tmpdir(), 'f1aire-team-radio-'));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('radio-bytes', { status: 200 }));

    try {
      const source = {
        raw: {
          download: {
            prefix:
              'https://livetiming.formula1.com/static/2024/2024-05-26_Test_Weekend/2024-05-26_Race/',
            session: {
              path: '2024/2024-05-26_Test_Weekend/2024-05-26_Race/',
            },
          },
          subscribe: {},
          keyframes: null,
        },
      };
      const state = {
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
      };

      const first = await downloadTeamRadioCapture({
        source,
        state,
        captureId: '1',
        destinationDir,
        fetchImpl,
      });

      expect(first).toMatchObject({
        captureId: '1',
        driverNumber: '4',
        reused: false,
        bytes: 11,
        filePath: path.join(destinationDir, 'LANNOR01_4_20240526_121625.mp3'),
      });
      expect(readFileSync(first.filePath, 'utf-8')).toBe('radio-bytes');
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      const second = await downloadTeamRadioCapture({
        source,
        state,
        captureId: '1',
        destinationDir,
        fetchImpl,
      });

      expect(second).toMatchObject({
        captureId: '1',
        reused: true,
        filePath: first.filePath,
        bytes: 11,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(destinationDir, { recursive: true, force: true });
    }
  });
});
