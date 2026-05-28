// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'
import { loadHubSpec, parseHubShortLabel } from './loadHubSpec.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const mainThreadConfig = {
  jbrowse: {
    configuration: {
      rpc: {
        defaultDriver: 'MainThreadRpcDriver',
      },
    },
  },
}

function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const rootModel = rootModelFactory({
    pluginManager,
    sessionModelFactory,
  }).create(mainThreadConfig)
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return { pluginManager, rootModel }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('parseHubShortLabel', () => {
  it('extracts the shortLabel value', () => {
    expect(
      parseHubShortLabel('hub myHub\nshortLabel My Cool Hub\nlongLabel x'),
    ).toBe('My Cool Hub')
  })

  it('returns undefined when there is no shortLabel line', () => {
    expect(parseHubShortLabel('hub myHub\nlongLabel x')).toBeUndefined()
  })
})

describe('loadHubSpec', () => {
  // regression: loadHubSpec used to await the hub.txt fetch *before* calling
  // setSession, leaving rootModel.session undefined while JBrowse rendered
  // (xref ?hubURL=...&config=none "session is undefined")
  it('sets the session synchronously, before the hub.txt fetch resolves', () => {
    const { pluginManager, rootModel } = setup()
    // a pending fetch never resolves, so only the synchronous portion runs
    jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))

    void loadHubSpec({ hubURL: ['http://example.com/hub.txt'] }, pluginManager)

    expect(rootModel.session).toBeTruthy()
    expect(rootModel.session?.name).toBe('http://example.com/hub.txt')
  })

  it('uses an explicit sessionName for the initial name', () => {
    const { pluginManager, rootModel } = setup()
    jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))

    void loadHubSpec(
      { hubURL: ['http://example.com/hub.txt'], sessionName: 'My Session' },
      pluginManager,
    )

    expect(rootModel.session?.name).toBe('My Session')
  })
})
