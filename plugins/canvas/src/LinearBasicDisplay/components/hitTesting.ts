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

export interface FlatbushRegionCache {
  featureIndex: Flatbush | null
  subfeatureIndex: Flatbush | null
  cachedItems: FlatbushItem[] | null
  cachedSubInfos: SubfeatureInfo[] | null
  cachedLabelVisibility?: LabelVisibility
  cachedBpPerPx?: number
  cachedReversed?: boolean
}

export type HitResult =
  | { feature: null; subfeature: null }
  | {
      feature: FlatbushItem
      subfeature: SubfeatureInfo | null
      displayedRegionIndex: number
    }

function buildFeatureIndex(
  items: FlatbushItem[],
  floatingLabelsData: FeatureDataResult['floatingLabelsData'],
  bpPerPx: number,
  reversed: boolean,
  labels: LabelVisibility,
) {
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

function buildSubfeatureIndex(infos: SubfeatureInfo[]) {
  const index = new Flatbush(infos.length)
  for (const item of infos) {
    index.add(item.startBp, item.topPx, item.endBp, item.bottomPx)
  }
  index.finish()
  return index
}

function labelVisibilityChanged(
  a: LabelVisibility | undefined,
  b: LabelVisibility,
) {
  return (
    a?.showLabels !== b.showLabels || a.showDescriptions !== b.showDescriptions
  )
}

function getOrCreateFlatbushIndexes(
  cache: FlatbushRegionCache,
  data: FeatureDataResult,
  bpPerPx: number,
  reversed: boolean,
  labels: LabelVisibility,
) {
  if (
    cache.cachedItems !== data.flatbushItems ||
    labelVisibilityChanged(cache.cachedLabelVisibility, labels) ||
    cache.cachedBpPerPx !== bpPerPx ||
    cache.cachedReversed !== reversed
  ) {
    cache.cachedItems = data.flatbushItems
    cache.cachedLabelVisibility = labels
    cache.cachedBpPerPx = bpPerPx
    cache.cachedReversed = reversed
    cache.featureIndex =
      data.flatbushItems.length > 0
        ? buildFeatureIndex(
            data.flatbushItems,
            data.floatingLabelsData,
            bpPerPx,
            reversed,
            labels,
          )
        : null
  }

  if (cache.cachedSubInfos !== data.subfeatureInfos) {
    cache.cachedSubInfos = data.subfeatureInfos
    cache.subfeatureIndex =
      data.subfeatureInfos.length > 0
        ? buildSubfeatureIndex(data.subfeatureInfos)
        : null
  }

  return {
    featureIndex: cache.featureIndex,
    subfeatureIndex: cache.subfeatureIndex,
  }
}

function performHitDetection(
  cache: FlatbushRegionCache,
  data: FeatureDataResult,
  bpPerPx: number,
  reversed: boolean,
  bpPos: number,
  yPos: number,
  labels: LabelVisibility,
) {
  let feature: FlatbushItem | null = null
  let subfeature: SubfeatureInfo | null = null

  const { featureIndex, subfeatureIndex } = getOrCreateFlatbushIndexes(
    cache,
    data,
    bpPerPx,
    reversed,
    labels,
  )

  if (subfeatureIndex) {
    const idx = subfeatureIndex.search(bpPos, yPos, bpPos, yPos)[0]
    if (idx !== undefined) {
      subfeature = data.subfeatureInfos[idx]!
    }
  }

  if (featureIndex) {
    const idx = featureIndex.search(bpPos, yPos, bpPos, yPos)[0]
    if (idx !== undefined) {
      feature = data.flatbushItems[idx]!
    }
  }

  return { feature, subfeature }
}

export function performMultiRegionHitDetection(
  cacheMap: Map<number, FlatbushRegionCache>,
  laidOutDataMap: Map<number, FeatureDataResult>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
  labels: LabelVisibility,
): HitResult {
  for (const vr of visibleRegions) {
    if (mouseXPx < vr.screenStartPx || mouseXPx > vr.screenEndPx) {
      continue
    }
    const data = laidOutDataMap.get(vr.displayedRegionIndex)
    if (!data) {
      continue
    }
    let cache = cacheMap.get(vr.displayedRegionIndex)
    if (!cache) {
      cache = {
        featureIndex: null,
        subfeatureIndex: null,
        cachedItems: null,
        cachedSubInfos: null,
      }
      cacheMap.set(vr.displayedRegionIndex, cache)
    }

    const blockWidth = vr.screenEndPx - vr.screenStartPx
    const bpPerPx = (vr.end - vr.start) / blockWidth
    const reversed = vr.reversed ?? false
    const frac = (mouseXPx - vr.screenStartPx) / blockWidth
    const bpPos = reversed
      ? vr.end - frac * (vr.end - vr.start)
      : vr.start + frac * (vr.end - vr.start)

    const { feature, subfeature } = performHitDetection(
      cache,
      data,
      bpPerPx,
      reversed,
      bpPos,
      yPos,
      labels,
    )

    if (feature) {
      return {
        feature,
        subfeature,
        displayedRegionIndex: vr.displayedRegionIndex,
      }
    }
  }
  return { feature: null, subfeature: null }
}
