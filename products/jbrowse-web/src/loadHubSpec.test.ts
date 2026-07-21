// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'
import {
  loadHubSpec,
  parseHubShortLabel,
  shortHubLabel,
} from './loadHubSpec.ts'
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

describe('shortHubLabel', () => {
  it('uses the second-to-last path segment', () => {
    expect(
      shortHubLabel(
        'https://hgdownload.soe.ucsc.edu/hubs/GCF/019/202/715/GCF_019202715.1/hub.txt',
      ),
    ).toBe('GCF_019202715.1')
  })

  it('falls back to the raw string if it is not a valid URL', () => {
    expect(shortHubLabel('not a url')).toBe('not a url')
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

    void loadHubSpec({ hubURL: ['https://example.com/hub.txt'] }, pluginManager)

    expect(rootModel.session).toBeTruthy()
    expect(rootModel.session?.name).toBe('https://example.com/hub.txt')
  })

  it('uses an explicit sessionName for the initial name', () => {
    const { pluginManager, rootModel } = setup()
    jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))

    void loadHubSpec(
      { hubURL: ['https://example.com/hub.txt'], sessionName: 'My Session' },
      pluginManager,
    )

    expect(rootModel.session?.name).toBe('My Session')
  })

  it('does nothing when hubURL is empty', async () => {
    const { pluginManager, rootModel } = setup()
    await loadHubSpec({ hubURL: [] }, pluginManager)
    expect(rootModel.session).toBeUndefined()
  })

  it('creates a connection instance for each hub URL', () => {
    const { pluginManager, rootModel } = setup()
    jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))

    void loadHubSpec(
      {
        hubURL: [
          'https://example.com/hub1.txt',
          'https://example.com/hub2.txt',
        ],
      },
      pluginManager,
    )

    expect(rootModel.session?.connectionInstances).toHaveLength(2)
  })

  // regression: the connection's name became the category label in the
  // track selector, so a raw hub.txt URL was unreadably long there
  it('names the connection with a short label, not the full hub.txt URL', () => {
    const { pluginManager, rootModel } = setup()
    jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))

    void loadHubSpec(
      { hubURL: ['https://example.com/hubs/my-hub/hub.txt'] },
      pluginManager,
    )

    const session = rootModel.session
    expect(session.sessionConnections[0].name).toBe('my-hub')
  })

  it('renames the connection once hub.txt resolves with a shortLabel', async () => {
    const { pluginManager, rootModel } = setup()
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'hub myHub\nshortLabel My Cool Hub\nlongLabel x',
    } as Response)

    await loadHubSpec(
      { hubURL: ['https://example.com/hubs/my-hub/hub.txt'] },
      pluginManager,
    )

    const session = rootModel.session
    expect(session.sessionConnections[0].name).toBe('My Cool Hub')
  })
})
