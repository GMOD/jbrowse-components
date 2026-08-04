// Drives loadSessionSpec against jbrowse-web's real session model, which is what
// `sessionConnections` has to work through: the spec carries plain JSON, and
// only a real session can say whether addConnectionConf coerces that into a
// config model and whether makeConnection accepts what it hands back. The
// ordering rules are unit-tested against stubs in @jbrowse/app-core.
import { loadSessionSpec } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('./makeWorkerInstance', () => () => {})

// the connection's hub.txt read. Left pending so the connection stays `loading`
// for as long as a test wants it to
const mockReadFile = jest.fn()
jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  openLocation: () => ({ readFile: mockReadFile }),
}))

const HUB = {
  type: 'UCSCTrackHubConnection',
  connectionId: 'hub1',
  name: 'my-hub',
  hubTxtLocation: {
    uri: 'https://example.com/hub.txt',
    locationType: 'UriLocation',
  },
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

beforeEach(() => {
  mockReadFile.mockReturnValue(new Promise(() => {}))
})

test('a spec registers its connections as real session connections', async () => {
  const { pluginManager, rootModel } = setup()

  await loadSessionSpec({ sessionConnections: [HUB], views: [] }, pluginManager)

  const { session } = rootModel
  expect(session.sessionConnections).toHaveLength(1)
  expect(session.sessionConnections[0]!.name).toBe('my-hub')
  // the config the spec named was instantiated, not merely stored
  expect(session.connectionInstances).toHaveLength(1)
  expect(session.connectionInstances[0]!.loading).toBe(true)
})

// `sessionConnections` names the session, and an admin opening a link is still
// only opening a link — the connection must not reach jbrowse.connections,
// which the admin server writes back into the config.json every visitor loads
test('an admin loading a spec keeps its connections in the session', async () => {
  const { pluginManager, rootModel } = setup({ adminMode: true })

  await loadSessionSpec({ sessionConnections: [HUB], views: [] }, pluginManager)

  const { session } = rootModel
  expect(
    session.sessionConnections.map(
      (c: AnyConfigurationModel) => c.connectionId as string,
    ),
  ).toEqual(['hub1'])
  expect(session.jbrowse.connections).toHaveLength(0)
})

// a hub's own connect() opens a view at its defaultPos; with the spec launching
// views of its own that would be a second, competing view
test('a spec with views silences the connections it registers', async () => {
  const { pluginManager, rootModel } = setup()

  void loadSessionSpec(
    {
      sessionConnections: [HUB],
      views: [{ type: 'LinearGenomeView', assembly: 'hubGenome' }],
    },
    pluginManager,
  )
  await Promise.resolve()

  expect(rootModel.session.connectionInstances[0]!.silent).toBe(true)
})

// the whole reason the spec waits: the assembly and the track ids a view names
// arrive with the connection's fetch, so launching mid-fetch resolves neither
test('a spec holds its views until the connection settles', async () => {
  const { pluginManager, rootModel } = setup()

  void loadSessionSpec(
    {
      sessionConnections: [HUB],
      views: [{ type: 'LinearGenomeView', assembly: 'hubGenome' }],
    },
    pluginManager,
  )
  // several turns, so this is "still waiting", not "hasn't started yet"
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  expect(rootModel.session.connectionInstances[0]!.loading).toBe(true)
  expect(rootModel.session.views).toHaveLength(0)
})
