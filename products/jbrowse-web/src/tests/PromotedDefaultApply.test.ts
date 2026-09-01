import { makePin, resolveConf, setConf } from '@jbrowse/core/configuration'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { SnackAction } from '@jbrowse/core/util'

// The pin's write against a real session — which is the only place either of
// these is visible, since `promotableDefaults`' own unit fakes compose a fresh
// config into each display and have no `trackConfigDeltas` at all.
//
// The count is over TRACKS, and only a real session can tell whether it is:
// `display.configuration` resolves inside its containing track's config, and
// that one is a `TrackConfigurationReference`, so the same track open in two
// views resolves to one config node — and therefore one display config —
// through the hydration cache, while the unit fakes cannot express the case at
// all. A breakpoint-split view
// is where a user meets it — it shows the same track in both halves, and is one
// of the composite shapes `openPromotableDisplays` recurses into.
const TRACK_ID = 'volvox_filtered_vcf'
const SLOT = 'displayMode'

interface TestView {
  showTrack: (id: string) => void
  tracks: {
    configuration: { trackId: string }
    displays: ResolvableDisplay[]
  }[]
}

interface TestSession {
  views: TestView[]
  addView: (type: string, init: Record<string, unknown>) => TestView
  setDisplayTypeDefault: (
    displayType: string,
    slot: string,
    value: unknown,
  ) => void
  snackbarMessages: { message: string; actions?: SnackAction[] }[]
}

beforeEach(() => {
  // a promoted default persists to localStorage, so one test's promotion would
  // otherwise decide the next one's starting cascade
  localStorage.clear()
  doBeforeEach()
})

function displayIn(view: TestView) {
  return view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
    .displays[0]!
}

function openInTwoViews() {
  const { rootModel } = getPluginManager()
  const session = rootModel.session as unknown as TestSession
  const first = session.views[0]!
  first.showTrack(TRACK_ID)
  const second = session.addView('LinearGenomeView', {})
  second.showTrack(TRACK_ID)
  return { session, first: displayIn(first), second: displayIn(second) }
}

test('one track shown in two views is two displays over one config', () => {
  const { first, second } = openInTwoViews()
  expect(first).not.toBe(second)
  expect(first.configuration).toBe(second.configuration)
})

test('the applied count is per track, not per open display', () => {
  const { session, first } = openInTwoViews()
  setConf(first, SLOT, 'normal')

  makePin(first, SLOT, 'compact').toggle()

  expect(session.snackbarMessages.at(-1)!.message).toBe(
    'Applied to 1 open track',
  )
  expect(resolveConf(first, SLOT)).toBe('compact')
})

// Unsetting a promotable slot — what the size rows' reset writes, and how a
// track rejoins the cascade — is a removal, and `diffTrackConfig` records adds
// and changes but never deletions. So unsetting a slot an admin `config.json`
// declares diffs to nothing exactly as netting back to the base does. Clearing
// the delta then reverted the track's working copy to the base, undoing the
// reset ~400ms after the user watched it land.
describe('unsetting an admin-configured promotable slot', () => {
  // gff3_custom_tooltips declares `subfeatureLabels: 'below'` on its
  // LinearBasicDisplay, which is what makes the removal unexpressible
  const ADMIN_TRACK = 'gff3_custom_tooltips'
  const ADMIN_SLOT = 'subfeatureLabels'

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('survives the debounced delta round-trip', () => {
    // non-admin: an admin's edits rewrite jbrowse.tracks itself and never go
    // near a delta, so the case does not exist there
    const { rootModel } = getPluginManager(undefined, false)
    const session = rootModel.session as unknown as TestSession
    const view = session.views[0]!
    view.showTrack(ADMIN_TRACK)
    const display = view.tracks.find(
      t => t.configuration.trackId === ADMIN_TRACK,
    )!.displays[0]!
    expect(resolveConf(display, ADMIN_SLOT)).toBe('below')

    // a promoted default for the track to fall back to, so reverting to the
    // admin base is visibly the wrong answer rather than a coincidence
    session.setDisplayTypeDefault(display.type, ADMIN_SLOT, 'none')

    // customize away from the admin value so a delta exists to be cleared
    setConf(display, ADMIN_SLOT, 'overlay')
    jest.advanceTimersByTime(1000)

    setConf(display, ADMIN_SLOT, undefined)
    expect(resolveConf(display, ADMIN_SLOT)).toBe('none')

    // the persist reaction is debounced 400ms; this is where it used to revert
    jest.advanceTimersByTime(1000)
    expect(resolveConf(display, ADMIN_SLOT)).toBe('none')
  })
})
