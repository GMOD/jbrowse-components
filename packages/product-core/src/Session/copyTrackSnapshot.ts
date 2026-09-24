import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

type TrackCopySnapshot = {
  trackId: string
  name?: string
  category?: unknown
  displays?: { type: string; displayId: string }[]
} & Record<string, unknown>

/**
 * Clone a track config for "Copy track": snapshots the config, appends a unique
 * timestamp suffix to trackId (so it doesn't collide with the original), tags
 * " (copy)" on the name, and regenerates each displayId to the canonical
 * `${trackId}-${type}` form baseTrackConfig auto-injects — keeping them unique
 * (displayId is a types.identifier, so a collision would crash MST).
 */
export function copyTrackSnapshot(
  config: BaseTrackConfig,
  opts: { clearCategory: boolean },
): TrackCopySnapshot {
  const snap = structuredClone(
    isStateTreeNode(config) ? getSnapshot(config) : config,
  ) as TrackCopySnapshot
  snap.name = `${snap.name || snap.trackId} (copy)`
  snap.trackId += `-${Date.now()}`
  if (opts.clearCategory) {
    snap.category = undefined
  }
  for (const d of snap.displays ?? []) {
    d.displayId = `${snap.trackId}-${d.type}`
  }
  return snap
}
