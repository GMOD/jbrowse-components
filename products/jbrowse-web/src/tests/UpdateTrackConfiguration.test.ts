import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'

interface TestView {
  showTrack: (id: string) => void
  tracks: { configuration: AnyConfigurationModel }[]
}

interface TestSession {
  views: TestView[]
  tracks: AnyConfigurationModel[]
  sessionTracks: AnyConfigurationModel[]
  updateTrackConfiguration: (snap: {
    trackId: string
    [key: string]: unknown
  }) => void
  resetTrackConfiguration: (trackId: string) => void
  isTrackOverride: (trackId: string) => boolean
  getTrackActions: (config: AnyConfigurationModel) => { label?: string }[]
}

beforeEach(() => {
  doBeforeEach()
})

function editedSnapshot(session: TestSession) {
  const orig = session.tracks.find(t => t.trackId === TRACK_ID)!
  return { ...readConfObject(orig), name: 'Edited name' }
}

test('non-admin edits become a shareable session-track override', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const before = session.tracks.length

  session.updateTrackConfiguration(editedSnapshot(session))

  // stored as a session track (persisted/shared with the session)
  expect(session.sessionTracks.some(t => t.trackId === TRACK_ID)).toBe(true)
  // shadows the original config track instead of duplicating it
  expect(session.tracks).toHaveLength(before)
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('a second edit updates the same override rather than adding another', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))
  session.updateTrackConfiguration({
    ...editedSnapshot(session),
    name: 'Edited again',
  })

  expect(
    session.sessionTracks.filter(t => t.trackId === TRACK_ID),
  ).toHaveLength(1)
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited again')
})

test('admin edits update the jbrowse config in place, no override', () => {
  const { rootModel } = getPluginManager(undefined, true)
  const session = rootModel.session as unknown as TestSession

  session.updateTrackConfiguration(editedSnapshot(session))

  expect(session.sessionTracks).toHaveLength(0)
  const resolved = session.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('a non-admin override survives session export + reload (shareable)', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  session.updateTrackConfiguration(editedSnapshot(session))

  // serialize the session as export/share would
  const exported = getSnapshot(rootModel.session)

  // reload into a fresh app instance
  const { rootModel: reloaded } = getPluginManager(undefined, false)
  reloaded.setSession(exported)
  const session2 = reloaded.session as unknown as TestSession

  expect(session2.sessionTracks.some(t => t.trackId === TRACK_ID)).toBe(true)
  const resolved = session2.tracks.find(t => t.trackId === TRACK_ID)!
  expect(readConfObject(resolved, 'name')).toBe('Edited name')
})

test('isTrackOverride distinguishes an override from a config track', () => {
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

test('reset discards the override and reverts an open track in place', () => {
  const { rootModel } = getPluginManager(undefined, false)
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  const originalName = readConfObject(
    session.tracks.find(t => t.trackId === TRACK_ID)!,
    'name',
  )

  view.showTrack(TRACK_ID)
  session.updateTrackConfiguration(editedSnapshot(session))

  // the open track resolves to the edited override
  const openTrack = () =>
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
  expect(readConfObject(openTrack().configuration, 'name')).toBe('Edited name')

  session.resetTrackConfiguration(TRACK_ID)

  // override gone, track still open and reverted to the config default
  expect(session.sessionTracks).toHaveLength(0)
  expect(session.isTrackOverride(TRACK_ID)).toBe(false)
  expect(openTrack()).toBeDefined()
  expect(readConfObject(openTrack().configuration, 'name')).toBe(originalName)
})
