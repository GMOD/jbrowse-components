import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

export interface YShifts {
  // A feature with no entry does not move.
  byFeature: ReadonlyMap<string, number>
  // Present where an isoform row moves on its own; absent, every child rides
  // its feature.
  ofChild?: (featureId: string, childOrdinal: number) => number
}

const PRIMITIVE_KINDS = ['rect', 'line', 'arrow'] as const

function featureShifts(data: FeatureDataResult, shifts: YShifts) {
  const items = data.flatbushItems
  const byFeature = new Float64Array(items.length)
  for (let i = 0; i < items.length; i++) {
    byFeature[i] = shifts.byFeature.get(items[i]!.featureId) ?? 0
  }
  return byFeature
}

function shiftPrimitiveYs(
  data: FeatureDataResult,
  kind: (typeof PRIMITIVE_KINDS)[number],
  byFeature: Float64Array,
  ofChild: YShifts['ofChild'],
) {
  const ys = data[`${kind}Ys`]
  const featureIndices = data[`${kind}FeatureIndices`]
  const ordinals = data[`${kind}ChildOrdinals`]
  if (ofChild && ordinals.length > 0) {
    for (let i = 0; i < ys.length; i++) {
      ys[i] =
        ys[i]! +
        ofChild(data.flatbushItems[featureIndices[i]!]!.featureId, ordinals[i]!)
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
    : (shifts.byFeature.get(featureId) ?? 0)
}

/**
 * The y-bearing fields a glyph is DRAWN from: the primitive lanes, the label
 * boxes and the amino-acid overlay. The one list of them that a shift walks;
 * a new y-bearing field joins it here, and `yLanes.test.ts` fails until it does.
 * Mutates `data`, which must be a clone (`cloneMutableFields`).
 */
export function shiftDrawnYLanes(data: FeatureDataResult, shifts: YShifts) {
  const byFeature = featureShifts(data, shifts)
  for (const kind of PRIMITIVE_KINDS) {
    shiftPrimitiveYs(data, kind, byFeature, shifts.ofChild)
  }
  for (const labelData of data.floatingLabelsData.values()) {
    labelData.topY += childShift(
      shifts,
      labelData.parentFeatureId ?? labelData.featureId,
      labelData.childOrdinal,
    )
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
 * subfeature extents. The only walk of every y a region carries.
 */
export function shiftYLanes(data: FeatureDataResult, shifts: YShifts) {
  const byFeature = shiftDrawnYLanes(data, shifts)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    item.topPx += byFeature[i]!
    item.bottomPx += byFeature[i]!
  }
  for (const info of data.subfeatureInfos) {
    const delta = childShift(shifts, info.parentFeatureId, info.childOrdinal)
    info.topPx += delta
    info.bottomPx += delta
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
