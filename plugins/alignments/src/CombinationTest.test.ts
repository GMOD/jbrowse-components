import PluginManager from '@jbrowse/core/PluginManager'
import { toArray } from 'rxjs/operators'
import { LocalFile } from 'generic-filehandle'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

import CramAdapter from './CramAdapter/CramAdapter'
import BamAdapter from './BamAdapter/BamAdapter'
import { SequenceAdapter } from './CramAdapter/CramTestAdapters'

import cramConfigSchema from './CramAdapter/configSchema'
import bamConfigSchema from './BamAdapter/configSchema'
import { firstValueFrom } from 'rxjs'

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
  const bamFeaturesArray = await firstValueFrom(bamFeatures.pipe(toArray()))
  const cramFeaturesArray = await firstValueFrom(cramFeatures.pipe(toArray()))
  return { bamFeaturesArray, cramFeaturesArray }
}

type M = { start: number }

async function cigarCheck(f: string) {
  const { cramFeaturesArray, bamFeaturesArray } = await getFeats(
    `../test_data/${f}.cram`,
    `../test_data/${f}.bam`,
  )
  const cramMap = Object.fromEntries(
    cramFeaturesArray.map(f => [f.get('name'), f.get('CIGAR')]),
  )
  const bamMap = Object.fromEntries(
    bamFeaturesArray.map(f => [f.get('name'), f.get('CIGAR')]),
  )
  expect(bamMap).toEqual(cramMap)
}

async function mismatchesCheck(f: string) {
  const { cramFeaturesArray, bamFeaturesArray } = await getFeats(
    `../test_data/${f}.cram`,
    `../test_data/${f}.bam`,
  )
  const cramMap = Object.fromEntries(
    cramFeaturesArray.map(f => [
      f.get('name'),
      f.get('mismatches').sort((a: M, b: M) => b.start - a.start),
    ]),
  )
  const bamMap = Object.fromEntries(
    bamFeaturesArray.map(f => [
      f.get('name'),
      f.get('mismatches').sort((a: M, b: M) => b.start - a.start),
    ]),
  )
  expect(bamMap).toEqual(cramMap)
}

test('match CIGAR across file types', async () => {
  await cigarCheck('volvox-sorted')
  await cigarCheck('volvox-long-reads.fastq.sorted')
})

test('mismatches same across file types', async () => {
  await mismatchesCheck('volvox-sorted')
  await mismatchesCheck('volvox-long-reads.fastq.sorted')
})
