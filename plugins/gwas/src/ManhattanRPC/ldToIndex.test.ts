import { LD_WINDOW_BP, buildLdToIndex, posKey } from './ldToIndex.ts'

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

function source(
  records: PlinkLDRecord[],
): Pick<LDRecordSource, 'getLDRecords'> {
  return { getLDRecords: () => Promise.resolve(records) }
}

// An LD file with a real index over it: a row is findable only by its A side,
// which is what makes the query window matter at all.
function indexedSource(
  ownRefName: string,
  records: PlinkLDRecord[],
): Pick<LDRecordSource, 'getLDRecords'> {
  return {
    getLDRecords: ({ refName, start, end }: NoAssemblyRegion) =>
      Promise.resolve(
        refName === ownRefName
          ? records.filter(r => r.bpA > start && r.bpA <= end)
          : [],
      ),
  }
}

// An LD file that answers only to its own spelling of the contig, the way a
// real adapter does (`r.chrA === refName`), so a query in the GWAS file's
// scheme comes back empty rather than quietly working.
function ldSource(
  ownRefName: string,
  records: PlinkLDRecord[],
): Pick<LDRecordSource, 'getLDRecords'> {
  return {
    getLDRecords: ({ refName }) =>
      Promise.resolve(refName === ownRefName ? records : []),
  }
}

const region = { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' }

test('posKey is 1-based to line up with chr:bp ids', () => {
  expect(posKey('chr1', 99)).toBe('chr1:100')
})

test('maps r² of the partner SNP, keyed by id and by chr:bp, both orientations', async () => {
  const ld = await buildLdToIndex({
    adapter: source([
      // index as snpA
      rec({
        snpA: 'rsIndex',
        bpA: 100,
        snpB: 'rsB',
        chrB: 'chr1',
        bpB: 200,
        r2: 0.8,
      }),
      // index as snpB
      rec({
        snpA: 'rsC',
        chrA: 'chr1',
        bpA: 300,
        snpB: 'rsIndex',
        bpB: 100,
        r2: 0.4,
      }),
    ]),
    region,
    indexSnp: 'rsIndex',
  })
  expect(ld.indexFound).toBe(true)
  expect(ld.r2ByKey.get('rsB')).toBe(0.8)
  expect(ld.r2ByKey.get('chr1:200')).toBe(0.8)
  expect(ld.r2ByKey.get('rsC')).toBe(0.4)
  expect(ld.r2ByKey.get('chr1:300')).toBe(0.4)
})

test('matches the index SNP by chr:bp as well as by id', async () => {
  const ld = await buildLdToIndex({
    adapter: source([
      rec({
        snpA: 'rsA',
        chrA: 'chr1',
        bpA: 100,
        snpB: 'rsB',
        bpB: 200,
        r2: 0.5,
      }),
    ]),
    region,
    indexSnp: 'chr1:100',
  })
  expect(ld.indexFound).toBe(true)
  expect(ld.r2ByKey.get('rsB')).toBe(0.5)
})

test('indexFound is false when no pair references the index SNP', async () => {
  const ld = await buildLdToIndex({
    adapter: source([rec({ snpA: 'rsA', snpB: 'rsB', r2: 0.9 })]),
    region,
    indexSnp: 'rsIndex',
  })
  expect(ld.indexFound).toBe(false)
  expect(ld.r2ByKey.size).toBe(0)
})

// The LD file is a second adapter, so the region — renamed for the GWAS file —
// is not a valid query for it, and its records come back spelling the contig
// its own way. `ldRefName` carries the LD file's name for the query; everything
// returned is translated back, because makeLdEvaluator looks these keys up with
// `posKey(region.refName, …)` built from GWAS features.
describe('a GWAS file and an LD file that name the contig differently', () => {
  // region.refName is the GWAS file's `1`; the LD file says `chr1`
  const ld = ldSource('chr1', [
    rec({
      snpA: 'rsIndex',
      chrA: 'chr1',
      bpA: 100,
      snpB: 'rsB',
      chrB: 'chr1',
      bpB: 200,
      r2: 0.8,
    }),
  ])
  const gwasRegion = { refName: '1', start: 0, end: 1000, assemblyName: 'hg38' }

  it('queries the LD file by its own name', async () => {
    const built = await buildLdToIndex({
      adapter: ld,
      region: gwasRegion,
      ldRefName: 'chr1',
      indexSnp: 'rsIndex',
    })
    expect(built.indexFound).toBe(true)
  })

  it('keys positions in the GWAS scheme, which is what a feature looks up', async () => {
    const built = await buildLdToIndex({
      adapter: ld,
      region: gwasRegion,
      ldRefName: 'chr1',
      indexSnp: 'rsIndex',
    })
    // posKey('1', 199) — the key makeLdEvaluator builds for that feature
    expect(built.r2ByKey.get('1:200')).toBe(0.8)
    expect(built.r2ByKey.get('chr1:200')).toBeUndefined()
    // by-id lookup names no contig and is unaffected
    expect(built.r2ByKey.get('rsB')).toBe(0.8)
  })

  it('matches a chr:bp index written in the GWAS scheme', async () => {
    const built = await buildLdToIndex({
      adapter: ld,
      region: gwasRegion,
      ldRefName: 'chr1',
      // GetManhattanData renames the index through the GWAS pass, so it arrives
      // spelled `1:100` while the LD record says `chr1`
      indexSnp: '1:100',
    })
    expect(built.indexFound).toBe(true)
    expect(built.r2ByKey.get('1:200')).toBe(0.8)
  })

  it('gives a partner on another contig no position key at all', async () => {
    const built = await buildLdToIndex({
      adapter: ldSource('chr1', [
        rec({
          snpA: 'rsIndex',
          chrA: 'chr1',
          bpA: 100,
          snpB: 'rsTrans',
          chrB: 'chr7',
          bpB: 200,
          r2: 0.3,
        }),
      ]),
      region: gwasRegion,
      ldRefName: 'chr1',
      indexSnp: 'rsIndex',
    })
    // `ldRefName` is one pair out of the assembly's aliasing — it says what
    // `1` is called in the LD file and nothing about `chr7`. Rather than key
    // the partner under a spelling from the other scheme, it gets no position
    // key, so every position key in the map is one a GWAS feature could build.
    // The id still resolves; a SNP id names no contig.
    expect(built.r2ByKey.get('rsTrans')).toBe(0.3)
    expect([...built.r2ByKey.keys()]).toEqual(['rsTrans'])
  })

  it('without ldRefName the query misses entirely — the bug this fixes', async () => {
    const built = await buildLdToIndex({
      adapter: ld,
      region: gwasRegion,
      indexSnp: 'rsIndex',
    })
    expect(built.indexFound).toBe(false)
    expect(built.r2ByKey.size).toBe(0)
  })
})

test('a pair where both sides are the index SNP is ignored', async () => {
  const ld = await buildLdToIndex({
    adapter: source([
      rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsIndex', bpB: 100, r2: 1 }),
    ]),
    region,
    indexSnp: 'rsIndex',
  })
  expect(ld.indexFound).toBe(false)
  expect(ld.r2ByKey.size).toBe(0)
})

// The defect the index anchoring exists to fix, in the shape
// test_data/gwas/SLE.ld actually has: every row carries the index as its A
// side, so a viewport panned past the index finds no row mentioning it and
// every point goes grey. Measured on that file, a 200kb pan in either
// direction took 1212 partners to 0.
describe('a viewport panned away from the index SNP', () => {
  const INDEX_BP = 191_958_656
  const ld = indexedSource(
    '2',
    [191_794_580, 192_010_000, 192_115_052].map((bpB, i) =>
      rec({
        chrA: '2',
        bpA: INDEX_BP,
        snpA: 'rsIndex',
        chrB: '2',
        bpB,
        snpB: `rsP${i}`,
        r2: 0.5,
      }),
    ),
  )
  // the demo's own window moved 200kb right; the index is no longer inside it
  const panned = {
    refName: '2',
    start: 191_990_000,
    end: 192_320_000,
    assemblyName: 'hg19',
  }
  const indexSnp = `2:${INDEX_BP}`

  it('still colours, because the read is anchored on the index', async () => {
    const built = await buildLdToIndex({
      adapter: ld,
      region: panned,
      ldRefName: '2',
      indexSnp,
    })
    expect(built.indexFound).toBe(true)
    expect(built.r2ByKey.get('2:192010000')).toBe(0.5)
  })

  // and the read really is a window around the index rather than the whole
  // contig: move the index past the far edge of one and the same records stop
  // being reachable, which is what the viewport-anchored read did on every pan
  it('reads a window around the index, not the whole contig', async () => {
    const built = await buildLdToIndex({
      adapter: ld,
      region: panned,
      ldRefName: '2',
      indexSnp: `2:${INDEX_BP + 2 * LD_WINDOW_BP}`,
    })
    expect(built.indexFound).toBe(false)
    expect(built.r2ByKey.size).toBe(0)
  })

  it('reads nothing at all for an index on another contig', async () => {
    const getLDRecords = jest.fn(() => Promise.resolve([]))
    const built = await buildLdToIndex({
      adapter: { getLDRecords },
      region: panned,
      ldRefName: '2',
      indexSnp: '7:1000',
    })
    expect(getLDRecords).not.toHaveBeenCalled()
    expect(built.indexFound).toBe(false)
  })
})

// PLINK writes `.` for a variant it has no id for. Keyed as an id, every
// unnamed partner in a file collides on the one entry and the last read wins,
// so a feature the GWAS file also leaves unnamed reads back a stranger's r²,
// and one with no LD record at all is coloured as a partner.
test('an unnamed partner does not shadow a named one', async () => {
  const ld = await buildLdToIndex({
    adapter: source([
      rec({ snpA: 'rsIndex', bpA: 100, snpB: '.', bpB: 200, r2: 0.9 }),
      rec({ snpA: 'rsIndex', bpA: 100, snpB: '.', bpB: 300, r2: 0.1 }),
      rec({ snpA: 'rsIndex', bpA: 100, snpB: 'rsNamed', bpB: 400, r2: 0.7 }),
    ]),
    region,
    indexSnp: 'chr1:100',
  })
  // each unnamed partner keeps its own r² under its own position
  expect(ld.r2ByKey.get('chr1:200')).toBe(0.9)
  expect(ld.r2ByKey.get('chr1:300')).toBe(0.1)
  // and `.` never becomes a key, so a feature named `.` falls through to its
  // position instead of reading whichever unnamed partner was written last
  expect(ld.r2ByKey.get('.')).toBeUndefined()
  expect(ld.r2ByKey.get('rsNamed')).toBe(0.7)
})
