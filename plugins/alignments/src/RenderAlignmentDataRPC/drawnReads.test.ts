import { readIdAt, readNameAt, svSignalTier } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECOND_IN_PAIR,
} from '@jbrowse/cigar-utils'
import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import { getCoverageBin } from '../LinearAlignmentsDisplay/components/positionStats.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { readCategoryBitsOf } from '../shared/splitAlignment.ts'
import { executeRenderAlignmentData } from './executeRenderAlignmentData.ts'
import { filterChainFeatures } from './filterChainFeatures.ts'

import type { WorkerFacet } from '../shared/types.ts'
import type { WorkerPileupData } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn().mockResolvedValue({}),
}))
jest.mock('../shared/fetchFeaturesFromAdapter.ts')

const region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50000,
}

async function svReads() {
  const path = require.resolve('../../../../test_data/volvox/volvox-sv.bam')
  const adapter = new BamAdapter(
    bamConfigSchema.create({
      bamLocation: { localPath: path, locationType: 'LocalPathLocation' },
      index: {
        location: {
          localPath: `${path}.bai`,
          locationType: 'LocalPathLocation',
        },
      },
    }),
    getVolvoxSequenceSubAdapter,
    undefined,
    volvoxReference,
  )
  return firstValueFrom(
    adapter.getFeatures(region, { filter: [] }).pipe(toArray()),
  )
}

async function groupsOf(
  featuresArray: Feature[],
  filter: FieldPredicate[] = [],
  facet?: WorkerFacet,
  tooltipField?: string,
) {
  jest
    .mocked(fetchFeaturesFromAdapter)
    .mockResolvedValue({ featuresArray } as unknown as Awaited<
      ReturnType<typeof fetchFeaturesFromAdapter>
    >)
  const result = await executeRenderAlignmentData({
    pluginManager: new PluginManager(),
    args: {
      sessionId: 'sess',
      adapterConfig: { type: 'BamAdapter' },
      regions: [region],
      statusCallback: undefined,
      showCoverage: true,
      filter,
      facet,
      tooltipField,
    },
  })
  if ('regionTooLarge' in result) {
    throw new Error('the mocked adapter measured no bytes')
  }
  return result.value.groups.map(g => g.data)
}

async function dataOf(
  featuresArray: Feature[],
  filter?: FieldPredicate[],
  tooltipField?: string,
) {
  return (await groupsOf(featuresArray, filter, undefined, tooltipField))[0]!
}

function bytes(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
}

// What the band draws and the tooltip reads, as arrays a toEqual compares
function band(d: WorkerPileupData) {
  return {
    depths: [...d.coverageDepths],
    snp: bytes(d.snpPackedBuffer),
    interbase: bytes(d.interbasePackedBuffer),
    indicators: [...d.indicatorPositions],
    sashimi: [...d.sashimiX1, ...d.sashimiX2, ...d.sashimiCounts],
  }
}

function readKeys(d: WorkerPileupData) {
  return Array.from({ length: d.readPositions.length / 2 }, (_, i) =>
    readIdAt(d, i),
  )
}

// The instances the pileup draws, as an unfiltered fetch of only the drawn
// reads gives them
function drawnInstances(d: WorkerPileupData) {
  return {
    mismatches: [...d.mismatchPositions],
    mismatchReads: [...d.mismatchReadIndices],
    gaps: [...d.gapPositions],
    gapReads: [...d.gapReadIndices],
    interbase: [...d.interbasePositions],
    interbaseReads: [...d.interbaseReadIndices],
    interbaseBlocks: [d.numInsertions, d.numSoftclips, d.numHardclips],
    segments: [...d.segmentPositions],
    segmentReads: [...d.segmentReadIndices],
    categories: [...d.readCategoryBits],
    clips: [...(d.readClipAtStart ?? [])],
  }
}

const DRAWN_FILTERS: [string, FieldPredicate[]][] = [
  ['svSignal', [{ field: 'svSignal', equal: true }]],
  ['split', [{ field: 'split', equal: true }]],
  ['not split', [{ field: 'split', equal: false }]],
  ['alone', [{ field: 'alone', equal: true }]],
  ['spliced', [{ field: 'spliced', equal: true }]],
  ['name', [{ field: 'name', equal: 'ctgA_1041_1553_0:0:0_1:0:0_255' }]],
]

let reads: Feature[]

beforeAll(async () => {
  reads = await svReads()
})

test('the fixture has reads to leave out', () => {
  expect(reads.length).toBeGreaterThan(1000)
  expect(filterChainFeatures(reads, DRAWN_FILTERS[0]![1]).length).toBeLessThan(
    reads.length / 2,
  )
})

test.each(DRAWN_FILTERS)(
  'the band counts every read under a %s filter',
  async (_, filter) => {
    expect(band(await dataOf(reads, filter))).toEqual(band(await dataOf(reads)))
  },
)

test.each(DRAWN_FILTERS)(
  'a %s filter draws what a fetch of only its reads draws',
  async (_, filter) => {
    const drawn = filterChainFeatures(reads, filter)
    expect(drawn.length).toBeLessThan(reads.length)
    const filtered = await dataOf(reads, filter)
    const alone = await dataOf(drawn)
    expect(readKeys(filtered)).toEqual(readKeys(alone))
    expect(drawnInstances(filtered)).toEqual(drawnInstances(alone))
  },
)

test('the coverage tooltip counts the reads the filter leaves out', async () => {
  const all = await dataOf(reads)
  const filtered = await dataOf(reads, [{ field: 'svSignal', equal: true }])
  const positions = [...new Set(all.mismatchPositions)]
  expect(positions.length).toBeGreaterThan(100)
  for (const position of positions) {
    expect(getCoverageBin(position, filtered)).toEqual(
      getCoverageBin(position, all),
    )
  }
})

test('a drawn mismatch fades by its share of every read', async () => {
  const all = await dataOf(reads)
  const filtered = await dataOf(reads, [{ field: 'svSignal', equal: true }])
  const frequencyAt = (d: WorkerPileupData) =>
    new Map(
      Array.from(d.mismatchPositions, (p, i) => [
        `${p}:${d.mismatchBases[i]}`,
        d.mismatchFrequencies[i],
      ]),
    )
  const unfiltered = frequencyAt(all)
  const drawn = [...frequencyAt(filtered)]
  expect(drawn.length).toBeGreaterThan(0)
  for (const [key, frequency] of drawn) {
    expect(frequency).toBe(unfiltered.get(key))
  }
})

test('sample events ship only while the filter leaves reads out', async () => {
  const all = await dataOf(reads)
  expect(all.sampleEvents).toBeUndefined()
  const filtered = await dataOf(reads, [{ field: 'svSignal', equal: true }])
  expect(filtered.sampleEvents?.mismatchPositions).toEqual(
    all.mismatchPositions,
  )
})

const PROPER = SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR

// read1 forward and split at its 3' end, read2 a concordant reverse mate
function splitPair(name: string, start: number) {
  const common = {
    refName: 'ctgA',
    name,
    pair_orientation: 'F1R2',
    score: 60,
  }
  return [
    new SimpleFeature({
      ...common,
      uniqueId: `${name}/1`,
      start,
      end: start + 50,
      strand: 1,
      CIGAR: '50M50S',
      flags: PROPER | SAM_FLAG_FIRST_IN_PAIR,
      template_length: 300,
      tags: { SA: 'ctgA,30000,+,50S50M,60,0;' },
    }),
    new SimpleFeature({
      ...common,
      uniqueId: `${name}/2`,
      start: start + 200,
      end: start + 300,
      strand: -1,
      CIGAR: '100M',
      flags: PROPER | SAM_FLAG_SECOND_IN_PAIR | SAM_FLAG_REVERSE,
      template_length: -300,
    }),
  ]
}

test('a strand facet keeps both mates of an SV-evidence chain', async () => {
  const filter: FieldPredicate[] = [{ field: 'svSignal', equal: true }]
  const pairs = [splitPair('split', 1000), splitPair('plain', 2000)]
  const [read1, read2] = pairs[0]!
  expect(svSignalTier(readCategoryBitsOf(read1!))).toBeGreaterThan(0)
  expect(svSignalTier(readCategoryBitsOf(read2!))).toBe(0)
  const sections = await groupsOf(
    [...pairs[0]!, ...pairs[1]!.slice(1)],
    filter,
    { field: 'strand' },
  )
  expect(sections.map(readKeys)).toEqual([['split/1'], ['split/2']])
})

// the filters that draw some of the fixture's reads and leave others out
const PARTIAL_FILTERS = DRAWN_FILTERS.filter(([name]) =>
  ['svSignal', 'split', 'not split', 'name'].includes(name),
)

test.each(PARTIAL_FILTERS)(
  "under a %s filter each tooltip value is its own read's",
  async (_, filter) => {
    const d = await dataOf(reads, filter, 'name')
    const names = Array.from({ length: d.readPositions.length / 2 }, (_, i) =>
      readNameAt(d, i),
    )
    expect(names.length).toBeGreaterThan(0)
    expect(names.length).toBeLessThan(reads.length)
    expect(d.readTooltipValues).toEqual(names)
  },
)

test('an unset tooltip field ships no column', async () => {
  const d = await dataOf(reads)
  expect(d.readTooltipValues).toBeUndefined()
  expect(d.readMateLines).toBeUndefined()
})

test('a tag tooltip reads the one tag, never the decoded tag block', async () => {
  const get = jest.spyOn(Object.getPrototypeOf(reads[0]), 'get')
  const d = await dataOf(reads, [], 'tags.NM')
  const askedTags = get.mock.calls.some(([field]) => field === 'tags')
  get.mockRestore()
  expect(d.readTooltipValues?.length).toBe(reads.length)
  expect(d.readTooltipValues?.every(v => /^\d+$/.test(v))).toBe(true)
  expect(askedTags).toBe(false)
})
