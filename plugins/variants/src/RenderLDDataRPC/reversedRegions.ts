import { ldPairIndex } from '../VariantRPC/getLDMatrix.ts'

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
 * the index-space form of hic's `mirrorUInRegion`
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
 * Re-index the fetched matrix into screen order. `ldPairIndex` is symmetric, so
 * a pair whose order the reversal inverted just reads the transposed slot.
 */
export function applyDisplayOrder(
  data: {
    snps: LDSnp[]
    ldValues: Float32Array
    recombination: { values: Float32Array; positions: number[] }
  },
  order: Uint32Array,
) {
  const n = order.length
  const snps = Array.from(order, i => data.snps[i]!)
  const ldValues = new Float32Array(data.ldValues.length)
  for (let i = 1; i < n; i++) {
    const rowBase = (i * (i - 1)) / 2
    for (let j = 0; j < i; j++) {
      ldValues[rowBase + j] = data.ldValues[ldPairIndex(order[i]!, order[j]!)]!
    }
  }

  // Recombination is 1-r² between axis-adjacent SNPs. Within a reversed region
  // the pairs are the same ones in the opposite order; the one pair that
  // straddles a region boundary now joins two SNPs that aren't neighbors in the
  // genome, so it is marked unmeasured (NaN) and the plot bridges it, rather
  // than reporting LD between an arbitrary pair.
  const values = new Float32Array(Math.max(0, n - 1))
  const positions: number[] = []
  for (let k = 0; k < n - 1; k++) {
    const a = order[k]!
    const b = order[k + 1]!
    values[k] =
      Math.abs(a - b) === 1
        ? data.recombination.values[Math.min(a, b)]!
        : Number.NaN
    positions.push((snps[k]!.start + snps[k + 1]!.start) / 2)
  }
  return { snps, ldValues, recombination: { values, positions } }
}
