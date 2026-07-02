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
  const track = view.showTrack(
    TRACK_ID,
    {},
    { rpcDriverName: 'MainThreadRpcDriver' },
  )
  expect(track).toBeDefined()
  expect(track!.displays[0]!.rpcDriverName).toBe('MainThreadRpcDriver')
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
