import { ldPairIndex } from '../VariantRPC/getLDMatrix.ts'

import type { LDSnp } from '../VariantRPC/getLDMatrix.ts'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Offset in bp from a displayed region's **left screen edge**, which is its end
 * when the region is reversed. The same reflection `Base1DUtils.bpToPx` applies
 * (`r.reversed ? r.end - coord : coord - r.start`), so anything positioned with
 * this lands under the same ruler tick as a feature drawn by the normal block
 * machinery.
 */
export function bpOffsetInRegion(
  region: { start: number; end: number; reversed?: boolean },
  bp: number,
) {
  return region.reversed ? region.end - bp : bp - region.start
}

// Index of the region a SNP sits in, or -1. Regions are the worker-side
// (renamed) blocks, so refNames compare directly against the feature's.
function regionIndexOf(snp: LDSnp, regions: Region[]) {
  return regions.findIndex(
    r => r.refName === snp.refName && snp.start >= r.start && snp.start < r.end,
  )
}

// Reverse order[from..to] in place (inclusive).
function reverseRange(order: Uint32Array, from: number, to: number) {
  for (let a = from, b = to; a < b; a++, b--) {
    const t = order[a]!
    order[a] = order[b]!
    order[b] = t
  }
}

// Runs of consecutive SNPs sharing a region, as [start, end] inclusive index
// pairs. SNPs arrive grouped by region (the adapter is queried region by
// region) and ascending within each, so a region's SNPs are one contiguous run.
function regionRuns(snps: LDSnp[], regions: Region[]) {
  const runs: { region: number; from: number; to: number }[] = []
  for (let i = 0; i < snps.length; i++) {
    const region = regionIndexOf(snps[i]!, regions)
    const last = runs.at(-1)
    if (last?.region === region) {
      last.to = i
    } else {
      runs.push({ region, from: i, to: i })
    }
  }
  return runs
}

/**
 * Screen order of the SNP index axis. Every LD consumer — the two renderers'
 * `boundaries[]` walk, `hitTest`, the connector lines' matrix anchor, labels —
 * reads columns in `snps[]` array order, so a reversed displayed region (bp
 * running leftward under a ruler that also runs leftward) is expressed by
 * reversing that region's run of SNPs. That is the index-space form of hic's
 * `mirrorUInRegion` (`plugins/hic/src/regionOffsets.ts`) and shares its one
 * load-bearing property: the reflection maps each region **onto itself**, so
 * region layout is untouched and mixed orientations work. Mirroring the whole
 * triangle instead would re-reverse the regions, which `horizontallyFlip()`
 * has already reversed in `displayedRegions`.
 *
 * Returns undefined when nothing is reversed, so the common case copies
 * nothing.
 */
export function getDisplayOrder(snps: LDSnp[], regions: Region[]) {
  if (!regions.some(r => r.reversed)) {
    return undefined
  }
  const order = new Uint32Array(snps.length)
  for (let i = 0; i < snps.length; i++) {
    order[i] = i
  }
  for (const run of regionRuns(snps, regions)) {
    if (regions[run.region]?.reversed) {
      reverseRange(order, run.from, run.to)
    }
  }
  return order
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
