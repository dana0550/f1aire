import { stepCountIs, streamText, type ToolSet } from 'ai';
import type { LanguageModel } from 'ai';
import { formatUnknownError } from './error-utils.js';
import { parseStrategyAnswerV1 } from './trust/schemas.js';
import { renderAbstention, renderVerifiedAnswer } from './trust/renderer.js';
import { verifyStrategyAnswer } from './trust/verifier.js';

type Message = { role: 'user' | 'assistant'; content: string };

type CreateEngineerSessionArgs = {
  model: LanguageModel;
  tools: ToolSet;
  system: string;
  streamTextFn?: typeof streamText;
  logger?: (event: Record<string, unknown>) => void | Promise<void>;
  onEvent?: (event: { type: string; [key: string]: unknown }) => void;
};

const TRUST_SYSTEM_APPEND = `
You are operating in hard trust mode.
Return ONLY one JSON object with this schema:
{
  "schemaVersion": "1",
  "recommendation": "string",
  "whyNow": "string",
  "alternatives": ["string"],
  "riskInvalidators": ["string"],
  "nextObservationWindow": "string",
  "asOf": "string|null",
  "claims": [
    {
      "claimId": "C-...",
      "statement": "string",
      "claimType": "fact|comparison|forecast|recommendation",
      "claimRole": "recommendation|rationale|alternative|invalidator|observation-window|evidence",
      "checks": [
        {
          "checkId": "K-...",
          "toolName": "string",
          "args": {},
          "targetPath": "dot.path",
          "op": "eq|approx|lt|lte|gt|gte|contains|count|rank",
          "expected": "any",
          "tolerance": 0
        }
      ]
    }
  ]
}
Rules:
- Do not output markdown or prose outside JSON.
- Every claim MUST have at least one deterministic check.
- Never use run_py as a final verification check tool.
- Include at least one claimRole=recommendation, one claimRole=invalidator, and one claimRole=observation-window.
`;

function buildTrustSystem(system: string): string {
  return `${system.trim()}\n\n${TRUST_SYSTEM_APPEND.trim()}`;
}

function buildRepairPrompt(input: string, reason: string): string {
  return [
    'Your previous strategy draft was rejected.',
    `Reason: ${reason}`,
    'Produce a corrected JSON strategy draft only.',
    'Keep checks deterministic and valid under the provided schema.',
    `Original question: ${input}`,
  ].join('\n');
}

export function createEngineerSession({
  model,
  tools,
  system,
  streamTextFn = streamText,
  logger,
  onEvent,
}: CreateEngineerSessionArgs) {
  const messages: Message[] = [];
  const trustedSystem = buildTrustSystem(system);

  const getToolName = (part: unknown): string | undefined => {
    const value =
      (part as any)?.toolName ??
      (part as any)?.tool?.name ??
      (part as any)?.toolCall?.name ??
      (part as any)?.name;
    return typeof value === 'string' ? value : undefined;
  };

  const getToolCallId = (part: unknown): string | undefined => {
    const value =
      (part as any)?.toolCallId ??
      (part as any)?.toolCall?.id ??
      (part as any)?.id;
    return typeof value === 'string' ? value : undefined;
  };

  const runDraftStream = async (
    callMessages: Message[],
  ): Promise<{
    buffer: string;
    hadText: boolean;
    sawToolCall: boolean;
    errorMessage: string | null;
  }> => {
    let errorMessage: string | null = null;
    let sawToolCall = false;
    const result = await streamTextFn({
      model,
      system: trustedSystem,
      messages: callMessages,
      tools,
      // Allow enough steps for tool retries while maintaining a hard bound.
      stopWhen: stepCountIs(8),
      onError({ error }) {
        errorMessage = formatUnknownError(error);
        logger?.({
          type: 'stream-error',
          error: errorMessage,
        });
        onEvent?.({ type: 'stream-error', error: errorMessage });
      },
    });

    let buffer = '';
    let hadText = false;
    for await (const part of result.fullStream) {
      onEvent?.({ type: 'stream-part', part });
      if (part.type !== 'text-delta') {
        const logEvent: Record<string, unknown> = {
          type: 'stream-part',
          partType: part.type,
        };
        const toolName = getToolName(part);
        const toolCallId = getToolCallId(part);
        if (toolName) logEvent.toolName = toolName;
        if (toolCallId) logEvent.toolCallId = toolCallId;
        if (part.type === 'tool-error' || part.type === 'error') {
          logEvent.error = formatUnknownError((part as any).error);
        }
        logger?.(logEvent);
      }
      if (
        part.type === 'tool-call' ||
        part.type === 'tool-result' ||
        part.type === 'tool-input-start'
      ) {
        sawToolCall = true;
      }
      if (part.type === 'text-delta') {
        hadText = true;
        buffer += part.text;
      }
      if (part.type === 'error') {
        errorMessage = formatUnknownError(part.error);
        onEvent?.({ type: 'stream-error', error: errorMessage });
      }
      if (part.type === 'tool-error') {
        errorMessage = formatUnknownError(part.error);
        onEvent?.({ type: 'tool-error', error: errorMessage });
      }
    }

    if (!hadText && !errorMessage) {
      try {
        const fallbackText = await result.text;
        if (fallbackText) {
          buffer = fallbackText;
          hadText = true;
        }
      } catch {
        // Keep existing fallback behavior below.
      }
    }

    return { buffer, hadText, sawToolCall, errorMessage };
  };

  return {
    async *send(input: string) {
      logger?.({ type: 'send-start', inputLength: input.length });
      onEvent?.({ type: 'send-start', inputLength: input.length });
      messages.push({ role: 'user', content: input });
      onEvent?.({ type: 'strategy-plan-start', schemaVersion: '1' });
      logger?.({ type: 'strategy-plan-start', schemaVersion: '1' });

      let sawToolCall = false;
      let finalText = '';
      let mode: 'verified' | 'abstained' = 'abstained';
      let abstainReasons: string[] = [];
      let repairHint: string | null = null;
      let lastError: string | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        onEvent?.({ type: 'strategy-draft-start', attempt: attempt + 1 });
        logger?.({ type: 'strategy-draft-start', attempt: attempt + 1 });

        const callMessages: Message[] = repairHint
          ? messages.concat({ role: 'user', content: repairHint })
          : messages;
        const generation = await runDraftStream(callMessages);
        sawToolCall ||= generation.sawToolCall;
        if (!generation.hadText && generation.errorMessage) {
          lastError = generation.errorMessage;
          continue;
        }
        if (!generation.buffer.trim()) {
          lastError = 'empty-draft-response';
          continue;
        }

        const parsed = parseStrategyAnswerV1(generation.buffer);
        if (!parsed.ok) {
          lastError = parsed.error;
          logger?.({
            type: 'strategy-draft-invalid',
            attempt: attempt + 1,
            reason: parsed.error,
          });
          if (attempt < 1) {
            repairHint = buildRepairPrompt(input, parsed.error);
            onEvent?.({
              type: 'strategy-repair-attempt',
              attempt: attempt + 1,
              reason: parsed.error,
            });
            logger?.({
              type: 'strategy-repair-attempt',
              attempt: attempt + 1,
              reason: parsed.error,
            });
            continue;
          }
          break;
        }

        onEvent?.({
          type: 'strategy-check-start',
          attempt: attempt + 1,
          claimCount: parsed.value.claims.length,
        });
        logger?.({
          type: 'strategy-check-start',
          attempt: attempt + 1,
          claimCount: parsed.value.claims.length,
        });
        const report = await verifyStrategyAnswer(parsed.value, tools);
        for (const claimResult of report.claimResults) {
          for (const checkResult of claimResult.checkResults) {
            const event = {
              type: 'strategy-check-result',
              schemaVersion: '1',
              attempt: attempt + 1,
              claimId: claimResult.claimId,
              checkId: checkResult.checkId,
              ok: checkResult.ok,
              error: checkResult.error,
              toolName: checkResult.toolName,
              targetPath: checkResult.targetPath,
            };
            onEvent?.(event);
            logger?.(event);
          }
        }
        onEvent?.({
          type: 'strategy-check-finish',
          schemaVersion: '1',
          attempt: attempt + 1,
          ok: report.ok,
          failedCheckCount: report.failedCheckCount,
        });
        logger?.({
          type: 'strategy-check-finish',
          schemaVersion: '1',
          attempt: attempt + 1,
          ok: report.ok,
          failedCheckCount: report.failedCheckCount,
          reasonCodes: report.reasonCodes,
        });

        if (report.ok) {
          const rendered = renderVerifiedAnswer(parsed.value, report);
          if (rendered.ok) {
            finalText = rendered.text;
            mode = 'verified';
            break;
          }
          lastError = rendered.reasonCodes.join(',') || 'rendering-failed';
          if (attempt < 1) {
            repairHint = buildRepairPrompt(input, `rendering-failed:${lastError}`);
            onEvent?.({
              type: 'strategy-repair-attempt',
              attempt: attempt + 1,
              reason: `rendering-failed:${lastError}`,
            });
            logger?.({
              type: 'strategy-repair-attempt',
              attempt: attempt + 1,
              reason: `rendering-failed:${lastError}`,
            });
            continue;
          }
          finalText = renderAbstention(rendered.reasonCodes);
          abstainReasons = rendered.reasonCodes;
          break;
        }

        lastError = report.reasonCodes.join(',') || 'verification-failed';
        if (attempt < 1) {
          repairHint = buildRepairPrompt(input, `verification-failed:${lastError}`);
          onEvent?.({
            type: 'strategy-repair-attempt',
            attempt: attempt + 1,
            reason: `verification-failed:${lastError}`,
          });
          logger?.({
            type: 'strategy-repair-attempt',
            attempt: attempt + 1,
            reason: `verification-failed:${lastError}`,
          });
          continue;
        }

        finalText = renderAbstention(report.reasonCodes);
        abstainReasons = report.reasonCodes;
        break;
      }

      if (!finalText) {
        abstainReasons = lastError ? [lastError] : [];
        finalText = renderAbstention(abstainReasons);
      }

      if (mode === 'abstained') {
        onEvent?.({
          type: 'strategy-abstain',
          schemaVersion: '1',
          reasonCodes: abstainReasons,
        });
        logger?.({
          type: 'strategy-abstain',
          schemaVersion: '1',
          reasonCodes: abstainReasons,
        });
      }

      onEvent?.({ type: 'strategy-plan-finish', schemaVersion: '1', mode });
      logger?.({ type: 'strategy-plan-finish', schemaVersion: '1', mode });
      yield finalText;

      logger?.({
        type: 'send-finish',
        outputLength: finalText.length,
        hadText: false,
        sawToolCall,
        mode,
      });
      onEvent?.({
        type: 'send-finish',
        outputLength: finalText.length,
        hadText: false,
        mode,
      });
      messages.push({ role: 'assistant', content: finalText });
    },
  };
}
