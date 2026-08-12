import { reconcileChainSuppAcrossRegions } from './chainSuppAcrossRegions.ts'
import { buildReadColorCategories } from './colorUtils.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ReadColorOpts } from './colorUtils.ts'

// Bake one RC_* index per read (see colorUtils `buildReadColorCategories`).
// Runs on the main thread, right after `overlayReadTagColors`, because the
// `noTagValue` category is decided from the freshly baked `readTagColors` —
// classify before that and every tag-colored read lands in the wrong bucket.
//
// Main thread rather than the worker for the same reason tag colors are: the
// inputs (`colorSupplementaryChains`, `flipStrandLongReadChains`) would
// otherwise have to enter `rpcProps()` and turn two color toggles into full
// region refetches. Here they are tier-2 — a relayout, no worker round trip.
//
// And it is also the only place that CAN answer the chain-level supplementary
// marker for a chain spanning two displayed regions, which is what
// `reconcileChainSuppAcrossRegions` is doing above the bake: each worker call
// sees one region, so a fusion read's primary and its supplementary are
// classified by two calls that each saw half a molecule. Chain mode only, and a
// no-op on a single-region view.
export function overlayReadColorCategories(
  map: Map<number, PileupDataResult>,
  colorScheme: number,
  opts: ReadColorOpts,
): Map<number, PileupDataResult> {
  const src = opts.chainMode ? reconcileChainSuppAcrossRegions(map) : map
  const out = new Map<number, PileupDataResult>()
  for (const [idx, data] of src) {
    out.set(idx, {
      ...data,
      readColorCategories: buildReadColorCategories(data, colorScheme, opts),
    })
  }
  return out
}
