import { isTrackRecipe } from '@jbrowse/core/util/withLaunchInput'
import { liftSyntenyViewSettings } from '@jbrowse/synteny-core'

type Snap = Record<string, unknown>

function isBuiltTrack(entry: unknown): entry is Snap {
  return (
    !!entry &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    !isTrackRecipe(entry)
  )
}

/**
 * A session written before levels held their tracks puts the built synteny
 * tracks on the view itself. v4.3.0 read that list as level 0's; the launch key
 * `tracks` takes recipes only, so without this the view opens on "No tracks
 * active".
 */
export function liftViewLevelTracks(snap: Snap | undefined) {
  if (!snap || snap.levels !== undefined || !Array.isArray(snap.tracks)) {
    return snap
  }
  const built = snap.tracks.filter(isBuiltTrack)
  if (!built.length) {
    return snap
  }
  const { tracks, ...rest } = snap
  const recipes = (tracks as unknown[]).filter(t => !isBuiltTrack(t))
  return {
    ...rest,
    ...(recipes.length ? { tracks: recipes } : {}),
    levels: [{ level: 0, tracks: built }],
  }
}

/** Every v4.3.0 spelling the linear synteny view still reads. */
export function liftLegacySyntenyView(snap: Snap | undefined) {
  return liftViewLevelTracks(liftSyntenyViewSettings(snap))
}
