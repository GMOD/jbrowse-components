import type { CoarseTierMode } from './coarseTier.ts'

export const DENSITY_TIER_MODES = ['auto', 'features', 'density'] as const

export type DensityTierMode = (typeof DENSITY_TIER_MODES)[number]

export function isDensityTierMode(value: unknown): value is DensityTierMode {
  const modes: readonly unknown[] = DENSITY_TIER_MODES
  return modes.includes(value)
}

/** The `densityTier` slot's vocabulary as the coarse tier's policy. */
export function coarseTierModeOf(mode: DensityTierMode): CoarseTierMode {
  return mode === 'features' ? 'never' : mode === 'density' ? 'always' : 'auto'
}

/**
 * The zoom step a set of bins is cached under: one per doubling of bp/px, so a
 * pan or a small zoom reuses the bins and a real zoom re-reads at the level the
 * sidecar keeps for it.
 */
export function densityZoomBucket(bpPerPx: number) {
  return Math.round(Math.log2(Math.max(1, bpPerPx)))
}
