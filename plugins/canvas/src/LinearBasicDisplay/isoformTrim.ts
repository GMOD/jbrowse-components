import { createMoreIsoformsLabel } from '../RenderFeatureDataRPC/floatingLabels.ts'
import { isoformGapPx } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

// Shifts are subtracted from the worker's values, in worker px for geometry
// and whole rows for `below` labels, each undone in the unit it was counted
// in.
export interface IsoformTrim {
  keptOrdinals: ReadonlySet<number>
  shiftPxByOrdinal: ReadonlyMap<number, number>
  shiftLabelRowsByOrdinal: ReadonlyMap<number, number>
  heightPx: number
  labelRows: number
  startBp: number
  endBp: number
  hidden: number
  canonicalTag?: string
}

// Best by rank, not first by drawn order, so k = 1 keeps what `longestCoding`
// keeps; decorations are not isoforms and are always kept, which is why the
// height cannot be counted in rows.
export function trimIsoformStack(
  stack: IsoformStack,
  maxIsoforms: number,
): IsoformTrim {
  const gapPx = isoformGapPx(stack)
  const keptOrdinals = new Set<number>()
  const shiftPxByOrdinal = new Map<number, number>()
  const shiftLabelRowsByOrdinal = new Map<number, number>()
  let cursorPx = 0
  let labelRows = 0
  let droppedLabelRows = 0
  let startBp = Number.POSITIVE_INFINITY
  let endBp = Number.NEGATIVE_INFINITY
  let keptIsoforms = 0
  let empty = true

  for (const child of stack.children) {
    if (child.isoform && child.rank >= maxIsoforms) {
      droppedLabelRows += child.labelRows
      continue
    }
    if (!empty) {
      cursorPx += gapPx
    }
    empty = false
    keptOrdinals.add(child.ordinal)
    shiftPxByOrdinal.set(child.ordinal, child.yPx - cursorPx)
    shiftLabelRowsByOrdinal.set(child.ordinal, droppedLabelRows)
    cursorPx += child.heightPx
    labelRows += child.labelRows
    startBp = Math.min(startBp, child.startBp)
    endBp = Math.max(endBp, child.endBp)
    if (child.isoform) {
      keptIsoforms++
    }
  }

  return {
    keptOrdinals,
    shiftPxByOrdinal,
    shiftLabelRowsByOrdinal,
    heightPx: cursorPx,
    labelRows,
    startBp: empty ? 0 : startBp,
    endBp: empty ? 0 : endBp,
    hidden: Math.max(0, stack.isoformCount - keptIsoforms),
    canonicalTag: stack.canonicalTag,
  }
}

export interface IsoformBadge {
  hidden: number
  expanded: boolean
}

// A gene the count leaves whole gets no `trims` entry, so a rung that trims
// nothing does no work downstream; `badges` also covers genes the worker
// collapsed or the user opened.
export interface IsoformTrimPlan {
  trims: ReadonlyMap<string, IsoformTrim>
  badges: ReadonlyMap<string, IsoformBadge>
}

// A presentation gate priced and drawn off the same decision: the plan
// applies it, `decideLabelReservations` reserves what it reports,
// `applyIsoformTrim` writes what it reports.
export const MIN_ISOFORM_BADGE_GENE_PX = 100

export function planIsoformTrims(
  stacks: Iterable<readonly [string, IsoformStack]>,
  maxIsoforms: number | undefined,
  expandedGeneIds: ReadonlySet<string> | undefined,
  bpPerPx: number,
): IsoformTrimPlan {
  const trims = new Map<string, IsoformTrim>()
  const badges = new Map<string, IsoformBadge>()
  for (const [featureId, stack] of stacks) {
    // The tighter of the ladder's count and the worker's own collapse, so
    // both count their missing isoforms the same way.
    const count = Math.min(
      maxIsoforms ?? Number.POSITIVE_INFINITY,
      stack.collapsedIsoformCount ?? Number.POSITIVE_INFINITY,
    )
    if (count === Number.POSITIVE_INFINITY) {
      continue
    }
    const trim = trimIsoformStack(stack, count)
    const expanded = !!expandedGeneIds?.has(featureId)
    if (!expanded && trim.keptOrdinals.size !== stack.children.length) {
      trims.set(featureId, trim)
    }
    const drawn = expanded
      ? trimIsoformStack(stack, Number.POSITIVE_INFINITY)
      : trim
    const extentBp = drawn.endBp - drawn.startBp
    if (trim.hidden > 0 && extentBp / bpPerPx >= MIN_ISOFORM_BADGE_GENE_PX) {
      badges.set(featureId, { hidden: trim.hidden, expanded })
    }
  }
  return { trims, badges }
}

// A worker-collapsed gene counts what it shipped and an expanded gene is
// skipped: `planIsoformTrims` trims neither, and counted they put a bracket
// over a stack no count changes.
export function maxIsoformCount(
  regions: Iterable<Pick<FeatureDataResult, 'flatbushItems'>>,
  measureIds: ReadonlySet<string> | undefined,
  expandedGeneIds: ReadonlySet<string> | undefined,
) {
  let max = 0
  for (const data of regions) {
    for (const item of data.flatbushItems) {
      const stack = item.isoformStack
      const count = stack
        ? Math.min(
            stack.isoformCount,
            stack.collapsedIsoformCount ?? Number.POSITIVE_INFINITY,
          )
        : 0
      if (
        count > max &&
        (!measureIds || measureIds.has(item.featureId)) &&
        !expandedGeneIds?.has(item.featureId)
      ) {
        max = count
      }
    }
  }
  return max
}

function pick<T extends { length: number; [i: number]: number }>(
  arr: T,
  kept: readonly number[],
  stride: number,
): T {
  if (arr.length === 0) {
    return arr
  }
  const Ctor = (arr as unknown as { constructor: new (n: number) => T })
    .constructor
  const out = new Ctor(kept.length * stride)
  for (const [i, k] of kept.entries()) {
    for (let s = 0; s < stride; s++) {
      out[i * stride + s] = arr[k * stride + s]!
    }
  }
  return out
}

// Dropping none does not mean the kind is untouched: a kept isoform rises by
// everything dropped above it, whatever kind drew that.
function keptPrimitiveIndices(
  ordinals: Uint16Array,
  featureIndices: Uint32Array,
  flatbushItems: readonly { featureId: string }[],
  trims: ReadonlyMap<string, IsoformTrim>,
) {
  const kept: number[] = []
  let shifted = false
  for (let i = 0; i < featureIndices.length; i++) {
    const ordinal = ordinals.length > 0 ? ordinals[i]! : ROOT_CHILD_ORDINAL
    const trim = trims.get(flatbushItems[featureIndices[i]!]!.featureId)
    if (ordinal === ROOT_CHILD_ORDINAL || !trim) {
      kept.push(i)
    } else if (trim.keptOrdinals.has(ordinal)) {
      kept.push(i)
      shifted ||=
        (trim.shiftPxByOrdinal.get(ordinal) ?? 0) !== 0 ||
        (trim.shiftLabelRowsByOrdinal.get(ordinal) ?? 0) !== 0
    }
  }
  return { kept, shifted }
}

// The Y and label-row lanes are rewritten into new arrays rather than in
// place, because `cloneMutableFields` shares the rest with the worker's own.
function trimPrimitiveKind(
  kind: 'rect' | 'line' | 'arrow',
  data: FeatureDataResult,
  trims: ReadonlyMap<string, IsoformTrim>,
) {
  const ordinals = data[`${kind}ChildOrdinals`]
  const featureIndices = data[`${kind}FeatureIndices`]
  const { kept, shifted } = keptPrimitiveIndices(
    ordinals,
    featureIndices,
    data.flatbushItems,
    trims,
  )
  if (kept.length === featureIndices.length && !shifted) {
    return
  }

  const ys = pick(data[`${kind}Ys`], kept, 1)
  const labelRows = pick(data[`${kind}LabelRows`], kept, 1)
  for (const [i, k] of kept.entries()) {
    const ordinal = ordinals.length > 0 ? ordinals[k]! : ROOT_CHILD_ORDINAL
    const trim = trims.get(data.flatbushItems[featureIndices[k]!]!.featureId)
    if (trim && ordinal !== ROOT_CHILD_ORDINAL) {
      ys[i] = ys[i]! - (trim.shiftPxByOrdinal.get(ordinal) ?? 0)
      if (labelRows.length > 0) {
        labelRows[i] =
          labelRows[i]! - (trim.shiftLabelRowsByOrdinal.get(ordinal) ?? 0)
      }
    }
  }
  data[`${kind}Ys`] = ys
  data[`${kind}LabelRows`] = labelRows
  data[`${kind}Heights`] = pick(data[`${kind}Heights`], kept, 1)
  data[`${kind}Colors`] = pick(data[`${kind}Colors`], kept, 1)
  data[`${kind}ColorClasses`] = pick(data[`${kind}ColorClasses`], kept, 1)
  data[`${kind}ChildOrdinals`] = pick(ordinals, kept, 1)
  data[`${kind}FeatureIndices`] = pick(featureIndices, kept, 1)

  if (kind === 'rect') {
    data.rectPositions = pick(data.rectPositions, kept, 2)
    data.rectStrands = pick(data.rectStrands, kept, 1)
    data.rectDensityFade = pick(data.rectDensityFade, kept, 1)
  } else if (kind === 'line') {
    data.linePositions = pick(data.linePositions, kept, 2)
    data.lineDirections = pick(data.lineDirections, kept, 1)
  } else {
    data.arrowXs = pick(data.arrowXs, kept, 1)
    data.arrowDirections = pick(data.arrowDirections, kept, 1)
    data.arrowWidthsBp = pick(data.arrowWidthsBp, kept, 1)
  }
}

function trimShift(
  trims: ReadonlyMap<string, IsoformTrim>,
  geneId: string,
  childOrdinal: number | undefined,
) {
  const ordinal = childOrdinal ?? ROOT_CHILD_ORDINAL
  const trim = trims.get(geneId)
  if (!trim || ordinal === ROOT_CHILD_ORDINAL) {
    return 'untouched' as const
  }
  return trim.keptOrdinals.has(ordinal)
    ? {
        px: trim.shiftPxByOrdinal.get(ordinal) ?? 0,
        rows: trim.shiftLabelRowsByOrdinal.get(ordinal) ?? 0,
      }
    : undefined
}

// Before `applyHeightScale`, so each shift is spent in the unit the worker
// counted it in; after the scale px and label rows are one number and the
// shift cannot be undone. Geometry is gated on `trims`, not the plan: a plan
// carrying only badges reaches only the floating labels.
export function applyIsoformTrim(
  data: FeatureDataResult,
  plan: IsoformTrimPlan,
) {
  const { trims, badges } = plan
  if (trims.size === 0 && badges.size === 0) {
    return
  }

  if (trims.size > 0) {
    for (const kind of ['rect', 'line', 'arrow'] as const) {
      trimPrimitiveKind(kind, data, trims)
    }

    data.subfeatureInfos = data.subfeatureInfos.filter(info => {
      const shift = trimShift(trims, info.parentFeatureId, info.childOrdinal)
      if (shift === 'untouched') {
        return true
      }
      if (!shift) {
        return false
      }
      info.topPx -= shift.px
      info.bottomPx -= shift.px
      info.labelRowsAbove = (info.labelRowsAbove ?? 0) - shift.rows
      return true
    })

    if (data.aminoAcidOverlay) {
      data.aminoAcidOverlay = data.aminoAcidOverlay.filter(aa => {
        const shift = trimShift(
          trims,
          data.flatbushItems[aa.flatbushIdx]!.featureId,
          aa.childOrdinal,
        )
        if (shift === 'untouched') {
          return true
        }
        if (!shift) {
          return false
        }
        aa.topPx -= shift.px
        aa.labelRowsAbove = (aa.labelRowsAbove ?? 0) - shift.rows
        return true
      })
    }

    for (const item of data.flatbushItems) {
      const trim = trims.get(item.featureId)
      if (trim) {
        item.featureHeightPx = trim.heightPx
        item.labelRows = trim.labelRows
        item.startBp = trim.startBp
        item.endBp = trim.endBp
      }
    }
  }

  for (const [key, labelData] of data.floatingLabelsData) {
    const geneId = labelData.parentFeatureId ?? labelData.featureId
    if ((labelData.childOrdinal ?? ROOT_CHILD_ORDINAL) !== ROOT_CHILD_ORDINAL) {
      const shift = trimShift(trims, geneId, labelData.childOrdinal)
      if (!shift) {
        data.floatingLabelsData.delete(key)
      } else if (shift !== 'untouched') {
        labelData.topY -= shift.px
        labelData.labelRowsAbove = (labelData.labelRowsAbove ?? 0) - shift.rows
      }
      continue
    }
    const trim = trims.get(geneId)
    // Re-anchored to what drew, or the name floats left of the visible glyph
    // over empty track.
    if (trim) {
      labelData.featureHeight = trim.heightPx
      labelData.labelRows = trim.labelRows
      labelData.minX = trim.startBp
      labelData.maxX = trim.endBp
    }
    // Off `badges`, not `trim`: a worker-collapsed gene has no trim entry and
    // still shows fewer isoforms than it has.
    const badge = badges.get(geneId)
    if (badge && labelData.nameLabel) {
      labelData.moreIsoformsLabel = createMoreIsoformsLabel(
        badge.hidden,
        badge.expanded,
      )
    }
  }
}
