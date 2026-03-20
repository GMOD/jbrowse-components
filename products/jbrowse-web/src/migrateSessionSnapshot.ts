/**
 * Migrates old session and config snapshots to be compatible with the current
 * display type registrations. Handles display types that were removed or
 * renamed in the webgl-poc branch.
 *
 * Remapped display types:
 *   LinearPileupDisplay → LinearAlignmentsDisplay
 *   LinearSNPCoverageDisplay → LinearAlignmentsDisplay
 *   LinearReadArcsDisplay → LinearAlignmentsDisplay
 *   LinearReadCloudDisplay → LinearAlignmentsDisplay
 */

const displayTypeMap: Record<string, string> = {
  LinearPileupDisplay: 'LinearAlignmentsDisplay',
  LinearSNPCoverageDisplay: 'LinearAlignmentsDisplay',
  LinearReadArcsDisplay: 'LinearAlignmentsDisplay',
  LinearReadCloudDisplay: 'LinearAlignmentsDisplay',
}

function migrateDisplaySnapshot(display: Record<string, unknown>) {
  const oldType = display.type as string
  const newType = displayTypeMap[oldType]
  if (!newType) {
    return display
  }
  return { ...display, type: newType }
}

function migrateDisplaysArray(displays: unknown[]) {
  let changed = false
  const result = displays.map(d => {
    if (d && typeof d === 'object' && 'type' in d) {
      const migrated = migrateDisplaySnapshot(d as Record<string, unknown>)
      if (migrated !== d) {
        changed = true
      }
      return migrated
    }
    return d
  })
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return changed ? result : displays
}

function migrateTrackSnapshot(track: unknown): unknown {
  if (!track || typeof track !== 'object') {
    return track
  }
  const t = track as Record<string, unknown>
  let changed = false
  const result = { ...t }

  const displays = t.displays as unknown[] | undefined
  if (Array.isArray(displays)) {
    const newDisplays = migrateDisplaysArray(displays)
    if (newDisplays !== displays) {
      changed = true
      result.displays = newDisplays
    }
  }

  return changed ? result : track
}

function migrateViewSnapshot(
  view: Record<string, unknown>,
): Record<string, unknown> {
  let changed = false
  const result = { ...view }

  const tracks = view.tracks as unknown[] | undefined
  if (Array.isArray(tracks)) {
    const newTracks = tracks.map(t => migrateTrackSnapshot(t))
    if (newTracks.some((t, i) => t !== tracks[i])) {
      changed = true
      result.tracks = newTracks
    }
  }

  // Handle nested views (e.g. LinearSyntenyView has sub-views)
  const subViews = view.views as unknown[] | undefined
  if (Array.isArray(subViews)) {
    const newSubViews = subViews.map(sv => {
      if (sv && typeof sv === 'object') {
        return migrateViewSnapshot(sv as Record<string, unknown>)
      }
      return sv
    })
    if (newSubViews.some((v, i) => v !== subViews[i])) {
      changed = true
      result.views = newSubViews
    }
  }

  return changed ? result : view
}

/**
 * Walks a session snapshot and remaps old display types to their new names.
 * Handles displays nested inside views, tracks, and sessionTracks.
 */
export function migrateSessionSnapshot(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  let changed = false
  const result = { ...snapshot }

  const views = snapshot.views as unknown[] | undefined
  if (Array.isArray(views)) {
    const newViews = views.map(view => {
      if (!view || typeof view !== 'object') {
        return view
      }
      return migrateViewSnapshot(view as Record<string, unknown>)
    })
    if (newViews.some((v, i) => v !== views[i])) {
      changed = true
      result.views = newViews
    }
  }

  const sessionTracks = snapshot.sessionTracks as unknown[] | undefined
  if (Array.isArray(sessionTracks)) {
    const newTracks = sessionTracks.map(t => migrateTrackSnapshot(t))
    if (newTracks.some((t, i) => t !== sessionTracks[i])) {
      changed = true
      result.sessionTracks = newTracks
    }
  }

  return changed ? result : snapshot
}

/**
 * Walks a config snapshot and remaps old display types in track definitions.
 * Config tracks have displays in their configuration (not in views).
 */
export function migrateConfigSnapshot(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const tracks = snapshot.tracks as unknown[] | undefined
  if (!Array.isArray(tracks)) {
    return snapshot
  }
  const newTracks = tracks.map(t => migrateTrackSnapshot(t))
  if (newTracks.every((t, i) => t === tracks[i])) {
    return snapshot
  }
  return { ...snapshot, tracks: newTracks }
}
