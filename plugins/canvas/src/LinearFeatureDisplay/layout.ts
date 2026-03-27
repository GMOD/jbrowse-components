import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { STRAND_ARROW_WIDTH } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

const LABEL_PADDING_PX = 8
const LAYOUT_Y_PADDING = 5

function effectiveLabelWidthPx(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
) {
  let maxWidth = 0
  if (showLabels && labelData.nameLabel) {
    maxWidth = Math.max(maxWidth, labelData.nameLabel.textWidth)
  }
  if (showDescriptions && labelData.descriptionLabel) {
    maxWidth = Math.max(maxWidth, labelData.descriptionLabel.textWidth)
  }
  if (labelData.subfeatureLabel) {
    maxWidth = Math.max(maxWidth, labelData.subfeatureLabel.textWidth)
  }
  return maxWidth > 0 ? maxWidth + LABEL_PADDING_PX : 0
}

export function computeAndAssignLayout(
  rpcDataMap: Map<number, FeatureDataResult>,
  bpPerPx: number,
  regionKeys: Map<number, string>,
  newRegionNumbers: Set<number>,
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontSize = 12,
) {
  const refGroups = new Map<string, [number, FeatureDataResult][]>()
  for (const [regionNumber, data] of rpcDataMap) {
    if (data.flatbushItems.length === 0) {
      continue
    }
    const key = regionKeys.get(regionNumber) ?? ''
    let group = refGroups.get(key)
    if (!group) {
      group = []
      refGroups.set(key, group)
    }
    group.push([regionNumber, data])
  }

  for (const [, regions] of refGroups) {
    if (!regions.some(([num]) => newRegionNumbers.has(num))) {
      continue
    }

    const layout = new GranularRectLayout({ displayMode: 'normal' })
    const layoutMap = new Map<string, number>()
    const layoutHeights = new Map<string, number>()

    const labelInfoByFeatureId = new Map<
      string,
      { hasName: boolean; hasDescription: boolean; maxLabelWidthPx: number }
    >()
    for (const [, data] of regions) {
      for (const labelData of Object.values(data.floatingLabelsData)) {
        const targetId = labelData.parentFeatureId ?? labelData.featureId
        const widthPx = effectiveLabelWidthPx(
          labelData,
          showLabels,
          showDescriptions,
        )
        const existing = labelInfoByFeatureId.get(targetId)
        if (existing) {
          existing.hasName = existing.hasName || !!labelData.nameLabel
          existing.hasDescription =
            existing.hasDescription || !!labelData.descriptionLabel
          if (widthPx > existing.maxLabelWidthPx) {
            existing.maxLabelWidthPx = widthPx
          }
        } else {
          labelInfoByFeatureId.set(targetId, {
            hasName: !!labelData.nameLabel,
            hasDescription: !!labelData.descriptionLabel,
            maxLabelWidthPx: widthPx,
          })
        }
      }
    }

    const allFeatures = new Map<
      string,
      {
        startBp: number
        layoutEndBp: number
        height: number
        strand: number
      }
    >()
    for (const [, data] of regions) {
      for (const item of data.flatbushItems) {
        if (!allFeatures.has(item.featureId)) {
          let height = item.featureHeightPx + LAYOUT_Y_PADDING
          const labelInfo = labelInfoByFeatureId.get(item.featureId)
          if (showLabels && labelInfo?.hasName) {
            height += labelFontSize
          }
          if (showDescriptions && labelInfo?.hasDescription) {
            height += labelFontSize
          }

          let layoutEndBp = item.endBp
          if (labelInfo) {
            const labelEndBp =
              item.startBp + labelInfo.maxLabelWidthPx * bpPerPx
            if (labelEndBp > layoutEndBp) {
              layoutEndBp = labelEndBp
            }
          }

          allFeatures.set(item.featureId, {
            startBp: item.startBp,
            layoutEndBp,
            height,
            strand: item.strand ?? 0,
          })
        }
      }
    }

    const sorted = [...allFeatures.entries()].sort(
      ([, a], [, b]) => a.startBp - b.startBp,
    )

    for (const [id, { startBp, layoutEndBp, height, strand }] of sorted) {
      const arrowPadding = strand ? STRAND_ARROW_WIDTH : 0
      const leftPx = startBp / bpPerPx - arrowPadding
      const rightPx = layoutEndBp / bpPerPx + arrowPadding
      const top = layout.addRect(id, leftPx, rightPx, height)
      layoutMap.set(id, top ?? 0)
      layoutHeights.set(id, height)
    }

    for (const [, data] of regions) {
      fillYArrays(data, layoutMap, layoutHeights)
    }
  }
}

export function relayoutAllRegions(
  rpcDataMap: Map<number, FeatureDataResult>,
  bpPerPx: number,
  regionKeys: Map<number, string>,
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontSize = 12,
) {
  const allRegionNumbers = new Set(rpcDataMap.keys())
  computeAndAssignLayout(
    rpcDataMap,
    bpPerPx,
    regionKeys,
    allRegionNumbers,
    showLabels,
    showDescriptions,
    labelFontSize,
  )
}

// Bakes per-feature layout offsets into the Y position arrays (rectYs, lineYs,
// etc.) so the renderer can upload them directly to the GPU.
//
// Safe to call on data that already has offsets applied: each feature's
// item.topPx records the offset currently baked in, so the function computes
// the difference (new - current) and shifts by only that amount. On fresh RPC
// data where topPx is 0 the shift equals the full offset; on already-laid-out
// data only the change is applied. This avoids the need for a separate "undo"
// step when the layout is recomputed (e.g. when new regions arrive
// incrementally on the same chromosome).
export function fillYArrays(
  data: FeatureDataResult,
  layoutMap: Map<string, number>,
  layoutHeights?: Map<string, number>,
) {
  const featureDeltas = new Float32Array(data.flatbushItems.length)
  const oldOffsetByFeatureId = new Map<string, number>()
  for (const [i, item] of data.flatbushItems.entries()) {
    const newOffset = layoutMap.get(item.featureId) ?? 0
    featureDeltas[i] = newOffset - item.topPx
    if (!oldOffsetByFeatureId.has(item.featureId)) {
      oldOffsetByFeatureId.set(item.featureId, item.topPx)
    }
  }

  for (let i = 0; i < data.numRects; i++) {
    data.rectYs[i] =
      data.rectYs[i]! + featureDeltas[data.rectFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.numLines; i++) {
    data.lineYs[i] =
      data.lineYs[i]! + featureDeltas[data.lineFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.numArrows; i++) {
    data.arrowYs[i] =
      data.arrowYs[i]! + featureDeltas[data.arrowFeatureIndices[i]!]!
  }

  for (const [i, item] of data.flatbushItems.entries()) {
    const newOffset = item.topPx + featureDeltas[i]!
    const layoutHeight = layoutHeights?.get(item.featureId)
    item.topPx = newOffset
    item.bottomPx = newOffset + (layoutHeight ?? item.featureHeightPx)
  }

  for (const info of data.subfeatureInfos) {
    const oldOffset = oldOffsetByFeatureId.get(info.parentFeatureId) ?? 0
    const newOffset = layoutMap.get(info.parentFeatureId) ?? 0
    const delta = newOffset - oldOffset
    info.topPx += delta
    info.bottomPx += delta
  }

  for (const labelData of Object.values(data.floatingLabelsData)) {
    const offsetKey = labelData.parentFeatureId ?? labelData.featureId
    const oldOffset = oldOffsetByFeatureId.get(offsetKey) ?? 0
    const newOffset = layoutMap.get(offsetKey) ?? 0
    labelData.topY += newOffset - oldOffset
  }

  if (data.aminoAcidOverlay) {
    for (const aaItem of data.aminoAcidOverlay) {
      aaItem.topPx += featureDeltas[aaItem.flatbushIdx]!
    }
  }

  let maxY = 0
  for (const item of data.flatbushItems) {
    if (item.bottomPx > maxY) {
      maxY = item.bottomPx
    }
  }
  data.maxY = maxY

  data.flatbushItems = [...data.flatbushItems]
  data.subfeatureInfos = [...data.subfeatureInfos]
}
