import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'

interface PlainConfig {
  trackId: string
  [key: string]: unknown
}

interface TestView {
  showTrack: (id: string) => void
  tracks: { configuration: AnyConfigurationModel }[]
}

interface TestSession {
  views: TestView[]
  jbrowse: { updateTrackConf: (c: PlainConfig) => void; tracks: PlainConfig[] }
  tracks: AnyConfigurationModel[]
  sessionTracks: AnyConfigurationModel[]
  trackConfigDeltas: Record<string, PlainConfig>
  updateTrackConfiguration: (snap: PlainConfig) => void
  resetTrackConfiguration: (trackId: string) => void
  isTrackOverride: (trackId: string) => boolean
  getTrackActions: (config: AnyConfigurationModel) => { label?: string }[]
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

test('a non-admin edit is stored as a delta, not a full session-track copy', () => {
  const { rootModel } = getPluginManager(undefined, false)
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

test('a second edit updates the same delta rather than adding another', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))
  session.updateTrackConfiguration(editedSnapshot(session, 'Edited again'))

  expect(session.sessionTracks).toHaveLength(0)
  expect(Object.keys(session.trackConfigDeltas)).toEqual([TRACK_ID])
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited again')
})

test('an admin change to an untouched field flows through the delta', () => {
  const { rootModel } = getPluginManager(undefined, false)
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

test('admin edits update the jbrowse config in place, no delta', () => {
  const { rootModel } = getPluginManager(undefined, true)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))

  expect(session.sessionTracks).toHaveLength(0)
  expect(session.trackConfigDeltas).toEqual({})
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('a non-admin delta survives session export + reload (shareable)', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  session.updateTrackConfiguration(editedSnapshot(session))

  // serialize the session as export/share would
  const exported = getSnapshot(rootModel.session)

  // reload into a fresh app instance
  const { rootModel: reloaded } = getPluginManager(undefined, false)
  reloaded.setSession(exported)
  const session2 = reloaded.session as unknown as TestSession

  expect(session2.trackConfigDeltas[TRACK_ID]).toBeDefined()
  const resolved = session2.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('a legacy full-override session track migrates to a delta on load', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!

  // hand-craft a legacy session: the edit stored as a full same-id sessionTrack
  const snap: Record<string, unknown> = getSnapshot(rootModel.session)
  const exported = {
    ...snap,
    sessionTracks: [{ ...base, name: 'Legacy name' }],
    trackConfigDeltas: {},
  }

  const { rootModel: reloaded } = getPluginManager(undefined, false)
  reloaded.setSession(exported)
  const session2 = reloaded.session as unknown as TestSession

  // migrated: moved out of sessionTracks into a delta
  expect(session2.sessionTracks.some(t => t.trackId === TRACK_ID)).toBe(false)
  expect(session2.trackConfigDeltas[TRACK_ID]).toBeDefined()
  const resolved = session2.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Legacy name')
})

test('isTrackOverride distinguishes a delta from a plain config track', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession

  expect(session.isTrackOverride(TRACK_ID)).toBe(false)
  session.updateTrackConfiguration(editedSnapshot(session))
  expect(session.isTrackOverride(TRACK_ID)).toBe(true)
})

test('track menu offers Reset for an override, Delete otherwise', () => {
  const { rootModel } = getPluginManager(undefined, false)
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

test('a live setSlot edit persists exactly once and does not loop (admin)', () => {
  // Regression: BaseTrackModel's debounced save watches the re-resolving
  // `self.configuration` reference. Admin `updateTrackConf` replaces the frozen
  // jbrowse.tracks entry and rehydrates a new MST node on every write, so a
  // referential-equality reaction would re-fire forever. Structural comparison
  // must settle it.
  jest.useFakeTimers()
  try {
    const { rootModel } = getPluginManager(undefined, true)

    const session = rootModel.session
    session.views[0].showTrack(TRACK_ID)
    const track = session.views[0].tracks.find(
      (t: any) => t.configuration.trackId === TRACK_ID,
    )
    const spy = jest.spyOn(session.jbrowse, 'updateTrackConf')

    track.configuration.setSlot('name', 'Edited name')
    for (let i = 0; i < 20; i++) {
      jest.advanceTimersByTime(500)
    }

    expect(spy).toHaveBeenCalledTimes(1)
  } finally {
    jest.useRealTimers()
  }
})

test('reset discards the delta and reverts an open track in place', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  const originalName = readConfObject(
    session.tracks.find(t => t.trackId === TRACK_ID)!,
    'name',
  )

  view.showTrack(TRACK_ID)
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

test('reset reverts a live in-place setSlot edit (stale hydration node not reused)', () => {
  // Regression: a live track-menu setSlot mutates the base config's shared
  // hydrated MST node in place. Storing the delta rehydrates a fresh (merged)
  // node, but dropping the delta on reset made the `tracks` getter return the
  // base by identity again — and the hydration cache handed back the still-
  // mutated node, so the reset visibly reverted to the edited value. Distinct
  // from the snapshot-driven reset test above: only an in-place setSlot dirties
  // the cached base node, so that test never exercised this path.
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  const originalName = readConfObject(
    session.tracks.find(t => t.trackId === TRACK_ID)!,
    'name',
  )

  view.showTrack(TRACK_ID)
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

test('a save identical to the base stores no delta (no spurious override)', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const base = session.jbrowse.tracks.find(t => t.trackId === TRACK_ID)!

  // a save with no net change (e.g. opening then closing the config editor)
  // must not register an override — otherwise the row gets a bogus "edited"
  // badge and the menu swaps Delete for Reset with nothing overridden
  session.updateTrackConfiguration({ ...base })

  expect(session.trackConfigDeltas[TRACK_ID]).toBeUndefined()
  expect(session.isTrackOverride(TRACK_ID)).toBe(false)
})

test('editing a slot back to its base value clears the delta (implicit reset)', () => {
  const { rootModel } = getPluginManager(undefined, false)
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
