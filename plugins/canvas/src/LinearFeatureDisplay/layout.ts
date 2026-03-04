import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { maxLabelTextWidth } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

function effectiveLabelWidthPx(
  labelData: FeatureLabelData,
  showDescriptions: boolean,
) {
  return maxLabelTextWidth(labelData, showDescriptions)
}

export function computeAndAssignLayout(
  rpcDataMap: Map<number, FeatureDataResult>,
  bpPerPx: number,
  regionKeys: Map<number, string>,
  newRegionNumbers: Set<number>,
  showDescriptions = true,
  descriptionFontSize = 12,
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

    const labelInfoByFeatureId = new Map<
      string,
      { hasDescription: boolean; maxLabelWidthPx: number }
    >()
    for (const [, data] of regions) {
      for (const labelData of Object.values(data.floatingLabelsData)) {
        const targetId = labelData.parentFeatureId ?? labelData.featureId
        const widthPx = effectiveLabelWidthPx(labelData, showDescriptions)
        const existing = labelInfoByFeatureId.get(targetId)
        if (existing) {
          existing.hasDescription =
            existing.hasDescription || !!labelData.descriptionLabel
          if (widthPx > existing.maxLabelWidthPx) {
            existing.maxLabelWidthPx = widthPx
          }
        } else {
          labelInfoByFeatureId.set(targetId, {
            hasDescription: !!labelData.descriptionLabel,
            maxLabelWidthPx: widthPx,
          })
        }
      }
    }

    const allFeatures = new Map<
      string,
      { startBp: number; layoutEndBp: number; height: number }
    >()
    for (const [, data] of regions) {
      for (const item of data.flatbushItems) {
        if (!allFeatures.has(item.featureId)) {
          let height = item.bottomPx
          const labelInfo = labelInfoByFeatureId.get(item.featureId)
          if (!showDescriptions && labelInfo?.hasDescription) {
            height -= descriptionFontSize
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
          })
        }
      }
    }

    const sorted = [...allFeatures.entries()].sort(
      ([, a], [, b]) => a.startBp - b.startBp,
    )

    for (const [id, { startBp, layoutEndBp, height }] of sorted) {
      const leftPx = startBp / bpPerPx
      const rightPx = layoutEndBp / bpPerPx
      const top = layout.addRect(id, leftPx, rightPx, height)
      layoutMap.set(id, top ?? 0)
    }

    for (const [, data] of regions) {
      fillYArrays(data, layoutMap)
    }
  }
}

export function fillYArrays(
  data: FeatureDataResult,
  layoutMap: Map<string, number>,
) {
  const featureYOffsets = new Float32Array(data.flatbushItems.length)
  for (const [i, item] of data.flatbushItems.entries()) {
    featureYOffsets[i] = layoutMap.get(item.featureId) ?? 0
  }

  for (let i = 0; i < data.numRects; i++) {
    data.rectYs[i] =
      data.rectYs[i]! + featureYOffsets[data.rectFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.numLines; i++) {
    data.lineYs[i] =
      data.lineYs[i]! + featureYOffsets[data.lineFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.numArrows; i++) {
    data.arrowYs[i] =
      data.arrowYs[i]! + featureYOffsets[data.arrowFeatureIndices[i]!]!
  }

  for (const [i, item] of data.flatbushItems.entries()) {
    const offset = featureYOffsets[i]!
    item.topPx = offset
    item.bottomPx = item.bottomPx + offset
  }

  for (const info of data.subfeatureInfos) {
    const offset = layoutMap.get(info.parentFeatureId) ?? 0
    const height = info.bottomPx - info.topPx
    info.topPx = info.topPx + offset
    info.bottomPx = info.topPx + height
  }

  for (const labelData of Object.values(data.floatingLabelsData)) {
    const offsetKey = labelData.parentFeatureId ?? labelData.featureId
    labelData.topY = labelData.topY + (layoutMap.get(offsetKey) ?? 0)
  }

  if (data.aminoAcidOverlay) {
    for (const aaItem of data.aminoAcidOverlay) {
      aaItem.topPx = aaItem.topPx + featureYOffsets[aaItem.flatbushIdx]!
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
