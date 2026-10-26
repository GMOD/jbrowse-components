import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { LD_WINDOW_BP, joinLd, ldToIndex } from './ldJoin.ts'

import type { LdJoin } from './ldJoin.ts'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { LDRecordSource, PlinkLDRecord } from '@jbrowse/ld-core'

function rec(p: Partial<PlinkLDRecord>): PlinkLDRecord {
  return {
    chrA: 'chr1',
    bpA: 0,
    snpA: '',
    chrB: 'chr1',
    bpB: 0,
    snpB: '',
    r2: 0,
    ...p,
  }
}

// A source that answers only to its own spelling of the contig and, like a
// real index over the file, finds a row by its A side alone.
function source(
  ownRefName: string,
  records: PlinkLDRecord[],
): Pick<LDRecordSource, 'getLDRecords'> & { queries: NoAssemblyRegion[] } {
  const queries: NoAssemblyRegion[] = []
  return {
    queries,
    getLDRecords: query => {
      queries.push(query)
      const { refName, start, end } = query
      return Promise.resolve(
        refName === ownRefName
          ? records.filter(r => r.bpA > start && r.bpA <= end)
          : [],
      )
    },
  }
}

function feat(p: { name?: string; start: number; score?: number }) {
  return new SimpleFeature({
    uniqueId: `${p.start}-${p.name}`,
    refName: '1',
    start: p.start,
    end: p.start + 1,
    ...(p.name === undefined ? {} : { name: p.name }),
    ...(p.score === undefined ? {} : { score: p.score }),
  })
}

async function joined(
  records: PlinkLDRecord[],
  join: LdJoin,
  features: SimpleFeature[],
) {
  const ld = await ldToIndex(source(join.refName, records), join)
  return joinLd(features, ld, join).joined.map(out => [out?.r2, out?.role])
}

test('the index reads r² 1 and each partner its own, either orientation', async () => {
  expect(
    await joined(
      [
        rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsB', bpB: 200, r2: 0.8 }),
        rec({ snpA: 'rsC', bpA: 300, snpB: 'rsIndex', bpB: 100, r2: 0.4 }),
      ],
      { start: 99, refName: 'chr1' },
      [
        feat({ name: 'rsIndex', start: 99 }),
        feat({ name: 'rsB', start: 199 }),
        feat({ start: 299 }),
        feat({ name: 'rsFar', start: 800 }),
      ],
    ),
  ).toEqual([
    [1, 'index'],
    [0.8, 'partner'],
    [0.4, 'partner'],
    [undefined, undefined],
  ])
})

// Pan-UKBB and FinnGen list a multi-allelic site as one row per allele, and
// `indexSnp` names only the position.
test('of two alleles at the index position, only the stronger is the index', async () => {
  expect(
    await joined(
      [rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsB', bpB: 200, r2: 0.8 })],
      { start: 99, refName: 'chr1' },
      [
        feat({ name: 'rsWeak', start: 99, score: 4 }),
        feat({ name: 'rsIndex', start: 99, score: 9 }),
        feat({ name: 'rsTied', start: 99, score: 9 }),
        feat({ name: 'rsB', start: 199, score: 6 }),
      ],
    ),
  ).toEqual([
    [undefined, undefined],
    [1, 'index'],
    [undefined, undefined],
    [0.8, 'partner'],
  ])
})

// a p-value of NA parses to NaN, which draws no point to carry the diamond
test('an allele with no score is not the index over one with a score', async () => {
  expect(
    await joined(
      [rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsB', bpB: 200, r2: 0.8 })],
      { start: 99, refName: 'chr1' },
      [
        feat({ name: 'rsNA', start: 99, score: Number.NaN }),
        feat({ name: 'rsIndex', start: 99, score: 8 }),
      ],
    ),
  ).toEqual([
    [undefined, undefined],
    [1, 'index'],
  ])
})

// The LD file is a second file with its own spelling of the contig. The query
// goes out in that spelling, and a partner is keyed by its position on the
// region's contig, which the features share whatever either file calls it.
test('a placed index joins across an LD file that names the contig otherwise', async () => {
  expect(
    await joined(
      [rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsB', bpB: 200, r2: 0.8 })],
      { start: 99, refName: 'chr1' },
      [feat({ start: 99 }), feat({ start: 199 })],
    ),
  ).toEqual([
    [1, 'index'],
    [0.8, 'partner'],
  ])
})

test('a partner on another contig joins by its id and never by position', async () => {
  const ld = await ldToIndex(
    source('chr1', [
      rec({
        snpA: 'rsIndex',
        bpA: 100,
        snpB: 'rsTrans',
        chrB: 'chr7',
        bpB: 200,
        r2: 0.3,
      }),
    ]),
    { start: 99, refName: 'chr1' },
  )
  expect([...ld.byName]).toEqual([['rsTrans', 0.3]])
  expect(ld.byStart.size).toBe(0)
})

// PLINK writes `.` for a variant with no id. Keyed as an id, every unnamed
// partner collides on one entry, and a GWAS feature also named `.` reads back
// whichever was written last.
test('an unnamed partner keeps its own r² under its position', async () => {
  expect(
    await joined(
      [
        rec({ snpA: 'rsIndex', bpA: 100, snpB: '.', bpB: 200, r2: 0.9 }),
        rec({ snpA: 'rsIndex', bpA: 100, snpB: '.', bpB: 300, r2: 0.1 }),
      ],
      { start: 99, refName: 'chr1' },
      [
        feat({ name: '.', start: 199 }),
        feat({ name: '.', start: 299 }),
        feat({ name: '.', start: 599 }),
      ],
    ),
  ).toEqual([
    [0.9, 'partner'],
    [0.1, 'partner'],
    [undefined, undefined],
  ])
})

test('a pair with the index on both sides, or no r², joins nothing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const ld = await ldToIndex(
    source('chr1', [
      rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsIndex', bpB: 100, r2: 1 }),
      rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsB', bpB: 200, r2: undefined }),
    ]),
    { start: 99, refName: 'chr1' },
  )
  expect(ld.byName.size + ld.byStart.size).toBe(0)
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('matched none of 2 LD records'),
  )
  warn.mockRestore()
})

// The shape test_data/gwas/SLE.ld has: every row carries the index as its A
// side, so only a window holding the index finds a row naming it.
describe('the window the LD file is read over', () => {
  const INDEX_START = 191_958_655
  const records = [191_794_580, 192_010_000].map((bpB, i) =>
    rec({
      chrA: '2',
      bpA: INDEX_START + 1,
      snpA: 'rsIndex',
      chrB: '2',
      bpB,
      snpB: `rsP${i}`,
      r2: 0.5,
    }),
  )

  it('surrounds the index', async () => {
    const src = source('2', records)
    const ld = await ldToIndex(src, { start: INDEX_START, refName: '2' })
    expect(src.queries).toEqual([
      {
        refName: '2',
        start: INDEX_START - LD_WINDOW_BP,
        end: INDEX_START + 1 + LD_WINDOW_BP,
      },
    ])
    expect(ld.byStart.get(192_009_999)).toBe(0.5)
  })

  it('finds nothing once the index sits past it', async () => {
    const ld = await ldToIndex(source('2', records), {
      start: INDEX_START + 2 * LD_WINDOW_BP,
      refName: '2',
    })
    expect(ld.byStart.size).toBe(0)
  })
})

// A reference panel routinely holds SNPs the summary statistics dropped, so a
// partner placed in the region that no feature matches is ordinary data
describe('the missing-index notice', () => {
  const join = { start: 99, refName: '1' }
  const index = feat({ start: 99 })
  const unlisted = feat({ start: 499 })

  it('is raised where the LD file names no partner of a shown index', () => {
    const empty = { byName: new Map(), byStart: new Map() }
    expect(joinLd([index, unlisted], empty, join).unjoined).toBe(true)
  })

  it('is not raised for a partner the GWAS file lacks', () => {
    const ld = { byName: new Map(), byStart: new Map([[1199, 0.5]]) }
    expect(joinLd([index, unlisted], ld, join).unjoined).toBe(false)
  })

  it('is not raised where the index is off the region', () => {
    const empty = { byName: new Map(), byStart: new Map() }
    expect(joinLd([unlisted], empty, join).unjoined).toBe(false)
  })
})

test('the LD read carries the fetch options, so an abort reaches it', async () => {
  const getLDRecords = jest.fn().mockResolvedValue([])
  const opts = { signal: new AbortController().signal }
  await ldToIndex({ getLDRecords }, { start: 99, refName: 'chr1' }, opts)
  expect(getLDRecords).toHaveBeenCalledWith(expect.anything(), opts)
})
