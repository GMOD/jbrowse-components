import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

export function computeAndAssignLayout(
  rpcDataMap: Map<number, FeatureDataResult>,
  bpPerPx: number,
  regionKeys: Map<number, string>,
  newRegionNumbers: Set<number>,
) {
  // Group regions by reference sequence identity (assemblyName:refName) so
  // features on the same reference share a layout. A single feature can span
  // multiple discontiguous regions on the same reference and must get the
  // same Y value in each. Different references get separate layouts to avoid
  // false overlaps from unrelated absolute bp coordinates.
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
    // Skip groups where all regions were already processed. fillYArrays adds
    // offsets to Y values in-place, so re-processing old data would
    // double the offsets.
    if (!regions.some(([num]) => newRegionNumbers.has(num))) {
      continue
    }
    const layout = new GranularRectLayout({ displayMode: 'normal' })
    const layoutMap = new Map<string, number>()

    // Collect unique features across all regions in this refName group.
    // Use absolute bp coordinates since they are directly comparable
    // within the same chromosome.
    const allFeatures = new Map<
      string,
      { startBp: number; layoutEndBp: number; height: number }
    >()
    for (const [, data] of regions) {
      for (const item of data.flatbushItems) {
        if (!allFeatures.has(item.featureId)) {
          allFeatures.set(item.featureId, {
            startBp: item.startBp,
            layoutEndBp: item.layoutEndBp,
            height: item.bottomPx,
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
  // Pre-build per-flatbushItem y-offset to avoid repeated Map lookups
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
    labelData.topY = labelData.topY + (layoutMap.get(labelData.featureId) ?? 0)
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

  // New array references so client-side flatbush cache rebuilds
  data.flatbushItems = [...data.flatbushItems]
  data.subfeatureInfos = [...data.subfeatureInfos]
}
