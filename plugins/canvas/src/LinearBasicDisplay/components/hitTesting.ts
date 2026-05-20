import Flatbush from '@jbrowse/core/util/flatbush'

import { maxLabelTextWidth } from '../../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

export interface VisibleRegion {
  refName: string
  displayedRegionIndex: number
  start: number
  end: number
  reversed?: boolean
  assemblyName: string
  screenStartPx: number
  screenEndPx: number
}

export interface LabelVisibility {
  showLabels: boolean
  showDescriptions: boolean
}

export interface FlatbushRegionIndexes {
  feature: Flatbush | null
  subfeature: Flatbush | null
}

type HitResult =
  | { feature: null; subfeature: null }
  | {
      feature: FlatbushItem
      subfeature: SubfeatureInfo | null
      displayedRegionIndex: number
    }

export function buildFeatureFlatbushIndex(
  items: FlatbushItem[],
  floatingLabelsData: FeatureDataResult['floatingLabelsData'],
  bpPerPx: number,
  reversed: boolean,
  labels: LabelVisibility,
): Flatbush | null {
  if (items.length === 0) {
    return null
  }
  const index = new Flatbush(items.length)
  for (const item of items) {
    let hitStartBp = item.startBp
    let hitEndBp = item.endBp
    const labelData = floatingLabelsData[item.featureId]
    if (labelData) {
      const maxLabelWidthPx = maxLabelTextWidth(
        labelData,
        labels.showLabels,
        labels.showDescriptions,
      )
      const featureWidthPx = (item.endBp - item.startBp) / bpPerPx
      if (maxLabelWidthPx > featureWidthPx) {
        const extraBp = (maxLabelWidthPx - featureWidthPx) * bpPerPx
        if (reversed) {
          hitStartBp -= extraBp
        } else {
          hitEndBp += extraBp
        }
      }
    }
    index.add(hitStartBp, item.topPx, hitEndBp, item.bottomPx)
  }
  index.finish()
  return index
}

export function buildSubfeatureFlatbushIndex(
  infos: SubfeatureInfo[],
): Flatbush | null {
  if (infos.length === 0) {
    return null
  }
  const index = new Flatbush(infos.length)
  for (const item of infos) {
    index.add(item.startBp, item.topPx, item.endBp, item.bottomPx)
  }
  index.finish()
  return index
}

export function performMultiRegionHitDetection(
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>,
  flatbushIndexes: ReadonlyMap<number, FlatbushRegionIndexes>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
): HitResult {
  for (const vr of visibleRegions) {
    if (mouseXPx >= vr.screenStartPx && mouseXPx <= vr.screenEndPx) {
      const data = laidOutDataMap.get(vr.displayedRegionIndex)
      const indexes = flatbushIndexes.get(vr.displayedRegionIndex)
      if (data && indexes) {
        const blockWidth = vr.screenEndPx - vr.screenStartPx
        const reversed = vr.reversed ?? false
        const frac = (mouseXPx - vr.screenStartPx) / blockWidth
        const bpSpan = vr.end - vr.start
        const bpPos = reversed
          ? vr.end - frac * bpSpan
          : vr.start + frac * bpSpan

        let subfeature: SubfeatureInfo | null = null
        if (indexes.subfeature) {
          const idx = indexes.subfeature.search(bpPos, yPos, bpPos, yPos)[0]
          if (idx !== undefined) {
            subfeature = data.subfeatureInfos[idx]!
          }
        }

        if (indexes.feature) {
          const idx = indexes.feature.search(bpPos, yPos, bpPos, yPos)[0]
          if (idx !== undefined) {
            return {
              feature: data.flatbushItems[idx]!,
              subfeature,
              displayedRegionIndex: vr.displayedRegionIndex,
            }
          }
        }
      }
    }
  }
  return { feature: null, subfeature: null }
}
