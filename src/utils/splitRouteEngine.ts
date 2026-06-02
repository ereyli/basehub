export type SplitQuoteCandidate<TProtocol extends string = string> = {
  protocol: TProtocol;
  label: string;
  rawQuote: bigint;
};

export type SplitRoutePart<TProtocol extends string = string> = {
  candidate: SplitQuoteCandidate<TProtocol>;
  amountIn: bigint;
  estimatedRawOut: bigint;
  shareBps: number;
};

export type SplitRouteResult<TProtocol extends string = string> = {
  parts: SplitRoutePart<TProtocol>[];
  rawOutput: bigint;
  netOutput: bigint;
  feeAmount: bigint;
  improvementBps: number;
  bestSingleRawOutput: bigint;
};

export type SplitChunkQuote<TProtocol extends string = string> = {
  chunkIndex: number;
  amountIn: bigint;
  candidate: SplitQuoteCandidate<TProtocol>;
  rawQuote: bigint;
};

export const SPLIT_ROUTE_MIN_IMPROVEMENT_BPS = 5;

export function quotePerInputUnit(rawQuote: bigint, amountIn: bigint): bigint {
  if (amountIn <= 0n) return 0n;
  return (rawQuote * 1_000_000_000_000_000_000n) / amountIn;
}

export function calculateNetOutput(rawOutput: bigint, feeBps: number): { netOutput: bigint; feeAmount: bigint } {
  const safeFeeBps = Math.max(0, Math.min(10_000, Math.floor(feeBps)));
  const feeAmount = (rawOutput * BigInt(safeFeeBps)) / 10_000n;
  return { netOutput: rawOutput - feeAmount, feeAmount };
}

export function buildSplitRoute<TProtocol extends string>(
  candidates: SplitQuoteCandidate<TProtocol>[],
  amountIn: bigint,
  feeBps: number,
  options: {
    chunks?: number;
    minImprovementBps?: number;
  } = {}
): SplitRouteResult<TProtocol> | null {
  const chunks = options.chunks ?? 10;
  const minImprovementBps = options.minImprovementBps ?? SPLIT_ROUTE_MIN_IMPROVEMENT_BPS;
  if (amountIn <= 0n || chunks < 2) return null;

  const usable = candidates.filter((candidate) => candidate.rawQuote > 0n);
  if (usable.length < 2) return null;

  const ranked = [...usable].sort((a, b) => (a.rawQuote > b.rawQuote ? -1 : a.rawQuote < b.rawQuote ? 1 : 0));
  const bestSingle = ranked[0];
  const bestSingleRawOutput = bestSingle.rawQuote;
  const unitRanked = ranked
    .map((candidate) => ({
      candidate,
      unitQuote: quotePerInputUnit(candidate.rawQuote, amountIn)
    }))
    .sort((a, b) => (a.unitQuote > b.unitQuote ? -1 : a.unitQuote < b.unitQuote ? 1 : 0));

  const chunkAmounts: bigint[] = [];
  const baseChunk = amountIn / BigInt(chunks);
  let allocated = 0n;
  for (let i = 0; i < chunks; i++) {
    const chunkAmount = i === chunks - 1 ? amountIn - allocated : baseChunk;
    chunkAmounts.push(chunkAmount);
    allocated += chunkAmount;
  }

  const allocations = new Map<SplitQuoteCandidate<TProtocol>, { amountIn: bigint; estimatedRawOut: bigint }>();
  for (let i = 0; i < chunkAmounts.length; i++) {
    const chunkAmount = chunkAmounts[i];
    const rankedIndex = Math.min(i, unitRanked.length - 1);
    const candidate = unitRanked[rankedIndex].candidate;
    const estimatedRawOut = (candidate.rawQuote * chunkAmount) / amountIn;
    const current = allocations.get(candidate) ?? { amountIn: 0n, estimatedRawOut: 0n };
    allocations.set(candidate, {
      amountIn: current.amountIn + chunkAmount,
      estimatedRawOut: current.estimatedRawOut + estimatedRawOut
    });
  }

  const parts = Array.from(allocations.entries())
    .map(([candidate, allocation]) => ({
      candidate,
      amountIn: allocation.amountIn,
      estimatedRawOut: allocation.estimatedRawOut,
      shareBps: Number((allocation.amountIn * 10_000n) / amountIn)
    }))
    .filter((part) => part.amountIn > 0n && part.estimatedRawOut > 0n)
    .sort((a, b) => (a.estimatedRawOut > b.estimatedRawOut ? -1 : a.estimatedRawOut < b.estimatedRawOut ? 1 : 0));

  if (parts.length < 2) return null;

  const rawOutput = parts.reduce((sum, part) => sum + part.estimatedRawOut, 0n);
  if (rawOutput <= bestSingleRawOutput) return null;

  const improvementBps = Number(((rawOutput - bestSingleRawOutput) * 10_000n) / bestSingleRawOutput);
  if (improvementBps < minImprovementBps) return null;

  const { netOutput, feeAmount } = calculateNetOutput(rawOutput, feeBps);
  return {
    parts,
    rawOutput,
    netOutput,
    feeAmount,
    improvementBps,
    bestSingleRawOutput
  };
}

export function buildSplitRouteFromChunkQuotes<TProtocol extends string>(
  fullAmountCandidates: SplitQuoteCandidate<TProtocol>[],
  chunkQuotes: SplitChunkQuote<TProtocol>[],
  amountIn: bigint,
  feeBps: number,
  options: {
    minImprovementBps?: number;
  } = {}
): SplitRouteResult<TProtocol> | null {
  const minImprovementBps = options.minImprovementBps ?? SPLIT_ROUTE_MIN_IMPROVEMENT_BPS;
  if (amountIn <= 0n || fullAmountCandidates.length === 0 || chunkQuotes.length === 0) return null;

  const bestSingle = [...fullAmountCandidates]
    .filter((candidate) => candidate.rawQuote > 0n)
    .sort((a, b) => (a.rawQuote > b.rawQuote ? -1 : a.rawQuote < b.rawQuote ? 1 : 0))[0];
  if (!bestSingle) return null;

  const byChunk = new Map<number, SplitChunkQuote<TProtocol>[]>();
  for (const quote of chunkQuotes) {
    if (quote.amountIn <= 0n || quote.rawQuote <= 0n) continue;
    const existing = byChunk.get(quote.chunkIndex) ?? [];
    existing.push(quote);
    byChunk.set(quote.chunkIndex, existing);
  }

  const allocations = new Map<string, { candidate: SplitQuoteCandidate<TProtocol>; amountIn: bigint; estimatedRawOut: bigint }>();
  let totalInput = 0n;

  for (const quotes of Array.from(byChunk.values())) {
    const best = quotes.sort((a, b) => (a.rawQuote > b.rawQuote ? -1 : a.rawQuote < b.rawQuote ? 1 : 0))[0];
    const key = `${best.candidate.protocol}:${best.candidate.label}`;
    const current = allocations.get(key) ?? { candidate: best.candidate, amountIn: 0n, estimatedRawOut: 0n };
    allocations.set(key, {
      candidate: best.candidate,
      amountIn: current.amountIn + best.amountIn,
      estimatedRawOut: current.estimatedRawOut + best.rawQuote
    });
    totalInput += best.amountIn;
  }

  if (totalInput !== amountIn) return null;

  const parts = Array.from(allocations.values())
    .map((allocation) => ({
      candidate: allocation.candidate,
      amountIn: allocation.amountIn,
      estimatedRawOut: allocation.estimatedRawOut,
      shareBps: Number((allocation.amountIn * 10_000n) / amountIn)
    }))
    .filter((part) => part.amountIn > 0n && part.estimatedRawOut > 0n)
    .sort((a, b) => (a.estimatedRawOut > b.estimatedRawOut ? -1 : a.estimatedRawOut < b.estimatedRawOut ? 1 : 0));

  if (parts.length < 2) return null;

  const rawOutput = parts.reduce((sum, part) => sum + part.estimatedRawOut, 0n);
  const bestSingleRawOutput = bestSingle.rawQuote;
  if (rawOutput <= bestSingleRawOutput) return null;

  const improvementBps = Number(((rawOutput - bestSingleRawOutput) * 10_000n) / bestSingleRawOutput);
  if (improvementBps < minImprovementBps) return null;

  const { netOutput, feeAmount } = calculateNetOutput(rawOutput, feeBps);
  return {
    parts,
    rawOutput,
    netOutput,
    feeAmount,
    improvementBps,
    bestSingleRawOutput
  };
}
