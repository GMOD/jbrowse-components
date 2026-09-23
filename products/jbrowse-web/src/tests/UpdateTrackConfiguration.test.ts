import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'

interface PlainConfig {
  trackId: string
  [key: string]: unknown
}

interface TestView {
  showTrack: (id: string) => void
  launchTrack: (id: string) => Promise<unknown>
  hideTrack: (id: string) => void
  tracks: { configuration: AnyConfigurationModel }[]
}

interface TestSession {
  views: TestView[]
  jbrowse: {
    addTrackConf: (c: PlainConfig) => void
    updateTrackConf: (c: PlainConfig) => void
    tracks: PlainConfig[]
  }
  tracks: AnyConfigurationModel[]
  sessionTracks: AnyConfigurationModel[]
  trackConfigDeltas: Record<string, PlainConfig>
  updateTrackConfiguration: (snap: PlainConfig) => void
  resetTrackConfiguration: (trackId: string) => void
  promoteTrackConfigDeltas: (trackId?: string) => void
  promotableTrackIds: string[]
  isTrackOverride: (trackId: string) => boolean
  getTrackActions: (config: AnyConfigurationModel) => { label?: string }[]
  addSessionTrackConf: (conf: PlainConfig) => AnyConfigurationModel | undefined
  getTrackById: (id: string) => AnyConfigurationModel | undefined
}

beforeEach(() => {
  doBeforeEach()
})

// mirror the real save path (BaseTrackModel persists getSnapshot(configuration),
// a sparse post-stripDefault snapshot): start from the base config snapshot and
// change one slot.
function editedSnapshot(session: TestSession, name = 'Edited name') {
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!
  return { ...base, name }
}

test('a non-admin edit is stored as a delta, not a full session-track copy', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const before = session.tracks.length

  session.updateTrackConfiguration(editedSnapshot(session))

  // stored as a delta, not in sessionTracks
  expect(session.sessionTracks.some(t => t.trackId === TRACK_ID)).toBe(false)
  expect(session.trackConfigDeltas[TRACK_ID]).toBeDefined()
  // the delta records only the changed slot (+ its self-identifying trackId)
  expect(Object.keys(session.trackConfigDeltas[TRACK_ID]!).sort()).toEqual([
    'name',
    'trackId',
  ])
  // merged over the base, no duplicate row
  expect(session.tracks).toHaveLength(before)
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('a second edit updates the same delta rather than adding another', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))
  session.updateTrackConfiguration(editedSnapshot(session, 'Edited again'))

  expect(session.sessionTracks).toHaveLength(0)
  expect(Object.keys(session.trackConfigDeltas)).toEqual([TRACK_ID])
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited again')
})

test('an admin change to an untouched field flows through the delta', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))

  // simulate an admin correcting a *different* field on the base config
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!
  session.jbrowse.updateTrackConf({ ...base, category: ['Corrected'] })

  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  // the user's edit still applies
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
  // and so does the admin's change to the untouched field (not masked by a
  // pinned full snapshot)
  expect(readConfObject(resolved, 'category')).toEqual(['Corrected'])
})

// An admin server writes jbrowse.tracks back into the config.json every
// visitor is served, so an admin's edit is held in the session like anyone's,
// where undo, reset and a share link reach it, until it is promoted.
test("an admin's edit is a delta until promoted to the config", async () => {
  const { rootModel } = await getPluginManager(undefined, true)
  const session = rootModel.session as unknown as TestSession
  const baseName = session.jbrowse.tracks.find(
    t => t.trackId === TRACK_ID,
  )!.name

  session.updateTrackConfiguration(editedSnapshot(session))

  expect(session.sessionTracks).toHaveLength(0)
  expect(session.trackConfigDeltas[TRACK_ID]).toBeDefined()
  expect(session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!.name).toBe(
    baseName,
  )
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')

  session.promoteTrackConfigDeltas()

  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
  expect(session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!.name).toBe(
    'Edited name',
  )
  const promoted = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(promoted, 'name')).toBe('Edited name')
})

// A config.json that repeats a trackId resolves it to the last entry, which is
// the one an edit diffs against
test('a promote replaces the entry a repeated trackId resolves to', async () => {
  const { rootModel } = await getPluginManager(undefined, true)
  const session = rootModel.session as unknown as TestSession
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!
  session.jbrowse.addTrackConf({ ...base, name: 'Repeated' })

  session.updateTrackConfiguration(editedSnapshot(session))
  session.promoteTrackConfigDeltas()

  expect(
    session.jbrowse.tracks.filter(t => t.trackId === TRACK_ID).map(t => t.name),
  ).toEqual([base.name, 'Edited name'])
  expect(readConfObject(session.getTrackById(TRACK_ID)!, 'name')).toBe(
    'Edited name',
  )
})

// Admin → Save track settings to config offers a promote only where one
// writes: a session track's edits have no file to go to.
test('only an edit over a config track is promotable', async () => {
  const { rootModel } = await getPluginManager(undefined, true)
  const session = rootModel.session as unknown as TestSession
  const saveItem = () => {
    const admin = rootModel.menus().find(m => m.label === 'Admin')!
    return (
      admin.menuItems as () => { label?: string; disabled?: boolean }[]
    )().find(i => i.label === 'Save track settings to config')!
  }
  const added = { ...editedSnapshot(session, 'Added'), trackId: 'added' }
  session.addSessionTrackConf(added)
  session.updateTrackConfiguration({ ...added, name: 'Edited added' })

  expect(session.promotableTrackIds).toEqual([])
  expect(saveItem().disabled).toBe(true)

  session.updateTrackConfiguration(editedSnapshot(session))

  expect(session.promotableTrackIds).toEqual([TRACK_ID])
  expect(saveItem().disabled).toBe(false)

  session.promoteTrackConfigDeltas()

  expect(Object.keys(session.trackConfigDeltas)).toEqual(['added'])
  expect(session.jbrowse.tracks.some(t => t.trackId === 'added')).toBe(false)
})

// An id in both lists shows its session entry, so its delta diffs against that
// entry and says nothing about the config.json one
test('a delta over a session entry is not promoted onto a config entry of its id', async () => {
  const { rootModel } = await getPluginManager(undefined, true)
  const session = rootModel.session as unknown as TestSession
  const added = { ...editedSnapshot(session, 'Added'), trackId: 'added' }
  session.addSessionTrackConf(added)
  session.updateTrackConfiguration({ ...added, name: 'Edited added' })
  session.jbrowse.addTrackConf({ ...added, name: 'Catalog' })

  expect(session.promotableTrackIds).toEqual([])
  session.promoteTrackConfigDeltas('added')

  expect(session.jbrowse.tracks.find(t => t.trackId === 'added')!.name).toBe(
    'Catalog',
  )
  expect(session.trackConfigDeltas.added).toBeDefined()
})

test('only an admin can promote track edits to the config', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  session.updateTrackConfiguration(editedSnapshot(session))

  expect(() => {
    session.promoteTrackConfigDeltas()
  }).toThrow(/only an admin/)
  expect(session.trackConfigDeltas[TRACK_ID]).toBeDefined()
})

test('a non-admin delta survives session export + reload (shareable)', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  session.updateTrackConfiguration(editedSnapshot(session))

  // serialize the session as export/share would
  const exported = getSnapshot(rootModel.session)

  // reload into a fresh app instance
  const { rootModel: reloaded } = await getPluginManager(undefined, false)
  reloaded.setSession(exported)
  const session2 = reloaded.session as unknown as TestSession

  expect(session2.trackConfigDeltas[TRACK_ID]).toBeDefined()
  const resolved = session2.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('a legacy full-override session track migrates to a delta on load', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!

  // hand-craft a legacy session: the edit stored as a full same-id sessionTrack
  const snap: Record<string, unknown> = getSnapshot(rootModel.session)
  const exported = {
    ...snap,
    sessionTracks: [{ ...base, name: 'Legacy name' }],
    trackConfigDeltas: {},
  }

  const { rootModel: reloaded } = await getPluginManager(undefined, false)
  reloaded.setSession(exported)
  const session2 = reloaded.session as unknown as TestSession

  // migrated: moved out of sessionTracks into a delta
  expect(session2.sessionTracks.some(t => t.trackId === TRACK_ID)).toBe(false)
  expect(session2.trackConfigDeltas[TRACK_ID]).toBeDefined()
  const resolved = session2.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Legacy name')
})

// A non-admin's deltas ride along in a shared session, so an admin can open one
// and then edit the very tracks it overrides. The admin's edit extends that
// delta, and a promote writes the result into the base.
test("an admin's edit over a shared session's delta promotes to the config", async () => {
  const { rootModel: nonAdminRoot } = await getPluginManager(undefined, false)
  const nonAdmin = nonAdminRoot.session as unknown as TestSession
  nonAdmin.updateTrackConfiguration(editedSnapshot(nonAdmin, 'NonAdminName'))
  const shared = getSnapshot(nonAdminRoot.session)

  const { rootModel } = await getPluginManager(undefined, true)
  rootModel.setSession(shared)
  const session = rootModel.session as unknown as TestSession
  // the admin first sees the session as its author shared it
  expect(session.trackConfigDeltas[TRACK_ID]).toBeDefined()
  const before = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(before, 'name')).toBe('NonAdminName')

  session.updateTrackConfiguration(editedSnapshot(session, 'AdminName'))
  const edited = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(edited, 'name')).toBe('AdminName')

  session.promoteTrackConfigDeltas(TRACK_ID)

  expect(session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!.name).toBe(
    'AdminName',
  )
  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
  const after = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(after, 'name')).toBe('AdminName')
})

// Re-adding a config already in the catalog (jbrowse.tracks) must not push a
// full shadow into sessionTracks -- that silently demotes a catalog track to a
// session track and drops its delta-override semantics. addSessionTrackConf dedupes
// against everything getTrackById resolves, not just sessionTracks.
test('addSessionTrackConf does not shadow an existing catalog track into sessionTracks', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!

  const returned = session.addSessionTrackConf({ ...base, name: 'Re-added' })

  // nothing pushed into sessionTracks; the catalog stays the source of truth
  expect(session.sessionTracks.some(t => t.trackId === TRACK_ID)).toBe(false)
  // returns the already-resolvable config rather than a fresh shadow
  expect(returned).toBe(session.getTrackById(TRACK_ID))
  // and the catalog config is unchanged (the re-add's edited name is ignored)
  expect(readConfObject(session.getTrackById(TRACK_ID)!, 'name')).toBe(
    base.name,
  )
})

test('isTrackOverride distinguishes a delta from a plain config track', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession

  expect(session.isTrackOverride(TRACK_ID)).toBe(false)
  session.updateTrackConfiguration(editedSnapshot(session))
  expect(session.isTrackOverride(TRACK_ID)).toBe(true)
})

test("an admin's override offers Reset beside Delete", async () => {
  const { rootModel } = await getPluginManager(undefined, true)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))

  const override = session.tracks.find(t => t.trackId === TRACK_ID)!
  const labels = session.getTrackActions(override).map(i => i.label)
  expect(labels).toContain('Reset track settings')
  expect(labels).toContain('Delete track')
})

test('track menu offers Reset for an override, Delete otherwise', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const config = session.tracks.find(t => t.trackId === TRACK_ID)!

  const labelsBefore = session.getTrackActions(config).map(i => i.label)
  expect(labelsBefore).toContain('Delete track')
  expect(labelsBefore).not.toContain('Reset track settings')

  session.updateTrackConfiguration(editedSnapshot(session))

  const override = session.tracks.find(t => t.trackId === TRACK_ID)!
  const labelsAfter = session.getTrackActions(override).map(i => i.label)
  expect(labelsAfter).toContain('Reset track settings')
  expect(labelsAfter).not.toContain('Delete track')
})

test('a live setSlot edit persists exactly once and does not loop (admin)', async () => {
  // Regression: BaseTrackModel's debounced save watches the re-resolving
  // `self.configuration` reference, whose node identity a persisted save can
  // swap, so a referential-equality reaction would re-fire forever. Structural
  // comparison must settle it, and an admin's save must not reach the base.
  jest.useFakeTimers()
  try {
    const { rootModel } = await getPluginManager(undefined, true)

    const session = rootModel.session
    await session.views[0].launchTrack(TRACK_ID)
    const track = session.views[0].tracks.find(
      (t: any) => t.configuration.trackId === TRACK_ID,
    )
    const baseWrites = jest.spyOn(session.jbrowse, 'updateTrackConf')
    let deltaWrites = 0
    const dispose = reaction(
      () => session.trackConfigDeltas,
      () => {
        deltaWrites++
      },
    )

    track.configuration.setSlot('name', 'Edited name')
    for (let i = 0; i < 20; i++) {
      jest.advanceTimersByTime(500)
    }
    dispose()

    expect(deltaWrites).toBe(1)
    expect(baseWrites).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
})

test('reset discards the delta and reverts an open track in place', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  const originalName = readConfObject(
    session.tracks.find(t => t.trackId === TRACK_ID)!,
    'name',
  )

  await view.launchTrack(TRACK_ID)
  session.updateTrackConfiguration(editedSnapshot(session))

  // the open track resolves to the edited config
  const openTrack = () =>
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
  expect(readConfObject(openTrack().configuration, 'name')).toBe('Edited name')

  session.resetTrackConfiguration(TRACK_ID)

  // delta gone, track still open and reverted to the config default
  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
  expect(session.isTrackOverride(TRACK_ID)).toBe(false)
  expect(openTrack()).toBeDefined()
  expect(readConfObject(openTrack().configuration, 'name')).toBe(originalName)
})

test('reset reverts a live in-place setSlot edit (stale hydration node not reused)', async () => {
  // Regression: a live track-menu setSlot mutates the base config's shared
  // hydrated MST node in place. Storing the delta rehydrates a fresh (merged)
  // node, but dropping the delta on reset made the `tracks` getter return the
  // base by identity again — and the hydration cache handed back the still-
  // mutated node, so the reset visibly reverted to the edited value. Distinct
  // from the snapshot-driven reset test above: only an in-place setSlot dirties
  // the cached base node, so that test never exercised this path.
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  const originalName = readConfObject(
    session.tracks.find(t => t.trackId === TRACK_ID)!,
    'name',
  )

  await view.launchTrack(TRACK_ID)
  const openTrack = () =>
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
  const openConfig = () =>
    openTrack().configuration as AnyConfigurationModel & {
      setSlot: (slot: string, value: unknown) => void
    }

  // mutate the resolved config in place (what the track-menu slider does), then
  // persist exactly as BaseTrackModel's debounced reaction would
  openConfig().setSlot('name', 'Edited name')
  session.updateTrackConfiguration(
    getSnapshot(openConfig()) as unknown as PlainConfig,
  )
  expect(readConfObject(openConfig(), 'name')).toBe('Edited name')

  session.resetTrackConfiguration(TRACK_ID)

  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
  expect(readConfObject(openConfig(), 'name')).toBe(originalName)
})

test('a save identical to the base stores no delta (no spurious override)', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!

  // a save with no net change (e.g. opening then closing the config editor)
  // must not register an override — otherwise the row gets a bogus "edited"
  // badge and the menu swaps Delete for Reset with nothing overridden
  session.updateTrackConfiguration({ ...base })

  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
  expect(session.isTrackOverride(TRACK_ID)).toBe(false)
})

test('editing a slot back to its base value clears the delta (implicit reset)', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!

  session.updateTrackConfiguration(editedSnapshot(session))
  expect(session.trackConfigDeltas[TRACK_ID]).toBeDefined()

  // the delta is recomputed against the base each save, so reverting the slot
  // yields an empty delta and drops the override entirely
  session.updateTrackConfiguration({ ...base })
  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
  expect(session.isTrackOverride(TRACK_ID)).toBe(false)
})

test('a redundant identical save does not churn the delta identity', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))
  const firstDeltas = session.trackConfigDeltas

  // Two views showing the same track each persist the same snapshot (their
  // BaseTrackModel reactions both observe the one shared config node); the
  // config editor can also re-save unchanged. A structurally-identical re-store
  // must be a no-op — a fresh trackConfigDeltas object churns its identity and
  // makes the tracks getter rehydrate a new merged config node for no real
  // change.
  session.updateTrackConfiguration(editedSnapshot(session))
  expect(session.trackConfigDeltas).toBe(firstDeltas)
})

test('a live setSlot edit persists as a delta via the reaction (non-admin)', async () => {
  // End-to-end for the working-copy refactor: an in-place setSlot on the
  // resolved config (a private working copy) must be picked up by
  // BaseTrackModel's debounced reaction and stored as a delta — without the
  // test hand-calling updateTrackConfiguration. Uses real (fake) timer flow so
  // the actual reaction fires, not a simulated persist.
  jest.useFakeTimers()
  try {
    const { rootModel } = await getPluginManager(undefined, false)
    const session = rootModel.session as unknown as TestSession
    const view = session.views[0]!
    await view.launchTrack(TRACK_ID)
    const openConfig = () =>
      view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
        .configuration as AnyConfigurationModel & {
        setSlot: (slot: string, value: unknown) => void
      }

    openConfig().setSlot('name', 'Edited via reaction')
    expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()

    // the debounced reaction (400ms) diffs the working copy against the base
    // and stores the delta
    jest.advanceTimersByTime(500)

    expect(session.isTrackOverride(TRACK_ID)).toBe(true)
    expect(session.trackConfigDeltas[TRACK_ID]).toBeDefined()
    expect(readConfObject(openConfig(), 'name')).toBe('Edited via reaction')
  } finally {
    jest.useRealTimers()
  }
})

test('a config-editor widget edit persists as a delta via its debounced autorun (non-admin)', async () => {
  // End-to-end for the widget's own save path (ConfigurationEditorWidget's
  // afterCreate autorun) — distinct from BaseTrackModel's reaction, which is
  // covered above. The track is deliberately NOT shown: with no BaseTrackModel
  // instance, only the widget's autorun can persist, so this isolates it.
  // editConfiguration hydrates a temp MST target from the frozen base config;
  // mutating a slot re-runs the autorun, which snapshots the target and after a
  // 400ms debounce calls updateTrackConfiguration.
  jest.useFakeTimers()
  try {
    const { rootModel } = await getPluginManager(undefined, false)
    const session = rootModel.session as unknown as TestSession & {
      editConfiguration: (config: PlainConfig) => void
      getTrackConfigChanges: (
        trackId: string,
      ) => { path: string[]; from: unknown; to: unknown }[]
      widgets: Map<
        string,
        {
          type: string
          target?: AnyConfigurationModel & {
            setSlot: (slot: string, value: unknown) => void
          }
        }
      >
    }
    const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!

    session.editConfiguration(base)
    const widget = [...session.widgets.values()].find(
      w => w.type === 'ConfigurationEditorWidget',
    )!
    widget.target!.setSlot('name', 'Edited via widget')
    expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()

    jest.advanceTimersByTime(400)

    // only the name is a real change; the temp target hydrates with injected
    // {type, displayId} display stubs that ride along in the raw delta but are
    // dropped by getTrackConfigChanges (they're not genuine overrides)
    expect(session.isTrackOverride(TRACK_ID)).toBe(true)
    expect(session.getTrackConfigChanges(TRACK_ID)).toEqual([
      { path: ['name'], from: 'volvox filtered vcf', to: 'Edited via widget' },
    ])
    const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
    expect(readConfObject(resolved, 'name')).toBe('Edited via widget')
  } finally {
    jest.useRealTimers()
  }
})

test('a shorthand-uri track edit does not pin the expanded adapter into the delta', async () => {
  // Regression: BaseTrackModel persists getSnapshot(configuration) — the
  // *hydrated* form, where a `uri`-shorthand adapter has been expanded to
  // bamLocation/index (+baseUri) and {type, displayId} display stubs injected.
  // The base jbrowse.tracks entry is the raw config-file object still holding
  // the `uri` shorthand, so diffing the two normal forms made the whole
  // expanded adapter (and the stub-only displays array) read as a user edit and
  // pinned them into the delta — bloat, and worse it masks a later admin
  // adapter-URL fix. Normalizing the base through the track schema before
  // diffing cancels everything untouched, leaving only the real edit.
  const SHORTHAND_TRACK = 'volvox_alignments'
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!

  // sanity-check the fixture actually uses the shorthand form this guards
  const rawBase = session.jbrowse.tracks.find(
    t => t.trackId === SHORTHAND_TRACK,
  )!
  expect((rawBase.adapter as { uri?: string }).uri).toBeDefined()

  // launchTrack, not showTrack: this is an AlignmentsTrack, and
  // LinearAlignmentsDisplay's state model is loaded lazily
  await view.launchTrack(SHORTHAND_TRACK)
  const openConfig = () =>
    view.tracks.find(t => t.configuration.trackId === SHORTHAND_TRACK)!
      .configuration as AnyConfigurationModel & {
      setSlot: (slot: string, value: unknown) => void
    }

  // edit one slot, then persist exactly as BaseTrackModel's reaction would:
  // a snapshot of the hydrated (expanded) config node
  openConfig().setSlot('name', 'Edited name')
  session.updateTrackConfiguration(
    getSnapshot(openConfig()) as unknown as PlainConfig,
  )

  const delta = session.trackConfigDeltas[SHORTHAND_TRACK]!
  expect(delta).toBeDefined()
  expect(delta.adapter).toBeUndefined()
  expect(delta.displays).toBeUndefined()
  expect(Object.keys(delta).sort()).toEqual(['name', 'trackId'])
  // and the merge still resolves the untouched adapter from the base
  const resolved = session.tracks.find(t => t.trackId === SHORTHAND_TRACK)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('hiding then re-showing a track keeps its edit (delta is the source of truth)', async () => {
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!

  await view.launchTrack(TRACK_ID)
  session.updateTrackConfiguration(editedSnapshot(session))
  view.hideTrack(TRACK_ID)

  // the delta persisted through hide, so re-showing resolves the edited config
  await view.launchTrack(TRACK_ID)
  const reopened = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  expect(session.isTrackOverride(TRACK_ID)).toBe(true)
  expect(readConfObject(reopened, 'name')).toBe('Edited name')
})

// The working copy is cached per track (ADR-032), and nothing that replaced the
// frozen delta from outside this mixin used to invalidate it — an undo is
// `applySnapshot` on the whole session, so `trackConfigDeltas` lost the entry
// while `TrackConfigurationReference` kept handing back the still-edited node.
// The track stayed edited on screen against a session snapshot that said
// default, and the next edit re-diffed that node and reinstated the undone
// change. The three tests below pin the two directions and that last half.
test.each([
  ['a non-admin', false],
  ['an admin', true],
])(
  '%s: an undo that drops the delta drops the working copy with it',
  async (_who, admin) => {
    jest.useFakeTimers()
    try {
      const { rootModel } = await getPluginManager(undefined, admin)
      const session = rootModel.session as unknown as TestSession
      const view = session.views[0]!
      await view.launchTrack(TRACK_ID)
      const openConfig = () =>
        view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
          .configuration as AnyConfigurationModel & {
          setSlot: (slot: string, value: unknown) => void
        }
      const originalName = readConfObject(openConfig(), 'name')

      // let showTrack's own patch settle into history first, so the state undo
      // returns to is "track shown, never edited"
      jest.advanceTimersByTime(500)

      openConfig().setSlot('name', 'Edited name')
      jest.advanceTimersByTime(1000)
      expect(session.trackConfigDeltas[TRACK_ID]).toBeDefined()
      expect(readConfObject(openConfig(), 'name')).toBe('Edited name')
      expect(rootModel.history.canUndo).toBe(true)

      rootModel.history.undo()

      // the delta is gone, and so is the edit the working copy was holding
      expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
      expect(session.isTrackOverride(TRACK_ID)).toBe(false)
      expect(readConfObject(openConfig(), 'name')).toBe(originalName)
      // and what a share link taken now says agrees with what is on screen
      const snap = getSnapshot(rootModel.session) as {
        trackConfigDeltas?: Record<string, unknown>
      }
      expect(snap.trackConfigDeltas).toBeUndefined()

      // BaseTrackModel's reaction sees the rebuilt node and re-persists it; that
      // must not write the undone edit back
      jest.advanceTimersByTime(1000)
      expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
      expect(readConfObject(openConfig(), 'name')).toBe(originalName)
    } finally {
      jest.useRealTimers()
    }
  },
)

test('an edit made after an undo does not reinstate the undone one', async () => {
  jest.useFakeTimers()
  try {
    const { rootModel } = await getPluginManager(undefined, false)
    const session = rootModel.session as unknown as TestSession
    const view = session.views[0]!
    await view.launchTrack(TRACK_ID)
    const openConfig = () =>
      view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
        .configuration as AnyConfigurationModel & {
        setSlot: (slot: string, value: unknown) => void
      }
    const originalName = readConfObject(openConfig(), 'name')
    jest.advanceTimersByTime(500)

    openConfig().setSlot('name', 'Edited name')
    jest.advanceTimersByTime(1000)
    rootModel.history.undo()

    // a second edit, to a different slot: it is diffed against the base the
    // undo restored, so the name it never touched stays at the default
    openConfig().setSlot('description', 'Second edit')
    jest.advanceTimersByTime(1000)

    expect(Object.keys(session.trackConfigDeltas[TRACK_ID]!).sort()).toEqual([
      'description',
      'trackId',
    ])
    expect(readConfObject(openConfig(), 'name')).toBe(originalName)
    expect(readConfObject(openConfig(), 'description')).toBe('Second edit')
  } finally {
    jest.useRealTimers()
  }
})

test('persisting an edit keeps the working copy the next keystroke lands on', async () => {
  // The regression guard on the invalidation above: the cache is keyed on the
  // delta's identity, and every persist writes a *fresh* delta object — so a
  // cache that only compared identities would swap the node out from under a
  // half-typed value 400ms into typing it. `writeDelta` re-stamps instead, which
  // is what distinguishes "this mixin wrote the delta" from "a snapshot replaced
  // it".
  const { rootModel } = await getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  await view.launchTrack(TRACK_ID)
  const openConfig = () =>
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
      .configuration as AnyConfigurationModel & {
      setSlot: (slot: string, value: unknown) => void
    }
  const workingCopy = openConfig()

  // two successive persists of the same slot, as a debounced reaction firing
  // twice mid-typing does
  workingCopy.setSlot('name', 'Edited n')
  session.updateTrackConfiguration(
    getSnapshot(workingCopy) as unknown as PlainConfig,
  )
  const firstDelta = session.trackConfigDeltas[TRACK_ID]
  workingCopy.setSlot('name', 'Edited na')
  session.updateTrackConfiguration(
    getSnapshot(workingCopy) as unknown as PlainConfig,
  )
  // the delta really was replaced, so an identity check on it had something to
  // reject
  expect(session.trackConfigDeltas[TRACK_ID]).not.toBe(firstDelta)

  // the keystroke after that one has not been persisted, and reading the track's
  // config back has to still find it: asserted on the value first, because a
  // node-identity mismatch is what loses it and `toBe` on two MST nodes prints
  // nothing usable
  workingCopy.setSlot('name', 'Edited name')
  expect(readConfObject(openConfig(), 'name')).toBe('Edited name')
  expect(Object.is(openConfig(), workingCopy)).toBe(true)
})
