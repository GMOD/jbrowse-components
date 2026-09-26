import { getEnv } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { doBeforeEach, getTestSession, mockConsole } from './util.tsx'

const TRACK_ID = 'volvox_gc'

beforeEach(() => {
  doBeforeEach()
})

// These pin the SYNCHRONOUS door's contract — what showTrack/hideTrack/
// toggleTrack return and leave behind — so the display's state model has to be
// loaded first, which is the one thing the async launchTrack pair adds. Loading
// it here rather than per test states that precondition once.
const getView = async () => {
  const { view } = await getTestSession()
  await getEnv(view)
    .pluginManager.getDisplayType('LinearGCContentDisplay')
    .loadStateModel()
  return view
}

test('showTrack returns the track and adds it to view.tracks', async () => {
  const view = await getView()
  const track = view.showTrack(TRACK_ID)
  expect(track).toBeDefined()
  expect(track!.configuration.trackId).toBe(TRACK_ID)
  expect(view.tracks).toHaveLength(1)
})

test('showTrack is idempotent: second call returns same instance, no duplicates', async () => {
  const view = await getView()
  const first = view.showTrack(TRACK_ID)
  const second = view.showTrack(TRACK_ID)
  expect(first).toBe(second)
  expect(view.tracks).toHaveLength(1)
})

test('showTrack with unknown id returns undefined', async () => {
  await mockConsole(async () => {
    const view = await getView()
    const track = view.showTrack('does_not_exist')
    expect(track).toBeUndefined()
    expect(view.tracks).toHaveLength(0)
  })
})

test('showTrack passes displayInitialSnapshot state to the display', async () => {
  const view = await getView()
  const track = view.showTrack(TRACK_ID, {}, { resolution: 5 })
  expect(track).toBeDefined()
  expect(track!.displays[0]!.resolution).toBe(5)
})

// The notification contract of the shared spec/share-link/embed path. A key
// showTrackGeneric consumed itself, and an MST display prop the snapshot
// already applied, both land in applyDisplaySettings' `unapplied` on a
// perfectly correct call — so only a key whose WRITE THREW may raise a toast.
test('a correct displayInitialSnapshot raises no notification', async () => {
  const { session, view } = await getTestSession()
  await view.launchTrack(TRACK_ID, {}, { resolution: 5, height: 123 })
  expect(session.snackbarMessages).toHaveLength(0)
})

// The other half of that contract. A key with no slot, no setter and no
// presence on the display node reached NOTHING, and used to load a plausible
// track with the setting silently missing — which is the shape of every "the
// browser looks right but the thing I asked for is not there" report.
test('a spec key that reaches nothing is named', async () => {
  await mockConsole(async () => {
    const { session, view } = await getTestSession()
    const track = await view.launchTrack(TRACK_ID, {}, { colorSchem: 'strand' })
    // the track still opened: one dead key must not strand it
    expect(track).toBeDefined()
    expect(session.snackbarMessages).toHaveLength(1)
    expect(session.snackbarMessages[0]!.message).toContain('colorSchem')
  })
})

test('a display setting that throws is reported instead of dropped', async () => {
  await mockConsole(async () => {
    const { session, view } = await getTestSession()
    const track = await view.launchTrack(
      TRACK_ID,
      {},
      { height: 'not-a-number' },
    )
    // the track still opened — one rejected value must not strand it
    expect(track).toBeDefined()
    expect(view.tracks).toHaveLength(1)
    expect(session.snackbarMessages).toHaveLength(1)
    expect(session.snackbarMessages[0]!.message).toContain('height')
  })
})

test('hideTrack returns true and removes the track when shown', async () => {
  const view = await getView()
  await view.launchTrack(TRACK_ID)
  expect(view.hideTrack(TRACK_ID)).toBe(true)
  expect(view.tracks).toHaveLength(0)
})

test('hideTrack returns false when the track is not shown', async () => {
  const view = await getView()
  expect(view.hideTrack(TRACK_ID)).toBe(false)
})

test('toggleTrack returns true when transitioning to shown', async () => {
  const view = await getView()
  expect(view.toggleTrack(TRACK_ID)).toBe(true)
  expect(view.tracks).toHaveLength(1)
})

test('toggleTrack returns false when transitioning to hidden', async () => {
  const view = await getView()
  await view.launchTrack(TRACK_ID)
  expect(view.toggleTrack(TRACK_ID)).toBe(false)
  expect(view.tracks).toHaveLength(0)
})

test('toggleTrack failed open (unknown id) returns false', async () => {
  await mockConsole(async () => {
    const view = await getView()
    expect(view.toggleTrack('does_not_exist')).toBe(false)
  })
})

// A shown track handed a display type it is not drawn as switches to it, the
// settings landing on the display they were written for.
test('launchTrack switches a shown track to the display type it names', async () => {
  const { session, view } = await getTestSession()
  await view.launchTrack('gff3tabix_genes')
  const track = await view.launchTrack(
    'gff3tabix_genes',
    {},
    { type: 'LinearMarkDisplay', marks: [{ mark: 'span' }] },
  )
  expect(track!.activeDisplay.type).toBe('LinearMarkDisplay')
  expect(getSnapshot(track!.activeDisplay.configuration)).toMatchObject({
    marks: [{ mark: 'span' }],
  })
  expect(session.snackbarMessages).toHaveLength(0)
})

test('launchTrack leaves a track shown as the type it names as it was', async () => {
  const { view } = await getTestSession()
  const track = await view.launchTrack('volvox_test_vcf')
  const display = track!.activeDisplay
  await view.launchTrack('volvox_test_vcf', {}, { type: display.type })
  expect(track!.activeDisplay).toBe(display)
})

test('a display type the view cannot draw is named, and the display stays', async () => {
  await mockConsole(async () => {
    const { session, view } = await getTestSession()
    const track = await view.launchTrack('volvox_test_vcf')
    const display = track!.activeDisplay
    expect(
      await view.launchTrack(
        'volvox_test_vcf',
        {},
        { type: 'ChordVariantDisplay' },
      ),
    ).toBeUndefined()
    expect(track!.activeDisplay).toBe(display)
    expect(session.snackbarMessages[0]!.message).toContain(
      'cannot be shown as "ChordVariantDisplay"',
    )
  })
})

// The sync door cannot load a display's state model, so it hands the switch
// to launchTrack and answers undefined, as it does for a first show.
test('showTrack hands a switch to a display not yet loaded to launchTrack', async () => {
  const { view } = await getTestSession()
  const track = await view.launchTrack('volvox_test_vcf')
  const next = track!.compatibleDisplays.find(
    (d: { type: string }) => d.type !== track!.activeDisplay.type,
  )!
  expect(
    view.showTrack('volvox_test_vcf', {}, { type: next.type }),
  ).toBeUndefined()
  await waitFor(() => {
    expect(track!.activeDisplay.type).toBe(next.type)
  })
})
