import { makePin, resolveConf, setConf } from '@jbrowse/core/configuration'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { SnackAction } from '@jbrowse/core/util'

// The "Override N customized tracks" count is over TRACKS, and only a real
// session can tell whether it is: `display.configuration` is a
// `TrackConfigurationReference`, so the same track open in two views resolves
// to one config node through the hydration cache, while `promotableDefaults`'
// own unit fakes compose a fresh config into each display and cannot express
// the case at all. A breakpoint-split view is where a user meets it — it shows
// the same track in both halves, and is one of the composite shapes
// `openPromotableDisplays` recurses into.
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

test('the override count is per track, not per open display', () => {
  const { session, first } = openInTwoViews()
  // customize the track away from what we are about to promote, which is what
  // puts it in the override set at all
  setConf(first, SLOT, 'normal')

  makePin(first, SLOT, 'compact').toggle()

  const [action] = session.snackbarMessages.at(-1)!.actions ?? []
  expect(action?.name).toBe('Override 1 customized track')

  action!.onClick()
  expect(resolveConf(first, SLOT)).toBe('compact')
})
