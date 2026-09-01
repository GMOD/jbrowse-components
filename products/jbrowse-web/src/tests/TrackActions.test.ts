import { doBeforeEach, getTestSession, mockConsole } from './util.tsx'

const TRACK_ID = 'volvox_gc'

beforeEach(() => {
  doBeforeEach()
})

const getView = () => getTestSession().view

test('showTrack returns the track and adds it to view.tracks', () => {
  const view = getView()
  const track = view.showTrack(TRACK_ID)
  expect(track).toBeDefined()
  expect(track!.configuration.trackId).toBe(TRACK_ID)
  expect(view.tracks).toHaveLength(1)
})

test('showTrack is idempotent: second call returns same instance, no duplicates', () => {
  const view = getView()
  const first = view.showTrack(TRACK_ID)
  const second = view.showTrack(TRACK_ID)
  expect(first).toBe(second)
  expect(view.tracks).toHaveLength(1)
})

test('showTrack with unknown id returns undefined', async () => {
  await mockConsole(async () => {
    const view = getView()
    const track = view.showTrack('does_not_exist')
    expect(track).toBeUndefined()
    expect(view.tracks).toHaveLength(0)
  })
})

test('showTrack passes displayInitialSnapshot state to the display', () => {
  const view = getView()
  const track = view.showTrack(TRACK_ID, {}, { resolution: 5 })
  expect(track).toBeDefined()
  expect(track!.displays[0]!.resolution).toBe(5)
})

// The notification contract of the shared spec/share-link/embed path. A key
// showTrackGeneric consumed itself, and an MST display prop the snapshot
// already applied, both land in applyDisplaySettings' `unapplied` on a
// perfectly correct call — so only a key whose WRITE THREW may raise a toast.
test('a correct displayInitialSnapshot raises no notification', () => {
  const { session, view } = getTestSession()
  view.showTrack(TRACK_ID, {}, { resolution: 5, height: 123 })
  expect(session.snackbarMessages).toHaveLength(0)
})

test('a display setting that throws is reported instead of dropped', async () => {
  await mockConsole(async () => {
    const { session, view } = getTestSession()
    const track = view.showTrack(TRACK_ID, {}, { height: 'not-a-number' })
    // the track still opened — one rejected value must not strand it
    expect(track).toBeDefined()
    expect(view.tracks).toHaveLength(1)
    expect(session.snackbarMessages).toHaveLength(1)
    expect(session.snackbarMessages[0]!.message).toContain('height')
  })
})

test('hideTrack returns true and removes the track when shown', () => {
  const view = getView()
  view.showTrack(TRACK_ID)
  expect(view.hideTrack(TRACK_ID)).toBe(true)
  expect(view.tracks).toHaveLength(0)
})

test('hideTrack returns false when the track is not shown', () => {
  const view = getView()
  expect(view.hideTrack(TRACK_ID)).toBe(false)
})

test('toggleTrack returns true when transitioning to shown', () => {
  const view = getView()
  expect(view.toggleTrack(TRACK_ID)).toBe(true)
  expect(view.tracks).toHaveLength(1)
})

test('toggleTrack returns false when transitioning to hidden', () => {
  const view = getView()
  view.showTrack(TRACK_ID)
  expect(view.toggleTrack(TRACK_ID)).toBe(false)
  expect(view.tracks).toHaveLength(0)
})

test('toggleTrack failed open (unknown id) returns false', async () => {
  await mockConsole(async () => {
    const view = getView()
    expect(view.toggleTrack('does_not_exist')).toBe(false)
  })
})
