import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  DisplayEntry,
  DisplayType,
  RetiredDisplayType,
} from '@jbrowse/core/pluggableElementTypes'

/**
 * Loads an old session's display instances as the displays this build
 * registers, reading what each DisplayType declares: a `retiredTypes` entry
 * renames the instance and supplies the settings its old picture needs, and
 * `retiredState` lifts the props an old instance carried that are config slots
 * now. Every display also gets `heightPreConfig`, the per-instance height
 * before `height` was a slot.
 *
 * An instance holds no config, so what it lifts is written into the config it
 * points at: a `sessionTracks` entry in place, or a `trackConfigDeltas` entry
 * for a track whose base is the config.json. Config nodes need nothing here;
 * the track config's own preprocessor loads a retired type wherever one
 * hydrates.
 */

interface Resolved {
  display: DisplayType
  retired?: RetiredDisplayType
}

type Resolve = (type: unknown) => Resolved | undefined

function resolverFor(pluginManager: PluginManager): Resolve {
  const byName = new Map<string, Resolved>()
  for (const display of pluginManager.getDisplayElements()) {
    byName.set(display.name, { display })
    for (const retired of display.retiredTypes) {
      byName.set(retired.type, { display, retired })
    }
  }
  return type => (typeof type === 'string' ? byName.get(type) : undefined)
}

/**
 * Every display-instance key an old session may carry and have honoured, by
 * display type, `*` for any display, so `jbrowse validate` reports one as
 * stale rather than dead.
 */
export function migratedDisplayInstanceKeys(pluginManager: PluginManager) {
  return {
    '*': ['heightPreConfig'],
    ...Object.fromEntries(
      pluginManager
        .getDisplayElements()
        .flatMap(d =>
          d.retiredState ? [[d.name, [...d.retiredState.keys]]] : [],
        ),
    ),
  } as Record<string, string[]>
}

interface ExtractedDisplaySettings {
  trackConfigId: string
  displayId: string
  displayType: string
  settings: DisplayEntry
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function migrateDisplay(
  display: Record<string, unknown>,
  trackConfigId: string | undefined,
  resolve: Resolve,
  collected: ExtractedDisplaySettings[],
) {
  const resolved = resolve(display.type)
  if (!resolved) {
    return display
  }
  const { display: displayType, retired } = resolved
  const state = displayType.retiredState
  const shed = ['heightPreConfig', ...(state?.keys ?? [])].filter(
    k => k in display,
  )
  if (!retired && shed.length === 0) {
    return display
  }
  const { configuration } = display
  if (typeof configuration !== 'string') {
    return { ...display, type: displayType.name }
  }
  const lifted: DisplayEntry = {
    ...state?.lift(display),
    ...(typeof display.heightPreConfig === 'number'
      ? { height: display.heightPreConfig }
      : {}),
  }
  const migrated = retired?.migrate?.(lifted) ?? lifted
  const settings = displayType.retiredConfig?.(migrated) ?? migrated
  const displayId =
    retired && configuration === `${trackConfigId}-${retired.type}`
      ? `${trackConfigId}-${displayType.name}`
      : configuration
  if (trackConfigId && Object.keys(settings).length > 0) {
    collected.push({
      trackConfigId,
      displayId,
      displayType: displayType.name,
      settings,
    })
  }
  const rest = { ...display }
  for (const key of shed) {
    delete rest[key]
  }
  return { ...rest, type: displayType.name, configuration: displayId }
}

function migrateTrack(
  track: unknown,
  resolve: Resolve,
  collected: ExtractedDisplaySettings[],
): unknown {
  if (!isObject(track) || !Array.isArray(track.displays)) {
    return track
  }
  const trackConfigId =
    typeof track.configuration === 'string' ? track.configuration : undefined
  const displays = track.displays as unknown[]
  const next = displays.map(d =>
    isObject(d) ? migrateDisplay(d, trackConfigId, resolve, collected) : d,
  )
  return next.some((d, i) => d !== displays[i])
    ? { ...track, displays: next }
    : track
}

function migrateView(
  view: Record<string, unknown>,
  resolve: Resolve,
  collected: ExtractedDisplaySettings[],
): Record<string, unknown> {
  let result = view
  const { tracks, views } = view
  if (Array.isArray(tracks)) {
    const next = tracks.map(t => migrateTrack(t, resolve, collected))
    if (next.some((t, i) => t !== tracks[i])) {
      result = { ...result, tracks: next }
    }
  }
  // a synteny view's panels are views of their own
  if (Array.isArray(views)) {
    const next = views.map(v =>
      isObject(v) ? migrateView(v, resolve, collected) : v,
    )
    if (next.some((v, i) => v !== views[i])) {
      result = { ...result, views: next }
    }
  }
  return result
}

// The entry the settings belong to is the one under their id, else the one
// whose type loads as the same display: a session track still spelling the
// retired type holds it under the retired type's id.
function mergeSettingsIntoTrackConfig(
  track: Record<string, unknown>,
  { displayId, displayType, settings }: ExtractedDisplaySettings,
  resolve: Resolve,
): Record<string, unknown> {
  const list = Array.isArray(track.displays)
    ? (track.displays as unknown[])
    : []
  const index = [
    (d: unknown) => isObject(d) && d.displayId === displayId,
    (d: unknown) =>
      isObject(d) && resolve(d.type)?.display.name === displayType,
  ]
    .map(matches => list.findIndex(matches))
    .find(i => i !== -1)
  const displays =
    index === undefined
      ? [...list, { type: displayType, displayId, ...settings }]
      : list.map((d, i) =>
          i === index ? { ...(d as object), ...settings } : d,
        )
  return { ...track, displays }
}

function applyExtractedSettings(
  snapshot: Record<string, unknown>,
  collected: ExtractedDisplaySettings[],
  resolve: Resolve,
): Record<string, unknown> {
  if (collected.length === 0) {
    return snapshot
  }
  const sessionTracks = Array.isArray(snapshot.sessionTracks)
    ? [...(snapshot.sessionTracks as unknown[])]
    : []
  const sessionTrackIndex = new Map(
    sessionTracks.map((t, i) => [isObject(t) ? t.trackId : undefined, i]),
  )
  const deltas: Record<string, unknown> = isObject(snapshot.trackConfigDeltas)
    ? { ...snapshot.trackConfigDeltas }
    : {}
  let sessionTracksChanged = false
  let deltasChanged = false
  for (const extracted of collected) {
    const { trackConfigId } = extracted
    const index = sessionTrackIndex.get(trackConfigId)
    const sessionTrack = index === undefined ? undefined : sessionTracks[index]
    if (index !== undefined && isObject(sessionTrack)) {
      sessionTracks[index] = mergeSettingsIntoTrackConfig(
        sessionTrack,
        extracted,
        resolve,
      )
      sessionTracksChanged = true
    } else {
      const existing = deltas[trackConfigId]
      deltas[trackConfigId] = mergeSettingsIntoTrackConfig(
        isObject(existing) ? existing : { trackId: trackConfigId },
        extracted,
        resolve,
      )
      deltasChanged = true
    }
  }
  return {
    ...snapshot,
    ...(sessionTracksChanged ? { sessionTracks } : {}),
    ...(deltasChanged ? { trackConfigDeltas: deltas } : {}),
  }
}

/**
 * Returns the snapshot by identity when nothing in it is retired, which is
 * every session this build wrote.
 */
export function migrateSessionSnapshot(
  snapshot: Record<string, unknown>,
  pluginManager: PluginManager,
): Record<string, unknown> {
  const { views } = snapshot
  if (!Array.isArray(views)) {
    return snapshot
  }
  const resolve = resolverFor(pluginManager)
  const collected: ExtractedDisplaySettings[] = []
  const next = views.map(view =>
    isObject(view) ? migrateView(view, resolve, collected) : view,
  )
  const result = next.some((v, i) => v !== views[i])
    ? { ...snapshot, views: next }
    : snapshot
  return applyExtractedSettings(result, collected, resolve)
}
