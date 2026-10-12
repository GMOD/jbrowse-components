import {
  PAIR_DIRECTION_NUM,
  READ_SV_DELETION,
  namesToBlock,
  readCategoryBits,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { buildReadChains, layoutReadChains, readIdOf } from './readChains.ts'

import type { OverlayReadArrays, ReadSource } from './readChains.ts'

interface Read {
  id: string
  name: string
  start: number
  end: number
  flags?: number
  strand?: number
  orientation?: keyof typeof PAIR_DIRECTION_NUM
  sa?: string
  clip?: number
  cigarBits?: number
}

function arrays(reads: Read[]): OverlayReadArrays {
  return {
    readKeys: reads.map(r => r.id),
    readIdPrefix: undefined,
    ...namesToBlock(reads.map(r => r.name)),
    readPositions: new Uint32Array(reads.flatMap(r => [r.start, r.end])),
    readFlags: new Uint16Array(reads.map(r => r.flags ?? 0)),
    readStrands: new Int8Array(reads.map(r => r.strand ?? 1)),
    readInterchrom: new Uint8Array(reads.length),
    readPairOrientations: new Uint8Array(
      reads.map(r => (r.orientation ? PAIR_DIRECTION_NUM[r.orientation] : 0)),
    ),
    readSuppAlignments: reads.map(r => r.sa ?? ''),
    readCategoryBits: Uint8Array.from(reads, r =>
      readCategoryBits(
        r.flags ?? 0,
        r.sa ?? '',
        r.cigarBits ?? 0,
        r.orientation ? PAIR_DIRECTION_NUM[r.orientation] : 0,
      ),
    ),
    readClipAtStart: new Uint32Array(reads.map(r => r.clip ?? 0)),
  }
}

// One row's display: one lane, one region on `refName`, every read at row 0
function row(refName: string, reads: Read[]): ReadSource {
  return {
    readArraysByGroup: new Map([['', new Map([[0, arrays(reads)]])]]),
    loadedRegions: { get: () => ({ refName }) },
    readLayoutRecord: (_groupKey, _region, idx) => {
      const r = reads[idx]!
      return [r.start, 0, r.end, 5]
    },
  }
}

const assemblies = [undefined, undefined]

const PAIRED_FIRST = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
const PAIRED_SECOND = SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR
const PROPER = SAM_FLAG_PROPER_PAIR

test('a split read joins its segments across two rows', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        {
          id: 'p',
          name: 'long',
          start: 1000,
          end: 1500,
          sa: 'chr2,5001,+,500S500M,60,0;',
        },
      ]),
      row('chr2', [
        {
          id: 's',
          name: 'long',
          start: 5000,
          end: 5500,
          flags: SAM_FLAG_SUPPLEMENTARY,
          clip: 500,
          sa: 'chr1,1001,+,500M500S,60,0;',
        },
      ]),
    ],
    assemblies,
  )
  expect(chains).toHaveLength(1)
  expect(
    chains[0]!.connections.map(c => [
      readIdOf(c.e1),
      readIdOf(c.e2),
      c.isSplit,
    ]),
  ).toEqual([['p', 's', true]])
  expect(chains[0]!.entries.map(e => [e.level, e.refName])).toEqual([
    [0, 'chr1'],
    [1, 'chr2'],
  ])
})

// 0x800 is the split backstop for a supplementary whose SA the source dropped
test('a supplementary with no SA tag joins its primary', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        {
          id: 'p',
          name: 'long',
          start: 1000,
          end: 1500,
          sa: 'chr2,5001,+,500S500M,60,0;',
        },
      ]),
      row('chr2', [
        {
          id: 's',
          name: 'long',
          start: 5000,
          end: 5500,
          flags: SAM_FLAG_SUPPLEMENTARY,
          clip: 500,
        },
      ]),
    ],
    assemblies,
  )
  expect(
    chains.flatMap(c =>
      c.connections.map(x => [readIdOf(x.e1), readIdOf(x.e2), x.isSplit]),
    ),
  ).toEqual([['p', 's', true]])
})

test('a concordant pair draws no link', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        {
          id: 'a',
          name: 'pair',
          start: 100,
          end: 200,
          flags: PAIRED_FIRST | PROPER,
          orientation: 'LR',
        },
        {
          id: 'b',
          name: 'pair',
          start: 400,
          end: 500,
          flags: PAIRED_SECOND | PROPER,
          strand: -1,
          orientation: 'LR',
        },
      ]),
      row('chr2', []),
    ],
    assemblies,
  )
  expect(chains).toEqual([])
})

test('a discordant pair across rows is a mate link', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        { id: 'a', name: 'pair', start: 100, end: 200, flags: PAIRED_FIRST },
      ]),
      row('chr2', [
        {
          id: 'b',
          name: 'pair',
          start: 900,
          end: 1000,
          flags: PAIRED_SECOND,
          strand: -1,
        },
      ]),
    ],
    assemblies,
  )
  expect(chains.flatMap(c => c.connections.map(x => x.isSplit))).toEqual([
    false,
  ])
})

// The split view used to decide paired-vs-split once per track, and keep only
// discordant pairs in a paired library, so this junction had no connector.
test('a split read inside a concordant pair keeps its junction', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        {
          id: 'r1',
          name: 'frag',
          start: 100,
          end: 200,
          flags: PAIRED_FIRST | PROPER,
          orientation: 'LR',
          sa: 'chr2,5001,+,100S50M,60,0;',
        },
        {
          id: 'r2',
          name: 'frag',
          start: 400,
          end: 500,
          flags: PAIRED_SECOND | PROPER,
          strand: -1,
          orientation: 'LR',
        },
      ]),
      row('chr2', [
        {
          id: 'r1s',
          name: 'frag',
          start: 5000,
          end: 5050,
          flags: PAIRED_FIRST | PROPER | SAM_FLAG_SUPPLEMENTARY,
          orientation: 'LR',
          clip: 100,
          sa: 'chr1,101,+,100M50S,60,0;',
        },
      ]),
    ],
    assemblies,
  )
  expect(
    chains.flatMap(c =>
      c.connections.map(x => [readIdOf(x.e1), readIdOf(x.e2), x.isSplit]),
    ),
  ).toEqual([['r1', 'r1s', true]])
})

// Both mates enter as evidence, but the pair is concordant, so the link
// between them would show no rearrangement
test('concordant pair, both mates split → junctions only', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        {
          id: 'r1',
          name: 'frag',
          start: 100,
          end: 200,
          flags: PAIRED_FIRST | PROPER,
          orientation: 'LR',
          sa: 'chr2,5001,+,100S50M,60,0;',
        },
        {
          id: 'r2',
          name: 'frag',
          start: 400,
          end: 500,
          flags: PAIRED_SECOND | PROPER,
          strand: -1,
          orientation: 'LR',
          sa: 'chr2,6001,-,100S50M,60,0;',
        },
      ]),
      row('chr2', [
        {
          id: 'r1s',
          name: 'frag',
          start: 5000,
          end: 5050,
          flags: PAIRED_FIRST | PROPER | SAM_FLAG_SUPPLEMENTARY,
          orientation: 'LR',
          clip: 100,
          sa: 'chr1,101,+,100M50S,60,0;',
        },
        {
          id: 'r2s',
          name: 'frag',
          start: 6000,
          end: 6050,
          flags: PAIRED_SECOND | PROPER | SAM_FLAG_SUPPLEMENTARY,
          strand: -1,
          orientation: 'LR',
          clip: 100,
          sa: 'chr1,401,-,100M50S,60,0;',
        },
      ]),
    ],
    assemblies,
  )
  expect(
    chains
      .flatMap(c =>
        c.connections.map(x => [readIdOf(x.e1), readIdOf(x.e2), x.isSplit]),
      )
      .sort(),
  ).toEqual([
    ['r1', 'r1s', true],
    ['r2', 'r2s', true],
  ])
})

// The mate carrying a 60 bp deletion is evidence and enters, but its link to
// the split read draws no curve: the pair is concordant
test('a split read and its concordant mate with an SV-size deletion draw only the junction', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        {
          id: 'r1',
          name: 'frag',
          start: 100,
          end: 200,
          flags: PAIRED_FIRST | PROPER,
          orientation: 'LR',
          sa: 'chr2,5001,+,100S50M,60,0;',
        },
        {
          id: 'r2',
          name: 'frag',
          start: 400,
          end: 560,
          flags: PAIRED_SECOND | PROPER,
          strand: -1,
          orientation: 'LR',
          cigarBits: READ_SV_DELETION,
        },
      ]),
      row('chr2', [
        {
          id: 'r1s',
          name: 'frag',
          start: 5000,
          end: 5050,
          flags: PAIRED_FIRST | PROPER | SAM_FLAG_SUPPLEMENTARY,
          orientation: 'LR',
          clip: 100,
          sa: 'chr1,101,+,100M50S,60,0;',
        },
      ]),
    ],
    assemblies,
  )
  expect(
    chains.flatMap(c =>
      c.connections.map(x => [readIdOf(x.e1), readIdOf(x.e2), x.isSplit]),
    ),
  ).toEqual([['r1', 'r1s', true]])
  expect(chains[0]!.entries.map(readIdOf).sort()).toEqual(['r1', 'r1s', 'r2'])
})

test('a row with nothing laid out contributes no read', () => {
  const chains = buildReadChains(
    [
      row('chr1', [
        {
          id: 'p',
          name: 'long',
          start: 1000,
          end: 1500,
          sa: 'chr2,5001,+,500S500M,60,0;',
        },
      ]),
      undefined,
    ],
    assemblies,
  )
  expect(chains).toEqual([])
})

test('layoutReadChains asks each entry’s own row for its rect', () => {
  const sources = [
    row('chr1', [
      {
        id: 'p',
        name: 'long',
        start: 1000,
        end: 1500,
        sa: 'chr2,5001,+,500S500M,60,0;',
      },
    ]),
    row('chr2', [
      {
        id: 's',
        name: 'long',
        start: 5000,
        end: 5500,
        flags: SAM_FLAG_SUPPLEMENTARY,
        clip: 500,
        sa: 'chr1,1001,+,500M500S,60,0;',
      },
    ]),
  ]
  const chains = buildReadChains(sources, assemblies)
  const blocks = [
    [{ refName: 'chr1', start: 0, end: 2000 }],
    [{ refName: 'chr2', start: 4000, end: 6000 }],
  ]
  const layouts = layoutReadChains(chains, sources, blocks)
  expect(chains[0]!.entries.map(e => layouts.get(e))).toEqual([
    [1000, 0, 1500, 5],
    [5000, 0, 5500, 5],
  ])
  const offScreen = layoutReadChains(chains, sources, [
    blocks[0]!,
    [{ refName: 'chr2', start: 6000, end: 8000 }],
  ])
  expect(chains[0]!.entries.map(e => offScreen.get(e))).toEqual([
    [1000, 0, 1500, 5],
    undefined,
  ])
})
