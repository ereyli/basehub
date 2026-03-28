// Shared XP tiers & weights for NFT Wheel + NFT Plinko (same client-side RNG pool).
// Weights sum to 100. High tiers (28K+) are deliberately rarer than earlier configs.
export const NFT_LUCK_SEGMENTS = [
  { id: 0, xp: 3500, label: '3.5K', color: '#3b82f6', weight: 44 },
  { id: 1, xp: 7000, label: '7K', color: '#10b981', weight: 32 },
  { id: 2, xp: 14000, label: '14K', color: '#8b5cf6', weight: 15 },
  { id: 3, xp: 28000, label: '28K', color: '#ec4899', weight: 4 },
  { id: 4, xp: 56000, label: '56K', color: '#06b6d4', weight: 2 },
  { id: 5, xp: 112000, label: '112K', color: '#ef4444', weight: 1 },
  { id: 6, xp: 224000, label: '224K', color: '#fbbf24', weight: 2, isJackpot: true },
]
