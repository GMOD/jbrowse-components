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
const MIN_ISOFORM_GAP_PX = 1

/**
 * How much further apart than the worker laid them out one gene's transcript
 * rows have to sit, in DRAWN px, for every pair to keep a pixel between them.
 * Zero wherever the worker's own gap already clears the floor, which is every
 * gene in normal and compact mode.
 *
 * Measured as a PITCH the row must reach rather than as a gap it must have,
 * because the pixel a reader sees is decided after two roundings, not one: the
 * drawn box is `snapBoxHeightPx(box)` — which rounds, and nudges a thin even
 * height UP to the next odd one so the intron line has a center row — and the
 * top of each row is floored. Consecutive floored tops differ by at least
 * `floor(pitch)`, so a pitch of `drawnHeight + 1` is exactly what guarantees the
 * pixel, and asking for `gap >= 1` alone does not: at superCompact's 2.4px box
 * (a `featureHeight: 8` track) the nudge draws 3px boxes on a 3.4px pitch and
 * the rows still touch.
 */
export function isoformGapExtraPx(
  stack: IsoformStack,
  heightMultiplier: number,
) {
  const boxPx = stack.boxHeightPx * heightMultiplier
  const requiredPitchPx = snapBoxHeightPx(boxPx) + MIN_ISOFORM_GAP_PX
  return Math.max(
    0,
    requiredPitchPx - boxPx - isoformGapPx(stack) * heightMultiplier,
  )
}

// The extra px one gene's rows spread by, and which drawn row each of its
// children ended up on. The row is NOT the ordinal: a trim drops isoforms out of
// the middle of the drawn order and the rows below close up, so a kept child's
// row is its rank among the survivors (`applyIsoformTrim` has already moved it
// there).
export interface IsoformGapSpread {
  extraPx: number
  rowByOrdinal: ReadonlyMap<number, number>
  // what the whole gene grows by — one `extraPx` per gap it holds
  totalPx: number
}

// Rows a gene draws at a given trim, in drawn order.
function drawnOrdinals(stack: IsoformStack, trim: IsoformTrim | undefined) {
  const ordinals = stack.children.map(child => child.ordinal)
  return trim ? ordinals.filter(o => trim.keptOrdinals.has(o)) : ordinals
}

/**
 * The spread every stacked gene in one ref-group needs, keyed by feature id.
 * Empty in normal and compact mode, where the worker's proportional gap already
 * clears the floor and nothing downstream does any work.
 */
export function planIsoformGapFloor(
  stacks: Iterable<readonly [string, IsoformStack]>,
  trims: ReadonlyMap<string, IsoformTrim>,
  heightMultiplier: number,
) {
  const spreads = new Map<string, IsoformGapSpread>()
  for (const [featureId, stack] of stacks) {
    const extraPx = isoformGapExtraPx(stack, heightMultiplier)
    const ordinals = drawnOrdinals(stack, trims.get(featureId))
    if (extraPx > 0 && ordinals.length > 1) {
      spreads.set(featureId, {
        extraPx,
        rowByOrdinal: new Map(ordinals.map((o, row) => [o, row])),
        totalPx: extraPx * (ordinals.length - 1),
      })
    }
  }
  return spreads
}

// Height one gene's stack reserves beyond what the worker laid out, for the
// packer — which prices rows off the RAW region data and so never sees the
// shift `applyIsoformGapFloor` writes into the clone.
export function isoformGapSpreadPx(
  stack: IsoformStack | undefined,
  heightMultiplier: number,
  trim: IsoformTrim | undefined,
) {
  if (!stack) {
    return 0
  }
  const rows = drawnOrdinals(stack, trim).length
  return isoformGapExtraPx(stack, heightMultiplier) * Math.max(0, rows - 1)
}

/**
 * Push each stacked transcript down by the gaps above it, so the pixel the
 * floor promises is actually there.
 *
 * Runs AFTER `applyHeightScale` — the shift is in drawn px, which is the only
 * unit the promise can be made in — and before `applyLayoutToRegion`, which
 * adds the row offsets on top. In place, over the clone: the spread drops
 * nothing, so unlike the trim it needs no filtered copy of the arrays.
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
      ? spread.extraPx * (spread.rowByOrdinal.get(ordinal) ?? 0)
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
