import assert from 'node:assert/strict'
import { buildSplitRouteFromChunkQuotes, calculateNetOutput } from '../src/utils/splitRouteEngine.ts'

const amountIn = 1_000n
const feeBps = 50
const aerodrome = { protocol: 'aerodrome', label: 'Aerodrome', rawQuote: 1_850n }
const uniswap = { protocol: 'uniswap-v3', label: 'Uniswap V3', rawQuote: 1_830n }
const pancake = { protocol: 'pancakeswap-v3', label: 'PancakeSwap V3', rawQuote: 1_810n }

const chunkQuotes = [
  { chunkIndex: 0, amountIn: 250n, candidate: aerodrome, rawQuote: 520n },
  { chunkIndex: 0, amountIn: 250n, candidate: uniswap, rawQuote: 500n },
  { chunkIndex: 0, amountIn: 250n, candidate: pancake, rawQuote: 490n },
  { chunkIndex: 1, amountIn: 250n, candidate: aerodrome, rawQuote: 495n },
  { chunkIndex: 1, amountIn: 250n, candidate: uniswap, rawQuote: 505n },
  { chunkIndex: 1, amountIn: 250n, candidate: pancake, rawQuote: 485n },
  { chunkIndex: 2, amountIn: 250n, candidate: aerodrome, rawQuote: 470n },
  { chunkIndex: 2, amountIn: 250n, candidate: uniswap, rawQuote: 500n },
  { chunkIndex: 2, amountIn: 250n, candidate: pancake, rawQuote: 510n },
  { chunkIndex: 3, amountIn: 250n, candidate: aerodrome, rawQuote: 455n },
  { chunkIndex: 3, amountIn: 250n, candidate: uniswap, rawQuote: 495n },
  { chunkIndex: 3, amountIn: 250n, candidate: pancake, rawQuote: 515n }
]

const result = buildSplitRouteFromChunkQuotes([aerodrome, uniswap, pancake], chunkQuotes, amountIn, feeBps, {
  minImprovementBps: 1
})

assert.ok(result, 'split route should be selected when chunk quotes beat best single route')
assert.equal(result.rawOutput, 2_050n)
assert.equal(result.bestSingleRawOutput, 1_850n)
assert.equal(result.parts.length, 3)
assert.equal(result.parts.reduce((sum, part) => sum + part.amountIn, 0n), amountIn)
assert.equal(result.parts.reduce((sum, part) => sum + part.estimatedRawOut, 0n), result.rawOutput)

const { netOutput, feeAmount } = calculateNetOutput(2_050n, feeBps)
assert.equal(result.netOutput, netOutput)
assert.equal(result.feeAmount, feeAmount)

const noSplit = buildSplitRouteFromChunkQuotes([aerodrome, uniswap], [
  { chunkIndex: 0, amountIn: 500n, candidate: aerodrome, rawQuote: 900n },
  { chunkIndex: 0, amountIn: 500n, candidate: uniswap, rawQuote: 880n },
  { chunkIndex: 1, amountIn: 500n, candidate: aerodrome, rawQuote: 900n },
  { chunkIndex: 1, amountIn: 500n, candidate: uniswap, rawQuote: 880n }
], amountIn, feeBps)
assert.equal(noSplit, null, 'split route should be null when one DEX wins every chunk')

console.log('All split route engine tests passed.')
