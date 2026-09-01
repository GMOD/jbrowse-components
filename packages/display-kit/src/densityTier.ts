export const DENSITY_TIER_MODES = ['auto', 'features', 'density'] as const

export type DensityTierMode = (typeof DENSITY_TIER_MODES)[number]

export function isDensityTierMode(value: unknown): value is DensityTierMode {
  const modes: readonly unknown[] = DENSITY_TIER_MODES
  return modes.includes(value)
}

/**
 * Whether the density band stands in for features right now. `auto` swaps on
 * the gate's verdict — cost, not span — and on an explicit bp/px threshold when
 * a track asks for the band earlier; the other two modes are the user's
 * override either way. Without a source there is nothing to draw, so the banner
 * stands whatever the mode.
 */
export function resolveDensityTier({
  mode,
  hasSource,
  regionTooLarge,
  bpPerPx,
  thresholdBpPerPx,
}: {
  mode: DensityTierMode
  hasSource: boolean
  regionTooLarge: boolean
  bpPerPx: number | undefined
  thresholdBpPerPx: number
}) {
  const pastThreshold =
    thresholdBpPerPx > 0 && bpPerPx !== undefined && bpPerPx >= thresholdBpPerPx
  return (
    hasSource &&
    (mode === 'density' ||
      (mode === 'auto' && (regionTooLarge || pastThreshold)))
  )
}

/**
 * The zoom step a set of bins is cached under: one per doubling of bp/px, so a
 * pan or a small zoom reuses the bins and a real zoom re-reads at the level the
 * sidecar keeps for it.
 */
export function densityZoomBucket(bpPerPx: number) {
  return Math.round(Math.log2(Math.max(1, bpPerPx)))
}

/**
 * Whether the feature fetch stands down while the band stands in. `standsIn`
 * is the display's own term — the tier's verdict, or on alignments the verdict
 * plus somewhere to draw it. A refused viewport in `auto` keeps its fetch,
 * which stops at the gate and re-measures, because that measurement is how the
 * gate releases; a forced `density` has nothing to release, so it fetches
 * nothing whatever the gate says.
 */
export function resolveFetchSuspended({
  standsIn,
  mode,
  regionTooLarge,
}: {
  standsIn: boolean
  mode: DensityTierMode
  regionTooLarge: boolean
}) {
  return standsIn && (mode === 'density' || !regionTooLarge)
}

interface HeldSpan {
  region: { refName: string; start: number; end: number }
  displayedRegionIndex: number
}

/**
 * Whether bins read over `held` still answer for what is on screen, so a pan
 * or a zoom inside the buffered read re-uses them rather than re-reading. The
 * same question the feature fetch asks with `isBlockCovered`: every visible
 * block sits inside the held span of its own displayed region.
 */
export function densityBinsCover(
  held: readonly HeldSpan[],
  visible: readonly {
    refName: string
    start: number
    end: number
    displayedRegionIndex: number
  }[],
) {
  return visible.every(block =>
    held.some(
      h =>
        h.displayedRegionIndex === block.displayedRegionIndex &&
        h.region.refName === block.refName &&
        h.region.start <= Math.floor(block.start) &&
        h.region.end >= Math.ceil(block.end),
    ),
  )
}
