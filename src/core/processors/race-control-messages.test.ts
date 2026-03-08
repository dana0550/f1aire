import { describe, expect, it } from 'vitest';
import {
  getRaceControlEvents,
  parseRaceControlUtc,
  RaceControlMessagesProcessor,
} from './race-control-messages.js';

describe('RaceControlMessagesProcessor', () => {
  it('parses timezone-less UTC strings as UTC', () => {
    expect(parseRaceControlUtc('2024-05-19T12:57:03')?.toISOString()).toBe(
      '2024-05-19T12:57:03.000Z',
    );
  });

  it('returns deterministic newest-first typed events with filters', () => {
    const events = getRaceControlEvents(
      {
        Messages: {
          '9': {
            Utc: '2024-05-19T12:57:03',
            Lap: 1,
            Category: 'Drs',
            Status: 'DISABLED',
            Message: 'DRS DISABLED',
          },
          '10': {
            Utc: '2024-05-19T13:03:17',
            Lap: 1,
            Category: 'Flag',
            Flag: 'GREEN',
            Scope: 'Track',
            Message: 'GREEN LIGHT - PIT EXIT OPEN',
          },
          '11': {
            Utc: '2024-05-19T13:16:42',
            Lap: 10,
            Category: 'Flag',
            Flag: 'BLUE',
            Scope: 'Driver',
            RacingNumber: '23',
            Message: 'WAVED BLUE FLAG FOR CAR 23 (ALB)',
          },
        },
      },
      {
        category: 'flag',
        scope: 'driver',
        driverNumber: '23',
      },
    );

    expect(events).toEqual([
      {
        messageId: '11',
        utc: '2024-05-19T13:16:42',
        dateTime: new Date('2024-05-19T13:16:42.000Z'),
        lap: 10,
        category: 'Flag',
        flag: 'BLUE',
        scope: 'Driver',
        sector: null,
        status: null,
        driverNumber: '23',
        message: 'WAVED BLUE FLAG FOR CAR 23 (ALB)',
      },
    ]);
  });

  it('merges patches and supports as-of filtering', () => {
    const processor = new RaceControlMessagesProcessor();

    processor.process({
      type: 'RaceControlMessages',
      json: {
        Messages: [
          {
            Utc: '2024-05-18T14:00:00',
            Category: 'Flag',
            Flag: 'GREEN',
            Scope: 'Track',
            Message: 'GREEN LIGHT - PIT EXIT OPEN',
          },
        ],
      },
      dateTime: new Date('2024-05-18T14:00:00Z'),
    });
    processor.process({
      type: 'RaceControlMessages',
      json: {
        Messages: {
          '1': {
            Utc: '2024-05-18T14:04:28',
            Category: 'Other',
            Message:
              'CAR 2 (SAR) TIME 1:17.188 DELETED - TRACK LIMITS AT TURN 18 LAP 3 16:03:19',
          },
        },
      },
      dateTime: new Date('2024-05-18T14:04:28Z'),
    });

    expect(processor.state).toMatchObject({
      Messages: {
        '0': { Message: 'GREEN LIGHT - PIT EXIT OPEN' },
        '1': {
          Message:
            'CAR 2 (SAR) TIME 1:17.188 DELETED - TRACK LIMITS AT TURN 18 LAP 3 16:03:19',
        },
      },
    });

    expect(
      processor.getMessages({ before: new Date('2024-05-18T14:02:00Z') }),
    ).toEqual([
      {
        messageId: '0',
        utc: '2024-05-18T14:00:00',
        dateTime: new Date('2024-05-18T14:00:00.000Z'),
        lap: null,
        category: 'Flag',
        flag: 'GREEN',
        scope: 'Track',
        sector: null,
        status: null,
        driverNumber: null,
        message: 'GREEN LIGHT - PIT EXIT OPEN',
      },
    ]);
  });
});
