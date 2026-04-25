import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { STRAND_ARROW_WIDTH } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { maxLabelTextWidth } from '../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'

const LABEL_PADDING_PX = 8
const LAYOUT_Y_PADDING = 5

export interface LayoutInputs {
  bpPerPx: number
  regionKeys: Map<number, string>
  showLabels: boolean
  showDescriptions: boolean
  labelFontSize?: number
}

function reservedLabelWidthPx(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
) {
  const width = maxLabelTextWidth(labelData, showLabels, showDescriptions)
  return width > 0 ? width + LABEL_PADDING_PX : 0
}

// Pure layout. Raw data from the worker has Y coordinates relative to feature
// top (topPx = 0). This returns a new map where each region's Y values have
// been shifted by the per-feature top computed by GranularRectLayout.
// Regions sharing the same `assembly:refName` key share one layout so spanning
// features get the same Y in every region they appear in.
export function computeLaidOutData(
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LayoutInputs,
): Map<number, FeatureDataResult> {
  const {
    bpPerPx,
    regionKeys,
    showLabels,
    showDescriptions,
    labelFontSize = 12,
  } = inputs

  const out = new Map<number, FeatureDataResult>()
  for (const [n, raw] of rpcDataMap) {
    out.set(n, cloneMutableFields(raw))
  }

  const refGroups = new Map<string, [number, FeatureDataResult][]>()
  for (const [displayedRegionIndex, data] of out) {
    if (data.flatbushItems.length === 0) {
      continue
    }
    const key = regionKeys.get(displayedRegionIndex) ?? ''
    let group = refGroups.get(key)
    if (!group) {
      group = []
      refGroups.set(key, group)
    }
    group.push([displayedRegionIndex, data])
  }

  for (const [, regions] of refGroups) {
    const { layoutMap, layoutHeights } = packRef(
      regions,
      bpPerPx,
      showLabels,
      showDescriptions,
      labelFontSize,
    )
    for (const [, data] of regions) {
      applyLayoutToRegion(data, layoutMap, layoutHeights)
    }
  }

  return out
}

function cloneMutableFields(raw: FeatureDataResult): FeatureDataResult {
  const floatingLabelsData: Record<string, FeatureLabelData> = {}
  for (const [k, v] of Object.entries(raw.floatingLabelsData)) {
    floatingLabelsData[k] = { ...v }
  }
  return {
    ...raw,
    rectYs: new Float32Array(raw.rectYs),
    lineYs: new Float32Array(raw.lineYs),
    arrowYs: new Float32Array(raw.arrowYs),
    flatbushItems: raw.flatbushItems.map(item => ({ ...item })),
    subfeatureInfos: raw.subfeatureInfos.map(info => ({ ...info })),
    floatingLabelsData,
    aminoAcidOverlay: raw.aminoAcidOverlay?.map(aa => ({ ...aa })),
  }
}

function packRef(
  regions: [number, FeatureDataResult][],
  bpPerPx: number,
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontSize: number,
) {
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
      const widthPx = reservedLabelWidthPx(
        labelData,
        showLabels,
        showDescriptions,
      )
      const existing = labelInfoByFeatureId.get(targetId)
      if (existing) {
        if (labelData.nameLabel) {
          existing.hasName = true
        }
        if (labelData.descriptionLabel) {
          existing.hasDescription = true
        }
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

  interface FeatureExtent {
    startBp: number
    layoutEndBp: number
    height: number
    strand: number
  }
  const allFeatures = new Map<string, FeatureExtent>()
  for (const [, data] of regions) {
    for (const item of data.flatbushItems) {
      if (allFeatures.has(item.featureId)) {
        continue
      }
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
        const labelEndBp = item.startBp + labelInfo.maxLabelWidthPx * bpPerPx
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

  return { layoutMap, layoutHeights }
}

// Mutates the cloned region in place. Raw data has topPx=0 everywhere, so we
// simply add the per-feature offset rather than computing a delta from the
// previous layout. Callers must pass the clone produced by cloneMutableFields.
function applyLayoutToRegion(
  data: FeatureDataResult,
  layoutMap: Map<string, number>,
  layoutHeights: Map<string, number>,
) {
  const featureOffsets = new Float32Array(data.flatbushItems.length)
  for (let i = 0; i < data.flatbushItems.length; i++) {
    featureOffsets[i] = layoutMap.get(data.flatbushItems[i]!.featureId) ?? 0
  }

  for (let i = 0; i < data.rectYs.length; i++) {
    data.rectYs[i] =
      data.rectYs[i]! + featureOffsets[data.rectFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.lineYs.length; i++) {
    data.lineYs[i] =
      data.lineYs[i]! + featureOffsets[data.lineFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.arrowYs.length; i++) {
    data.arrowYs[i] =
      data.arrowYs[i]! + featureOffsets[data.arrowFeatureIndices[i]!]!
  }

  for (let i = 0; i < data.flatbushItems.length; i++) {
    const item = data.flatbushItems[i]!
    const offset = featureOffsets[i]!
    const height = layoutHeights.get(item.featureId) ?? item.featureHeightPx
    item.topPx = offset
    item.bottomPx = offset + height
  }

  for (const info of data.subfeatureInfos) {
    const offset = layoutMap.get(info.parentFeatureId) ?? 0
    info.topPx += offset
    info.bottomPx += offset
  }

  for (const labelData of Object.values(data.floatingLabelsData)) {
    const key = labelData.parentFeatureId ?? labelData.featureId
    labelData.topY += layoutMap.get(key) ?? 0
  }

  if (data.aminoAcidOverlay) {
    for (const aa of data.aminoAcidOverlay) {
      aa.topPx += featureOffsets[aa.flatbushIdx]!
    }
  }
}
