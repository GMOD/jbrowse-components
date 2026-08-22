import { getTrackConfigWithPromotables } from '@jbrowse/core/configuration'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'
const DISPLAY_TYPE = 'LinearVariantDisplay'
// a promotable slot on the canvas base display; unset resolves to promotedBase
// 'normal'
const SLOT = 'displayMode'
const PROMOTED = 'compact'

interface TestView {
  showTrack: (id: string) => void
  hideTrack: (id: string) => void
  tracks: { configuration: AnyConfigurationModel }[]
}
interface TestSession {
  views: TestView[]
  setDisplayTypeDefault: (type: string, slot: string, value: unknown) => void
  // the reader is the half `getTrackConfigWithPromotables` actually takes
  getDisplayTypeDefault: (type: string, slot: string) => unknown
}

beforeEach(() => {
  // promoted defaults persist to localStorage (PreferencesSessionMixin)
  localStorage.clear()
  doBeforeEach()
})

// The About dialog only resolves a *live* config node — `jbrowse.tracks` entries
// are frozen plain objects until a track is opened, and the dialog's
// `isStateTreeNode` guard hands those through as authored. So every case here
// opens the track first, which is also the entry point that matters: "what am I
// looking at right now".
async function openTrack() {
  const { rootModel } = await getPluginManager()
  const session = rootModel.session as unknown as TestSession
  const view = session.views[0]!
  view.showTrack(TRACK_ID)
  const trackConfig = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  return { session, view, trackConfig }
}

// the display entry in the copied config, by display type
function displayEntry(config: Record<string, unknown>) {
  const displays = config.displays as Record<string, unknown>[]
  return displays.find(d => d.type === DISPLAY_TYPE)!
}

function displayConfig(trackConfig: AnyConfigurationModel) {
  return (trackConfig.displays as AnyConfigurationModel[]).find(
    d => d.type === DISPLAY_TYPE,
  )!
}

test('a track following a promoted default copies the resolved value', async () => {
  const { session, trackConfig } = await openTrack()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const { config, fromDisplayTypeDefaults } = getTrackConfigWithPromotables(
    session,
    trackConfig,
  )

  // a raw getSnapshot omits the slot entirely (stripDefault collapses an unset
  // slot), so the copied config would render differently from the track
  expect(displayEntry(config)[SLOT]).toBe(PROMOTED)
  expect(fromDisplayTypeDefaults).toContain(`${DISPLAY_TYPE}.${SLOT}`)
})

test('resolves from the config alone once the track is closed again', async () => {
  const { session, view, trackConfig } = await openTrack()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  // the dialog outlives the open track; the hydration cache keeps the config
  // node alive, but there is no display state left to read the cascade off
  view.hideTrack(TRACK_ID)

  const { config, fromDisplayTypeDefaults } = getTrackConfigWithPromotables(
    session,
    trackConfig,
  )

  expect(displayEntry(config)[SLOT]).toBe(PROMOTED)
  expect(fromDisplayTypeDefaults).toContain(`${DISPLAY_TYPE}.${SLOT}`)
})

test('with nothing promoted the copied value is the base, and nothing is flagged', async () => {
  const { session, trackConfig } = await openTrack()

  const { config, fromDisplayTypeDefaults } = getTrackConfigWithPromotables(
    session,
    trackConfig,
  )

  expect(displayEntry(config)[SLOT]).toBe('normal')
  expect(fromDisplayTypeDefaults).toEqual([])
})

test("a customized track copies its own value and isn't flagged as inherited", async () => {
  const { session, trackConfig } = await openTrack()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  displayConfig(trackConfig).setSlot(SLOT, 'superCompact')

  const { config, fromDisplayTypeDefaults } = getTrackConfigWithPromotables(
    session,
    trackConfig,
  )

  expect(displayEntry(config)[SLOT]).toBe('superCompact')
  expect(fromDisplayTypeDefaults).toEqual([])
})
