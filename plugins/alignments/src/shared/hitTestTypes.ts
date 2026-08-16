// Hit-test types shared across per-feature `features/X/hitTest.ts` files
// and the orchestrator in `LinearAlignmentsDisplay/hitTestPipeline.ts`.
//
// Lives in `shared/` so feature folders and `features/clip/packGpu.ts` don't have
// to import upward into `LinearAlignmentsDisplay/components/`.

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

export type CigarItemType =
  | 'mismatch'
  | 'insertion'
  | 'deletion'
  | 'skip'
  | 'softclip'
  | 'hardclip'

export interface CigarHitResult {
  type: CigarItemType
  index: number
  position: number
  // Span of the op, always known: reference bases for a deletion/skip, read
  // bases for an insertion/clip, and 1 for a mismatch, which is one base by
  // construction. Required rather than optional so consumers can size the op
  // without a fallback — a hit with no length was never a real state.
  length: number
  base?: string
  sequence?: string
  // Phred base quality for a mismatch, absent when the read reports none.
  // `hitTestMismatch` resolves the arrays' QUAL_UNAVAILABLE sentinel here, so 0
  // is the score rather than the missing case and readers must test for
  // `undefined` rather than truthiness.
  qual?: number
}

// The SNP base to annotate a modification hit with, when the modified base is
// also a mismatch. undefined for a modification over a reference-matching base.
// Shared by the left-click path (useAlignmentsBase) and the right-click one
// (menus/contextMenu), which must annotate the identical widget.
export function snpBaseFromCigar(cigarHit: CigarHitResult | undefined) {
  return cigarHit?.type === 'mismatch' ? cigarHit.base : undefined
}

export interface ResolvedBlock {
  rpcData: PileupDataResult
  bpRange: [number, number]
  blockStartPx: number
  blockWidth: number
  refName: string
  reversed: boolean
}

export interface CigarCoords {
  bpPerPx: number
  // Fractional position along the block, for the hit tests that measure a
  // distance to a marker (see canvasXToGenomicPos).
  genomicPos: number
  // The integer base under the cursor, for the hit tests that index one (see
  // canvasXToBasePos). Not interchangeable with flooring genomicPos — that is
  // off by one on reversed blocks.
  basePos: number
  row: number
  adjustedY: number
  yWithinRow: number
}

/**
 * Whether the cursor is on a drawn read body. Both halves matter:
 *
 * - `adjustedY >= 0` — above the pileup top the floor divide makes `row`
 *   negative. Per-row tests compare `Ys[i] !== row` so a negative row never
 *   matches, but that is accidental, and it is reachable (coverage shown with no
 *   depth under the cursor falls through to the pileup tests).
 * - `yWithinRow <= featureHeight` — `row` comes from the row PITCH (body +
 *   spacing), so without this the inter-row gap resolves to the row above.
 */
export function isWithinReadBand(coords: CigarCoords, featureHeight: number) {
  return coords.adjustedY >= 0 && coords.yWithinRow <= featureHeight
}

/**
 * The index of the entry on `row` that is drawn LAST — i.e. whose pixels are
 * actually the ones under the cursor — or undefined for none. Every per-row hit
 * test over a row-instanced `*Ys` array goes through this, because the direction
 * is a correctness decision and not a style one.
 *
 * Both backends draw one instanced pass per feature kind in array order, so a
 * later index paints over an earlier one; the arrays are built per read in read
 * order (`buildMismatchArrays`, `buildGapArrays`, `buildInterbaseArrays`) and
 * `cloneWithLayout` only remaps their rows, never reorders them. So scanning
 * back to front answers with the mark on top, and — this is the point — with the
 * mark belonging to the same read `hitTestFeature` answers with, since that walks
 * `readKeys` backwards under the same rule.
 *
 * It only decides anything where a layout puts several features on one row, and
 * there it decides a lot: `buildCollapsedPileupMap` puts an entire group on row 0
 * (all-zero `readYs`) with overlap as the normal case, and a chain's reads share
 * a row. Scanning forwards there returned the underneath read's mark while
 * `hitTestFeature` returned the top read, so the tooltip and the details widget
 * paired one read's identity with another read's base, quality and position.
 *
 * `match` runs only for entries already known to be on `row` — a handful — so the
 * per-element cost stays the inline `ys[i] === row` compare.
 *
 * `start`/`end` bound the scan for the arrays that are a concatenation of
 * sub-ranges: interbases are laid out as (insertions, softclips, hardclips), and
 * scanning a sub-range is what lets that layout, rather than scan order, decide
 * priority between the kinds.
 */
export function findTopmostOnRow(
  ys: ArrayLike<number>,
  start: number,
  end: number,
  row: number,
  match: (index: number) => boolean,
): number | undefined {
  for (let i = end - 1; i >= start; i--) {
    if (ys[i] === row && match(i)) {
      return i
    }
  }
  return undefined
}
