import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECOND_IN_PAIR,
} from '@jbrowse/cigar-utils'
import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'

import { computeReadBaseCounts } from '../features/modCoverage/readBaseCounts.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import { classifyInsertSize } from '../shared/insertSizeStats.ts'
import { layerForTest } from '../shared/splitFieldForTest.ts'
import { executeRenderAlignmentData } from './executeRenderAlignmentData.ts'

import type * as ReadBaseCounts from '../features/modCoverage/readBaseCounts.ts'
import type { BaseLayer, WorkerFacet } from '../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn().mockResolvedValue({}),
}))
jest.mock('../shared/fetchFeaturesFromAdapter.ts')
jest.mock('../shared/fetchReferenceSequence.ts')
jest.mock('../features/modCoverage/readBaseCounts.ts', () => {
  const actual = jest.requireActual<typeof ReadBaseCounts>(
    '../features/modCoverage/readBaseCounts.ts',
  )
  return { computeReadBaseCounts: jest.fn(actual.computeReadBaseCounts) }
})

const MODIFICATIONS = layerForTest({ field: 'modifications' })
const BISULFITE = layerForTest({ field: 'bisulfite' })

const region = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 400 }

// Two spliced reads, so the region carries a skip gap
const spliced = [0, 1].map(
  i =>
    new SimpleFeature({
      uniqueId: `r${i}`,
      refName: 'ctgA',
      start: 10 + i,
      end: 130 + i,
      strand: 1,
      name: `r${i}`,
      CIGAR: '10M100N10M',
      seq: 'ACGTACGTACGTACGTACGT',
    }),
)

function run(
  settings: {
    showCoverage: boolean
    junctions?: boolean
    baseLayer?: BaseLayer
    facet?: WorkerFacet
    filter?: FieldPredicate[]
  },
  featuresArray: Feature[] = spliced,
) {
  jest
    .mocked(fetchFeaturesFromAdapter)
    .mockResolvedValue({ featuresArray } as unknown as Awaited<
      ReturnType<typeof fetchFeaturesFromAdapter>
    >)
  jest.mocked(fetchReferenceSequence).mockResolvedValue({
    regionSequence: 'a'.repeat(400),
    regionSequenceStart: 0,
  })
  return executeRenderAlignmentData({
    pluginManager: new PluginManager(),
    args: {
      sessionId: 'sess',
      adapterConfig: { type: 'BamAdapter' },
      sequenceAdapter: { type: 'TwoBitAdapter' },
      regions: [region],
      statusCallback: undefined,
      ...settings,
    },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// The junctions' splice motifs are the only reader of this reference, so it
// is read while the reply carries junctions, with or without the band
test.each([
  [true, true, 1],
  [false, true, 1],
  [false, false, 0],
])(
  'spliced reads read the reference for motifs only with junctions (showCoverage %s, junctions %s)',
  async (showCoverage, junctions, calls) => {
    await run({ showCoverage, junctions })
    expect(fetchReferenceSequence).toHaveBeenCalledTimes(calls)
  },
)

// The modBAM read-base pileup is the mod-coverage bar's denominator and
// nothing else, so no other coloring and no band-less fetch pays for it
test.each([
  [MODIFICATIONS, true, 1],
  [MODIFICATIONS, false, 0],
  [undefined, true, 0],
])(
  'the read-base pileup runs under %o with showCoverage %s: %i call(s)',
  async (baseLayer, showCoverage, calls) => {
    await run({ baseLayer, showCoverage })
    expect(computeReadBaseCounts).toHaveBeenCalledTimes(calls)
  },
)

// Both modification layers stay offered in chain mode (menus/colorBy.ts), so
// the fetch serves them under a chain-unit facet too: bisulfite reads the
// reference its C->T calls are against, and modBAM tallies the read-base pileup
// its coverage bar divides by. With the band off, the reference has no other
// reader.
const CHAIN_FACET: WorkerFacet = { field: 'tags.HP', unit: 'chain' }

test.each([undefined, CHAIN_FACET])(
  'bisulfite fetches the reference with facet %o',
  async facet => {
    await run({ showCoverage: false, baseLayer: BISULFITE, facet })
    expect(fetchReferenceSequence).toHaveBeenCalledTimes(1)
  },
)

test.each([undefined, CHAIN_FACET])(
  'the modBAM read-base pileup runs with facet %o',
  async facet => {
    await run({ showCoverage: true, baseLayer: MODIFICATIONS, facet })
    expect(computeReadBaseCounts).toHaveBeenCalledTimes(1)
  },
)

function pair(
  name: string,
  tlen: number,
  flags: number,
  orientation: string,
  score = 60,
) {
  return [SAM_FLAG_FIRST_IN_PAIR, SAM_FLAG_SECOND_IN_PAIR].map(
    (mate, i) =>
      new SimpleFeature({
        uniqueId: `${name}/${i}`,
        refName: 'ctgA',
        start: 10 + i * 200,
        end: 30 + i * 200,
        strand: i === 0 ? 1 : -1,
        name,
        CIGAR: '20M',
        seq: 'ACGTACGTACGTACGTACGT',
        flags: flags | mate | (i === 0 ? 0 : SAM_FLAG_REVERSE),
        template_length: i === 0 ? tlen : -tlen,
        pair_orientation: orientation,
        score,
      }),
  )
}

const PROPER = SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR
const concordant = Array.from({ length: 40 }, (_, i) =>
  pair(`fr${i}`, 300 + ((i * 7) % 200), PROPER, 'F1R2'),
).flat()
const longInserts = [0, 1, 2].map(i =>
  pair(`long${i}`, 5000 + i, SAM_FLAG_PAIRED, 'F1R2'),
)
// Flagged 0x2 by the aligner but facing outward, so `svSignal: 'only'` keeps
// them
const outwardProper = [2500, 2600, 2700, 2800].map(tlen =>
  pair(`rf${tlen}`, tlen, PROPER, 'R1F2'),
)

async function bandOf(featuresArray: Feature[], filter?: FieldPredicate[]) {
  const result = await run({ showCoverage: false, filter }, featuresArray)
  if ('regionTooLarge' in result) {
    throw new Error('the mocked adapter measured no bytes')
  }
  return result.value.groups[0]!.data.insertSizeStats
}

const ONLY_SV_SIGNAL: FieldPredicate[] = [{ field: 'svSignal', equal: true }]

test('keeping only SV evidence keeps the band the unfiltered fetch gives', async () => {
  const reads = [...concordant, ...longInserts.flat()]
  const band = await bandOf(reads)
  expect(band).toBeDefined()
  expect(await bandOf(reads, ONLY_SV_SIGNAL)).toEqual(band)
})

test('outward 0x2 pairs kept as SV evidence do not set the band', async () => {
  const reads = [...concordant, ...longInserts.flat(), ...outwardProper.flat()]
  const band = await bandOf(reads, ONLY_SV_SIGNAL)
  expect(band).toEqual(await bandOf(reads))
  expect(classifyInsertSize(5000, band)).toBe('long')
})

// Proper pairs at MAPQ 0 sit in repeats, where TLEN is arbitrary
test('a mapq floor shapes the band', async () => {
  const repeats = Array.from({ length: 30 }, (_, i) =>
    pair(`mq0_${i}`, 3000 + i * 1500, PROPER, 'F1R2', 0),
  ).flat()
  const passing = await bandOf(concordant)
  const band = await bandOf(
    [...concordant, ...repeats],
    [{ field: 'mapq', gte: 1 }],
  )
  expect(band).toEqual(passing)
  expect(band).not.toEqual(await bandOf([...concordant, ...repeats]))
})
