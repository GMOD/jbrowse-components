import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'

type TrackCopySnapshot = {
  trackId: string
  name?: string
  category?: unknown
  displays?: { type: string; displayId: string }[]
} & Record<string, unknown>

let copyCounter = 0

/**
 * Clone a track config for "Copy track": snapshots the config, appends a unique
 * timestamp-and-counter suffix to trackId (so it doesn't collide with the
 * original, or with another copy made in the same millisecond), tags
 * " (copy)" on the name, and regenerates each displayId to the canonical
 * `${trackId}-${type}` form baseTrackConfig auto-injects — keeping them unique
 * (displayId is a types.identifier, so a collision would crash MST).
 */
export function copyTrackSnapshot(
  config: AnyTrackConfig,
  opts: { clearCategory: boolean },
): TrackCopySnapshot {
  const snap = structuredClone(
    isStateTreeNode(config) ? getSnapshot(config) : config,
  ) as TrackCopySnapshot
  snap.name = `${snap.name || snap.trackId} (copy)`
  snap.trackId += `-${Date.now()}-${copyCounter++}`
  if (opts.clearCategory) {
    snap.category = undefined
  }
  for (const d of snap.displays ?? []) {
    d.displayId = `${snap.trackId}-${d.type}`
  }
  return snap
}
