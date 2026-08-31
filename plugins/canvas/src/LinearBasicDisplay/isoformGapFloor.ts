import { snapBoxHeightPx } from '@jbrowse/render-core/shaders/hpmath'

import { isoformGapPx } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { IsoformTrim } from './isoformTrim.ts'

// Clear pixels between two transcripts of one gene, below which the two read as
// one glyph. The gap the worker spends is a fraction of the box
// (TRANSCRIPT_PADDING_RATIO), so it shrinks with the compact scale and lands at
// 0.6px in superCompact — and a sub-pixel gap is not a thin gap but an absent
// one, because the renderer snaps every box to whole pixel rows
// (`snapBoxHeightPx`). At a 3.6px pitch the rounding gave alternating rows a
// pixel of air and none: three stacked isoforms drew as one solid bar.
//
// A whole pixel on purpose: the proof below turns `floor(x) >= drawnHeight +
// this` into `x >= drawnHeight + this`, which holds only while the right side is
// an integer. A fractional gap here would need a `ceil` to keep the guarantee.
const MIN_ISOFORM_GAP_PX = 1

// The required pitch lands exactly on a step of the row flooring, and `floor`
// has no tolerance: a pitch that comes out of float64 one ulp short (10.6 as
// 10.599999999999998) floors the lower row back up and hands back the merged
// bar. Far below a device pixel, far above the error.
const PITCH_SLACK_PX = 1 / 1024

// Where a drawn box's edges sit relative to the Y the layout holds.
// `snapBoxTopPx` centers the snapped height on the float box rather than
// anchoring its top, so half of whatever the height rounding changed comes off
// each edge.
function boxEdgeShiftPx(boxPx: number) {
  return (boxPx - snapBoxHeightPx(boxPx)) / 2
}

/**
 * The PITCH two consecutive rows of one gene must reach, in DRAWN px, for a
 * pixel to survive between them — from the float box heights of the upper and
 * the lower row.
 *
 * A pitch the row must reach rather than a gap it must have, because the pixel a
 * reader sees is decided after two roundings, not one: the drawn box is
 * `snapBoxHeightPx(box)` — which rounds, and nudges a thin even height UP to the
 * next odd one so the intron line has a center row — and the top of each row is
 * floored. The row offset `applyLayoutToRegion` adds later is unknown here, and
 * over every offset the two floored tops differ by at least — and at some offset
 * by exactly — `floor(pitch + lowerShift - upperShift)`, so this is the pitch at
 * which the lower top clears the upper snapped bottom by MIN_ISOFORM_GAP_PX.
 * Asking for `gap >= 1` alone does not: at superCompact's 2.4px box (a
 * `featureHeight: 8` track) the nudge draws 3px boxes on a 3.4px pitch and the
 * rows still touch.
 *
 * BOTH heights, because `featureHeight` is a per-feature callback slot
 * (`featureHeightPx`) and a stacked child is free to resolve a taller box than
 * its gene or than its sibling. The upper box alone decides the bottom edge to
 * clear; the lower one only shifts its own top. The taller of the two is
 * therefore the wrong term in both directions — it over-spreads a thin row above
 * a tall one by the whole difference, and it still lets a tall row above a thin
 * one touch (a 2px box over a 1.5px one both draw 3px, and max asks for a 4px
 * pitch where 4.25 is needed).
 */
function requiredPitchPx(upperBoxPx: number, lowerBoxPx: number) {
  return (
    snapBoxHeightPx(upperBoxPx) +
    MIN_ISOFORM_GAP_PX +
    PITCH_SLACK_PX +
    boxEdgeShiftPx(upperBoxPx) -
    boxEdgeShiftPx(lowerBoxPx)
  )
}

// The extra px each of one gene's gaps spreads by, plus which ordinal ends up on
// which drawn row, as a cumulative shift. The row is NOT the ordinal: a trim
// drops isoforms out of the middle of the drawn order and the rows below close
// up, so a kept child's row is its rank among the survivors (`applyIsoformTrim`
// has already moved it there).
export interface IsoformGapSpread {
  shiftPxByOrdinal: ReadonlyMap<number, number>
  // what the whole gene grows by — every gap it holds
  totalPx: number
}

// The children a gene draws at a given trim, in drawn order.
function drawnChildren(stack: IsoformStack, trim: IsoformTrim | undefined) {
  return trim
    ? stack.children.filter(child => trim.keptOrdinals.has(child.ordinal))
    : stack.children
}

/**
 * How much further apart than the worker laid them out each PAIR of one gene's
 * transcript rows has to sit, in DRAWN px — one entry per gap, in drawn order.
 *
 * Per gap rather than per gene because `requiredPitchPx` reads two box heights
 * and the pairs disagree once a callback resolves them separately. What is
 * subtracted is per gene, though: `layoutSubfeatures` spends
 * `TRANSCRIPT_PADDING_RATIO` of the GENE's own box on every gap it lays out
 * whatever the children resolved, so `isoformGapPx` is the number already spent.
 *
 * Zero for a gap whose worker pitch already clears the floor. That is not "every
 * gene outside superCompact": the worker spends 20% of the box, so it covers
 * `snapBoxHeightPx(box) + 1` only once the box draws about 6.7px or taller, and
 * a `featureHeight: 8` track's compact box (4.8px) or a normal-mode box under
 * 5px is nonzero too.
 */
export function isoformGapExtrasPx(
  stack: IsoformStack,
  heightMultiplier: number,
  trim: IsoformTrim | undefined,
) {
  const workerGapPx = isoformGapPx(stack) * heightMultiplier
  const boxesPx = drawnChildren(stack, trim).map(
    child => child.heightPx * heightMultiplier,
  )
  return boxesPx.slice(1).map((lowerPx, gap) => {
    const upperPx = boxesPx[gap]!
    return Math.max(
      0,
      requiredPitchPx(upperPx, lowerPx) - upperPx - workerGapPx,
    )
  })
}

// The spread every stacked gene in one ref-group needs, keyed by feature id.
export function planIsoformGapFloor(
  stacks: Iterable<readonly [string, IsoformStack]>,
  trims: ReadonlyMap<string, IsoformTrim>,
  heightMultiplier: number,
) {
  const spreads = new Map<string, IsoformGapSpread>()
  for (const [featureId, stack] of stacks) {
    const trim = trims.get(featureId)
    const extrasPx = isoformGapExtrasPx(stack, heightMultiplier, trim)
    if (extrasPx.some(extraPx => extraPx > 0)) {
      const children = drawnChildren(stack, trim)
      // cumulative: a row clears every gap above it, not only its own
      const shiftPxByOrdinal = new Map([[children[0]!.ordinal, 0]])
      let shiftPx = 0
      for (const [gap, extraPx] of extrasPx.entries()) {
        shiftPx += extraPx
        shiftPxByOrdinal.set(children[gap + 1]!.ordinal, shiftPx)
      }
      spreads.set(featureId, { shiftPxByOrdinal, totalPx: shiftPx })
    }
  }
  return spreads
}

// Height one gene's stack reserves beyond what the worker laid out, for the
// packer — which prices rows off the RAW region data and so never sees the
// shift `applyIsoformGapFloor` writes into the clone. The same per-gap terms
// `planIsoformGapFloor` spends, summed, so the row a gene is given is the row it
// fills.
export function isoformGapSpreadPx(
  stack: IsoformStack | undefined,
  heightMultiplier: number,
  trim: IsoformTrim | undefined,
) {
  return stack
    ? isoformGapExtrasPx(stack, heightMultiplier, trim).reduce(
        (total, extraPx) => total + extraPx,
        0,
      )
    : 0
}

/**
 * Push each stacked transcript down by the gaps above it, so the pixel the
 * floor promises is actually there.
 *
 * Runs AFTER `applyHeightScale` — the shift is in drawn px, which is the only
 * unit the promise can be made in — and before `applyLayoutToRegion`, which
 * adds the row offsets on top. In place, over the clone: the spread drops
 * nothing, so unlike the trim it needs no filtered copy of the arrays.
 *
 * The promise covers the `heightMultiplier` scaling and stops there.
 * `scaleLaidOutData` multiplies this committed layout again when a fixed-height
 * track squeezes the `bodies` rung to fit, and a scale below 1 can round a
 * floored pitch back onto the row below (a 4px pitch over a 3px box at scale
 * 0.8 draws 3px boxes 3px apart). Re-running the floor there is not available:
 * it reads per-gene `IsoformStack` metadata that the packed, flattened
 * `FeatureDataResult` no longer carries, and clamping the scale instead would
 * break the one thing fit mode guarantees — content height × scale = track
 * height — by overflowing the track it was asked to fit. That rung already
 * trades legibility for the fit; it hides names, descriptions and subfeature
 * labels too.
 */
export function applyIsoformGapFloor(
  data: FeatureDataResult,
  spreads: ReadonlyMap<string, IsoformGapSpread>,
) {
  if (spreads.size === 0) {
    return
  }
  const shiftPx = (featureId: string, ordinal: number) => {
    const spread = spreads.get(featureId)
    return spread && ordinal !== ROOT_CHILD_ORDINAL
      ? (spread.shiftPxByOrdinal.get(ordinal) ?? 0)
      : 0
  }

  for (const kind of ['rect', 'line', 'arrow'] as const) {
    const ordinals = data[`${kind}ChildOrdinals`]
    if (ordinals.length === 0) {
      continue
    }
    const featureIndices = data[`${kind}FeatureIndices`]
    const ys = data[`${kind}Ys`]
    for (let i = 0; i < ys.length; i++) {
      const item = data.flatbushItems[featureIndices[i]!]!
      ys[i] = ys[i]! + shiftPx(item.featureId, ordinals[i]!)
    }
  }

  for (const info of data.subfeatureInfos) {
    const shift = shiftPx(
      info.parentFeatureId,
      info.childOrdinal ?? ROOT_CHILD_ORDINAL,
    )
    info.topPx += shift
    info.bottomPx += shift
  }

  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      const item = data.flatbushItems[aa.flatbushIdx]!
      aa.topPx += shiftPx(item.featureId, aa.childOrdinal ?? ROOT_CHILD_ORDINAL)
    }
  }

  for (const labelData of data.floatingLabelsData.values()) {
    const geneId = labelData.parentFeatureId ?? labelData.featureId
    const spread = spreads.get(geneId)
    if (spread) {
      // The gene's own entry hangs its name off the bottom of the stack, so it
      // grows by every gap the stack spread by; a transcript's entry rides the
      // row that moved.
      if (labelData.childOrdinal === undefined) {
        labelData.featureHeight += spread.totalPx
      } else {
        labelData.topY += shiftPx(geneId, labelData.childOrdinal)
      }
    }
  }

  for (const item of data.flatbushItems) {
    const spread = spreads.get(item.featureId)
    if (spread) {
      item.featureHeightPx += spread.totalPx
    }
  }
}
