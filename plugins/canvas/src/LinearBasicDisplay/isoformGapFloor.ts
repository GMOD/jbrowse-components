import { snapBoxHeightPx } from '@jbrowse/render-core/shaders/hpmath'

import { isoformGapPx } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { IsoformTrim } from './isoformTrim.ts'

// A sub-pixel gap is an absent one, because the renderer snaps every box to
// whole pixel rows. A whole pixel on purpose: the proof in `requiredPitchPx`
// needs the right-hand side to be an integer.
const MIN_ISOFORM_GAP_PX = 1

// `floor` has no tolerance, so a pitch one ulp short (10.599999999999998)
// floors the lower row back onto the merged bar.
const PITCH_SLACK_PX = 1 / 1024

// `snapBoxTopPx` centers the snapped height on the float box, so half of the
// rounding comes off each edge.
function boxEdgeShiftPx(boxPx: number) {
  return (boxPx - snapBoxHeightPx(boxPx)) / 2
}

// A pitch rather than a gap, because the visible pixel is decided after two
// roundings: the drawn box is `snapBoxHeightPx(box)` and each row top is
// floored, so this is the pitch at which the lower top clears the upper
// snapped bottom by MIN_ISOFORM_GAP_PX at every row offset. Both heights,
// because `featureHeight` is a per-feature callback and the taller of the two
// is wrong in both directions.
function requiredPitchPx(upperBoxPx: number, lowerBoxPx: number) {
  return (
    snapBoxHeightPx(upperBoxPx) +
    MIN_ISOFORM_GAP_PX +
    PITCH_SLACK_PX +
    boxEdgeShiftPx(upperBoxPx) -
    boxEdgeShiftPx(lowerBoxPx)
  )
}

// The row is not the ordinal: a trim drops isoforms out of the middle and the
// rows below close up.
export interface IsoformGapSpread {
  shiftPxByOrdinal: ReadonlyMap<number, number>
  totalPx: number
}

function drawnChildren(stack: IsoformStack, trim: IsoformTrim | undefined) {
  return trim
    ? stack.children.filter(child => trim.keptOrdinals.has(child.ordinal))
    : stack.children
}

// Per gap, because `requiredPitchPx` reads two box heights; what is
// subtracted is per gene, since `layoutSubfeatures` spends
// `TRANSCRIPT_PADDING_RATIO` of the gene's own box on every gap.
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
      // Cumulative: a row clears every gap above it.
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

// The packer prices rows off the raw region data and never sees the shift
// `applyIsoformGapFloor` writes into the clone.
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

// After `applyHeightScale`, since the shift is in drawn px, and before
// `applyLayoutToRegion` adds the row offsets. `scaleLaidOutData` can later
// squeeze a floored pitch back onto the row below; re-running the floor there
// is unavailable because the flattened `FeatureDataResult` no longer carries
// the per-gene stacks, and that rung already hides every label.
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
      // The gene's own entry hangs its name off the bottom of the stack, so
      // it grows by every gap; a transcript's entry rides its row.
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
