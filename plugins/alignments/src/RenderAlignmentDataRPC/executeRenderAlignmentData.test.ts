import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'

import { computeReadBaseCounts } from '../features/modCoverage/readBaseCounts.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import { executeRenderAlignmentData } from './executeRenderAlignmentData.ts'

import type * as ReadBaseCounts from '../features/modCoverage/readBaseCounts.ts'
import type { BaseLayer, WorkerFacet } from '../shared/types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

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

const MODIFICATIONS: BaseLayer = { type: 'modifications' }
const BISULFITE: BaseLayer = { type: 'bisulfite' }

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

function run(settings: {
  showCoverage: boolean
  baseLayer?: BaseLayer
  facet?: WorkerFacet
}) {
  jest
    .mocked(fetchFeaturesFromAdapter)
    .mockResolvedValue({ featuresArray: spliced } as unknown as Awaited<
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
      colorBy: { type: 'normal' },
      statusCallback: undefined,
      ...settings,
    } as unknown as RpcExecuteArgs<'RenderAlignmentData'>,
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// Junctions are part of the coverage band, and their splice motifs are the
// only reader of this reference
test.each([
  [true, 1],
  [false, 0],
])(
  'spliced reads read the reference for motifs only with the band (showCoverage %s)',
  async (showCoverage, calls) => {
    await run({ showCoverage })
    expect(fetchReferenceSequence).toHaveBeenCalledTimes(calls)
  },
)

// The modBAM read-base pileup is the mod-coverage bar's denominator and
// nothing else, so no other colouring and no band-less fetch pays for it
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
