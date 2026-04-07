import Flatbush from '@jbrowse/core/util/flatbush'

import { maxLabelTextWidth } from '../../RenderFeatureDataRPC/rpcTypes.ts'

import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

export interface VisibleRegion {
  refName: string
  regionNumber: number
  start: number
  end: number
  assemblyName: string
  screenStartPx: number
  screenEndPx: number
}

export interface FlatbushRegionCache {
  featureIndex: Flatbush | null
  subfeatureIndex: Flatbush | null
  cachedItems: FlatbushItem[] | null
  cachedSubInfos: SubfeatureInfo[] | null
  cachedShowDescriptions?: boolean
}

export type HitResult =
  | { feature: null; subfeature: null }
  | {
      feature: FlatbushItem
      subfeature: SubfeatureInfo | null
      regionNumber: number
    }

function buildFeatureIndex(
  items: FlatbushItem[],
  floatingLabelsData: FeatureDataResult['floatingLabelsData'],
  bpPerPx: number,
  reversed: boolean,
  showDescriptions: boolean,
) {
  const index = new Flatbush(items.length)
  for (const item of items) {
    let hitStartBp = item.startBp
    let hitEndBp = item.endBp
    const labelData = floatingLabelsData[item.featureId]
    if (labelData) {
      const maxLabelWidthPx = maxLabelTextWidth(labelData, showDescriptions)
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

function getOrCreateFlatbushIndexes(
  cache: FlatbushRegionCache,
  data: FeatureDataResult,
  bpPerPx: number,
  reversed: boolean,
  showDescriptions: boolean,
) {
  if (
    cache.cachedItems !== data.flatbushItems ||
    cache.cachedShowDescriptions !== showDescriptions
  ) {
    cache.cachedItems = data.flatbushItems
    cache.cachedShowDescriptions = showDescriptions
    cache.featureIndex =
      data.flatbushItems.length > 0
        ? buildFeatureIndex(
            data.flatbushItems,
            data.floatingLabelsData,
            bpPerPx,
            reversed,
            showDescriptions,
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
  showDescriptions: boolean,
  debug: boolean,
) {
  let feature: FlatbushItem | null = null
  let subfeature: SubfeatureInfo | null = null

  const { featureIndex, subfeatureIndex } = getOrCreateFlatbushIndexes(
    cache,
    data,
    bpPerPx,
    reversed,
    showDescriptions,
  )

  if (debug) {
    console.log('[HitTest] performHitDetection bpPos=', bpPos, 'yPos=', yPos, 'numItems=', data.flatbushItems.length, 'numSub=', data.subfeatureInfos.length, 'hasFeatureIndex=', !!featureIndex, 'hasSubIndex=', !!subfeatureIndex)
  }

  if (subfeatureIndex) {
    const subHits = subfeatureIndex.search(bpPos, yPos, bpPos, yPos)
    if (debug) {
      console.log('[HitTest] subfeature hits:', subHits.length)
    }
    for (const idx of subHits) {
      const info = data.subfeatureInfos[idx]
      if (info) {
        subfeature = info
        break
      }
    }
  }

  if (featureIndex) {
    const hits = featureIndex.search(bpPos, yPos, bpPos, yPos)
    if (debug) {
      console.log('[HitTest] feature hits:', hits.length, 'first few items bounds:', data.flatbushItems.slice(0, 3).map(i => ({ id: i.featureId, startBp: i.startBp, endBp: i.endBp, topPx: i.topPx, bottomPx: i.bottomPx })))
    }
    for (const idx of hits) {
      const item = data.flatbushItems[idx]
      if (item) {
        feature = item
        break
      }
    }
  }

  if (debug) {
    console.log('[HitTest] result: feature=', feature?.featureId ?? null, 'subfeature=', subfeature?.featureId ?? null)
  }
  return { feature, subfeature }
}

export function performMultiRegionHitDetection(
  cacheMap: Map<number, FlatbushRegionCache>,
  rpcDataMap: Map<number, FeatureDataResult>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
  showDescriptions: boolean,
  debug = false,
): HitResult {
  if (debug) {
    console.log('[HitTest] performMultiRegionHitDetection mouseXPx=', mouseXPx, 'yPos=', yPos, 'numRegions=', visibleRegions.length, 'rpcDataMapSize=', rpcDataMap.size)
  }
  for (const vr of visibleRegions) {
    if (debug) {
      console.log('[HitTest] region', vr.regionNumber, 'screenStartPx=', vr.screenStartPx, 'screenEndPx=', vr.screenEndPx, 'start=', vr.start, 'end=', vr.end, 'refName=', vr.refName)
    }
    if (mouseXPx < vr.screenStartPx || mouseXPx > vr.screenEndPx) {
      if (debug) {
        console.log('[HitTest] mouseX outside region bounds, skipping')
      }
      continue
    }
    const data = rpcDataMap.get(vr.regionNumber)
    if (!data) {
      if (debug) {
        console.log('[HitTest] no rpcData for region', vr.regionNumber)
      }
      continue
    }
    let cache = cacheMap.get(vr.regionNumber)
    if (!cache) {
      cache = {
        featureIndex: null,
        subfeatureIndex: null,
        cachedItems: null,
        cachedSubInfos: null,
      }
      cacheMap.set(vr.regionNumber, cache)
    }

    const blockWidth = vr.screenEndPx - vr.screenStartPx
    const bpPerPx = (vr.end - vr.start) / blockWidth
    const reversed = vr.start > vr.end
    const bpPos = vr.start + (mouseXPx - vr.screenStartPx) * bpPerPx

    const { feature, subfeature } = performHitDetection(
      cache,
      data,
      bpPerPx,
      reversed,
      bpPos,
      yPos,
      showDescriptions,
      debug,
    )

    if (feature) {
      return { feature, subfeature, regionNumber: vr.regionNumber }
    }
    return { feature: null, subfeature: null }
  }
  return { feature: null, subfeature: null }
}
