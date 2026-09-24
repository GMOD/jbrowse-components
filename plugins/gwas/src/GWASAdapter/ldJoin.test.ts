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

function feat(p: { name?: string; start: number }) {
  return new SimpleFeature({
    uniqueId: String(p.start),
    refName: '1',
    start: p.start,
    end: p.start + 1,
    ...(p.name === undefined ? {} : { name: p.name }),
  })
}

const region = { refName: '1', start: 0, end: 1000, assemblyName: 'hg38' }

async function joined(
  records: PlinkLDRecord[],
  join: LdJoin,
  features: SimpleFeature[],
) {
  const ld = await ldToIndex(source(join.refName, records), region, join)
  return features.map(f => {
    const out = joinLd(f, ld, join)
    return [out.get('ld'), out.get('ld_role')]
  })
}

test('the index reads r² 1 and each partner its own, either orientation', async () => {
  expect(
    await joined(
      [
        rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsB', bpB: 200, r2: 0.8 }),
        rec({ snpA: 'rsC', bpA: 300, snpB: 'rsIndex', bpB: 100, r2: 0.4 }),
      ],
      { index: { name: 'rsIndex' }, refName: 'chr1' },
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

// The LD file is a second file with its own spelling of the contig. The query
// goes out in that spelling, and a partner is keyed by its position on the
// region's contig, which the features share whatever either file calls it.
test('a placed index joins across an LD file that names the contig otherwise', async () => {
  expect(
    await joined(
      [rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsB', bpB: 200, r2: 0.8 })],
      { index: { start: 99 }, refName: 'chr1' },
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
    region,
    { index: { name: 'rsIndex' }, refName: 'chr1' },
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
      { index: { start: 99 }, refName: 'chr1' },
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
    region,
    { index: { name: 'rsIndex' }, refName: 'chr1' },
  )
  expect(ld.byName.size + ld.byStart.size).toBe(0)
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('matched none of 2 LD records'),
  )
  warn.mockRestore()
})

// The shape test_data/gwas/SLE.ld has: every row carries the index as its A
// side, so a window without the index finds no row naming it.
describe('a region panned away from a placed index', () => {
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
  const panned = {
    refName: '2',
    start: 191_990_000,
    end: 192_320_000,
    assemblyName: 'hg19',
  }

  it('reads the window around the index, not the region', async () => {
    const ld = await ldToIndex(source('2', records), panned, {
      index: { start: INDEX_START },
      refName: '2',
    })
    expect(ld.byStart.get(192_009_999)).toBe(0.5)
  })

  it('finds nothing once the index sits past the window', async () => {
    const ld = await ldToIndex(source('2', records), panned, {
      index: { start: INDEX_START + 2 * LD_WINDOW_BP },
      refName: '2',
    })
    expect(ld.byStart.size).toBe(0)
  })

  it('reads the region itself for an index known only by id', async () => {
    const src = source('2', records)
    await ldToIndex(src, panned, { index: { name: 'rsIndex' }, refName: '2' })
    expect(src.queries).toEqual([
      { refName: '2', start: panned.start, end: panned.end },
    ])
  })
})
