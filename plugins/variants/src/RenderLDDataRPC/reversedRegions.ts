import { LD_NOT_COMPUTED } from '@jbrowse/ld-core'

import {
  bandCellCount,
  bandPairIndex,
  bandRowFirstColumn,
} from '../VariantRPC/ldBand.ts'

import type { LDSnp } from '../VariantRPC/getLDMatrix.ts'
import type { Region } from '@jbrowse/core/util/types'

// Index of the region a SNP sits in, or -1. Regions are the worker-side
// (renamed) blocks, so refNames compare directly against the feature's.
function regionIndexOf(snp: LDSnp, regions: Region[]) {
  return regions.findIndex(
    r => r.refName === snp.refName && snp.start >= r.start && snp.start < r.end,
  )
}

/**
 * Screen order of the SNP index axis. Every LD consumer — the two renderers'
 * `boundaries[]` walk, `hitTest`, the connector lines' matrix anchor, labels —
 * reads columns in `snps[]` array order, so the axis is expressed by putting
 * that array in the order the view draws it: regions in the order `regions`
 * lists them, and inside a **reversed** region bp running the other way. That is
 * the index-space form of hic's `mirrorU`
 * (`plugins/hic/src/regionOffsets.ts`) and of the variant matrix's
 * `orderByScreenPosition`, and it shares their one load-bearing property: the
 * reflection maps each region **onto itself**, so region layout is untouched and
 * mixed orientations work. Mirroring the whole triangle instead would re-reverse
 * the regions, which `horizontallyFlip()` has already reversed in
 * `displayedRegions`.
 *
 * Derived from `regions` and each SNP's position, never from the order the fetch
 * arrived in. `getFeaturesInMultipleRegions` merges the per-region queries and
 * emits them as they land, so neither the order of the per-region groups nor
 * their contiguity is guaranteed — a collapsed minus-strand gene (regions listed
 * descending, every one reversed) hands its SNPs back ascending, i.e. in exactly
 * the opposite order to the one being drawn. That is the same mismatch that
 * crossed every connector line on the variant matrix.
 *
 * A SNP inside no region has no place on the axis and sorts after the placed
 * ones rather than leading them. Returns undefined when the fetch order is
 * already the screen order, so the common case copies nothing.
 */
export function getDisplayOrder(snps: LDSnp[], regions: Region[]) {
  const keyed = snps.map((snp, arrival) => {
    const region = regionIndexOf(snp, regions)
    return {
      arrival,
      // unplaceable sorts last
      rank: region === -1 ? regions.length : region,
      pos: regions[region]?.reversed ? -snp.start : snp.start,
    }
  })
  keyed.sort(
    (a, b) => a.rank - b.rank || a.pos - b.pos || a.arrival - b.arrival,
  )
  return keyed.every((k, i) => k.arrival === i)
    ? undefined
    : Uint32Array.from(keyed, k => k.arrival)
}

/**
 * Re-index the fetched matrix into screen order. `bandPairIndex` is symmetric,
 * so a pair whose order the reversal inverted just reads the transposed slot.
 *
 * A pair adjacent on screen need not have been adjacent in the source order —
 * a reversal preserves separation, but two blocks laid end to end do not — so a
 * screen-order pair can name a source pair the band never computed. Those cells
 * carry `LD_NOT_COMPUTED` and both renderers leave them unpainted, which is what
 * an out-of-band cell already looks like. They are not 0: the cell is inside the
 * drawn band, so 0 there is an opaque diamond at the bottom of the ramp saying
 * the two variants are in linkage equilibrium — a claim about a pair nothing
 * measured. Two blocks laid end to end at k = 5 fabricate exactly the k(k+1)/2
 * cells straddling the seam, which is 15 of the 185 drawn at n = 40.
 */
export function applyDisplayOrder(
  data: {
    snps: LDSnp[]
    ldValues: Float32Array
  },
  order: Uint32Array,
  band: number,
) {
  const n = order.length
  const snps = Array.from(order, i => data.snps[i]!)
  const ldValues = new Float32Array(bandCellCount(n, band))
  let idx = 0
  for (let i = 1; i < n; i++) {
    for (let j = bandRowFirstColumn(i, band); j < i; j++) {
      const src = bandPairIndex(order[i]!, order[j]!, band)
      ldValues[idx++] = src < 0 ? LD_NOT_COMPUTED : data.ldValues[src]!
    }
  }
  return { snps, ldValues }
}
