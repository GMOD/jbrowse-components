// A `&hubURL=` link is the spec hubLinkSpec builds, loaded by loadSessionSpec
// — the same two calls Desktop's "Open JBrowse Web link..." makes. These drive
// them against jbrowse-web's real session model; the link-level cases go
// through the whole loader.
// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import { hubLinkSpec, loadSessionSpec } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { when } from 'mobx'

import corePlugins from './corePlugins.ts'
import { createPluginManager } from './createPluginManager.ts'
import { createSessionLoaderFromUrl } from './createSessionLoader.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

jest.mock('./makeWorkerInstance', () => () => {})

// the connection's reads, by uri (the session name's read goes through global
// fetch instead), so a test can hold a connection in flight or fail it
const mockReadFile = jest.fn()
jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  openLocation: (location: { uri: string }) => ({
    readFile: () => mockReadFile(location.uri),
    read: () => new Promise(() => {}),
  }),
}))

const HUB_TXT =
  'hub myHub\nshortLabel My Cool Hub\nlongLabel x\ngenomesFile genomes.txt\nemail hub@example.com'
const GENOMES_TXT =
  'genome hubAsm\ntrackDb hubAsm/trackDb.txt\ntwoBitPath hubAsm/hubAsm.2bit'
const TRACKDB_TXT =
  'track genes\ntype bigBed 12\nbigDataUrl genes.bb\nshortLabel Genes\nlongLabel Genes'

// a multi-genome hub: hub.txt and genomes.txt arrive at once, so the hub adds
// hubAsm right away, and its tracks arrive with `trackDb`
function serveHub(trackDb: Promise<string>) {
  mockReadFile.mockImplementation((uri: string) =>
    uri.endsWith('/hub.txt')
      ? Promise.resolve(HUB_TXT)
      : uri.endsWith('/genomes.txt')
        ? Promise.resolve(GENOMES_TXT)
        : uri.endsWith('/trackDb.txt')
          ? trackDb
          : new Promise(() => {}),
  )
}

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

function loadHubLink(
  {
    hubURL,
    viewInit = {},
    sessionTracks,
  }: {
    hubURL: string[]
    viewInit?: Parameters<typeof hubLinkSpec>[1]
    sessionTracks?: Record<string, unknown>[]
  },
  pluginManager: PluginManager,
) {
  return loadSessionSpec(
    hubLinkSpec(hubURL, viewInit, sessionTracks).spec,
    pluginManager,
  )
}

// the whole web route: address bar, loader, plugin manager, session
async function openWebLink(query: string) {
  window.history.replaceState(null, '', `/?config=none&${query}`)
  const loader = createSessionLoaderFromUrl(0)
  loader.setConfigAndPlugins(
    {
      configuration: {
        rpc: { defaultDriver: 'MainThreadRpcDriver' },
        disableAnalytics: true,
      },
    },
    [],
  )
  await loader.loadSessionByType()
  const pluginManager = await createPluginManager(loader, () => {})
  return pluginManager.rootModel?.session
}

function pendingFetch() {
  jest.spyOn(global, 'fetch').mockReturnValue(new Promise(() => {}))
}

function resolvingFetch() {
  jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(
      new Response('hub myHub\nshortLabel My Cool Hub\nlongLabel x'),
    )
}

beforeEach(() => {
  // connections stay in flight by default, so a test that isn't about the
  // connection gets no failure noise out of one
  mockReadFile.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('a hub link', () => {
  // regression: the hub loader used to await the hub.txt fetch *before*
  // calling setSession, leaving rootModel.session undefined while JBrowse
  // rendered (xref ?hubURL=...&config=none "session is undefined")
  it('sets the session synchronously, before the hub.txt fetch resolves', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubLink({ hubURL: ['https://example.com/hub.txt'] }, pluginManager)

    expect(rootModel.session).toBeTruthy()
    expect(rootModel.session?.name).toBe('https://example.com/hub.txt')
  })

  it('uses an explicit &sessionName= for the session name', async () => {
    pendingFetch()

    const session = await openWebLink(
      'hubURL=https://example.com/hub.txt&sessionName=My%20Session',
    )

    expect(session?.name).toBe('My Session')
  })

  it('creates a connection instance for each hub URL', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubLink(
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
    pendingFetch()

    void loadHubLink(
      { hubURL: ['https://example.com/hubs/my-hub/hub.txt'] },
      pluginManager,
    )

    const session = rootModel.session!
    expect(session.sessionConnections[0]!.name).toBe('my-hub')
  })

  it('renames the session and the connection once hub.txt resolves with a shortLabel', async () => {
    const { pluginManager, rootModel } = setup()
    resolvingFetch()

    // the rename comes from its own hub.txt read, not the connection's
    // doConnect, whose own read is held in flight by mockReadFile
    await loadHubLink(
      { hubURL: ['https://example.com/hubs/my-hub/hub.txt'] },
      pluginManager,
    )

    const session = rootModel.session!
    await when(() => session.name === 'My Cool Hub')
    expect(session.sessionConnections[0]!.name).toBe('My Cool Hub')
  })
})

// a hand-written ?hubURL=...&loc=... used to lose the hub entirely: the loader
// ranked the loc/assembly shorthand first and built a bare LGV. The hub now
// wins and the shorthand rides along as the spec's view.
describe('a hub link with a view init', () => {
  const hubURL = ['https://example.com/hubs/my-hub/hub.txt']

  const flush = () => new Promise(resolve => setTimeout(resolve, 0))

  // a hub track's id is a hash of its trackDb stanza, so read it off the hub
  async function hubTrackId() {
    const { pluginManager, rootModel } = setup()
    await loadHubLink({ hubURL }, pluginManager)
    const connection = rootModel.session!.connectionInstances[0]!
    await when(() => !connection.loading)
    return connection.tracks[0]!.trackId
  }

  // a gene-name &loc= searches the index the hub brings with its tracks, so
  // the hub's assembly appearing is not yet enough to launch against
  it('launches the view once the hub has loaded, not when its assembly appears', async () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()
    let releaseTrackDb = (_text: string) => {}
    serveHub(
      new Promise(resolve => {
        releaseTrackDb = resolve
      }),
    )

    const p = loadHubLink(
      { hubURL, viewInit: { loc: 'BRCA1', assembly: 'hubAsm' } },
      pluginManager,
    )
    const session = rootModel.session!
    await when(() => session.assemblyManager.has('hubAsm'))
    await flush()
    expect(session.views).toHaveLength(0)

    releaseTrackDb(TRACKDB_TXT)
    await p

    expect(session.views).toHaveLength(1)
  })

  it('launches with a &tracks= id the hub brings already present', async () => {
    pendingFetch()
    serveHub(Promise.resolve(TRACKDB_TXT))
    const trackId = await hubTrackId()
    const { pluginManager, rootModel } = setup()

    const p = loadHubLink(
      {
        hubURL,
        viewInit: { loc: 'chr1:1-100', assembly: 'hubAsm', tracks: [trackId] },
      },
      pluginManager,
    )
    const session = rootModel.session!
    const presentAtLaunch: boolean[] = []
    void when(
      () => session.views.length > 0,
      () => presentAtLaunch.push(!!session.getTrackById(trackId)),
    )
    await p

    expect(presentAtLaunch).toEqual([true])
    const view = session.views[0] as LinearGenomeViewModel
    expect(view.pendingLaunch).toMatchObject({
      loc: 'chr1:1-100',
      assembly: 'hubAsm',
      tracks: [trackId],
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

    await loadHubLink(
      { hubURL, viewInit: { loc: 'chr1:1-100', assembly: 'notInThisHub' } },
      pluginManager,
    )

    const session = rootModel.session!
    expect(session.views).toHaveLength(1)
    expect((session.views[0] as LinearGenomeViewModel).error).toBe(
      'Assembly notInThisHub not found',
    )
  })

  // a single-file hub's doConnect launches its own LGV at the hub's defaultPos;
  // that would compete with the location the link asked for
  it('silences the connections it is launching the view for', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubLink(
      { hubURL, viewInit: { loc: 'chr1:1-100', assembly: 'hubAsm' } },
      pluginManager,
    )

    expect(rootModel.session!.connectionInstances[0]!.silent).toBe(true)
  })

  it('leaves the hub to launch its own view when there is no view init', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubLink({ hubURL }, pluginManager)

    expect(rootModel.session!.connectionInstances[0]!.silent).toBe(false)
  })

  // the launcher resolves against an assembly name, and a hub's genome ids are
  // only known to the hub — so this one can't be honored, and must say so
  it('reports a loc with no assembly instead of dropping it silently', async () => {
    resolvingFetch()

    const session = await openWebLink(`hubURL=${hubURL[0]}&loc=chr1:1-100`)

    expect(session).toMatchObject({
      snackbarMessages: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringMatching(/&loc=.*&assembly=/),
        }),
      ]),
      // the hub itself still loaded, non-silently, so its own defaultPos
      // launch remains the best guess available
      connectionInstances: [expect.objectContaining({ silent: false })],
    })
  })

  it('names whichever params an assembly-less link carried', async () => {
    resolvingFetch()

    const session = await openWebLink(
      `hubURL=${hubURL[0]}&tracklist=true&regions=chr1`,
    )

    expect(session).toMatchObject({
      snackbarMessages: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringMatching(
            /^&tracklist=, &regions= alongside &hubURL=/,
          ),
        }),
      ]),
    })
  })
})

// `?hubURL=…&sessionTracks=[…]` used to open the hub with the tracks silently
// dropped, while the SAME url handed to app-core's parseSessionSpecUrl — which
// is what Desktop's "Open JBrowse Web link…" and the jbrowse:// handler use —
// carried them through. One link, two answers, neither of them announced.
describe('a hub link with sessionTracks', () => {
  const hubURL = ['https://example.com/hubs/my-hub/hub.txt']
  const TRACK = {
    trackId: 'url_track',
    type: 'FeatureTrack',
    name: 'URL track',
    assemblyNames: ['hubAsm'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }

  it('registers them as session tracks alongside the hub', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubLink({ hubURL, sessionTracks: [TRACK] }, pluginManager)

    const session = rootModel.session!
    expect(session.sessionTracks.map(t => t.trackId)).toEqual(['url_track'])
    // registered by the time the connection exists, which is what lets a view
    // launched after the hub's assembly resolves name the track in `&tracks=`
    expect(session.connectionInstances).toHaveLength(1)
  })

  // a hub's tracks belong to the session whoever is looking, and
  // `publishTrackConf` next door would write an admin's into jbrowse.tracks —
  // the config.json served to every visitor
  it('keeps them out of jbrowse.tracks for an admin', () => {
    const { pluginManager, rootModel } = setup({ adminMode: true })
    pendingFetch()

    void loadHubLink({ hubURL, sessionTracks: [TRACK] }, pluginManager)

    const session = rootModel.session!
    expect(session.sessionTracks).toHaveLength(1)
    expect(session.jbrowse.tracks).toHaveLength(0)
  })

  it('is a no-op when the link carries none', () => {
    const { pluginManager, rootModel } = setup()
    pendingFetch()

    void loadHubLink({ hubURL }, pluginManager)

    expect(rootModel.session!.sessionTracks).toHaveLength(0)
  })
})
