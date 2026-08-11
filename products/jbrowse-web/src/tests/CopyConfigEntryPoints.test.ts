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
}

beforeEach(() => {
  localStorage.clear()
  doBeforeEach()
})

function setup() {
  const { pluginManager, rootModel } = getPluginManager()
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

test('a selector entry is frozen and a view entry is live', () => {
  const { session, view } = setup()
  expect(isStateTreeNode(fromSelector(session))).toBe(false)
  view.showTrack(TRACK_ID)
  const inView = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  expect(isStateTreeNode(inView)).toBe(true)
})

test('copying from the selector resolves promoted defaults too', () => {
  const { pluginManager, session } = setup()
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

test('both entry points copy the same config', () => {
  const { pluginManager, session, view } = setup()
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

test('hydration reuses the node the track itself later resolves', () => {
  const { pluginManager, session, view } = setup()
  const hydrated = hydrateTrackConfig(pluginManager, fromSelector(session))
  view.showTrack(TRACK_ID)
  const inView = view.tracks.find(
    t => t.configuration.trackId === TRACK_ID,
  )!.configuration
  expect(hydrated).toBe(inView)
})

test('an unbuildable config hydrates to undefined instead of throwing', () => {
  const { pluginManager } = setup()
  expect(
    hydrateTrackConfig(pluginManager, {
      trackId: 'x',
      type: 'NoSuchTrackType',
    }),
  ).toBeUndefined()
})
