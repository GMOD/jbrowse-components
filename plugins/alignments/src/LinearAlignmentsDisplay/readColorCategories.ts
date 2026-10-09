import { buildReadColorCategories } from './colorUtils.ts'

import type {
  PileupDataResult,
  TagColoredPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { ColorSchemeType } from '../shared/types.ts'
import type { ReadColorOpts } from './colorUtils.ts'

// Bake one RC_* index per read (see colorUtils `buildReadColorCategories`).
// Runs on the main thread, right after `overlayReadTagColors`, because the
// `noTagValue` category is decided from the freshly baked `readTagColors` —
// classify before that and every tag-colored read lands in the wrong bucket.
//
// Main thread rather than the worker for the same reason tag colors are: the
// chain frame it reads is joined on the main thread, and a color switch here is
// tier-2, a recolor with no worker round trip.
//
// A PURE PER-READ BAKE, and nothing else. The frame pass that rewrites
// `readChainHasSupp` reads neither the color scheme nor the tag map, so it runs
// ahead of this in `applyChainStrandFrames` (groupLayout), memoized on what it
// depends on.
export function overlayReadColorCategories(
  map: Map<number, TagColoredPileupData>,
  colorScheme: ColorSchemeType,
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
