import {
  getTrackConfigWithPromotables,
  hydrateTrackConfig,
} from '@jbrowse/core/configuration'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// "About track" is reached from two menus that hand the dialog two different
// things: the hierarchical selector passes a `session.tracks` entry, which is a
// `types.frozen` plain object, while the in-view track label passes
// `track.configuration`, a live node. "Copy config" resolves the promotable
// cascade, which only a live node has — so before hydration the same track
// copied a different config depending on which menu you used, and the selector
// is the one reachable without opening the track at all.
const TRACK_ID = 'volvox_filtered_vcf'
const DISPLAY_TYPE = 'LinearVariantDisplay'
const SLOT = 'displayMode'
const PROMOTED = 'compact'

interface TestView {
  showTrack: (id: string) => void
  tracks: { configuration: AnyConfigurationModel }[]
}
interface TestSession {
  views: TestView[]
  tracks: AnyConfigurationModel[]
  setDisplayTypeDefault: (type: string, slot: string, value: unknown) => void
  getDisplayTypeDefault: (type: string, slot: string) => unknown
  getEditableTrackConfig?: (trackId: string) => unknown
}

beforeEach(() => {
  localStorage.clear()
  doBeforeEach()
})

async function setup(adminMode = true) {
  const { pluginManager, rootModel } = await getPluginManager(
    undefined,
    adminMode,
  )
  const session = rootModel.session as unknown as TestSession
  return { pluginManager, session, view: session.views[0]! }
}

// what TrackSelectorTrackMenu hands to getTrackListMenuItems
function fromSelector(session: TestSession) {
  return session.tracks.find(t => t.trackId === TRACK_ID)!
}

// what the copy button writes, by the route AboutDialogContents takes
function copiedConfig(
  pluginManager: PluginManager,
  session: TestSession,
  config: AnyConfigurationModel,
) {
  const live = isStateTreeNode(config)
    ? config
    : hydrateTrackConfig(pluginManager, config)!
  return getTrackConfigWithPromotables(session, live)
}

function displayEntry(config: Record<string, unknown>) {
  return (config.displays as Record<string, unknown>[]).find(
    d => d.type === DISPLAY_TYPE,
  )!
}

test('a selector entry is frozen and a view entry is live', async () => {
  const { session, view } = await setup()
  expect(isStateTreeNode(fromSelector(session))).toBe(false)
  view.showTrack(TRACK_ID)
  const inView = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  expect(isStateTreeNode(inView)).toBe(true)
})

test('copying from the selector resolves promoted defaults too', async () => {
  const { pluginManager, session } = await setup()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const { config, fromDisplayTypeDefaults } = copiedConfig(
    pluginManager,
    session,
    fromSelector(session),
  )

  // the whole point: a config pasted into someone else's config.json renders
  // the way this session does, rather than picking up whatever they promoted
  expect(displayEntry(config)[SLOT]).toBe(PROMOTED)
  expect(fromDisplayTypeDefaults).toContain(`${DISPLAY_TYPE}.${SLOT}`)
})

test('both entry points copy the same config', async () => {
  const { pluginManager, session, view } = await setup()
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)

  const selector = copiedConfig(pluginManager, session, fromSelector(session))
  view.showTrack(TRACK_ID)
  const inView = copiedConfig(
    pluginManager,
    session,
    view.tracks.find(t => t.configuration.trackId === TRACK_ID)!.configuration,
  )

  expect(selector.config).toEqual(inView.config)
  expect(selector.fromDisplayTypeDefaults).toEqual(
    inView.fromDisplayTypeDefaults,
  )
})

test('hydration reuses the node the track itself later resolves', async () => {
  const { pluginManager, session, view } = await setup()
  const hydrated = hydrateTrackConfig(pluginManager, fromSelector(session))
  view.showTrack(TRACK_ID)
  const inView = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  expect(hydrated).toBe(inView)
})

test('an unbuildable config hydrates to undefined instead of throwing', async () => {
  const { pluginManager } = await setup()
  // it logs the reason it gave up; that is the point, not suite noise
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(
    hydrateTrackConfig(pluginManager, {
      trackId: 'x',
      type: 'NoSuchTrackType',
    }),
  ).toBeUndefined()
  expect(spy).toHaveBeenCalled()
  spy.mockRestore()
})

// The case above is the easy one: in admin mode with no edit, both entry points
// bottom out in the same frozen-hydration cache, so agreeing costs nothing.
// Non-admin with an edited track is where the two genuinely differ —
// TrackConfigurationReference hands the in-view menu a private working copy
// from `editableTrackConfigs` that in-place setSlot edits mutate (ADR-032),
// while the selector gets `mergeTrackConfig(base, delta)`, a different object
// built from `trackConfigDeltas`. They agree only because BaseTrackModel's
// debounced reaction pushes every config mutation through
// updateTrackConfiguration into that delta. Nothing pinned that, and "the
// settings I applied come out in Copy config" rests on it.
const EDITED = 'superCompact'

function displayConfig(trackConfig: AnyConfigurationModel) {
  return (trackConfig.displays as AnyConfigurationModel[]).find(
    d => d.type === DISPLAY_TYPE,
  )!
}

test('a non-admin quick-edit reaches Copy config from both menus', async () => {
  const { pluginManager, session, view } = await setup(false)
  view.showTrack(TRACK_ID)
  const inViewConf = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  // the working copy, not the shared base — this is the ADR-032 path
  expect(inViewConf).toBe(session.getEditableTrackConfig!(TRACK_ID))

  // a track-menu quick-edit: setSlot straight onto the config schema
  displayConfig(inViewConf).setSlot(SLOT, EDITED)
  // BaseTrackModel's persist reaction is debounced 400ms
  await new Promise(resolve => setTimeout(resolve, 600))

  const selector = copiedConfig(pluginManager, session, fromSelector(session))
  const inView = copiedConfig(pluginManager, session, inViewConf)

  expect(displayEntry(inView.config)[SLOT]).toBe(EDITED)
  expect(displayEntry(selector.config)[SLOT]).toBe(EDITED)
  expect(selector.config).toEqual(inView.config)
}, 10000)

test("a non-admin edit isn't reported as inherited from a session default", async () => {
  const { pluginManager, session, view } = await setup(false)
  session.setDisplayTypeDefault(DISPLAY_TYPE, SLOT, PROMOTED)
  view.showTrack(TRACK_ID)
  const inViewConf = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  displayConfig(inViewConf).setSlot(SLOT, EDITED)
  await new Promise(resolve => setTimeout(resolve, 600))

  const { config, fromDisplayTypeDefaults } = copiedConfig(
    pluginManager,
    session,
    fromSelector(session),
  )
  // the track states its own value, so the "includes N settings from your
  // session-wide defaults" note must not claim this one
  expect(displayEntry(config)[SLOT]).toBe(EDITED)
  expect(fromDisplayTypeDefaults).not.toContain(`${DISPLAY_TYPE}.${SLOT}`)
}, 10000)
