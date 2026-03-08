import { describe, expect, it } from 'vitest';
import {
  buildDriverTrackerState,
  getDriverTrackerMeta,
  getDriverTrackerRows,
  mergeDriverTrackerState,
} from './driver-tracker.js';

describe('driver tracker helpers', () => {
  it('merges incremental board patches into stable state', () => {
    const first = mergeDriverTrackerState(null, {
      Withheld: false,
      Lines: [
        { Position: '1', RacingNumber: '81', ShowPosition: true },
        { Position: '2', RacingNumber: '4', ShowPosition: true },
      ],
    });
    const second = mergeDriverTrackerState(first, {
      SessionPart: 2,
      Lines: {
        '0': { DiffToLeader: 'LEADER', OverallFastest: true },
        '1': {
          DiffToAhead: '+0.9',
          DiffToLeader: '+0.9',
          LapState: 80,
        },
      },
    });

    expect(second).toEqual({
      Withheld: false,
      SessionPart: 2,
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
          DiffToAhead: '+0.9',
          DiffToLeader: '+0.9',
          LapState: 80,
        },
      },
    });
  });

  it('builds cursor-ready state from subscribe baseline and timeline patches', () => {
    const state = buildDriverTrackerState({
      baseState: {
        Withheld: false,
        Lines: {
          '0': { Position: '1', RacingNumber: '81', ShowPosition: true },
        },
      },
      timeline: [
        {
          json: {
            Lines: {
              '1': {
                Position: '2',
                RacingNumber: '4',
                ShowPosition: true,
                DiffToLeader: '+1.8',
              },
            },
          },
        },
        {
          json: {
            SessionPart: 3,
            Lines: {
              '0': { LapTime: '1:23.456' },
              '1': { DiffToAhead: '+1.8', LapState: 529 },
            },
          },
        },
      ],
    });

    expect(state).toEqual({
      Withheld: false,
      SessionPart: 3,
      Lines: {
        '0': {
          Position: '1',
          RacingNumber: '81',
          ShowPosition: true,
          LapTime: '1:23.456',
        },
        '1': {
          Position: '2',
          RacingNumber: '4',
          ShowPosition: true,
          DiffToLeader: '+1.8',
          DiffToAhead: '+1.8',
          LapState: 529,
        },
      },
    });
    expect(getDriverTrackerMeta(state)).toEqual({
      withheld: false,
      sessionPart: 3,
    });
  });

  it('returns ordered typed rows with parsed board fields', () => {
    const rows = getDriverTrackerRows({
      state: {
        Lines: {
          '1': {
            Position: '2',
            RacingNumber: '4',
            ShowPosition: 'true',
            LapTime: '1:31.200',
            LapState: '80',
            DiffToAhead: '+0.9',
            DiffToLeader: '+0.9',
            OverallFastest: 0,
            PersonalFastest: 1,
          },
          '0': {
            Position: '1',
            RacingNumber: '81',
            ShowPosition: false,
            DiffToLeader: 'LEADER',
            OverallFastest: true,
            PersonalFastest: false,
          },
        },
      },
      driverListState: {
        '4': { FullName: 'Lando Norris' },
        '81': { BroadcastName: 'Oscar Piastri' },
      },
    });

    expect(rows).toEqual([
      {
        lineIndex: 0,
        driverNumber: '81',
        driverName: 'Oscar Piastri',
        position: 1,
        showPosition: false,
        lapTime: null,
        lapState: null,
        diffToAhead: null,
        diffToAheadSeconds: null,
        diffToLeader: 'LEADER',
        diffToLeaderSeconds: null,
        overallFastest: true,
        personalFastest: false,
        raw: {
          Position: '1',
          RacingNumber: '81',
          ShowPosition: false,
          DiffToLeader: 'LEADER',
          OverallFastest: true,
          PersonalFastest: false,
        },
      },
      {
        lineIndex: 1,
        driverNumber: '4',
        driverName: 'Lando Norris',
        position: 2,
        showPosition: true,
        lapTime: '1:31.200',
        lapState: 80,
        diffToAhead: '+0.9',
        diffToAheadSeconds: 0.9,
        diffToLeader: '+0.9',
        diffToLeaderSeconds: 0.9,
        overallFastest: false,
        personalFastest: true,
        raw: {
          Position: '2',
          RacingNumber: '4',
          ShowPosition: 'true',
          LapTime: '1:31.200',
          LapState: '80',
          DiffToAhead: '+0.9',
          DiffToLeader: '+0.9',
          OverallFastest: 0,
          PersonalFastest: 1,
        },
      },
    ]);
  });
});
