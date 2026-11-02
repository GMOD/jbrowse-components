import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_SECOND_IN_PAIR,
} from '@jbrowse/cigar-utils'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BamAdapter from '../BamAdapter/BamAdapter.ts'
import bamConfigSchema from '../BamAdapter/configSchema.ts'
import {
  getVolvoxSequenceSubAdapter,
  volvoxReference,
} from '../CramAdapter/CramTestAdapters.fixture.ts'
import { FACET_DIMENSIONS } from './groupFeatures.ts'
import { splitReadChannel, svChannelOf } from './svChannel.ts'
import { getFlags } from './util.ts'

import type { ReadPiece } from './svChannel.ts'
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
  expect(
    splitReadChannel([piece(100, 200, 1, 0), piece(500, 600, 1, 100)]),
  ).toBe('LR')
})

test('a forward read jumping back is a duplication-type junction, filed with RL pairs', () => {
  expect(
    splitReadChannel([piece(500, 600, 1, 0), piece(100, 200, 1, 100)]),
  ).toBe('RL')
})

test('either end of an inversion, or both, files as inversion', () => {
  expect(
    splitReadChannel([piece(100, 200, 1, 0), piece(300, 400, -1, 100)]),
  ).toBe('inversion')
  expect(
    splitReadChannel([piece(300, 400, -1, 0), piece(500, 600, 1, 100)]),
  ).toBe('inversion')
  expect(
    splitReadChannel([
      piece(100, 200, 1, 0),
      piece(300, 400, -1, 100),
      piece(500, 600, 1, 200),
    ]),
  ).toBe('inversion')
})

test('pieces are ordered along the read, not as listed', () => {
  expect(
    splitReadChannel([piece(500, 600, 1, 100), piece(100, 200, 1, 0)]),
  ).toBe('LR')
})

test('a same-reference junction outranks a stray piece on another reference', () => {
  expect(
    splitReadChannel([
      piece(100, 200, 1, 0),
      piece(300, 400, -1, 100),
      piece(900, 1000, 1, 300, { refName: 'ctgB' }),
    ]),
  ).toBe('inversion')
})

test('a read whose only junctions leave its reference files as other chromosome', () => {
  expect(
    splitReadChannel([
      piece(100, 200, 1, 0),
      piece(500, 600, 1, 100, { refName: 'ctgB' }),
    ]),
  ).toBe('otherChromosome')
})

test('a read leaving and re-entering at one base files as an insertion', () => {
  expect(
    splitReadChannel([piece(100, 200, 1, 0), piece(200, 300, 1, 150)]),
  ).toBe('svInsertion')
})

test('an unplaced piece joins nothing, and its neighbours are not joined across it', () => {
  expect(
    splitReadChannel([
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
    set.add(svChannelOf(f))
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
  ).toEqual({ LR: 20 })
  expect(tally(channelsByRead(await records('volvox-simple-inv.bam')))).toEqual(
    { LR: 6, inversion: 25, none: 47, svInsertion: 4 },
  )
})

test('a pair whose read2 splits across an inversion files as inversion in chain mode', async () => {
  const chain = (await records('volvox-sv.bam')).filter(
    f => f.get('name') === 'ctgA_1041_1553_0:0:0_1:0:0_255',
  )
  expect(chain).toHaveLength(3)
  expect(FACET_DIMENSIONS.svChannel.chainKey!(chain).key).toBe('inversion')
})
