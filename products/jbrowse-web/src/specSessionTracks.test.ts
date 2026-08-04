// The `sessionTracks` counterpart to specSessionConnections.test.ts: only a real
// session model can say which of the two adders a spec actually reaches, since
// the choice is made by a runtime `in` check and the destinations differ only in
// admin mode.
import { loadSessionSpec } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('./makeWorkerInstance', () => () => {})

const TRACK = {
  trackId: 'spec_track',
  type: 'FeatureTrack',
  name: 'spec track',
  assemblyNames: ['volvox'],
  adapter: { type: 'FromConfigAdapter', features: [] },
}

function setup({ adminMode = false } = {}) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const rootModel = rootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode,
  }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return { pluginManager, rootModel }
}

test('a spec registers its tracks as real session tracks', async () => {
  const { pluginManager, rootModel } = setup()

  await loadSessionSpec({ sessionTracks: [TRACK], views: [] }, pluginManager)

  const { session } = rootModel
  expect(
    session.sessionTracks.map(
      (t: AnyConfigurationModel) => t.trackId as string,
    ),
  ).toEqual(['spec_track'])
  expect(session.jbrowse.tracks).toHaveLength(0)
})

// an admin opening a link is still only opening a link — the spec's tracks must
// not reach jbrowse.tracks, which the admin server writes back into the
// config.json every visitor loads
test('an admin loading a spec keeps its tracks in the session', async () => {
  const { pluginManager, rootModel } = setup({ adminMode: true })

  await loadSessionSpec({ sessionTracks: [TRACK], views: [] }, pluginManager)

  const { session } = rootModel
  expect(
    session.sessionTracks.map(
      (t: AnyConfigurationModel) => t.trackId as string,
    ),
  ).toEqual(['spec_track'])
  expect(session.jbrowse.tracks).toHaveLength(0)
})
