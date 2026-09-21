import { getConf, setConf } from '@jbrowse/core/configuration'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// Two invariants of a track's working copy that only a real session can show:
// the unit fakes compose a fresh config into each display and have no
// `trackConfigDeltas` at all.

interface TestDisplay {
  configuration: AnyConfigurationModel
}
interface TestView {
  launchTrack: (id: string) => Promise<unknown>
  tracks: {
    configuration: { trackId: string }
    displays: TestDisplay[]
  }[]
}
interface TestSession {
  views: TestView[]
  addView: (type: string, init: Record<string, unknown>) => TestView
}

beforeEach(() => {
  doBeforeEach()
})

function displayIn(view: TestView, trackId: string) {
  return view.tracks.find(t => t.configuration.trackId === trackId)!
    .displays[0]!
}

// `display.configuration` resolves inside its containing track's config, and
// that one is a `TrackConfigurationReference`, so the same track open in two
// views resolves to one config node through the hydration cache (ADR-031). A
// breakpoint-split view is where a user meets it.
test('one track shown in two views is two displays over one config', async () => {
  const { rootModel } = await getPluginManager()
  const session = rootModel.session as unknown as TestSession
  const first = session.views[0]!
  await first.launchTrack('volvox_filtered_vcf')
  const second = session.addView('LinearGenomeView', {})
  await second.launchTrack('volvox_filtered_vcf')
  const a = displayIn(first, 'volvox_filtered_vcf')
  const b = displayIn(second, 'volvox_filtered_vcf')
  expect(a).not.toBe(b)
  expect(a.configuration).toBe(b.configuration)
})

// Unsetting a slot an admin `config.json` declares is what a size row's reset
// writes, and it has to hold through the debounced save: the delta records it
// as a `null`, where clearing the delta would revert the working copy to the
// admin value.
describe('unsetting an admin-configured slot', () => {
  // gff3_custom_tooltips declares `subfeatureLabels: 'below'` on its
  // LinearBasicDisplay
  const ADMIN_TRACK = 'gff3_custom_tooltips'
  const ADMIN_SLOT = 'subfeatureLabels'

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('survives the debounced delta round-trip', async () => {
    // non-admin: an admin's edits rewrite jbrowse.tracks itself and never go
    // near a delta, so the case does not exist there
    const { rootModel } = await getPluginManager(undefined, false)
    const session = rootModel.session as unknown as TestSession
    const view = session.views[0]!
    await view.launchTrack(ADMIN_TRACK)
    const display = displayIn(view, ADMIN_TRACK)
    expect(getConf(display, ADMIN_SLOT)).toBe('below')

    // customize away from the admin value so a delta exists to be cleared
    setConf(display, ADMIN_SLOT, 'overlay')
    jest.advanceTimersByTime(1000)

    setConf(display, ADMIN_SLOT, undefined)
    expect(getConf(display, ADMIN_SLOT)).toBe('none')

    // the persist reaction is debounced 400ms; this is where it used to revert
    jest.advanceTimersByTime(1000)
    expect(getConf(display, ADMIN_SLOT)).toBe('none')
  })
})
