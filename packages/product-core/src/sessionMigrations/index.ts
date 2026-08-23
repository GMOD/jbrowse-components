/**
 * Migrates old session and config snapshots to be compatible with the current
 * display type registrations. Handles display types that were removed or
 * renamed in the v4 rendering rearchitecture.
 *
 * Remapped display types (see `displayTypeMap` for the band settings each one
 * carries over):
 *   LinearPileupDisplay → LinearAlignmentsDisplay
 *   LinearSNPCoverageDisplay → LinearAlignmentsDisplay
 *   LinearReadArcsDisplay → LinearAlignmentsDisplay
 *   LinearReadCloudDisplay → LinearAlignmentsDisplay
 *   LinearFeatureDisplay → LinearBasicDisplay
 *
 * Also lifts the per-instance alignments settings a v4.3.0 session persisted
 * (`colorBySetting`, `filterBySetting`, `jexlFilters`, `trackMaxHeight`,
 * `hideMismatchesSetting`) into the config where they now live as slots — off
 * the nested `LinearAlignmentsDisplay` container's `PileupDisplay` /
 * `SNPCoverageDisplay` sub-nodes and off a flat old display alike, see
 * `extractAlignmentsInstanceSettings` — and routes the legacy per-instance
 * `heightPreConfig` display-height prop onto the `height` config slot — see
 * `extractInstanceHeight`.
 */

// Each old display drew one band; the unified LinearAlignmentsDisplay draws all
// of them, so a bare type rename turns a coverage-only track into coverage +
// pileup and an arcs track into a plain pileup. `settings` restores the old
// intent through the config slots that now express it, and is applied only where
// the snapshot doesn't already carry the key, so an explicit author value wins.
const displayTypeMap: Record<
  string,
  { type: string; settings?: Record<string, unknown> }
> = {
  LinearPileupDisplay: {
    type: 'LinearAlignmentsDisplay',
    settings: { showCoverage: false },
  },
  LinearSNPCoverageDisplay: {
    type: 'LinearAlignmentsDisplay',
    // coverageHeight + height together, else the band keeps its 45px default
    // under the 250px display height and leaves 200px blank.
    settings: { showPileup: false, coverageHeight: 100, height: 100 },
  },
  LinearReadArcsDisplay: {
    type: 'LinearAlignmentsDisplay',
    settings: {
      showPileup: false,
      showCoverage: false,
      readConnections: 'arc',
    },
  },
  LinearReadCloudDisplay: {
    type: 'LinearAlignmentsDisplay',
    settings: {
      showPileup: false,
      showCoverage: false,
      readConnections: 'cloud',
    },
  },
  LinearFeatureDisplay: { type: 'LinearBasicDisplay' },
}

// The pre-4.x LinearAlignmentsDisplay was a container whose per-instance
// track-menu settings lived on nested `PileupDisplay` / `SNPCoverageDisplay`
// sub-nodes. Those settings are now config slots on the flat
// LinearAlignmentsDisplay, so the sub-nodes are dead on load — MST drops them
// and `colorBy`/`filterBy` silently revert to their config default (e.g. a
// modifications/methylation session opens colored `normal`). We pull them off
// the instance here and route them into the config.
const NESTED_ALIGNMENTS_SUBNODES = ['PileupDisplay', 'SNPCoverageDisplay']

// Persisted key -> the slot it now lives in, and how to carry its value across.
//
// The `*Setting` names are the ones a real saved session carries, and getting
// them wrong is why this migration never fired: SharedLinearPileupDisplayMixin
// (v4.3.0) declared the props as `colorBySetting`/`filterBySetting`, its
// `preProcessSnapshot` renamed an incoming bare `colorBy` to `colorBySetting`,
// and its `postProcessSnapshot` wrote that name back out — so no session
// snapshot JBrowse ever produced holds the bare form this used to look for. The
// bare names stay accepted because a hand-written snapshot may use them.
//
// `hideSmallIndelsSetting` and `hideLargeIndelsSetting` are deliberately absent:
// those two toggles have no slot today, the feature having been removed rather
// than moved, so there is nowhere to carry them.
const MIGRATED_INSTANCE_SLOTS: Record<
  string,
  { slot: string; convert?: (value: unknown) => unknown }
> = {
  colorBy: { slot: 'colorBy' },
  colorBySetting: { slot: 'colorBy' },
  filterBy: { slot: 'filterBy' },
  filterBySetting: { slot: 'filterBy' },
  jexlFilters: { slot: 'jexlFilters' },
  trackMaxHeight: { slot: 'maxHeight' },
  hideMismatchesSetting: {
    slot: 'showMismatches',
    convert: value => !value,
  },
}

/**
 * Every display-instance key a session snapshot may still carry and have
 * honored, keyed by the display type it applies to — `*` for the ones any
 * display gets. A snapshot carrying one of these loads correctly, so `jbrowse
 * validate` reports it as stale rather than dead; that command reads this map
 * (through the generated config manifest) rather than keeping a copy that could
 * drift.
 *
 * Not every entry is lifted *here*. The two multi-sample variant displays lift
 * their own `jexlFilters` in the model's `preProcessSnapshot`, because the value
 * stays on the instance (under `jexlFiltersSetting`) rather than moving to a
 * config slot, which is the only shape this module handles. What decides
 * membership is whether the key still works, not which file makes it work.
 *
 * Keyed rather than flat because the same name means different things on
 * different displays: `jexlFilters` is lifted for the alignments display and,
 * differently, for the two variant ones, while on a LinearBasicDisplay — whose
 * own prop has always been `jexlFiltersSetting` — it is simply dead, and a flat
 * list would call that one supported.
 */
export const MIGRATED_DISPLAY_INSTANCE_KEYS: Record<string, string[]> = {
  '*': ['heightPreConfig'],
  LinearAlignmentsDisplay: [
    ...Object.keys(MIGRATED_INSTANCE_SLOTS),
    ...NESTED_ALIGNMENTS_SUBNODES,
  ],
  LinearMultiSampleVariantDisplay: ['jexlFilters'],
  LinearMultiSampleVariantMatrixDisplay: ['jexlFilters'],
}

// Read the migrated settings off one node (a nested sub-node, or an old flat
// display's own snapshot), keyed by the slot they now belong to. A key present
// under both its bare and its `*Setting` spelling resolves to whichever comes
// last in MIGRATED_INSTANCE_SLOTS, which is the `*Setting` one — the spelling
// the display was actually writing.
function migratedSettingsOf(source: Record<string, unknown>) {
  const settings: Record<string, unknown> = {}
  for (const [key, { slot, convert }] of Object.entries(
    MIGRATED_INSTANCE_SLOTS,
  )) {
    if (source[key] !== undefined) {
      settings[slot] = convert ? convert(source[key]) : source[key]
    }
  }
  return settings
}

// A per-instance setting lifted off an old display, tagged with the track +
// display config it must land on. `displayType` is used only when the target
// config has no display with this id yet and one must be synthesized (so it's
// typed correctly — not every source is a LinearAlignmentsDisplay).
interface ExtractedDisplaySettings {
  trackConfigId: string
  displayId: string
  displayType?: string
  settings: Record<string, unknown>
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

// The standalone `methylation` colorBy scheme was removed; it is now the
// `modifications` scheme with `fillUnmarked` set. It is NOT rewritten here: the
// alignments model normalizes it at read time (`normalizeColorBy`, applied in
// its `colorBy` getter), which covers every persistence path — instance slot,
// session-wide promoted default, and config-file display default — so session
// migration deliberately leaves a `methylation` colorBy untouched.
function migrateDisplayType(
  display: Record<string, unknown>,
  trackConfigId: string | undefined,
  collected: ExtractedDisplaySettings[],
) {
  const entry = displayTypeMap[display.type as string]
  if (!entry) {
    return display
  }
  const missing = Object.fromEntries(
    Object.entries(entry.settings ?? {}).filter(
      ([k]) => display[k] === undefined,
    ),
  )
  // Every one of these is a config slot on the flat display, and a session
  // instance declares only `type` and `configuration` — so merging them here
  // would hand MST properties it drops on load, and the compensation would be
  // gone exactly where it is needed most: a v4 session on an admin config, which
  // is the commonest way anyone has one of these displays at all. Route them the
  // way extractInstanceHeight routes its own, into the config the instance
  // points at. A *config* display node has no `configuration` reference and
  // keeps them inline, where they are the live slots.
  const displayId = display.configuration
  if (trackConfigId && typeof displayId === 'string') {
    if (Object.keys(missing).length > 0) {
      collected.push({
        trackConfigId,
        displayId,
        displayType: entry.type,
        settings: missing,
      })
    }
    return { ...display, type: entry.type }
  }
  return { ...display, ...missing, type: entry.type }
}

/**
 * Pull the per-instance alignments settings off an old display into `collected`
 * and return the display with the dead keys stripped. The caller routes
 * `collected` into the config (see `applyExtractedSettings`); the settings can't
 * stay on the instance because they're config slots now.
 *
 * Two shapes, because v4.3.0 sessions hold both:
 *
 *   - the nested `LinearAlignmentsDisplay` container, whose settings sat on
 *     `PileupDisplay` / `SNPCoverageDisplay` sub-nodes
 *   - a flat `LinearPileupDisplay` / `LinearReadArcsDisplay` /
 *     `LinearReadCloudDisplay` / `LinearSNPCoverageDisplay`, which carried them
 *     directly — `migrateDisplayType` has already renamed it by the time this
 *     runs, so both arrive here as a LinearAlignmentsDisplay
 *
 * The display's own keys are read only when it carries a `configuration`
 * reference, i.e. only for a session instance. A *config* display node reaches
 * this same function through `migrateConfigSnapshot`, and there `colorBy` and
 * friends are the live slots — lifting them would strip a working config.
 */
function extractAlignmentsInstanceSettings(
  display: Record<string, unknown>,
  trackConfigId: string | undefined,
  collected: ExtractedDisplaySettings[],
): Record<string, unknown> {
  if (display.type !== 'LinearAlignmentsDisplay') {
    return display
  }
  const subNode = NESTED_ALIGNMENTS_SUBNODES.map(k => display[k]).find(isObject)
  // The instance's `configuration` string is the display config id the settings
  // must merge onto (`${trackId}-LinearAlignmentsDisplay`). Skip routing if it's
  // inline or the track id is unknown — nothing to key the merge on.
  const displayId = display.configuration
  const isInstance = typeof displayId === 'string'
  const ownSettings = isInstance ? migratedSettingsOf(display) : {}
  const settings = {
    ...(subNode ? migratedSettingsOf(subNode) : {}),
    ...ownSettings,
  }
  if (!subNode && Object.keys(settings).length === 0) {
    return display
  }
  if (trackConfigId && isInstance && Object.keys(settings).length > 0) {
    collected.push({
      trackConfigId,
      displayId,
      displayType: 'LinearAlignmentsDisplay',
      settings,
    })
  }
  const { PileupDisplay, SNPCoverageDisplay, ...rest } = display
  if (isInstance) {
    // Every one of these is dead on a display instance now, routed or not — MST
    // would drop them on load anyway, and leaving them makes a migrated snapshot
    // still look like it holds settings it does not.
    for (const key of Object.keys(MIGRATED_INSTANCE_SLOTS)) {
      delete rest[key]
    }
  }
  return rest
}

// Pre-v4 the display height lived in a per-instance `heightPreConfig` MST
// prop (`height = heightPreConfig ?? config-height`); the drag-resize handle
// wrote it. That prop is gone — the height is now the `height` config slot only
// — so an old session's `heightPreConfig` is silently dropped on load and the
// track snaps to the config default (e.g. the alignments 250px). Route it onto
// the display's `height` slot so saved/shared sessions keep their heights, and
// strip the dead prop. When a track shows in two panels (a synteny view's two
// LGVs share one display config), the last panel's value wins — both then render
// at one height, which is the config-slot model's intent.
function extractInstanceHeight(
  display: Record<string, unknown>,
  trackConfigId: string | undefined,
  collected: ExtractedDisplaySettings[],
): Record<string, unknown> {
  if (typeof display.heightPreConfig !== 'number') {
    return display
  }
  const displayId = display.configuration
  if (trackConfigId && typeof displayId === 'string') {
    collected.push({
      trackConfigId,
      displayId,
      displayType: typeof display.type === 'string' ? display.type : undefined,
      settings: { height: display.heightPreConfig },
    })
  }
  const { heightPreConfig, ...rest } = display
  return rest
}

function migrateDisplaySnapshot(
  display: Record<string, unknown>,
  trackConfigId: string | undefined,
  collected: ExtractedDisplaySettings[],
) {
  return extractInstanceHeight(
    extractAlignmentsInstanceSettings(
      migrateDisplayType(display, trackConfigId, collected),
      trackConfigId,
      collected,
    ),
    trackConfigId,
    collected,
  )
}

function migrateDisplaysArray(
  displays: unknown[],
  trackConfigId: string | undefined,
  collected: ExtractedDisplaySettings[],
) {
  let changed = false
  const result = displays.map(d => {
    if (isObject(d) && 'type' in d) {
      const migrated = migrateDisplaySnapshot(d, trackConfigId, collected)
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

function migrateTrackSnapshot(
  track: unknown,
  collected: ExtractedDisplaySettings[],
): unknown {
  if (!isObject(track)) {
    return track
  }
  let changed = false
  const result = { ...track }

  const displays = track.displays as unknown[] | undefined
  if (Array.isArray(displays)) {
    const trackConfigId =
      typeof track.configuration === 'string' ? track.configuration : undefined
    const newDisplays = migrateDisplaysArray(displays, trackConfigId, collected)
    if (newDisplays !== displays) {
      changed = true
      result.displays = newDisplays
    }
  }

  return changed ? result : track
}

function migrateViewSnapshot(
  view: Record<string, unknown>,
  collected: ExtractedDisplaySettings[],
): Record<string, unknown> {
  let changed = false
  const result = { ...view }

  const tracks = view.tracks as unknown[] | undefined
  if (Array.isArray(tracks)) {
    const newTracks = tracks.map(t => migrateTrackSnapshot(t, collected))
    if (newTracks.some((t, i) => t !== tracks[i])) {
      changed = true
      result.tracks = newTracks
    }
  }

  // Handle nested views (e.g. LinearSyntenyView has sub-views)
  const subViews = view.views as unknown[] | undefined
  if (Array.isArray(subViews)) {
    const newSubViews = subViews.map(sv =>
      isObject(sv) ? migrateViewSnapshot(sv, collected) : sv,
    )
    if (newSubViews.some((v, i) => v !== subViews[i])) {
      changed = true
      result.views = newSubViews
    }
  }

  return changed ? result : view
}

// Merge `settings` onto the display config carrying `displayId` inside `track`
// (an in-session track config). Returns a new track if it changed. The config
// slots win over whatever the old config held.
function mergeSettingsIntoTrackConfig(
  track: Record<string, unknown>,
  displayId: string,
  displayType: string | undefined,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const displays = track.displays
  const list = Array.isArray(displays) ? displays : []
  const hasMatch = list.some(d => isObject(d) && d.displayId === displayId)
  const newDisplays = hasMatch
    ? list.map(d =>
        isObject(d) && d.displayId === displayId ? { ...d, ...settings } : d,
      )
    : [
        ...list,
        {
          type: displayType ?? 'LinearAlignmentsDisplay',
          displayId,
          ...settings,
        },
      ]
  return { ...track, displays: newDisplays }
}

/**
 * Route each setting lifted off a nested alignments instance into the config it
 * now lives in: a user-added `sessionTracks` entry is edited in place (the
 * config is embedded there), while an admin config track — whose base lives in
 * the reloaded config file, out of reach here — gets a `trackConfigDeltas`
 * entry keyed by trackId (see product-core/src/Session/CLAUDE.md).
 */
function applyExtractedSettings(
  snapshot: Record<string, unknown>,
  collected: ExtractedDisplaySettings[],
): Record<string, unknown> {
  if (collected.length === 0) {
    return snapshot
  }
  const sessionTracks = Array.isArray(snapshot.sessionTracks)
    ? [...snapshot.sessionTracks]
    : []
  const sessionTrackIndex = new Map(
    sessionTracks.map((t, i) => [isObject(t) ? t.trackId : undefined, i]),
  )
  const deltas: Record<string, unknown> = isObject(snapshot.trackConfigDeltas)
    ? { ...snapshot.trackConfigDeltas }
    : {}
  let sessionTracksChanged = false
  let deltasChanged = false

  for (const { trackConfigId, displayId, displayType, settings } of collected) {
    const idx = sessionTrackIndex.get(trackConfigId)
    if (idx !== undefined && isObject(sessionTracks[idx])) {
      sessionTracks[idx] = mergeSettingsIntoTrackConfig(
        sessionTracks[idx],
        displayId,
        displayType,
        settings,
      )
      sessionTracksChanged = true
    } else {
      const existing = isObject(deltas[trackConfigId])
        ? deltas[trackConfigId]
        : { trackId: trackConfigId }
      deltas[trackConfigId] = mergeSettingsIntoTrackConfig(
        existing,
        displayId,
        displayType,
        settings,
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
 * Walks a session snapshot and remaps old display types to their new names.
 * Handles displays nested inside views, tracks, and sessionTracks.
 */
export function migrateSessionSnapshot(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  let changed = false
  const result = { ...snapshot }
  // Per-instance alignments settings lifted off old nested displays in views,
  // routed into the config after the walk (they can't stay on the instance).
  const collected: ExtractedDisplaySettings[] = []

  const views = snapshot.views as unknown[] | undefined
  if (Array.isArray(views)) {
    const newViews = views.map(view =>
      isObject(view) ? migrateViewSnapshot(view, collected) : view,
    )
    if (newViews.some((v, i) => v !== views[i])) {
      changed = true
      result.views = newViews
    }
  }

  const sessionTracks = snapshot.sessionTracks as unknown[] | undefined
  if (Array.isArray(sessionTracks)) {
    const newTracks = sessionTracks.map(t => migrateTrackSnapshot(t, collected))
    if (newTracks.some((t, i) => t !== sessionTracks[i])) {
      changed = true
      result.sessionTracks = newTracks
    }
  }

  // trackConfigDeltas is a `trackId → partial track config` map (see
  // SessionTracks.ts). A delta carries a `displays` array like a track, so run
  // each through the same track migrator; migrateTrackSnapshot is a no-op for a
  // delta that carries no stale display type.
  const deltas = snapshot.trackConfigDeltas as
    | Record<string, unknown>
    | undefined
  if (deltas && typeof deltas === 'object') {
    let deltasChanged = false
    const newDeltas: Record<string, unknown> = {}
    for (const [trackId, delta] of Object.entries(deltas)) {
      const migrated = migrateTrackSnapshot(delta, collected)
      if (migrated !== delta) {
        deltasChanged = true
      }
      newDeltas[trackId] = migrated
    }
    if (deltasChanged) {
      changed = true
      result.trackConfigDeltas = newDeltas
    }
  }

  // applyExtractedSettings returns its input by identity when nothing was
  // collected, so this preserves the unchanged-by-identity contract.
  return applyExtractedSettings(changed ? result : snapshot, collected)
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
  const newTracks = tracks.map(t => migrateTrackSnapshot(t, []))
  if (newTracks.every((t, i) => t === tracks[i])) {
    return snapshot
  }
  return { ...snapshot, tracks: newTracks }
}
