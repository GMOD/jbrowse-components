import { toArray } from 'rxjs/operators'
import { LocalFile } from 'generic-filehandle'
import PluginManager from '@jbrowse/core/PluginManager'
import { SnapshotIn } from 'mobx-state-tree'
import AdapterF from './index'
import CramAdapterF from '../CramAdapter'
import BamAdapterF from '../BamAdapter'

import { SequenceAdapter } from '../CramAdapter/CramTestAdapters'

const pluginManager = new PluginManager()
const {
  getAdapterClass: getSNPCoverageAdapter,
  configSchema,
} = pluginManager.load(AdapterF)
const {
  getAdapterClass: getCramAdapter,
  configSchema: CramConfigSchema,
} = pluginManager.load(CramAdapterF)
const {
  getAdapterClass: getBamAdapter,
  configSchema: BamConfigSchema,
} = pluginManager.load(BamAdapterF)

pluginManager.configure()

async function newSNPCoverageWithBam(
  bamConf: SnapshotIn<typeof BamConfigSchema>,
) {
  const BamAdapter = await getBamAdapter()
  const SNPCoverageAdapter = await getSNPCoverageAdapter()
  return new SNPCoverageAdapter(configSchema.create({}), async () => {
    return {
      dataAdapter: new BamAdapter(BamConfigSchema.create(bamConf)),
      sessionIds: new Set(),
    }
  })
}

test('SNP adapter can fetch features from volvox.bam using bam subadapter', async () => {
  const adapter = await newSNPCoverageWithBam({
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

  const features = adapter.getFeatures(
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
  expect(featuresJsonArray.length).toEqual(19998)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()

  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of BamSlightlyLazyFeature toJSON in a SNP adapter', async () => {
  const adapter = await newSNPCoverageWithBam({
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

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0].toJSON()

  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(2)
  expect(f.end).toBe(3)
  expect(f.snpinfo).toBeTruthy()
})

test('test usage of getMultiRegion stats, SNP adapter can generate a domain from BamFile', async () => {
  const adapter = await newSNPCoverageWithBam({
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
        assemblyName: 'volvox',
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
  expect(stats.scoreMin).toEqual(1)
  expect(stats.scoreMax).toEqual(13)
})

async function newSNPCoverageWithCram(
  cramConf: SnapshotIn<typeof CramConfigSchema>,
  sequenceFileName: string,
) {
  const CramAdapter = await getCramAdapter()
  const SNPCoverageAdapter = await getSNPCoverageAdapter()
  return new SNPCoverageAdapter(configSchema.create({}), async () => {
    return {
      dataAdapter: new CramAdapter(
        CramConfigSchema.create(cramConf),
        async () => {
          return {
            dataAdapter: new SequenceAdapter(new LocalFile(sequenceFileName)),
            sessionIds: new Set(),
          }
        },
      ),
      sessionIds: new Set(),
    }
  })
}

test('SNP adapter can fetch features from volvox.cram using cram subadapter', async () => {
  const adapter = await newSNPCoverageWithCram(
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

  const features = adapter.getFeatures(
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
  expect(featuresJsonArray.length).toEqual(19998)
  expect(featuresJsonArray.slice(1000, 1010)).toMatchSnapshot()
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
})

test('test usage of CramSlightlyLazyFeature toJSON in a SNP adapter', async () => {
  const adapter = await newSNPCoverageWithCram(
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

  const features = adapter.getFeatures({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const featuresArray = await features.pipe(toArray()).toPromise()
  const f = featuresArray[0].toJSON()

  expect(f.refName).toBe('ctgA')
  expect(f.start).toBe(2)
  expect(f.end).toBe(3)
  expect(f.snpinfo).toBeTruthy()
})

test('test usage of getMultiRegion stats, SNP adapter can generate a domain from CramFile', async () => {
  const adapter = await newSNPCoverageWithCram(
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

  const stats = await adapter.getMultiRegionStats(
    [
      {
        assemblyName: 'volvox',
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
  expect(stats.scoreMin).toEqual(1)
  expect(stats.scoreMax).toEqual(13)
})
