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

// the connection's hub.txt read (loadHubSpec's own shortLabel read goes through
// global fetch instead), so a test can hold a connection in flight or fail it
const mockReadFile = jest.fn()
jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  openLocation: () => ({ readFile: mockReadFile }),
}))

const mainThreadConfig = {
  jbrowse: {
    configuration: {
      rpc: {
        defaultDriver: 'MainThreadRpcDriver',
      },
    },
  },
}

function setup({ adminMode = false } = {}) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const rootModel = rootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode,
  }).create(mainThreadConfig)
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  return { pluginManager, rootModel }
}

beforeEach(() => {
  // connections stay in flight by default, so a test that isn't about the
  // connection gets no failure noise out of one
  mockReadFile.mockReturnValue(new Promise(() => {}))
})

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
    // the rename comes from loadHubSpec's own fetch, not the connection's
    // doConnect, whose own read is held in flight by mockReadFile
    await loadHubSpec(
      { hubURL: ['https://example.com/hubs/my-hub/hub.txt'] },
      pluginManager,
    )

    const session = rootModel.session
    expect(session.sessionConnections[0].name).toBe('My Cool Hub')
  })
})

// a hand-written ?hubURL=...&loc=... used to lose the hub entirely: the loader
// ranked the loc/assembly shorthand first and built a bare LGV. The hub now
// wins and the shorthand rides along as a view init.
describe('loadHubSpec with a view init', () => {
  const hubURL = ['https://example.com/hubs/my-hub/hub.txt']

  function pendingFetch() {
    jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))
  }

  function resolvingFetch() {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'hub myHub\nshortLabel My Cool Hub',
    } as Response)
  }

  const flush = () => new Promise(resolve => setTimeout(resolve, 0))

  it('waits for the hub assembly before launching, then navigates', async () => {
    const { pluginManager, rootModel } = setup()
    resolvingFetch()
    // keep the connection in flight, so the only thing that can release the
    // launch is the assembly appearing
    mockReadFile.mockReturnValue(new Promise(() => {}))

    const p = loadHubSpec(
      { hubURL, viewInit: { loc: 'chr1:1-100', assembly: 'hubAsm' } },
      pluginManager,
    )
    const session = rootModel.session!
    // let the hub.txt fetch and rename settle; the launch is now parked on an
    // assembly the hub's connect() has not produced. An LGV created here would
    // report "Assembly hubAsm not found" until it arrived
    await flush()
    expect(session.views).toHaveLength(0)

    session.addSessionAssembly({
      name: 'hubAsm',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'hubAsm-ref',
        adapter: { type: 'FromConfigSequenceAdapter', features: [] },
      },
    })
    await p

    expect(session.views).toHaveLength(1)
    expect(session.views[0].type).toBe('LinearGenomeView')
    expect(session.views[0].pendingLaunch).toMatchObject({
      loc: 'chr1:1-100',
      assembly: 'hubAsm',
    })
  })

  // the other side of that wait: a &assembly= naming a genome the hub doesn't
  // carry must not park forever. Once every connection has settled the view is
  // launched anyway, so the LGV reports "Assembly ... not found" itself
  it('stops waiting once the hub settles without the assembly', async () => {
    const { pluginManager, rootModel } = setup()
    resolvingFetch()
    // the connection reports its own failure, which is not what's under test
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockReadFile.mockRejectedValue(new Error('hub is unreachable'))

    await loadHubSpec(
      { hubURL, viewInit: { loc: 'chr1:1-100', assembly: 'notInThisHub' } },
      pluginManager,
    )

    const session = rootModel.session!
    expect(session.views).toHaveLength(1)
    expect(session.views[0].error).toBe('Assembly notInThisHub not found')
  })

  // a single-file hub's doConnect launches its own LGV at the hub's defaultPos;
  // that would compete with the location the link asked for
  it('silences the connections it is launching the view for', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubSpec(
      { hubURL, viewInit: { loc: 'chr1:1-100', assembly: 'hubAsm' } },
      pluginManager,
    )

    expect(rootModel.session!.connectionInstances[0].silent).toBe(true)
  })

  it('leaves the hub to launch its own view when there is no view init', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubSpec({ hubURL }, pluginManager)

    expect(rootModel.session!.connectionInstances[0].silent).toBe(false)
  })

  // the launcher resolves against an assembly name, and a hub's genome ids are
  // only known to the hub — so this one can't be honored, and must say so
  it('reports a loc with no assembly instead of dropping it silently', async () => {
    const { pluginManager, rootModel } = setup()
    resolvingFetch()

    await loadHubSpec(
      { hubURL, viewInit: { loc: 'chr1:1-100' } },
      pluginManager,
    )

    const session = rootModel.session!
    expect(
      session.snackbarMessages.some(
        (s: { message: string }) =>
          s.message.includes('&loc=') && s.message.includes('&assembly='),
      ),
    ).toBe(true)
    // the hub itself still loaded, non-silently, so its own defaultPos launch
    // remains the best guess available
    expect(session.connectionInstances[0].silent).toBe(false)
  })

  it('names whichever params an assembly-less init carried', async () => {
    const { pluginManager, rootModel } = setup()
    resolvingFetch()

    await loadHubSpec(
      { hubURL, viewInit: { tracklist: true, displayedRegionNames: ['chr1'] } },
      pluginManager,
    )

    expect(
      rootModel.session!.snackbarMessages.some((s: { message: string }) =>
        s.message.startsWith('&tracklist=, &regions= alongside &hubURL='),
      ),
    ).toBe(true)
  })
})

// `?hubURL=…&sessionTracks=[…]` used to open the hub with the tracks silently
// dropped, while the SAME url handed to app-core's parseSessionSpecUrl — which
// is what Desktop's "Open JBrowse Web link…" and the jbrowse:// handler use —
// carried them through. One link, two answers, neither of them announced.
describe('loadHubSpec with sessionTracks', () => {
  const hubURL = ['https://example.com/hubs/my-hub/hub.txt']
  const TRACK = {
    trackId: 'url_track',
    type: 'FeatureTrack',
    name: 'URL track',
    assemblyNames: ['hubAsm'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }

  function pendingFetch() {
    jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))
  }

  it('registers them as session tracks alongside the hub', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubSpec({ hubURL, sessionTracks: [TRACK] }, pluginManager)

    const session = rootModel.session!
    expect(
      session.sessionTracks.map((t: { trackId: string }) => t.trackId),
    ).toEqual(['url_track'])
    // registered by the time the connection exists, which is what lets a view
    // launched after the hub's assembly resolves name the track in `&tracks=`
    expect(session.connectionInstances).toHaveLength(1)
  })

  // the reason addSessionTracks is shared with loadSessionSpec rather than
  // reimplemented here: a hub's tracks belong to the session whoever is
  // looking, and `publishTrackConf` next door would write an admin's into
  // jbrowse.tracks — the config.json served to every visitor
  it('keeps them out of jbrowse.tracks for an admin', () => {
    const { pluginManager, rootModel } = setup({ adminMode: true })
    pendingFetch()

    void loadHubSpec({ hubURL, sessionTracks: [TRACK] }, pluginManager)

    const session = rootModel.session!
    expect(session.sessionTracks).toHaveLength(1)
    expect(session.jbrowse.tracks).toHaveLength(0)
  })

  it('is a no-op when the link carries none', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubSpec({ hubURL }, pluginManager)

    expect(rootModel.session!.sessionTracks).toHaveLength(0)
  })
})
