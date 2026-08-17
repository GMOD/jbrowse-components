import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/cigar-utils'

import { isChainData } from '../RenderAlignmentDataRPC/types.ts'
import { chainSuppFill } from '../shared/buildChainMetadata.ts'
import {
  CHAIN_FILL_SPLIT_DELETION,
  CHAIN_FILL_SPLIT_INVERSION,
} from '../shared/types.ts'
import { getOrCreate } from '../shared/util.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

/**
 * Re-answer each chain's supplementary marker (`readChainHasSupp`) from every
 * displayed region at once.
 *
 * The worker computes that marker per region, from the segments THAT region
 * fetched, and a chain crossing a region boundary is exactly the case where no
 * region holds the whole chain. An interchromosomal fusion is the shape it
 * breaks on, and it is the shape the mode exists for: one displayed window on
 * chr22 and one on chr9, a read's primary alignment in the first and its
 * supplementary in the second. The chr22 call saw no supplementary and reported
 * `NO_SUPP`; the chr9 call saw no primary and framed the segment against
 * `chainSuppFill`'s unknown-primary fallback. So one molecule was classified
 * twice, differently, and neither answer was about the molecule:
 *
 *   - the primary side painted the scheme's plain fill, because as far as its
 *     region knew the read never split, and
 *   - the supplementary side painted its own raw mapping strand while the legend
 *     said "same strand / inverted **relative to the chain's primary**".
 *
 * Chain identity is by NAME across regions — the rule `mergeChains` already lays
 * the rows out by, and the one this plugin's RPC doc states for anything unioning
 * chains across worker calls. This is that rule applied to the fill.
 *
 * The paired per-mate split markers (`CHAIN_FILL_SPLIT_*`) are deliberately left
 * alone: they classify a supplementary against its OWN mate's primary, which is
 * a finer question than this pass answers, and a read that already carries one
 * keeps it. Unioning those needs each mate's primary strand rather than the
 * chain's and is a separate change; nothing here can downgrade one.
 *
 * A no-op for the single-region case (returns the input map untouched), which is
 * almost every view.
 */
// Generic in the entry type: it rewrites one worker field and passes everything
// else through, so it must not decide which tier its caller is holding.
export function reconcileChainSuppAcrossRegions<T extends WorkerPileupData>(
  map: Map<number, T>,
): Map<number, T> {
  if (map.size < 2) {
    return map
  }
  // Chain name → what the regions collectively saw. `primaryStrand` 0 means no
  // region held a primary, which `chainSuppFill` resolves to the unframed
  // marker — the same answer a single region gives when it can't tell.
  const byChain = new Map<string, { hasSupp: boolean; primaryStrand: number }>()
  let anyChainData = false
  for (const data of map.values()) {
    if (!isChainData(data)) {
      continue
    }
    anyChainData = true
    const { readChainIndices, chainNames, readFlags, readStrands } = data
    for (let i = 0; i < readChainIndices.length; i++) {
      const name = chainNames[readChainIndices[i]!]!
      const entry = getOrCreate(byChain, name, () => ({
        hasSupp: false,
        primaryStrand: 0,
      }))
      if (readFlags[i]! & SAM_FLAG_SUPPLEMENTARY) {
        entry.hasSupp = true
      } else {
        entry.primaryStrand = readStrands[i]!
      }
    }
  }
  if (!anyChainData) {
    return map
  }

  const out = new Map<number, T>()
  for (const [idx, data] of map) {
    if (!isChainData(data)) {
      out.set(idx, data)
      continue
    }
    const { readChainIndices, chainNames, readChainHasSupp } = data
    const n = readChainIndices.length
    const merged = new Uint8Array(n)
    let changed = false
    for (let i = 0; i < n; i++) {
      const own = readChainHasSupp[i]!
      if (
        own === CHAIN_FILL_SPLIT_INVERSION ||
        own === CHAIN_FILL_SPLIT_DELETION
      ) {
        merged[i] = own
        continue
      }
      const entry = byChain.get(chainNames[readChainIndices[i]!]!)!
      const fill = chainSuppFill(entry.hasSupp, entry.primaryStrand)
      merged[i] = fill
      changed = changed || fill !== own
    }
    // Reference identity matters downstream (the renderer's upload memo reads
    // it), so a region the union agreed with keeps its own array.
    out.set(idx, changed ? { ...data, readChainHasSupp: merged } : data)
  }
  return out
}
