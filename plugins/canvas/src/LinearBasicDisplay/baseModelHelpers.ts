import { radioItems } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'

import { featuresPerPx } from '../RenderFeatureDataRPC/densityGate.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature, Region } from '@jbrowse/core/util'

// Add id if absent, remove it if present — the shared body of the pin/solo
// feature-toggle actions. Structural param so any observable string array fits.
export function toggleArrayMember(
  arr: {
    indexOf: (v: string) => number
    push: (v: string) => unknown
    splice: (start: number, deleteCount: number) => unknown
  },
  id: string,
) {
  const idx = arr.indexOf(id)
  if (idx === -1) {
    arr.push(id)
  } else {
    arr.splice(idx, 1)
  }
}

export function findSubfeatureById(
  feature: Feature,
  targetId: string,
): Feature | undefined {
  const subfeatures = feature.get('subfeatures')
  if (subfeatures) {
    for (const sub of subfeatures) {
      if (sub.id() === targetId) {
        return sub
      }
      const found = findSubfeatureById(sub, targetId)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

export async function fetchCanvasFeatureDetails(
  session: {
    rpcManager: RpcManager
    notifyError: (msg: string, err?: unknown) => void
  },
  sessionId: string,
  adapterConfig: Record<string, unknown>,
  featureId: string,
  region: Region,
) {
  try {
    const result = await session.rpcManager.call(
      sessionId,
      'GetCanvasFeatureDetails',
      { adapterConfig, featureId, region },
    )
    return result.feature ? new SimpleFeature(result.feature) : undefined
  } catch (e) {
    console.error('Failed to fetch feature details:', e)
    session.notifyError(`${e}`, e)
    return undefined
  }
}

// A named group of mutually-exclusive radio options rendered inline: a
// subHeader followed by the radios, so a settings menu reads as one flat list
// of checkboxes/radios instead of nesting a submenu the user has to hover into.
// The rows come from core's `radioItems` rather than being spelled out here, so
// every radio in every canvas menu keeps the menu open on click — a hand-rolled
// copy is how the "Gene glyph" submenu ended up dismissing the whole track menu
// while its siblings stayed put.
export function inlineRadioGroup<T extends string>(
  header: string,
  current: T,
  options: readonly { value: T; label: string }[],
  onSelect: (value: T) => void,
): MenuItem[] {
  return [
    { type: 'subHeader' as const, label: header },
    ...radioItems(options, current, onSelect),
  ]
}

// Per-region density sample written after each fetch. featureCount comes from
// the worker; regionWidthBp is derived locally from the request's region.
export interface RegionDensityStats {
  featureCount: number
  regionWidthBp: number
}

// Features-per-pixel for a single region given its raw count, the region's
// genomic span, and the current bpPerPx. Used by the derived regionTooLarge
// banner and by force-load to sample observed density. Delegates to the same
// `featuresPerPx` the worker's gate uses: main thread and worker must agree on
// the number, or the banner contradicts the short-circuit that produced it.
export function screenDensity(ds: RegionDensityStats, bpPerPx: number) {
  return ds.regionWidthBp > 0
    ? featuresPerPx(
        ds.featureCount,
        { start: 0, end: ds.regionWidthBp },
        bpPerPx,
      )
    : 0
}

// First-wins index from per-region arrays. Spanning features can appear in
// multiple regions; we keep the first occurrence so consumers (hover lookup,
// selection, label resolution) get a single, stable item per featureId.
export function indexById<T extends { featureId: string }>(
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>,
  pick: (data: FeatureDataResult) => readonly T[],
) {
  const map = new Map<string, T>()
  for (const data of laidOutDataMap.values()) {
    for (const item of pick(data)) {
      if (!map.has(item.featureId)) {
        map.set(item.featureId, item)
      }
    }
  }
  return map
}
