import { describe, expect, it } from 'vitest';
import {
  buildChampionshipPredictionState,
  getChampionshipPredictionDrivers,
  getChampionshipPredictionTeams,
} from './championship-prediction.js';

describe('championship-prediction', () => {
  it('merges timeline patches and builds deterministic driver/team tables', () => {
    const state = buildChampionshipPredictionState({
      baseState: {
        Drivers: {
          '1': {
            RacingNumber: '1',
            CurrentPosition: 1,
            PredictedPosition: 1,
            CurrentPoints: 100,
            PredictedPoints: 108,
          },
          '4': {
            RacingNumber: '4',
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
      timeline: [
        {
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
        },
        {
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
        },
      ],
    });

    const driverListState = {
      '1': { FullName: 'Max Verstappen', TeamName: 'Red Bull Racing' },
      '4': { FullName: 'Lando Norris', TeamName: 'McLaren Mercedes' },
    };

    expect(
      getChampionshipPredictionDrivers({
        state,
        driverListState,
      }),
    ).toEqual([
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
          CurrentPosition: 2,
          PredictedPosition: 1,
          CurrentPoints: 95,
          PredictedPoints: 109,
        },
      },
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
        gapToLeaderPoints: 2,
        raw: {
          RacingNumber: '1',
          CurrentPosition: 1,
          PredictedPosition: 2,
          CurrentPoints: 100,
          PredictedPoints: 107,
        },
      },
    ]);

    expect(
      getChampionshipPredictionTeams({
        state,
        teamName: 'mclaren',
      }),
    ).toEqual([
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
    ]);
  });
});
