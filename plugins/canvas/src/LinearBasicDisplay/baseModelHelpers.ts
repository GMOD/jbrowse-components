// Pure data helpers for the LinearBasicDisplay model chain — no menus, no
// session, nothing another display composes.
//
// That last part is what the file is now for. It used to also hold
// `screenDensity` and `fetchCanvasFeatureDetails`, which are used by BOTH canvas
// displays and by `CanvasFeatureGateMixin` — so `shared/` imported out of a
// single display's directory, and the multi-row display reached into
// LinearBasicDisplay for a fetch helper. Both now live in `shared/`, where a
// thing two displays need belongs.

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

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
