import { featureGroupSections, sectionIdsOf } from './facet.ts'
import { bodyHeightPx } from './layoutInputs.ts'
import { isPlacedRow } from './rowPlacement.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
  FlatbushItem,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureFacet } from './facet.ts'

function scaleFloat32(arr: Float32Array, multiplier: number) {
  for (let i = 0; i < arr.length; i++) {
    arr[i]! *= multiplier
  }
}

// The worker emits geometry in normal-mode px but counts label rows, whose
// height follows the gentler label font multiplier, so the two scale
// separately.
function scaleYWithLabelRows(
  ys: Float32Array,
  rows: Uint16Array,
  multiplier: number,
  labelFontPx: number,
) {
  const hasRows = rows.length > 0
  for (let i = 0; i < ys.length; i++) {
    ys[i] = ys[i]! * multiplier + (hasRows ? rows[i]! * labelFontPx : 0)
  }
}

// No `multiplier === 1` early return: normal mode still has label rows to
// spend.
export function applyHeightScale(
  data: FeatureDataResult,
  multiplier: number,
  labelFontPx: number,
) {
  for (const kind of ['rect', 'line', 'arrow'] as const) {
    scaleYWithLabelRows(
      data[`${kind}Ys`],
      data[`${kind}LabelRows`],
      multiplier,
      labelFontPx,
    )
    scaleFloat32(data[`${kind}Heights`], multiplier)
  }
  for (const item of data.flatbushItems) {
    item.featureHeightPx = bodyHeightPx(
      item.featureHeightPx,
      item.labelRows,
      multiplier,
      labelFontPx,
    )
  }
  for (const info of data.subfeatureInfos) {
    const above = (info.labelRowsAbove ?? 0) * labelFontPx
    info.topPx = info.topPx * multiplier + above
    info.bottomPx =
      info.bottomPx * multiplier + above + (info.ownsLabelRow ? labelFontPx : 0)
  }
  for (const labelData of data.floatingLabelsData.values()) {
    labelData.topY =
      labelData.topY * multiplier +
      (labelData.labelRowsAbove ?? 0) * labelFontPx
    labelData.featureHeight =
      labelData.featureHeight * multiplier +
      (labelData.labelRows ?? 0) * labelFontPx
  }
  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx = aa.topPx * multiplier + (aa.labelRowsAbove ?? 0) * labelFontPx
      aa.heightPx *= multiplier
    }
  }
}

// The chip rows are the one part of a stack the fit scale leaves alone: a
// chip is 16 px whatever the squeeze, so every feature moves back down by the
// px the chips above it lost to the scale.
export interface FixedChips {
  facet: FeatureFacet
  chipPx: number
}

function chipShiftOf(
  map: ReadonlyMap<number, FeatureDataResult>,
  scale: number,
  { facet, chipPx }: FixedChips,
) {
  const sectionOf = sectionIdsOf(map, facet)
  const ordinal = new Map(
    featureGroupSections(map, facet, chipPx, sectionOf).map((s, i) => [
      s.key,
      i,
    ]),
  )
  const lost = chipPx * (1 - scale)
  return (item: FlatbushItem) => {
    const i = isPlacedRow(item.topPx)
      ? ordinal.get(sectionOf(item).key)
      : undefined
    return i === undefined ? 0 : (i + 1) * lost
  }
}

// Every y a region carries, moved by a per-feature amount: the same set of
// fields `applyHeightScale` scales.
function shiftFeatureYs(
  data: FeatureDataResult,
  shiftOf: (featureId: string) => number,
) {
  const byIndex = new Float32Array(data.flatbushItems.length)
  for (const [i, item] of data.flatbushItems.entries()) {
    byIndex[i] = shiftOf(item.featureId)
    item.topPx += byIndex[i]
    item.bottomPx += byIndex[i]
  }
  for (const kind of ['rect', 'line', 'arrow'] as const) {
    const ys = data[`${kind}Ys`]
    const featureIndices = data[`${kind}FeatureIndices`]
    for (let i = 0; i < ys.length; i++) {
      ys[i] = ys[i]! + byIndex[featureIndices[i]!]!
    }
  }
  for (const info of data.subfeatureInfos) {
    const d = shiftOf(info.parentFeatureId)
    info.topPx += d
    info.bottomPx += d
  }
  for (const labelData of data.floatingLabelsData.values()) {
    labelData.topY += shiftOf(labelData.parentFeatureId ?? labelData.featureId)
  }
  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += byIndex[aa.flatbushIdx]!
    }
  }
}

export function scaleLaidOutData(
  map: ReadonlyMap<number, FeatureDataResult>,
  scale: number,
  fixedChips?: FixedChips,
): Map<number, FeatureDataResult> {
  const chipShift = fixedChips && chipShiftOf(map, scale, fixedChips)
  const out = new Map<number, FeatureDataResult>()
  for (const [n, data] of map) {
    if (data.flatbushItems.length === 0) {
      // Shares the raw object so an idle empty region keeps its reference and
      // does not re-upload.
      out.set(n, data)
    } else {
      const cloned = cloneMutableFields(data)
      // labelFontPx 0: the label rows were spent when this layout was
      // committed, so they are already inside the Y values scaled here.
      applyHeightScale(cloned, scale, 0)
      for (const item of cloned.flatbushItems) {
        item.topPx *= scale
        item.bottomPx *= scale
      }
      if (chipShift) {
        const shiftById = new Map(
          data.flatbushItems.map(item => [item.featureId, chipShift(item)]),
        )
        shiftFeatureYs(cloned, id => shiftById.get(id) ?? 0)
      }
      out.set(n, cloned)
    }
  }
  return out
}

export function cloneMutableFields(raw: FeatureDataResult) {
  const floatingLabelsData = new Map<string, FeatureLabelData>()
  for (const [k, v] of raw.floatingLabelsData) {
    floatingLabelsData.set(k, { ...v })
  }
  return {
    ...raw,
    rectYs: new Float32Array(raw.rectYs),
    rectHeights: new Float32Array(raw.rectHeights),
    rectDensityFade: new Uint32Array(raw.rectDensityFade),
    lineYs: new Float32Array(raw.lineYs),
    lineHeights: new Float32Array(raw.lineHeights),
    arrowYs: new Float32Array(raw.arrowYs),
    arrowHeights: new Float32Array(raw.arrowHeights),
    flatbushItems: raw.flatbushItems.map(item => ({ ...item })),
    subfeatureInfos: raw.subfeatureInfos.map(info => ({ ...info })),
    floatingLabelsData,
    aminoAcidOverlay: raw.aminoAcidOverlay?.map(aa => ({ ...aa })),
  }
}

// Mutates the clone `cloneMutableFields` made, in place.
export function applyLayoutToRegion(
  data: FeatureDataResult,
  layoutMap: Map<string, number>,
  layoutHeights: Map<string, number>,
  droppedLabelIds: ReadonlySet<string>,
  densityFadeIds: ReadonlySet<string>,
) {
  const featureOffsets = new Float32Array(data.flatbushItems.length)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    featureOffsets[i] = layoutMap.get(data.flatbushItems[i]!.featureId)!
  }

  for (let i = 0; i < data.rectDensityFade.length; i++) {
    const featureId = data.flatbushItems[data.rectFeatureIndices[i]!]!.featureId
    data.rectDensityFade[i] = densityFadeIds.has(featureId) ? 1 : 0
  }

  for (const kind of ['rect', 'line', 'arrow'] as const) {
    const ys = data[`${kind}Ys`]
    const featureIndices = data[`${kind}FeatureIndices`]
    for (let i = 0; i < ys.length; i++) {
      ys[i] = ys[i]! + featureOffsets[featureIndices[i]!]!
    }
  }

  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    const offset = featureOffsets[i]!
    const height = layoutHeights.get(item.featureId)!
    item.topPx = offset
    item.bottomPx = offset + height
  }

  for (const info of data.subfeatureInfos) {
    const offset = layoutMap.get(info.parentFeatureId) ?? 0
    info.topPx += offset
    info.bottomPx += offset
  }

  // A decimated feature keeps its entry and loses only `nameLabel`, the one
  // label whose row went unreserved.
  for (const [key, labelData] of data.floatingLabelsData) {
    const layoutKey = labelData.parentFeatureId ?? labelData.featureId
    const offset = layoutMap.get(layoutKey)
    if (offset === undefined || !isPlacedRow(offset)) {
      data.floatingLabelsData.delete(key)
      continue
    }
    if (droppedLabelIds.has(layoutKey)) {
      delete labelData.nameLabel
    }
    labelData.topY += offset
  }

  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += featureOffsets[aa.flatbushIdx]!
    }
  }
}
