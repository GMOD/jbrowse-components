// Drives the UCSC and JBrowse 2 hub connections through jbrowse-web's real
// session model: a connection's own connect() against the track union, the
// session's assemblies and its snackbar.
import PluginManager from '@jbrowse/core/PluginManager'
import { when } from 'mobx'

import corePlugins from './corePlugins.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

jest.mock('./makeWorkerInstance', () => () => {})

const files: Record<string, string | Promise<string>> = {}
const mockReads: string[] = []

jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  openLocation: (location: { uri: string }) => ({
    readFile: async () => {
      mockReads.push(location.uri)
      const body = files[location.uri]
      if (body === undefined) {
        throw new Error(`HTTP 404 fetching ${location.uri}`)
      }
      return body
    },
  }),
}))

const HUB = 'https://example.com/hub/'
const JB2 = 'https://example.com/jb2/config.json'

function uri(location: string) {
  return { uri: location, locationType: 'UriLocation' }
}

function assembly(name: string) {
  return {
    name,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}-ref`,
      adapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: uri(`https://example.com/${name}.2bit`),
      },
    },
  }
}

function track(trackId: string, assemblyName: string, type = 'FeatureTrack') {
  return {
    type,
    trackId,
    name: `${trackId} name`,
    assemblyNames: [assemblyName],
    adapter: {
      type: 'BigBedAdapter',
      bigBedLocation: uri(`https://example.com/${trackId}.bb`),
    },
  }
}

function trackDb(name: string) {
  return `track ${name}\ntype bigBed 12\nbigDataUrl ${name}.bb\nshortLabel ${name}\nlongLabel ${name}`
}

function serveUcscHub(genomes: string) {
  files[`${HUB}hub.txt`] =
    'hub myHub\nshortLabel My Hub\nlongLabel x\ngenomesFile genomes.txt\nemail hub@example.com'
  files[`${HUB}genomes.txt`] = genomes
}

function setup(
  tracks: ReturnType<typeof track>[] = [],
  assemblies: Record<string, unknown>[] = [],
) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const rootModel = rootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: false,
  }).create(
    {
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
        tracks,
        assemblies,
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(rootModel)
  pluginManager.configure()
  rootModel.setSession({ name: 'testSession' })
  return rootModel.session!
}

type Session = ReturnType<typeof setup>

function settled(session: Session) {
  return when(() => session.connectionInstances.every(c => !c.loading))
}

function addJb2Hub(session: Session, extra: Record<string, unknown> = {}) {
  return session.addConnectionConf({
    type: 'JB2TrackHubConnection',
    connectionId: 'jb2',
    name: 'Other site',
    configJsonLocation: uri(JB2),
    ...extra,
  })
}

function addUcscHub(session: Session) {
  return session.addConnectionConf({
    type: 'UCSCTrackHubConnection',
    connectionId: 'ucsc',
    name: 'My Hub',
    hubTxtLocation: uri(`${HUB}hub.txt`),
  })
}

function trackIds(session: Session) {
  return session.connectionInstances.flatMap(c =>
    c.tracks.map((t: { trackId: string }) => t.trackId),
  )
}

function sessionAssemblyNames(session: Session) {
  return session.sessionAssemblies.map((a: { name: string }) => a.name)
}

function messages(session: Session) {
  return session.snackbarMessages.map(m => m.message)
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

async function readStarted(location: string) {
  while (!mockReads.includes(location)) {
    await flush()
  }
}

beforeEach(() => {
  mockReads.length = 0
  for (const k of Object.keys(files)) {
    delete files[k]
  }
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('a JBrowse 2 hub', () => {
  it('loads its other tracks when one has a type this site lacks', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA')],
      tracks: [
        track('first', 'asmA'),
        track('alien', 'asmA', 'TrackTypeOfAMissingPlugin'),
        track('last', 'asmA'),
      ],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session))
    await settled(session)

    expect(trackIds(session)).toEqual(['first', 'last'])
    expect(session.snackbarMessages.at(-1)).toMatchObject({
      message:
        'Other site: left out 1 track of a type this JBrowse has no plugin for: TrackTypeOfAMissingPlugin',
      level: 'warning',
    })
  })

  it('imports only the genomes assemblyNames lists', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA'), assembly('asmB')],
      tracks: [track('a', 'asmA'), track('b', 'asmB')],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['asmB'] }))
    await settled(session)

    expect(sessionAssemblyNames(session)).toEqual(['asmB'])
    expect(trackIds(session)).toEqual(['b'])
  })

  it('keeps a track that pairs a listed genome with another', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA'), assembly('asmB')],
      tracks: [
        track('a', 'asmA'),
        track('b', 'asmB'),
        { ...track('pair', 'asmA'), assemblyNames: ['asmA', 'elsewhere'] },
      ],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['asmA'] }))
    await settled(session)

    expect(trackIds(session)).toEqual(['a', 'pair'])
  })

  // the Hubs plugin lists the name a link asked for, which a hosted config
  // carries as an alias of an accession
  it('imports a genome assemblyNames lists by an alias', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [
        { ...assembly('GCF_1'), aliases: ['rn8'] },
        assembly('asmB'),
      ],
      tracks: [track('rat', 'GCF_1'), track('b', 'asmB')],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['rn8'] }))
    await settled(session)

    expect(sessionAssemblyNames(session)).toEqual(['GCF_1'])
    expect(trackIds(session)).toEqual(['rat'])
  })

  it('keeps a track that names a listed genome by its alias', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [{ ...assembly('hg38'), aliases: ['GRCh38'] }],
      tracks: [track('byName', 'hg38'), track('byAlias', 'GRCh38')],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['hg38'] }))
    await settled(session)

    expect(trackIds(session)).toEqual(['byName', 'byAlias'])
  })

  it('keeps the tracks of a listed genome the hub does not itself declare', async () => {
    files[JB2] = JSON.stringify({
      tracks: [track('mine', 'hg38'), track('other', 'mm39')],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['hg38'] }))
    await settled(session)

    expect(trackIds(session)).toEqual(['mine'])
  })

  it('keeps the tracks of a genome assemblyNames lists by the name the site knows it by', async () => {
    files[JB2] = JSON.stringify({
      tracks: [track('mine', 'hg38'), track('other', 'mm39')],
    })
    const session = setup([], [{ ...assembly('GRCh38'), aliases: ['hg38'] }])

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['GRCh38'] }))
    await settled(session)

    expect(trackIds(session)).toEqual(['mine'])
  })

  it('fails when assemblyNames lists none of its genomes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA')],
      tracks: [track('a', 'asmA')],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['hg38'] }))
    await when(() => session.connectionInstances.length === 0)

    expect(sessionAssemblyNames(session)).toEqual([])
    expect(messages(session)).toContainEqual(
      expect.stringContaining("none of this hub's genomes is named hg38"),
    )
  })

  it('imports every genome when assemblyNames is empty', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA'), assembly('asmB')],
      tracks: [track('a', 'asmA'), track('b', 'asmB')],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session))
    await settled(session)

    expect(sessionAssemblyNames(session)).toEqual(['asmA', 'asmB'])
    expect(trackIds(session)).toEqual(['a', 'b'])
  })

  it('adds nothing when it is deleted while its config.json is in flight', async () => {
    let arrive = (_body: string) => {}
    files[JB2] = new Promise<string>(resolve => {
      arrive = resolve
    })
    const session = setup()
    const conf = addJb2Hub(session)
    session.makeConnection(conf)
    await readStarted(JB2)

    session.deleteConnection(conf)
    arrive(
      JSON.stringify({
        assemblies: [assembly('asmA')],
        tracks: [track('a', 'asmA')],
      }),
    )
    await flush()

    expect(sessionAssemblyNames(session)).toEqual([])
    expect(messages(session)).toEqual([])
  })

  it('reports nothing when its config.json fails after it was deleted', async () => {
    let fail = (_error: Error) => {}
    files[JB2] = new Promise<string>((_resolve, reject) => {
      fail = reject
    })
    const session = setup()
    const conf = addJb2Hub(session)
    session.makeConnection(conf)
    await readStarted(JB2)

    session.deleteConnection(conf)
    fail(new Error('HTTP 500'))
    await flush()

    expect(messages(session)).toEqual([])
  })

  it('reads a track written as a trackId and a uri', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA')],
      tracks: [
        {
          trackId: 'loose',
          uri: 'https://example.com/genes.bb',
          assemblyNames: ['asmA'],
        },
      ],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session))
    await settled(session)

    expect(session.getTrackById('loose')).toMatchObject({
      type: 'FeatureTrack',
      adapter: { type: 'BigBedAdapter' },
    })
  })

  it('leaves an open config track alone when its trackId is also a hub track', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA')],
      tracks: [track('a', 'asmA'), track('b', 'asmA')],
    })
    const session = setup([{ ...track('a', 'asmA'), name: 'my track' }])
    const conf = addJb2Hub(session)
    session.makeConnection(conf)
    await settled(session)
    const view = session.addView(
      'LinearGenomeView',
      {},
    ) as LinearGenomeViewModel
    view.showTrack('a')
    view.showTrack('b')
    await when(() => view.tracks.length === 2)

    expect(view.tracks.map(t => t.configuration.name)).toEqual([
      'my track',
      'b name',
    ])
    session.deleteConnection(conf)
    expect(view.tracks.map(t => t.configuration.name)).toEqual(['my track'])
  })

  it('loads every track when one holds a value its slot refuses', async () => {
    files[JB2] = JSON.stringify({
      assemblies: [assembly('asmA')],
      tracks: [
        track('good', 'asmA'),
        {
          ...track('bad', 'asmA'),
          displays: [
            {
              type: 'LinearBasicDisplay',
              displayId: 'bad-LinearBasicDisplay',
              heightMode: 'shrink',
            },
          ],
        },
      ],
    })
    const session = setup()

    session.makeConnection(addJb2Hub(session))
    await settled(session)

    expect(trackIds(session)).toEqual(['good', 'bad'])
  })
})

describe('a UCSC hub', () => {
  it('loads the genomes whose trackDb it can read and names the one it cannot', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    serveUcscHub(
      [
        'genome good\ntrackDb good/trackDb.txt\ntwoBitPath good/good.2bit',
        'genome broken\ntrackDb broken/trackDb.txt\ntwoBitPath broken/broken.2bit',
      ].join('\n\n'),
    )
    files[`${HUB}good/trackDb.txt`] = trackDb('genes')
    const session = setup()

    session.makeConnection(addUcscHub(session))
    await settled(session)

    expect(session.connectionInstances).toHaveLength(1)
    expect(trackIds(session)).toHaveLength(1)
    expect(sessionAssemblyNames(session)).toEqual(['good', 'broken'])
    expect(session.snackbarMessages).toEqual([
      expect.objectContaining({
        message:
          'Loaded data from these assemblies: good (1 track). Could not read the tracks of these assemblies: broken',
        level: 'warning',
      }),
    ])
  })

  it('adds nothing when it is deleted while a trackDb is in flight', async () => {
    let arrive = (_body: string) => {}
    serveUcscHub(
      'genome hubAsm\ntrackDb hubAsm/trackDb.txt\ntwoBitPath hubAsm/hubAsm.2bit',
    )
    files[`${HUB}hubAsm/trackDb.txt`] = new Promise<string>(resolve => {
      arrive = resolve
    })
    const session = setup()
    const conf = addUcscHub(session)
    session.makeConnection(conf)
    await readStarted(`${HUB}hubAsm/trackDb.txt`)

    session.deleteConnection(conf)
    arrive(trackDb('genes'))
    await flush()

    expect(sessionAssemblyNames(session)).toEqual([])
    expect(messages(session)).toEqual([])
  })

  it('refuses a single-file hub for a genome the site lacks and the hub does not supply', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    files[`${HUB}hub.txt`] = [
      'hub myHub\nshortLabel My Hub\nlongLabel x\nuseOneFile on\nemail hub@example.com',
      'genome hg38',
      trackDb('genes'),
    ].join('\n\n')
    const session = setup()

    session.makeConnection(addUcscHub(session))
    await when(() => session.connectionInstances.length === 0)

    expect(sessionAssemblyNames(session)).toEqual([])
    expect(messages(session)).toContainEqual(
      expect.stringContaining('the hub supplies no sequence for it'),
    )
  })

  it('keeps the tracks of a genome assemblyNames lists by the name the site knows it by', async () => {
    files[JB2] = JSON.stringify({
      tracks: [track('mine', 'hg38'), track('other', 'mm39')],
    })
    const session = setup([], [{ ...assembly('GRCh38'), aliases: ['hg38'] }])

    session.makeConnection(addJb2Hub(session, { assemblyNames: ['GRCh38'] }))
    await settled(session)

    expect(trackIds(session)).toEqual(['mine'])
  })

  it('fails when assemblyNames lists none of its genomes', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    serveUcscHub('genome good\ntrackDb good/trackDb.txt\ntwoBitPath good.2bit')
    files[`${HUB}good/trackDb.txt`] = trackDb('genes')
    const session = setup()

    session.makeConnection(
      session.addConnectionConf({
        type: 'UCSCTrackHubConnection',
        connectionId: 'ucsc',
        name: 'My Hub',
        assemblyNames: ['hg38'],
        hubTxtLocation: uri(`${HUB}hub.txt`),
      }),
    )
    await when(() => session.connectionInstances.length === 0)

    expect(sessionAssemblyNames(session)).toEqual([])
    expect(messages(session)).toContainEqual(
      expect.stringContaining("none of this hub's genomes is named hg38"),
    )
  })

  it('imports a genome assemblyNames lists by the name the site knows it by', async () => {
    serveUcscHub('genome hg38\ntrackDb hg38/trackDb.txt')
    files[`${HUB}hg38/trackDb.txt`] = trackDb('genes')
    const session = setup([], [{ ...assembly('GRCh38'), aliases: ['hg38'] }])

    session.makeConnection(
      session.addConnectionConf({
        type: 'UCSCTrackHubConnection',
        connectionId: 'ucsc',
        name: 'My Hub',
        assemblyNames: ['GRCh38'],
        hubTxtLocation: uri(`${HUB}hub.txt`),
      }),
    )
    await settled(session)

    expect(trackIds(session)).toHaveLength(1)
    expect(sessionAssemblyNames(session)).toEqual([])
  })

  it('fails as a whole when no trackDb can be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    serveUcscHub(
      'genome broken\ntrackDb broken/trackDb.txt\ntwoBitPath broken/broken.2bit',
    )
    const session = setup()

    session.makeConnection(addUcscHub(session))
    await when(() => session.connectionInstances.length === 0)

    expect(messages(session)).toContainEqual(
      expect.stringContaining('HTTP 404'),
    )
  })

  it('skips a genome the site lacks when the hub supplies no sequence for it', async () => {
    serveUcscHub('genome hg38\ntrackDb hg38/trackDb.txt')
    files[`${HUB}hg38/trackDb.txt`] = trackDb('genes')
    const session = setup()

    session.makeConnection(addUcscHub(session))
    await settled(session)

    expect(sessionAssemblyNames(session)).toEqual([])
    expect(trackIds(session)).toEqual([])
    expect(session.snackbarMessages).toEqual([
      expect.objectContaining({
        message: 'Skipped data from these assemblies: hg38',
        level: 'warning',
      }),
    ])
  })
})
