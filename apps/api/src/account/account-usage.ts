import { executionResultReportSchema } from "@le-fabrique/contracts";
import type { Prisma } from "@prisma/client";
/** Bound aggregation reports observed time/tokens, never subscription balances or inferred API cost. */
export async function accountUsage(
  tx: Prisma.TransactionClient,
  organizationId: string,
  visibleIds?: string[],
) {
  const attempts = await tx.attempt.findMany({
    where: {
      run: {
        ticket: { project: { organizationId, ...(visibleIds ? { id: { in: visibleIds } } : {}) } },
      },
    },
    select: { result: true, startedAt: true, completedAt: true, stoppedConfirmed: true },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: 10001,
  });
  let input = 0,
    output = 0,
    known = 0,
    incomplete = attempts.length > 10000,
    seconds = 0,
    completed = 0,
    timeIncomplete = attempts.length > 10000;
  const providers = new Map<
    string,
    {
      provider: string;
      inputTokens: number;
      outputTokens: number;
      observations: number;
      known: number;
      incomplete: boolean;
    }
  >();
  for (const attempt of attempts.slice(0, 10000)) {
    if (attempt.completedAt && attempt.stoppedConfirmed) {
      seconds += Math.max(0, attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000;
      completed++;
    } else timeIncomplete = true;
    const parsed = executionResultReportSchema.safeParse(attempt.result);
    if (!parsed.success) {
      incomplete = true;
      continue;
    }
    if (!parsed.data.runtimeObservations.length) incomplete = true;
    for (const o of parsed.data.runtimeObservations) {
      let p = providers.get(o.provider);
      if (!p) {
        p = {
          provider: o.provider,
          inputTokens: 0,
          outputTokens: 0,
          observations: 0,
          known: 0,
          incomplete: false,
        };
        providers.set(o.provider, p);
      }
      p.observations++;
      if (!o.usage) {
        p.incomplete = true;
        incomplete = true;
        continue;
      }
      known++;
      p.known++;
      input += o.usage.inputTokens;
      output += o.usage.outputTokens;
      p.inputTokens += o.usage.inputTokens;
      p.outputTokens += o.usage.outputTokens;
    }
  }
  const observedAt = new Date().toISOString();
  return {
    executionSeconds: !attempts.length ? 0 : completed ? Math.floor(seconds) : null,
    executionTimeIncomplete: timeIncomplete,
    executionTimeObservedAt: observedAt,
    aiUsage: known
      ? {
          inputTokens: input,
          outputTokens: output,
          observedAt,
          source: "persisted-attempt-results" as const,
          incomplete,
          byProvider: [...providers.values()].map(({ known: count, ...p }) => ({
            ...p,
            inputTokens: count ? p.inputTokens : null,
            outputTokens: count ? p.outputTokens : null,
          })),
        }
      : null,
  };
}
