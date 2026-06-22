import { SimpleFeature } from '@jbrowse/core/util'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature, Region } from '@jbrowse/core/util'

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

// A "Show..."/track-menu submenu of mutually-exclusive radio options. Keeps the
// call sites declarative (just the option data) instead of repeating the
// checked/onClick mapping at each menu.
export function radioSubMenu<T extends string>(
  label: string,
  current: T,
  options: readonly { value: T; label: string }[],
  onSelect: (value: T) => void,
) {
  return {
    label,
    subMenu: options.map(option => ({
      label: option.label,
      type: 'radio' as const,
      checked: current === option.value,
      onClick: () => {
        onSelect(option.value)
      },
    })),
  }
}

// Per-region density sample written after each fetch. featureCount comes from
// the worker; regionWidthBp is derived locally from the request's region.
export interface RegionDensityStats {
  featureCount: number
  regionWidthBp: number
}

// Features-per-pixel for a single region given its raw count, the region's
// genomic span, and the current bpPerPx. Used by the derived regionTooLarge
// banner and by force-load to sample observed density.
export function screenDensity(ds: RegionDensityStats, bpPerPx: number) {
  return (ds.featureCount / ds.regionWidthBp) * bpPerPx
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
