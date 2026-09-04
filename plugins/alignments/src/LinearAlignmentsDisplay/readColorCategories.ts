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
// inputs (`colorSupplementaryChains`, `flipStrandLongReadChains`) would
// otherwise have to enter `rpcProps()` and turn two color toggles into full
// region refetches. Here they are tier-2 — a relayout, no worker round trip.
//
// A PURE PER-READ BAKE, and nothing else. It used to also run the two passes
// that rewrite `readChainHasSupp` (`reconcileChainSuppAcrossRegions`, then
// `consensusChainStrandFrames`), which made this function's cost a function of
// inputs it does not have: neither pass reads the colour scheme or the tag map,
// yet both re-ran on every change to either — so switching strand →
// first-of-pair-strand re-solved a mean-field relaxation over every chain on
// screen to arrive at the identical answer. They now live in
// `applyChainStrandFrames` (groupLayout), memoized on what they actually depend
// on.
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
