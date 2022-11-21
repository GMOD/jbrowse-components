import PluginManager from '@jbrowse/core/PluginManager'
import { toArray } from 'rxjs/operators'
import { LocalFile } from 'generic-filehandle'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

import CramAdapter from './CramAdapter/CramAdapter'
import BamAdapter from './BamAdapter/BamAdapter'
import { SequenceAdapter } from './CramAdapter/CramTestAdapters'

import cramConfigSchema from './CramAdapter/configSchema'
import bamConfigSchema from './BamAdapter/configSchema'

const pluginManager = new PluginManager()

const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => {
  return {
    dataAdapter: new SequenceAdapter(
      new LocalFile(require.resolve('../test_data/volvox.fa')),
    ),
    sessionIds: new Set(),
  }
}

async function getFeats(f1: string, f2: string) {
  const cramAdapter = new CramAdapter(
    cramConfigSchema.create({
      cramLocation: {
        localPath: require.resolve(f1),
      },
      craiLocation: {
        localPath: require.resolve(f1 + '.crai'),
      },
    }),
    getVolvoxSequenceSubAdapter,
    pluginManager,
  )

  const bamAdapter = new BamAdapter(
    bamConfigSchema.create({
      bamLocation: {
        localPath: require.resolve(f2),
      },
      index: {
        location: {
          localPath: require.resolve(f2 + '.bai'),
        },
      },
    }),
  )
  const query = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 1,
    end: 10200,
  }
  const bamFeatures = bamAdapter.getFeatures(query)
  const cramFeatures = cramAdapter.getFeatures(query)
  const bamFeaturesArray = await bamFeatures.pipe(toArray()).toPromise()
  const cramFeaturesArray = await cramFeatures.pipe(toArray()).toPromise()
  return { bamFeaturesArray, cramFeaturesArray }
}

test('match CIGAR across file types', async () => {
  const { cramFeaturesArray, bamFeaturesArray } = await getFeats(
    '../test_data/volvox-sorted.cram',
    '../test_data/volvox-sorted.bam',
  )
  const cramMap = Object.fromEntries(
    cramFeaturesArray.map(f => [f.get('name'), f.get('CIGAR')]),
  )
  const bamMap = Object.fromEntries(
    bamFeaturesArray.map(f => [f.get('name'), f.get('CIGAR')]),
  )
  expect(bamMap).toEqual(cramMap)
})

test('mismatches same across file types', async () => {
  const { cramFeaturesArray, bamFeaturesArray } = await getFeats(
    '../test_data/volvox-sorted.cram',
    '../test_data/volvox-sorted.bam',
  )
  const cramMap = Object.fromEntries(
    cramFeaturesArray.map(f => [
      f.get('name'),
      f
        .get('mismatches')
        .sort(
          (a: { start: number }, b: { start: number }) => b.start - a.start,
        ),
    ]),
  )
  const bamMap = Object.fromEntries(
    bamFeaturesArray.map(f => [
      f.get('name'),
      f
        .get('mismatches')
        .sort(
          (a: { start: number }, b: { start: number }) => b.start - a.start,
        ),
    ]),
  )
  const b = bamFeaturesArray.find(
    f => f.get('name') === 'ctgA_9977_10531_4:0:0_5:0:0_11f1',
  )
  const c = cramFeaturesArray.find(
    f => f.get('name') === 'ctgA_9977_10531_4:0:0_5:0:0_11f1',
  )

  expect(bamMap).toEqual(cramMap)
})
