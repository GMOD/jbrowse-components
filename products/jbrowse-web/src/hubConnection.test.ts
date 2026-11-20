// Drives the UCSC and JBrowse 2 hub connections through jbrowse-web's real
// session model, the only place a connection's own connect() runs against the
// track union, the session's assemblies and its snackbar.
import PluginManager from '@jbrowse/core/PluginManager'
import { when } from 'mobx'

import corePlugins from './corePlugins.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const files: Record<string, string | Promise<string>> = {}

jest.mock('@jbrowse/core/util/io', () => ({
  ...jest.requireActual('@jbrowse/core/util/io'),
  openLocation: (location: { uri: string }) => ({
    readFile: async () => {
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

function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  const rootModel = rootModelFactory({
    pluginManager,
    sessionModelFactory,
    adminMode: false,
  }).create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
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

beforeEach(() => {
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
    expect(messages(session)).toContainEqual(
      expect.stringContaining('alien name (TrackTypeOfAMissingPlugin)'),
    )
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
    await flush()

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
    expect(messages(session)).toContainEqual(expect.stringContaining('broken'))
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
    expect(messages(session)).toContainEqual(
      expect.stringContaining('Skipped data from these assemblies: hg38'),
    )
  })
})
