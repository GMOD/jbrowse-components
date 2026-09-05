import type { BufferedVisibleRegion } from './regionHost.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

/**
 * When the coarse tier stands in for the detail: `auto` swaps on the verdict
 * and the threshold, the other two are the user's override either way.
 */
export type CoarseTierMode = 'auto' | 'never' | 'always'

/**
 * Whether the coarse tier stands in for the detail right now. `auto` swaps
 * where the gate refuses the detail fetch — cost, not span — and past the
 * display's own threshold where it asks for the tier earlier. Without a source
 * there is nothing to draw, so the banner stands whatever the mode.
 */
export function resolveCoarseTier({
  mode,
  hasSource,
  gateRefusesDetail,
  pastThreshold,
}: {
  mode: CoarseTierMode
  hasSource: boolean
  gateRefusesDetail: boolean
  pastThreshold: boolean
}) {
  return (
    hasSource &&
    (mode === 'always' ||
      (mode === 'auto' && (gateRefusesDetail || pastThreshold)))
  )
}

/**
 * Whether the detail fetch stands down while the coarse tier stands in.
 * `standsIn` is the display's own term — the tier's verdict, or on alignments
 * the verdict plus somewhere to draw it. A detail fetch the gate refused in
 * `auto` keeps running, because that fetch stops at the gate and re-measures,
 * and the measurement is how the gate releases; a forced tier has nothing to
 * release, and a gate measuring the coarse read has nothing to learn from the
 * detail fetch, so both fetch nothing whatever the gate says.
 */
export function resolveFetchSuspended({
  standsIn,
  mode,
  gateRefusesDetail,
}: {
  standsIn: boolean
  mode: CoarseTierMode
  gateRefusesDetail: boolean
}) {
  return standsIn && (mode === 'always' || !gateRefusesDetail)
}

/**
 * What one coarse read was issued over, and so what the held payloads answer
 * for: the buffered regions and the key the display's read depends on (the
 * adapter, plus a zoom bucket or a settings key). Its own span, beside the
 * detail store's `loadedRegions`: the two tiers fetch different widths of the
 * same `displayedRegionIndex`, and one entry stamped by both narrowed the
 * coarse span to the detail's on every zoom in.
 */
export interface CoarseTierRead {
  regions: BufferedVisibleRegion[]
  key: string
}

export interface CoarseTierEntry<P> {
  displayedRegionIndex: number
  payload: P
}

/** What a coarse read answers: one payload per region it covered, or a refusal. */
export type CoarseTierResult<P> =
  | { entries: CoarseTierEntry<P>[]; bytes?: number }
  | RegionTooLargeResult

/**
 * Whether payloads read over `held` still answer for what is on screen, so a
 * pan or a zoom inside the buffered read re-uses them rather than re-reading.
 * The same question the detail fetch asks with `isBlockCovered`: every visible
 * block sits inside the held span of its own displayed region.
 */
export function coarseTierCovers(
  held: readonly BufferedVisibleRegion[],
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
