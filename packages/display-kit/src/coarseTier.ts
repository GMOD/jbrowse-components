import { isBlockCovered } from './planRegionFetch.ts'

import type { BufferedVisibleRegion } from './regionHost.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'

/**
 * Whether a coarse source slot holds something a sub-adapter can be built
 * from. The `{ uri }` shorthand every location slot accepts has no `type`, and
 * a read over it would answer nothing while the tier waited on it.
 */
export function isSubAdapterConfig(
  value: unknown,
): value is Record<string, unknown> & { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  )
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
  /** `CoarseTierMixin.coarseTierIssueKey` at issue, compared with `isDataCurrent` */
  key: unknown
}

export interface CoarseTierEntry<P> {
  displayedRegionIndex: number
  payload: P
}

/**
 * What a coarse read answers: one payload per region it covered, or a refusal.
 * A gated read reports `bytes` with `partial` beside it, the same pair every
 * fetch runner commits — see `measurementPartial`.
 */
export type CoarseTierResult<P> =
  | { entries: CoarseTierEntry<P>[]; bytes?: number; partial?: boolean }
  | RegionTooLargeResult

/**
 * Whether payloads read over `held` still answer for what is on screen, so a
 * pan or a zoom inside the buffered read re-uses them rather than re-reading.
 *
 * Literally the detail fetch's question, asked over the tier's own spans:
 * every visible block sits inside the held span of its own displayed region.
 * `isBlockCovered` is that comparison — including the `floor`/`ceil` that
 * handles a fractional `bpPerPx` — and this used to restate it inline, which
 * is one rounding rule kept in two places for two tiers of the same fetch.
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
        isBlockCovered(h.region, block),
    ),
  )
}
