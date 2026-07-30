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
export function overlayReadColorCategories(
  map: Map<number, PileupDataResult>,
  colorScheme: number,
  opts: ReadColorOpts,
): Map<number, PileupDataResult> {
  const out = new Map<number, PileupDataResult>()
  for (const [idx, data] of map) {
    out.set(idx, {
      ...data,
      readColorCategories: buildReadColorCategories(data, colorScheme, opts),
    })
  }
  return out
}
