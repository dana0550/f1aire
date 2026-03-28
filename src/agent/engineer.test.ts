import { describe, it, expect, vi } from 'vitest';
import { createEngineerSession } from './engineer.js';

function buildDraft(expectedValue: number): string {
  return JSON.stringify({
    schemaVersion: '1',
    recommendation: 'Pit this lap for undercut',
    whyNow: 'Traffic window opens in 1 lap',
    alternatives: ['Stay out and defend'],
    riskInvalidators: ['Unexpected VSC'],
    nextObservationWindow: 'Next 2 laps',
    asOf: 'Lap 30',
    claims: [
      {
        claimId: 'C-1',
        statement: 'Undercut delta is favorable',
        claimRole: 'rationale',
        claimType: 'comparison',
        checks: [
          {
            checkId: 'K-1',
            toolName: 'get_metric',
            args: { metric: 'undercut_delta' },
            targetPath: 'value',
            op: 'eq',
            expected: expectedValue,
          },
        ],
      },
      {
        claimId: 'C-2',
        statement: 'Pit this lap for undercut',
        claimRole: 'recommendation',
        claimType: 'recommendation',
        checks: [
          {
            checkId: 'K-2',
            toolName: 'get_metric',
            args: { metric: 'undercut_delta' },
            targetPath: 'value',
            op: 'eq',
            expected: expectedValue,
          },
        ],
      },
      {
        claimId: 'C-3',
        statement: 'Unexpected VSC',
        claimRole: 'invalidator',
        claimType: 'forecast',
        checks: [
          {
            checkId: 'K-3',
            toolName: 'get_metric',
            args: { metric: 'undercut_delta' },
            targetPath: 'value',
            op: 'eq',
            expected: expectedValue,
          },
        ],
      },
      {
        claimId: 'C-4',
        statement: 'Next 2 laps',
        claimRole: 'observation-window',
        claimType: 'fact',
        checks: [
          {
            checkId: 'K-4',
            toolName: 'get_metric',
            args: { metric: 'undercut_delta' },
            targetPath: 'value',
            op: 'eq',
            expected: expectedValue,
          },
        ],
      },
    ],
  });
}

describe('engineer session', () => {
  it('returns a verified response when checks pass', async () => {
    const onEvent = vi.fn();
    const session = createEngineerSession({
      model: {} as any,
      tools: {
        get_metric: {
          execute: vi.fn().mockResolvedValue({ value: 12 }),
        },
      } as any,
      system: 'x',
      onEvent,
      streamTextFn: (async () =>
        ({
          fullStream: (async function* () {
            yield { type: 'text-delta', id: 't1', text: buildDraft(12) };
          })(),
        }) as any) as any,
    });
    const stream = session.send('hello');
    const parts: string[] = [];
    for await (const t of stream) parts.push(t);
    const output = parts.join('');
    expect(output).toContain('Recommendation: Pit this lap for undercut');
    expect(output).toContain('Verified claims:');
    expect(output).toContain('- Undercut delta is favorable');
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'strategy-check-result',
        claimId: 'C-1',
        checkId: 'K-1',
        ok: true,
        toolName: 'get_metric',
      }),
    );
  });

  it('allows enough tool steps for python self-healing', async () => {
    const streamTextFn = vi.fn(async () =>
      ({
        fullStream: (async function* () {
          yield { type: 'text-delta', id: 't1', text: buildDraft(1) };
        })(),
      }) as any);

    const session = createEngineerSession({
      model: {} as any,
      tools: {
        get_metric: {
          execute: vi.fn().mockResolvedValue({ value: 1 }),
        },
      } as any,
      system: 'x',
      streamTextFn: streamTextFn as any,
    });

    // Trigger the underlying streamText call.
    const out: string[] = [];
    for await (const t of session.send('hello')) out.push(t);
    expect(out.join('')).toContain('Recommendation: Pit this lap for undercut');

    const [{ stopWhen }] = streamTextFn.mock.calls[0] ?? [];
    expect(stopWhen).toBeTypeOf('function');

    // stepCountIs(N) stops when steps.length === N.
    expect(stopWhen({ steps: new Array(7).fill({}) })).toBe(false);
    expect(stopWhen({ steps: new Array(8).fill({}) })).toBe(true);
  });

  it('abstains when verification fails after repair attempt', async () => {
    const streamTextFn = vi
      .fn()
      .mockResolvedValueOnce({
        fullStream: (async function* () {
          yield { type: 'text-delta', id: 't1', text: buildDraft(12) };
        })(),
      })
      .mockResolvedValueOnce({
        fullStream: (async function* () {
          yield { type: 'text-delta', id: 't2', text: buildDraft(12) };
        })(),
      });

    const session = createEngineerSession({
      model: {} as any,
      tools: {
        get_metric: {
          execute: vi.fn().mockResolvedValue({ value: 99 }),
        },
      } as any,
      system: 'x',
      streamTextFn: streamTextFn as any,
    });

    const out: string[] = [];
    for await (const t of session.send('hello')) out.push(t);
    const output = out.join('');
    expect(output).toContain('Unable to provide a verified strategy answer for this request.');
    expect(output).toContain('Verification blockers:');
    expect(output).toContain('- eq-mismatch');
    expect(streamTextFn).toHaveBeenCalledTimes(2);
  });
});
