import { getNiceDomain } from './scale.ts'

/**
 * One visible block's worth of one stats-bearing thing, carrying the block span
 * it is clipped to: a wiggle source's feature arrays, a coverage region, a
 * region's worker-shipped extremes.
 */
export interface VisibleEntry<T> {
  visStart: number
  visEnd: number
  data: T
}

/**
 * The half of the containing view this reads.
 *
 * `settledDynamicBlocks` — the 500ms-debounced coarse blocks once the view has
 * settled once, the live ones before that — so a per-bp or per-feature scan
 * doesn't recompute on every animation frame during pan/zoom. Not
 * `coarseDynamicBlocks`: over the empty initial coarse list every walker below
 * yields no entries, and no entries is not a stale domain but the caller's
 * `[0, 1]` fallback — a bigwig line track drew blank and a density track solid.
 * ARCHITECTURE.md, "Every fetch autorun runs on the leading edge".
 */
export interface SettledBlocksView {
  initialized: boolean
  settledDynamicBlocks: {
    start: number
    end: number
    displayedRegionIndex?: number
  }[]
}

/**
 * How one display gets from its per-region fetch results to a score domain. The
 * walk, the readiness guard and the bounded nice-rounding are the same for all
 * of them; what differs is where a region's payload lives, which pieces of it
 * are in scope, how those pieces reduce to stats, and what an autoscale mode
 * makes of the stats.
 */
export interface VisibleStatsDomainSpec<Payload, Item, Stats> {
  /** false when the band this domain scales is not drawn: nothing is walked */
  active: boolean
  view: SettledBlocksView
  payloadFor: (displayedRegionIndex: number) => Payload | undefined
  /** the payload's stats-bearing pieces, already filtered to what is shown */
  itemsFor: (payload: Payload) => Item[]
  accumulate: (entries: VisibleEntry<Item>[]) => Stats | undefined
  /** stats to a raw `[min, max]`, before bounds and nice-rounding */
  range: (stats: Stats, entries: VisibleEntry<Item>[]) => [number, number]
  /** `ScoreScaleMixin`'s resolved bounds; `undefined` autoscales that end */
  bounds: readonly [number | undefined, number | undefined]
  scaleType: string
}

/**
 * #api
 * The visible score domain four displays derive identically: walk the settled
 * blocks, accumulate the stats of what each one shows, and nice-round the
 * autoscaled range inside the configured bounds. `undefined` while there is
 * nothing to scale against — no data, a hidden band, or a view that has not
 * initialized — which every caller distinguishes from a domain.
 */
export function visibleStatsDomain<Payload, Item, Stats>({
  active,
  view,
  payloadFor,
  itemsFor,
  accumulate,
  range,
  bounds,
  scaleType,
}: VisibleStatsDomainSpec<Payload, Item, Stats>) {
  let domain: [number, number] | undefined
  if (active && view.initialized) {
    const entries = view.settledDynamicBlocks.flatMap(block => {
      const payload =
        block.displayedRegionIndex === undefined
          ? undefined
          : payloadFor(block.displayedRegionIndex)
      const visStart = Math.floor(block.start)
      const visEnd = Math.ceil(block.end)
      return payload
        ? itemsFor(payload).map(data => ({ visStart, visEnd, data }))
        : []
    })
    const stats = accumulate(entries)
    if (stats) {
      domain = getNiceDomain({
        domain: range(stats, entries),
        bounds,
        scaleType,
      })
    }
  }
  return domain
}
