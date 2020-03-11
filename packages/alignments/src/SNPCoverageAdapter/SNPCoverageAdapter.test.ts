import { toArray } from 'rxjs/operators'
import { LocalFile, GenericFilehandle } from 'generic-filehandle'
import { Observable } from 'rxjs'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration'
import { Instance, SnapshotIn } from 'mobx-state-tree'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import AdapterF from './index'
import CramAdapterF from '../CramAdapter'
import {
  AdapterClass as BamAdapter,
  configSchema as BamConfigSchema,
} from '../BamAdapter'

const pluginManager = new PluginManager()
const { AdapterClass: SNPCoverageAdapter, configSchema } = pluginManager.load(
  AdapterF,
)
const {
  AdapterClass: CramAdapter,
  configSchema: CramConfigSchema,
} = pluginManager.load(CramAdapterF)

pluginManager.configure()

function newSNPCoverageWithBam(bamConf: SnapshotIn<typeof BamConfigSchema>) {
  return new SNPCoverageAdapter(configSchema.create({}), () => {
    return {
      dataAdapter: new BamAdapter(BamConfigSchema.create(bamConf)),
      sessionIds: new Set(),
    }
  })
}

test('SNP adapter can fetch features from volvox.bam using bam subadapter', async () => {
  const adapter = newSNPCoverageWithBam({
    type: 'BamAdapter',
    bamLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.bam'),
    },
    index: {
      location: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
    },
  })

  const features = await adapter.getFeatures(
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 20000,
    },
    {
      bpPerPx: 0.2,
    },
  )

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('ctgA')
  expect(featuresArray[0].get('snpinfo')).toBeTruthy()

  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(20000)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of BamSlightlyLazyFeature toJSON in a SNP adapter', async () => {
  const adapter = newSNPCoverageWithBam({
    type: 'BamAdapter',
    bamLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.bam'),
    },
    index: {
      location: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
    },
  })

  const features = await adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0].toJSON()

  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(0)
  expect(f.end).toBe(1)
  expect(f.snpinfo).toBeTruthy()
})

test('test usage of getMultiRegion stats, SNP adapter can generate a domain from BamFile', async () => {
  const adapter = newSNPCoverageWithBam({
    type: 'BamAdapter',
    bamLocation: {
      localPath: require.resolve('../../test_data/volvox-sorted.bam'),
    },
    index: {
      location: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
      },
      indexType: 'BAI',
    },
  })

  const stats = await adapter.getMultiRegionStats(
    [
      {
        refName: 'ctgA',
        start: 0,
        end: 100,
      },
    ],
    {
      opts: {
        signal: {
          aborted: false,
          onabort: null,
        },
        bpPerPx: 0.2,
      },
    },
  )

  expect(Object.keys(stats).length).toEqual(9)
  expect(stats.scoreMin).toEqual(0)
  expect(stats.scoreMax).toEqual(13)
})

// setup for Cram Adapter Testing
function parseSmallFasta(text: string) {
  return text
    .split('>')
    .filter(t => /\S/.test(t))
    .map(entryText => {
      const [defLine, ...seqLines] = entryText.split('\n')
      const [id, ...descriptionLines] = defLine.split(' ')
      const description = descriptionLines.join(' ')
      const sequence = seqLines.join('').replace(/\s/g, '')
      return { id, description, sequence }
    })
}

type FileHandle = GenericFilehandle

class FetchableSmallFasta {
  data: Promise<ReturnType<typeof parseSmallFasta>>

  constructor(filehandle: FileHandle) {
    this.data = filehandle.readFile().then(buffer => {
      const text = buffer.toString('utf8')
      return parseSmallFasta(text)
    })
  }

  async fetch(id: number, start: number, end: number) {
    const data = await this.data
    const entry = data[id]
    const length = end - start + 1
    if (!entry) throw new Error(`no sequence with id ${id} exists`)
    return entry.sequence.substr(start - 1, length)
  }

  async getSequenceList() {
    const data = await this.data
    return data.map(entry => entry.id)
  }
}

class SequenceAdapter extends BaseFeatureDataAdapter {
  fasta: FetchableSmallFasta

  refNames: string[] = []

  constructor(filehandle: FileHandle) {
    super()
    this.fasta = new FetchableSmallFasta(filehandle)
  }

  async getRefNames() {
    return this.refNames
  }

  getFeatures({
    refName,
    start,
    end,
  }: {
    refName: string
    start: number
    end: number
  }): Observable<SimpleFeature> {
    return new Observable(observer => {
      this.fasta
        .getSequenceList()
        .then(refNames => {
          this.refNames = refNames
        })
        .then(() =>
          this.fasta.fetch(this.refNames.indexOf(refName), start, end),
        )
        .then(ret => {
          observer.next(
            new SimpleFeature({
              uniqueId: `${refName}-${start}-${end}`,
              seq: ret,
              start,
              end,
            }),
          )
          observer.complete()
        })
      return { unsubscribe: () => {} }
    })
  }
}

function newSNPCoverageWithCram(
  cramConf: SnapshotIn<typeof CramConfigSchema>,
  sequenceFileName: string,
) {
  return new SNPCoverageAdapter(configSchema.create({}), () => {
    return {
      dataAdapter: new CramAdapter(CramConfigSchema.create(cramConf), () => {
        return {
          dataAdapter: new SequenceAdapter(new LocalFile(sequenceFileName)),
          sessionIds: new Set(),
        }
      }),
      sessionIds: new Set(),
    }
  })
}

test('SNP adapter can fetch features from volvox.cram using cram subadapter', async () => {
  const adapter = newSNPCoverageWithCram(
    {
      type: 'CramAdapter',
      cramLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram'),
      },
      craiLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
      },
    },
    require.resolve('../../test_data/volvox.fa'),
  )

  const features = await adapter.getFeatures(
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 20000,
    },
    {
      bpPerPx: 0.2,
    },
  )

  const featuresArray = await features.pipe(toArray()).toPromise()
  expect(featuresArray[0].get('refName')).toBe('ctgA')
  expect(featuresArray[0].get('snpinfo')).toBeTruthy()

  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.length).toEqual(20000)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

// test('test usage of CramSlightlyLazyFeature toJSON in a SNP adapter', async () => {
//   const adapter = getAdapter(
//     pluginManager,
//     'testSession',
//     'SNPCoverageAdapter',
//     {
//       cramLocation: {
//         localPath: require.resolve('../../test_data/volvox-sorted.cram'),
//       },
//       craiLocation: {
//         localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
//       },
//       sequenceAdapter: new SequenceAdapter(
//         new LocalFile(require.resolve('../../test_data/volvox.fa')),
//       ),
//     },
//   ).dataAdapter as SNPCoverageAdapter

//   const features = await adapter.getFeatures({
//     assemblyName: 'volvox',
//     refName: 'ctgA',
//     start: 0,
//     end: 100,
//   })
//   const featuresArray = await features.pipe(toArray()).toPromise()
//   const f = featuresArray[0].toJSON()

//   expect(f.refName).toBe('ctgA')
//   expect(f.start).toBe(0)
//   expect(f.end).toBe(1)
//   expect(f.snpinfo).toBeTruthy()
// })

// test('test usage of getMultiRegion stats, SNP adapter can generate a domain from CramFile', async () => {
//   const adapter = getAdapter(
//     pluginManager,
//     'testSession',
//     'SNPCoverageAdapter',
//     {
//       type: 'CramAdapter',
//       cramLocation: {
//         localPath: require.resolve('../../test_data/volvox-sorted.cram'),
//       },
//       craiLocation: {
//         localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
//       },
//       sequenceAdapter: new SequenceAdapter(
//         new LocalFile(require.resolve('../../test_data/volvox.fa')),
//       ),
//     },
//   ).dataAdapter as SNPCoverageAdapter

//   const stats = await adapter.getMultiRegionStats(
//     [
//       {
//         refName: 'ctgA',
//         start: 0,
//         end: 100,
//       },
//     ],
//     {
//       opts: {
//         signal: {
//           aborted: false,
//           onabort: null,
//         },
//         bpPerPx: 0.2,
//       },
//     },
//   )

//   expect(Object.keys(stats).length).toEqual(9)
//   expect(stats.scoreMin).toEqual(0)
//   expect(stats.scoreMax).toEqual(13)
// })
