import { createMoreIsoformsLabel } from '../RenderFeatureDataRPC/floatingLabels.ts'
import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  IsoformStack,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

// What one gene keeps at a given isoform count, and how far the kept parts
// move. Shifts are SUBTRACTED from the worker's own values: a kept child rises
// by everything dropped above it, in worker px for geometry and in whole rows
// for `below` labels — the two units the boundary carries, each undone in the
// unit it was counted in.
export interface IsoformTrim {
  keptOrdinals: ReadonlySet<number>
  shiftPxByOrdinal: ReadonlyMap<number, number>
  shiftLabelRowsByOrdinal: ReadonlyMap<number, number>
  // the gene's extent after the drop, in `IsoformStack`'s own units
  heightPx: number
  labelRows: number
  startBp: number
  endBp: number
  // isoforms the gene HAS and does not draw — what the badge counts
  hidden: number
  canonicalTag?: string
}

/**
 * What one gene keeps at `maxIsoforms` isoforms.
 *
 * Best by RANK, not first by drawn order: the stack sorts by (canonical,
 * coding) while the ranking also weighs protein length, so keeping a prefix of
 * the drawn order would keep a different set than `longestCoding` keeps at
 * k = 1. Decorations — an NCBI source record, a `biological_region` — are not
 * isoforms and are always kept, which is also why the height cannot be counted
 * in rows: they take real ones.
 */
export function trimIsoformStack(
  stack: IsoformStack,
  maxIsoforms: number,
): IsoformTrim {
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
      cursorPx += stack.gapPx
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

/**
 * Every trim one isoform count puts in force, and the badge counts for the
 * genes it spares because the user opened them.
 *
 * A gene the count leaves whole gets no entry, so a rung that trims nothing
 * does no work downstream — which is what keeps the `full` rung's arrays the
 * worker's own.
 */
export interface IsoformTrimPlan {
  trims: ReadonlyMap<string, IsoformTrim>
  // expanded gene id -> what the count WOULD have hidden, so the badge on it
  // reads "show fewer" and offers the way back
  expandedHidden: ReadonlyMap<string, number>
}

export const NO_ISOFORM_TRIM: IsoformTrimPlan = {
  trims: new Map(),
  expandedHidden: new Map(),
}

export function planIsoformTrims(
  stacks: Iterable<readonly [string, IsoformStack]>,
  maxIsoforms: number | undefined,
  expandedGeneIds: ReadonlySet<string> | undefined,
): IsoformTrimPlan {
  const trims = new Map<string, IsoformTrim>()
  const expandedHidden = new Map<string, number>()
  for (const [featureId, stack] of stacks) {
    // The tighter of the ladder's count and the worker's own collapse. The
    // second only bites on a gene the user EXPANDED — every other gene under
    // `longestCoding` already arrives with one child, where trimming to one is
    // a no-op — and it is what keeps that gene's "show fewer" badge naming the
    // count it was opened from.
    const count = Math.min(
      maxIsoforms ?? Number.POSITIVE_INFINITY,
      stack.collapsedIsoformCount ?? Number.POSITIVE_INFINITY,
    )
    if (count === Number.POSITIVE_INFINITY) {
      continue
    }
    const trim = trimIsoformStack(stack, count)
    if (trim.keptOrdinals.size === stack.children.length) {
      continue
    }
    if (expandedGeneIds?.has(featureId)) {
      expandedHidden.set(featureId, trim.hidden)
    } else {
      trims.set(featureId, trim)
    }
  }
  return { trims, expandedHidden }
}

// The most isoforms any gene on screen has — the top of the fit ladder's
// bisection, and the count above which trimming can take nothing away.
export function maxIsoformCount(
  regions: Iterable<Pick<FeatureDataResult, 'flatbushItems'>>,
  measureIds?: ReadonlySet<string>,
) {
  let max = 0
  for (const data of regions) {
    for (const item of data.flatbushItems) {
      const count = item.isoformStack?.isoformCount ?? 0
      if (count > max && (!measureIds || measureIds.has(item.featureId))) {
        max = count
      }
    }
  }
  return max
}

// The badge a trimmed gene's name row carries. Its width is part of that row's
// reservation, so the packer asks for it at the count it is probing and the
// committed layout writes the same text (see `decideLabelReservations`).
export function moreIsoformsLabel(hidden: number, expanded: boolean) {
  return createMoreIsoformsLabel({ overflow: { hidden, expanded } })
}

// The kept elements of one typed array, in a new array of the same kind. Built
// through the source's own constructor rather than a per-kind branch, so a
// primitive array added later is filtered by being passed here.
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

// Which primitives of one kind survive, given the trims in force, and whether
// any survivor has moved — dropping none does NOT mean this kind is untouched,
// because a kept isoform rises by everything dropped above it whatever kind
// drew that. A single-exon isoform dropped above a multi-exon one that stays
// leaves the region's only intron line kept, and 23px below the exons it joins.
//
// Three ways a region holds something no trim has a say over, answered here so
// each caller does not repeat them: the ordinal lane is length-zero (this
// region stacks no gene), the primitive is the root feature's own, or its owner
// is not being trimmed.
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

// Filter and shift one primitive kind's parallel arrays. Every array of the
// kind goes through the same kept-index list, so they cannot come out of step;
// the Y and label-row lanes are rewritten into the NEW arrays rather than in
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

/**
 * Drop the isoforms one plan leaves out of ONE region's cloned arrays, and
 * close the gaps the drop leaves.
 *
 * Runs BEFORE `applyHeightScale`, so every shift is spent in the unit the
 * worker counted it in: px for geometry, whole rows for `below` labels, which
 * only become px once the display mode's label font is applied. After the
 * scale the two are mixed into one number and the shift could not be undone.
 *
 * Mutates the clone `cloneMutableFields` produced, and returns without touching
 * a byte when the plan is empty.
 */
export function applyIsoformTrim(
  data: FeatureDataResult,
  plan: IsoformTrimPlan,
) {
  const { trims, expandedHidden } = plan
  if (trims.size === 0 && expandedHidden.size === 0) {
    return
  }

  for (const kind of ['rect', 'line', 'arrow'] as const) {
    trimPrimitiveKind(kind, data, trims)
  }

  data.subfeatureInfos = data.subfeatureInfos.filter(info => {
    const trim = trims.get(info.parentFeatureId)
    const ordinal = info.childOrdinal ?? ROOT_CHILD_ORDINAL
    if (!trim || ordinal === ROOT_CHILD_ORDINAL) {
      return true
    }
    if (!trim.keptOrdinals.has(ordinal)) {
      return false
    }
    const shiftPx = trim.shiftPxByOrdinal.get(ordinal) ?? 0
    info.topPx -= shiftPx
    info.bottomPx -= shiftPx
    info.labelRowsAbove =
      (info.labelRowsAbove ?? 0) -
      (trim.shiftLabelRowsByOrdinal.get(ordinal) ?? 0)
    return true
  })

  if (data.aminoAcidOverlay) {
    data.aminoAcidOverlay = data.aminoAcidOverlay.filter(aa => {
      const ordinal = aa.childOrdinal ?? ROOT_CHILD_ORDINAL
      const trim = trims.get(data.flatbushItems[aa.flatbushIdx]!.featureId)
      if (!trim || ordinal === ROOT_CHILD_ORDINAL) {
        return true
      }
      if (!trim.keptOrdinals.has(ordinal)) {
        return false
      }
      aa.topPx -= trim.shiftPxByOrdinal.get(ordinal) ?? 0
      aa.labelRowsAbove =
        (aa.labelRowsAbove ?? 0) -
        (trim.shiftLabelRowsByOrdinal.get(ordinal) ?? 0)
      return true
    })
  }

  for (const item of data.flatbushItems) {
    const trim = trims.get(item.featureId)
    if (trim) {
      item.featureHeightPx = trim.heightPx
      item.bottomPx = trim.heightPx
      item.labelRows = trim.labelRows
      item.startBp = trim.startBp
      item.endBp = trim.endBp
    }
  }

  for (const [key, labelData] of data.floatingLabelsData) {
    const geneId = labelData.parentFeatureId ?? labelData.featureId
    const ordinal = labelData.childOrdinal ?? ROOT_CHILD_ORDINAL
    const trim = trims.get(geneId)
    if (trim && ordinal !== ROOT_CHILD_ORDINAL) {
      if (trim.keptOrdinals.has(ordinal)) {
        labelData.topY -= trim.shiftPxByOrdinal.get(ordinal) ?? 0
        labelData.labelRowsAbove =
          (labelData.labelRowsAbove ?? 0) -
          (trim.shiftLabelRowsByOrdinal.get(ordinal) ?? 0)
      } else {
        data.floatingLabelsData.delete(key)
      }
      continue
    }
    if (ordinal !== ROOT_CHILD_ORDINAL) {
      continue
    }
    // The gene's own entry. Re-anchored to what actually drew, the way
    // `processFeatureRecord` re-anchors a `longestCoding` collapse — otherwise
    // the name floats left of the visible glyph over empty track.
    if (trim) {
      labelData.featureHeight = trim.heightPx
      labelData.labelRows = trim.labelRows
      labelData.minX = trim.startBp
      labelData.maxX = trim.endBp
      if (labelData.nameLabel && trim.hidden > 0) {
        labelData.moreIsoformsLabel = moreIsoformsLabel(trim.hidden, false)
      }
    } else {
      const hidden = expandedHidden.get(geneId)
      if (hidden !== undefined && labelData.nameLabel) {
        labelData.moreIsoformsLabel = moreIsoformsLabel(hidden, true)
      }
    }
  }
}
