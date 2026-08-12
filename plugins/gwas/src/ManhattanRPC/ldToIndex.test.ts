import { buildLdToIndex, posKey } from './ldToIndex.ts'

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
