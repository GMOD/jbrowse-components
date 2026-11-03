import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from '../BamAdapter/BamAdapter.ts'
import configSchema from '../BamAdapter/configSchema.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import { stringifyCoverageBedGraph } from './coverage.ts'

import type { AssemblyHost } from '@jbrowse/core/util'

const session = {
  assemblyManager: { get: () => undefined },
} as unknown as AssemblyHost

// `samtools depth -r ctgA:3840-3880` over the same file, as bedGraph runs:
// samtools leaves a deletion out of the depth as the coverage band does, and
// this file holds no read its default flag filter drops. The 5 at 3858 is the
// one-base deletion a dozen reads carry there.
const SAMTOOLS_DEPTH = [
  'ctgA\t3839\t3843\t17',
  'ctgA\t3843\t3844\t18',
  'ctgA\t3844\t3847\t17',
  'ctgA\t3847\t3850\t18',
  'ctgA\t3850\t3851\t17',
  'ctgA\t3851\t3856\t16',
  'ctgA\t3856\t3857\t17',
  'ctgA\t3857\t3858\t15',
  'ctgA\t3858\t3859\t5',
  'ctgA\t3859\t3866\t17',
  'ctgA\t3866\t3867\t18',
  'ctgA\t3867\t3868\t17',
  'ctgA\t3868\t3870\t18',
  'ctgA\t3870\t3872\t17',
  'ctgA\t3872\t3879\t16',
  'ctgA\t3879\t3880\t15',
]

test('the depth of a BAM region matches samtools depth', async () => {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
  const region = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 3839,
    end: 3880,
  }
  // serialized and revived, as CoreGetFeatures hands them to the export
  const reads = (
    await firstValueFrom(adapter.getFeatures(region).pipe(toArray()))
  ).map(f => new SimpleFeature(f.toJSON()))

  expect(
    stringifyCoverageBedGraph({
      features: reads,
      regions: [region],
      session,
      assemblyName: 'volvox',
    }).split('\n'),
  ).toEqual(SAMTOOLS_DEPTH)
})

test('a skipped intron adds no depth, and an uncovered base no row', () => {
  const read = (id: string, start: number, CIGAR: string, end: number) =>
    new SimpleFeature({ uniqueId: id, refName: 'ctgA', start, end, CIGAR })
  expect(
    stringifyCoverageBedGraph({
      features: [
        read('spliced', 10, '5M10N5M', 30),
        read('short', 40, '5M', 45),
      ],
      regions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
      ],
      session,
      assemblyName: 'volvox',
    }).split('\n'),
  ).toEqual(['ctgA\t10\t15\t1', 'ctgA\t25\t30\t1', 'ctgA\t40\t45\t1'])
})
