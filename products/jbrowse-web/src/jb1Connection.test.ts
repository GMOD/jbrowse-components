// Drives a JBrowse1Connection through jbrowse-web's real session model, which
// is the only place the connection's own connect() runs: the plugin's tests
// cover the loader and the per-track conversion, and neither sees what the
// connection actually hands setTrackConfs.
import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from './corePlugins.ts'
import rootModelFactory from './rootModel/rootModel.ts'
import sessionModelFactory from './sessionModel/index.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const files: Record<string, string> = {}

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

const DATA_DIR = 'https://example.com/data/'

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
  return rootModel
}

async function connect(tracks: unknown[]) {
  files[`${DATA_DIR}trackList.json`] = JSON.stringify({ tracks })
  const rootModel = setup()
  const { session } = rootModel
  const conf = session.addConnectionConf({
    type: 'JBrowse1Connection',
    connectionId: 'jb1',
    name: 'legacy',
    assemblyNames: ['hg19'],
    dataDirLocation: { uri: DATA_DIR, locationType: 'UriLocation' },
  })
  const instance = session.makeConnection(conf)
  await instance.connect()
  return instance
}

beforeEach(() => {
  for (const k of Object.keys(files)) {
    delete files[k]
  }
})

test('a connection stamps its assembly on the tracks it imports', async () => {
  const instance = await connect([
    {
      label: 'genes',
      key: 'Genes',
      storeClass: 'JBrowse/Store/SeqFeature/GFF3Tabix',
      urlTemplate: 'genes.gff3.gz',
    },
  ])
  expect(instance.tracks).toHaveLength(1)
  expect(instance.tracks[0]!.assemblyNames).toEqual(['hg19'])
})

// a JBrowse 1 sequence store describes the assembly, which the connection is
// handed rather than supplying, and ReferenceSequenceTrack declares neither
// assemblyNames nor category — so one passed through would be a second copy of
// a sequence the assembly already has, wearing two slots JBrowse ignores
test('a connection drops a JBrowse 1 sequence store', async () => {
  const instance = await connect([
    {
      label: 'refseq',
      storeClass: 'JBrowse/Store/SeqFeature/IndexedFasta',
      urlTemplate: 'seq/hg19.fa',
    },
    {
      label: 'genes',
      storeClass: 'JBrowse/Store/SeqFeature/GFF3Tabix',
      urlTemplate: 'genes.gff3.gz',
    },
  ])
  expect(instance.tracks).toHaveLength(1)
  expect(instance.tracks[0]!.type).toBe('FeatureTrack')
})
