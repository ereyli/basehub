export const TOKEN_SUPPLY = 10_000_000_000
export const AIRDROP_POOL = 1_000_000_000
export const ASSUMED_ELIGIBLE_WALLETS = 2_000_000
export const ASSUMED_AVERAGE_SCORE = 50
export const MODEL_VERSION = '1.1'

export const SOURCES = {
  base: 'https://www.base.org/blog/the-state-of-base-at-basecamp-2025',
  arbitrum: 'https://docs.arbitrum.foundation/airdrop-eligibility-distribution',
  optimism: 'https://github.com/ethereum-optimism/community-hub/blob/main/pages/op-token/airdrops/airdrop-1.mdx',
  optimism5: 'https://app.optimism.io/airdrops/5',
  starknet: 'https://www.starknet.io/blog/starknet-provisions-program/',
  zksync: 'https://docs.zknation.io/zk-token/zk-airdrop',
  stocks: 'https://docs.base.org/sdks/tokenized-stocks/overview',
  spiko: 'https://support.spiko.io/hc/en-us/articles/45293663366673-Spiko-token-addresses',
  x402: 'https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md',
}

const capped = (value, threshold, points) => Math.min(value / threshold, 1) * points
const whole = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 2 })

export function buildScore(metrics) {
  const m = metrics
  const dimensions = [
    { name: 'Consistency', max: 30, points: capped(m.months, 9, 20) + capped(m.weeks, 20, 10), detail: 'Active months and seven-day periods with observed wallet actions.' },
    { name: 'Application diversity', max: 25, points: capped(m.knownApps, 8, 15) + capped(m.contracts, 25, 10), detail: 'Recognized applications plus distinct non-token contract destinations.' },
    { name: 'Economic activity', max: 20, points: capped(m.swaps, 12, 7) + capped(m.defiTypes, 2, 7) + capped(m.bridge, 1, 3) + capped(m.nftMints, 3, 3), detail: 'Recognized swaps, lending and liquidity, standard bridge receipts, and self-initiated NFT mints.' },
    { name: 'Base-native activity', max: 15, points: capped(m.x402, 3, 5) + capped(m.rwaActions, 3, 5) + capped(m.b20Assets, 3, 5), detail: 'Supported x402 settlements, active use of indexed RWAs, and distinct native B20 assets used.' },
    { name: 'Building and smart accounts', max: 10, points: capped(m.deployments, 2, 5) + capped(m.agentRegistrations, 1, 3) + capped(m.sponsored, 2, 2), detail: 'Observed deployments, supported ERC-8004 registrations and sponsored ERC-4337 actions.' },
  ].map((dimension) => ({ ...dimension, points: Math.round(dimension.points * 10) / 10 }))
  return { total: Math.round(dimensions.reduce((sum, dimension) => sum + dimension.points, 0)), dimensions }
}

const check = (label, observed, threshold, complete = true, unit = '', strict = false) => ({
  label, measured: observed == null ? 'Unavailable' : `${whole(observed)}${unit} / ${whole(threshold)}${unit}`,
  status: observed != null && (strict ? observed > threshold : observed >= threshold) ? 'met' : complete && observed != null ? 'missed' : 'unknown',
})
const unavailable = (label, measured, status = 'unknown') => ({ label, measured, status })
const verdict = (criteria) => criteria.some(({ status }) => status === 'missed')
  ? 'missed' : criteria.every(({ status }) => status === 'met') ? 'met' : 'unknown'

export function buildHistory(m, coverage) {
  // Thresholds using observed lower bounds can prove a pass. Incomplete scans
  // never turn missing evidence into a failed check.
  const complete = coverage.activityComplete
  const bridge = check('Standard bridge into Base', m.bridge, 1, false)
  const volume = (threshold, strict = false) => check(
    `Swap notional ${strict ? 'above' : 'of at least'} ${whole(threshold)} USDC`, m.usdcVolume, threshold, false, ' USDC', strict)
  const arb = [
    bridge,
    ...[2, 6, 9].map((n) => check(`Activity in at least ${n} distinct months`, m.months, n, complete)),
    ...[4, 10, 25, 100].map((n) => check(`More than ${n} transactions or different contracts`, Math.max(m.transactions, m.contracts), n + 1, complete)),
    ...[10_000, 50_000, 250_000].map((threshold) => volume(threshold, true)),
    unavailable('Bridge value thresholds', 'Historical USD bridge value unavailable'),
    unavailable('Arbitrum Nova and Nitro weighting', 'Arbitrum-specific rules', 'na'),
  ]
  const spanKnown = m.activitySpanHours > 48
  const arbPoints = arb.filter(({ status }) => status === 'met').length
  const arbLowBalanceRisk = m.ethBalance == null || (m.ethBalance < 0.005 && m.contracts <= 1)
  const arbMinimum = arbPoints - (spanKnown ? 0 : 1) - (arbLowBalanceRisk ? 1 : 0)

  const repeat = [
    check('At least 24 hours between first and last wallet action', m.activitySpanHours, 24, complete),
    check('At least one recognized application action', m.appWeeks, 1, false),
    check('Recognized application activity in at least four distinct weeks', m.appWeeks, 4, false),
  ]
  const stark = [
    check('More than five transactions', m.transactions, 6, complete),
    check('At least three active months', m.months, 3, complete),
    volume(100),
    check('ETH balance at the selected block', m.ethBalance, 0.005),
  ]
  const power = [
    check('At least 20 distinct contracts', m.recentContracts, 20, complete),
    check('Contracts / transactions ratio (180-day Base window)', complete ? m.recentContractRatio : null, 10, complete, '%'),
  ]
  const zkActions = [
    check('At least 10 non-token contracts active for 30 days', m.matureContracts, 10, false),
    check('At least five observed paymaster operations', m.sponsored, 5, false),
    check('At least 10 different ERC-20s traded on tracked DEXs', m.swappedAssets, 10, false),
    check('Provided liquidity or supplied assets to tracked lending protocols', m.deFiSupplies, 1, false),
    unavailable('Libertas Omnibus holder', 'ZKsync-specific NFT', 'na'),
    unavailable('ZKsync Lite usage and Gitcoin donation', 'ZKsync-specific activities', 'na'),
  ]
  return [
    { id: 'arb', name: 'Arbitrum', snapshot: '2023-02-06', source: SOURCES.arbitrum, status: arbMinimum >= 3 ? 'met' : 'unknown', criteria: arb, summary: `${arbPoints} observed positive points. Base simulation applies possible observable deductions conservatively. Nova, Nitro and historical exclusion lists are outside this result.` },
    { id: 'op1', name: 'Optimism #1', snapshot: '2022-03-25', source: SOURCES.optimism, status: verdict(repeat), criteria: [...repeat, unavailable('Early OP bridge cohort and Ethereum contribution routes', 'Original cross-chain cohorts', 'na')], summary: 'Repeat-user route adapted to Base. Weeks are relative to the first observed action.' },
    { id: 'op5', name: 'Optimism #5', snapshot: '2024-09-15', source: SOURCES.optimism5, status: verdict(power), criteria: [...power, check('Frequent user bonus: 10 app actions in 20 weeks', m.recentBusyWeeks, 20, false), unavailable('Superchain explorer and program-specific bonuses', 'Original cross-chain or campaign data', 'na')], summary: 'Power-user rule applied to Base over the 180 days ending at your selected block.' },
    { id: 'stark', name: 'Starknet Provisions', snapshot: '2023-11-15', source: SOURCES.starknet, status: verdict(stark), criteria: stark, summary: 'All four conditions must pass. USDC swap notional is a limited volume proxy. Contributions and jurisdictional rules are outside this simulation.' },
    { id: 'zk', name: 'ZKsync Era', snapshot: '2024-03-24', source: SOURCES.zksync, status: bridge.status === 'met' && zkActions.some(({ status }) => status === 'met') ? 'met' : 'unknown', criteria: [bridge, ...zkActions, unavailable('Time-weighted balance and minimum allocation', 'Historical DeFi balances not measured')], summary: 'Usage gate only. A matched gate leaves the original allocation, minimum award and filters unresolved.' },
  ]
}

export function estimateAllocation(score, eligibleWallets, mode, averageScore) {
  if (!Number.isInteger(eligibleWallets) || eligibleWallets < 1 || eligibleWallets > 100_000_000) return null
  if (mode === 'equal') return AIRDROP_POOL / eligibleWallets
  if (!Number.isFinite(score) || score < 0 || score > 100 || !Number.isFinite(averageScore) || averageScore <= 0 || averageScore > 100) return null
  const populationPoints = averageScore * eligibleWallets
  if (populationPoints < score || populationPoints - score > (eligibleWallets - 1) * 100) return null
  return AIRDROP_POOL * (score / populationPoints)
}
