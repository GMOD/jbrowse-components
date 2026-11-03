import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

/**
 * Either every lane rides its feature's entry in `byFeature` (a feature with
 * none does not move), or `ofChild` prices each isoform row on its own, the
 * root row included, and nothing else is consulted. `byIndex`, where a caller
 * already holds it, is `byFeature` laid out by flatbush index.
 */
export type YShifts =
  | {
      byFeature: ReadonlyMap<string, number>
      byIndex?: Float64Array
      ofChild?: never
    }
  | {
      ofChild: (featureId: string, childOrdinal: number) => number
      byFeature?: never
      byIndex?: never
    }

/**
 * Sees each label as the walker shifts it, with the shift it read: undefined
 * where `byFeature` has no entry for the label's feature.
 */
export type LabelVisitor = (
  key: string,
  label: FeatureLabelData,
  shift: number | undefined,
) => void

const PRIMITIVE_KINDS = ['rect', 'line', 'arrow'] as const

function featureShifts(data: FeatureDataResult, shifts: YShifts) {
  const items = data.flatbushItems
  if (shifts.ofChild) {
    const out = new Float64Array(items.length)
    for (let i = 0; i < items.length; i++) {
      out[i] = shifts.ofChild(items[i]!.featureId, ROOT_CHILD_ORDINAL)
    }
    return out
  } else if (shifts.byIndex) {
    return shifts.byIndex
  } else {
    const out = new Float64Array(items.length)
    for (let i = 0; i < items.length; i++) {
      out[i] = shifts.byFeature.get(items[i]!.featureId) ?? 0
    }
    return out
  }
}

function shiftPrimitiveYs(
  data: FeatureDataResult,
  kind: (typeof PRIMITIVE_KINDS)[number],
  byFeature: Float64Array,
  shifts: YShifts,
) {
  const ys = data[`${kind}Ys`]
  const featureIndices = data[`${kind}FeatureIndices`]
  const ordinals = data[`${kind}ChildOrdinals`]
  if (shifts.ofChild && ordinals.length > 0) {
    for (let i = 0; i < ys.length; i++) {
      ys[i] =
        ys[i]! +
        shifts.ofChild(
          data.flatbushItems[featureIndices[i]!]!.featureId,
          ordinals[i]!,
        )
    }
  } else {
    for (let i = 0; i < ys.length; i++) {
      ys[i] = ys[i]! + byFeature[featureIndices[i]!]!
    }
  }
}

function childShift(
  shifts: YShifts,
  featureId: string,
  childOrdinal: number | undefined,
) {
  return shifts.ofChild
    ? shifts.ofChild(featureId, childOrdinal ?? ROOT_CHILD_ORDINAL)
    : shifts.byFeature.get(featureId)
}

/**
 * The y-bearing fields a glyph is DRAWN from: the primitive lanes, the label
 * boxes and the amino-acid overlay. A new y-bearing field joins the walk here,
 * and `yLanes.test.ts` fails until it does.
 * Mutates `data`, which must be a clone (`cloneMutableFields`).
 */
export function shiftDrawnYLanes(
  data: FeatureDataResult,
  shifts: YShifts,
  onLabel?: LabelVisitor,
) {
  const byFeature = featureShifts(data, shifts)
  for (const kind of PRIMITIVE_KINDS) {
    shiftPrimitiveYs(data, kind, byFeature, shifts)
  }
  for (const [key, labelData] of data.floatingLabelsData) {
    const shift = childShift(
      shifts,
      labelData.parentFeatureId ?? labelData.featureId,
      labelData.childOrdinal,
    )
    labelData.topY += shift ?? 0
    onLabel?.(key, labelData, shift)
  }
  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += shifts.ofChild
        ? shifts.ofChild(
            data.flatbushItems[aa.flatbushIdx]!.featureId,
            aa.childOrdinal ?? ROOT_CHILD_ORDINAL,
          )
        : byFeature[aa.flatbushIdx]!
    }
  }
  return byFeature
}

/**
 * `shiftDrawnYLanes` and the boxes hit testing reads: the feature rows and the
 * subfeature extents. `applyHeightScale` and `isoformTrim` scale and filter
 * the same fields on lists of their own.
 */
export function shiftYLanes(
  data: FeatureDataResult,
  shifts: YShifts,
  onLabel?: LabelVisitor,
) {
  const byFeature = shiftDrawnYLanes(data, shifts, onLabel)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    item.topPx += byFeature[i]!
    item.bottomPx += byFeature[i]!
  }
  for (const info of data.subfeatureInfos) {
    const delta = childShift(shifts, info.parentFeatureId, info.childOrdinal)
    info.topPx += delta ?? 0
    info.bottomPx += delta ?? 0
  }
}

/**
 * Fresh copies of exactly the lanes `shiftDrawnYLanes` writes, to shift
 * without touching the data they came from.
 */
export function cloneDrawnYLanes(data: FeatureDataResult) {
  const floatingLabelsData: FeatureDataResult['floatingLabelsData'] = new Map()
  for (const [k, v] of data.floatingLabelsData) {
    floatingLabelsData.set(k, { ...v })
  }
  return {
    rectYs: new Float32Array(data.rectYs),
    lineYs: new Float32Array(data.lineYs),
    arrowYs: new Float32Array(data.arrowYs),
    floatingLabelsData,
    aminoAcidOverlay: data.aminoAcidOverlay?.map(aa => ({ ...aa })),
  }
}
