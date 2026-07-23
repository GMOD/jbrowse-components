import fs from 'fs'

import { buildConsensusTally, computeConsensus } from '@jbrowse/alignments-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { LocalFile } from 'generic-filehandle2'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import CramAdapter from '../CramAdapter/CramAdapter.ts'
import { SequenceAdapter } from '../CramAdapter/CramTestAdapters.ts'
import cramConfigSchema from '../CramAdapter/configSchema.ts'

import type { ConsensusFeature } from '@jbrowse/alignments-core'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

// CRAM shares the same data as volvox-sorted.bam, so it must reproduce the
// same samtools-verified consensus — this exercises the CRAM mismatch/inserted-
// base decode path (readFeaturesToMismatches) end to end.

function loadCtgA() {
  const fa = fs.readFileSync(
    require.resolve('../../test_data/volvox.fa'),
    'utf8',
  )
  const seq: string[] = []
  let inCtgA = false
  for (const line of fa.split('\n')) {
    if (line.startsWith('>')) {
      inCtgA = line.slice(1).split(/\s/)[0] === 'ctgA'
    } else if (inCtgA) {
      seq.push(line.trim())
    }
  }
  return seq.join('')
}

const pluginManager = new PluginManager()
const getVolvoxSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new SequenceAdapter(
    new LocalFile(require.resolve('../../test_data/volvox.fa')),
  ),
  sessionIds: new Set(),
})

function makeAdapter() {
  const adapter = new CramAdapter(
    cramConfigSchema.create({
      cramLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram'),
        locationType: 'LocalPathLocation',
      },
      craiLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.cram.crai'),
        locationType: 'LocalPathLocation',
      },
    }),
    getVolvoxSequenceSubAdapter,
    pluginManager,
  )
  adapter.setSequenceAdapterConfig({ type: 'TestSequenceAdapter' })
  return adapter
}

const CASES = [
  {
    key: '0-200',
    insertions: false,
    golden:
      'NNTTGTTGCGGAGTTGAACAACGGCATTAGGAACACTTCCGTCTCTCACTTTTATACGATTATGATTGGTTCTTTAGCCTTGGTTTAGATTGGTAGTAGTAGCGGCGCTAATGCTACCTGAATTGAGAACTCGAGCGGGGGCTAGGCAAATTCTGATTCAGCCTGACTTCTCTTGGAACCCTGCCCATAAATCAAAGGGT',
  },
  {
    key: '15000-15200',
    insertions: true,
    golden:
      'CCACATTCAGCTCTCGGTAACATGGGAGGCTTGTGGTTGCACCGTAAAAGGGGGATAGCCCATCCATCCTGTAAACCAACAATCGCGCGTAGCTTAATACGCTCACATTAGACATTCGATCGAGAGACCTGGTTTCAAGAGCCTTCCCTTTTGCTTTAGTGGGCCCAAATCGCAACCCTGCTCCCCTCCCTTACGCCTTAT',
  },
]

test.each(CASES)(
  'CRAM consensus matches samtools --mode simple for ctgA $key',
  async ({ key, insertions, golden }) => {
    const [start, end] = key.split('-').map(Number) as [number, number]
    const ctgA = loadCtgA()
    const region = { assemblyName: 'volvox', refName: 'ctgA', start, end }
    const features = (await firstValueFrom(
      makeAdapter().getFeatures(region).pipe(toArray()),
    )) as unknown as ConsensusFeature[]

    const tally = buildConsensusTally(features, region)
    // Pins callFract to samtools' own default explicitly, independent of
    // computeConsensus's.
    const consensus = computeConsensus(ctgA.slice(start, end), tally, {
      includeInsertions: insertions,
      callFract: 0.75,
    })

    expect(consensus).toBe(golden)
  },
)
