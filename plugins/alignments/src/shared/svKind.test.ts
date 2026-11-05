import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_SECOND_IN_PAIR,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import { filterChainFeatures } from '../RenderAlignmentDataRPC/filterChainFeatures.ts'
import { FACET_DIMENSIONS, partitionFeatures } from './groupFeatures.ts'
import { splitReadKind } from './splitReadJunctions.ts'
import { svKindOf } from './svKind.ts'
import { getFlags } from './util.ts'

import type { ReadPiece } from './splitReadJunctions.ts'
import type { Feature } from '@jbrowse/core/util'

function piece(
  start: number,
  end: number,
  strand: number,
  clip: number,
  { refName = 'ctgA', placed = true } = {},
): ReadPiece {
  return { refName, start, end, strand, clip, placed }
}

test('a forward read jumping ahead is a deletion-type junction, filed with LR pairs', () => {
  expect(splitReadKind([piece(100, 200, 1, 0), piece(500, 600, 1, 100)])).toBe(
    'deletionType',
  )
})

test('a forward read jumping back is a duplication-type junction, filed with RL pairs', () => {
  expect(splitReadKind([piece(500, 600, 1, 0), piece(100, 200, 1, 100)])).toBe(
    'duplicationType',
  )
})

test('either end of an inversion, or both, files as inversion', () => {
  expect(splitReadKind([piece(100, 200, 1, 0), piece(300, 400, -1, 100)])).toBe(
    'inversion',
  )
  expect(splitReadKind([piece(300, 400, -1, 0), piece(500, 600, 1, 100)])).toBe(
    'inversion',
  )
  expect(
    splitReadKind([
      piece(100, 200, 1, 0),
      piece(300, 400, -1, 100),
      piece(500, 600, 1, 200),
    ]),
  ).toBe('inversion')
})

test('pieces are ordered along the read, not as listed', () => {
  expect(splitReadKind([piece(500, 600, 1, 100), piece(100, 200, 1, 0)])).toBe(
    'deletionType',
  )
})

test('a same-reference junction outranks a stray piece on another reference', () => {
  expect(
    splitReadKind([
      piece(100, 200, 1, 0),
      piece(300, 400, -1, 100),
      piece(900, 1000, 1, 300, { refName: 'ctgB' }),
    ]),
  ).toBe('inversion')
})

test('a read whose only junctions leave its reference files as a partner elsewhere', () => {
  expect(
    splitReadKind([
      piece(100, 200, 1, 0),
      piece(500, 600, 1, 100, { refName: 'ctgB' }),
    ]),
  ).toBe('elsewhere')
})

test('a read leaving and re-entering at one base files as an insertion', () => {
  expect(splitReadKind([piece(100, 200, 1, 0), piece(200, 300, 1, 150)])).toBe(
    'insertion',
  )
})

test('an unplaced piece joins nothing, and its neighbours are not joined across it', () => {
  expect(
    splitReadKind([
      piece(100, 200, 1, 0),
      piece(150, 180, 1, 100, { placed: false }),
      piece(500, 600, 1, 130),
    ]),
  ).toBeUndefined()
})

function bam(file: string) {
  const path = require.resolve(`../../../../test_data/volvox/${file}`)
  return new BamAdapter(
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
}

async function records(file: string) {
  return firstValueFrom(
    bam(file)
      .getFeatures(
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
        { filter: [] },
      )
      .pipe(toArray()),
  )
}

// One read of a pair: SA entries name one mate's pieces only.
function readKey(f: Feature) {
  const flags = getFlags(f)
  const mate =
    flags & SAM_FLAG_FIRST_IN_PAIR ? 1 : flags & SAM_FLAG_SECOND_IN_PAIR ? 2 : 0
  return `${f.get('name')}/${mate}`
}

function channelsByRead(features: Feature[]) {
  const byRead = new Map<string, Set<string>>()
  for (const f of features) {
    const set = byRead.get(readKey(f)) ?? new Set<string>()
    set.add(svKindOf(f, undefined))
    byRead.set(readKey(f), set)
  }
  return byRead
}

function tally(byRead: Map<string, Set<string>>) {
  const counts: Record<string, number> = {}
  for (const set of byRead.values()) {
    const key = [...set].sort().join('+')
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

test.each([
  'volvox-simple-inv.bam',
  'volvox-long-reads-sv.bam',
  'volvox-sv.bam',
  'volvox-simple-inv-paired.bam',
])('%s: every piece of a read lands in one channel', async file => {
  const split = [...channelsByRead(await records(file))].filter(
    ([, set]) => set.size > 1,
  )
  expect(split).toEqual([])
})

test('the volvox long-read fixtures fill the channels their SVs name', async () => {
  expect(
    tally(channelsByRead(await records('volvox-long-reads-sv.bam'))),
  ).toEqual({ deletionType: 20 })
  expect(tally(channelsByRead(await records('volvox-simple-inv.bam')))).toEqual(
    { deletionType: 6, insertion: 4, inversion: 25, none: 47 },
  )
})

test('a pair whose read2 splits across an inversion files as inversion in chain mode', async () => {
  const chain = (await records('volvox-sv.bam')).filter(
    f => f.get('name') === 'ctgA_1041_1553_0:0:0_1:0:0_255',
  )
  expect(chain).toHaveLength(3)
  expect(FACET_DIMENSIONS.svKind.chainKey!(chain, undefined).key).toBe(
    'inversion',
  )
})

const SV_FIXTURES = [
  'volvox-simple-inv.bam',
  'volvox-long-reads-sv.bam',
  'volvox-sv.bam',
  'volvox-simple-inv-paired.bam',
]

// The band and the filter judge each chain alike, so a split read's
// concordant mate files with it, and every read the filter keeps has a kind
test.each(SV_FIXTURES)(
  '%s: "No SV evidence" holds exactly the reads Only SV evidence hides',
  async file => {
    const reads = await records(file)
    const kept = new Set(
      filterChainFeatures(reads, [{ field: 'svSignal', equal: true }]),
    )
    const none = partitionFeatures(reads, { field: 'svKind' }).find(
      g => g.key === 'none',
    )
    expect(kept.size).toBeGreaterThan(0)
    expect(new Set(none?.features)).toEqual(
      new Set(reads.filter(f => !kept.has(f))),
    )
  },
)

test('a split read and its concordant mate share a band in read mode', async () => {
  const chain = (await records('volvox-sv.bam')).filter(
    f => f.get('name') === 'ctgA_1041_1553_0:0:0_1:0:0_255',
  )
  const groups = partitionFeatures(chain, { field: 'svKind' })
  expect(groups.map(g => [g.key, g.features.length])).toEqual([
    ['inversion', 3],
  ])
})

// Its two placed siblings make a junction, but its own placement is a guess,
// so neither the filter nor the band counts it while they are out of view
test('a MAPQ-0 split record alone files as no SV evidence', () => {
  const read = new SimpleFeature({
    uniqueId: 'mq0',
    refName: 'ctgA',
    start: 1000,
    end: 1030,
    strand: 1,
    name: 'mq0',
    flags: 0,
    score: 0,
    CIGAR: '30M70S',
    tags: { SA: 'ctgA,3000,+,30S40M30S,60,0;ctgA,6000,+,70S30M,60,0;' },
  })
  expect(svKindOf(read, undefined)).toBe('deletionType')
  expect(
    filterChainFeatures([read], [{ field: 'svSignal', equal: true }]),
  ).toEqual([])
  expect(
    partitionFeatures([read], { field: 'svKind' }).map(g => g.key),
  ).toEqual(['none'])
})
