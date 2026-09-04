import {
  lowerBound,
  makeRefChrFilter,
  nextChrStartBlock,
  parseTaiIndex,
  queryBlockSpan,
  selectIndexEntries,
} from './taiIndex.ts'

import type { ByteRange, IndexData } from './types.ts'

// Build records at fixed chrStart positions; virtualOffset is irrelevant to
// selection so a simple ascending offset keeps the fixtures readable.
function records(...starts: number[]): ByteRange[] {
  return starts.map((chrStart, i) => ({
    chrStart,
    virtualOffset: {
      blockPosition: i,
      dataPosition: 0,
    },
  }))
}

describe('parseTaiIndex', () => {
  test('absolute rows: strips assembly prefix, splits virtual offset', () => {
    const index = parseTaiIndex(
      'hg38.chr1\t0\t65536\nhg38.chr1\t1000\t131072\n',
    )
    expect([...index.keys()]).toEqual(['chr1'])
    const chr1 = index.get('chr1')!
    expect(chr1).toHaveLength(2)
    expect(chr1[0]).toMatchObject({ chrStart: 0 })
    // 65536 -> block 1, data 0
    expect(chr1[0]!.virtualOffset).toMatchObject({
      blockPosition: 1,
      dataPosition: 0,
    })
    expect(chr1[1]).toMatchObject({ chrStart: 1000 })
    // 131072 -> block 2, data 0
    expect(chr1[1]!.virtualOffset).toMatchObject({
      blockPosition: 2,
      dataPosition: 0,
    })
  })

  test('relative `*` rows accumulate deltas onto the previous absolute values', () => {
    // first row absolute: chrStart 100, voff 70000 (block 1, data 4464)
    // second row relative: +50 chrStart, +1000 voff -> 150, 71000
    const index = parseTaiIndex('hg38.chrI\t100\t70000\n*\t50\t1000\n')
    const chrI = index.get('chrI')!
    expect(chrI).toHaveLength(2)
    expect(chrI[0]).toMatchObject({ chrStart: 100 })
    expect(chrI[0]!.virtualOffset).toMatchObject({
      blockPosition: 1,
      dataPosition: 70000 - 65536,
    })
    expect(chrI[1]).toMatchObject({ chrStart: 150 })
    // 71000 -> block 1, data 71000-65536=5464
    expect(chrI[1]!.virtualOffset).toMatchObject({
      blockPosition: 1,
      dataPosition: 71000 - 65536,
    })
  })

  test('chained relative rows keep accumulating from running totals', () => {
    const index = parseTaiIndex(
      'a.chr1\t0\t0\n*\t10\t100\n*\t10\t100\n*\t10\t100\n',
    )
    const chr1 = index.get('chr1')!
    expect(chr1.map(r => r.chrStart)).toEqual([0, 10, 20, 30])
    expect(chr1.map(r => r.virtualOffset.dataPosition)).toEqual([
      0, 100, 200, 300,
    ])
  })

  test('relative rows inherit the previous absolute chromosome', () => {
    const index = parseTaiIndex('a.chr1\t0\t0\n*\t10\t100\na.chr2\t0\t5000\n')
    expect([...index.keys()]).toEqual(['chr1', 'chr2'])
    expect(index.get('chr1')).toHaveLength(2)
    expect(index.get('chr2')).toHaveLength(1)
  })

  test('ignores blank and whitespace-only lines', () => {
    const index = parseTaiIndex('\n  \na.chr1\t0\t0\n\n')
    expect(index.get('chr1')).toHaveLength(1)
  })

  test('empty input yields empty index', () => {
    expect(parseTaiIndex('').size).toBe(0)
  })

  test('a numeric middle segment is a genome version, not the chromosome', () => {
    const index = parseTaiIndex('hg38.1.chrX\t0\t0\n')
    expect([...index.keys()]).toEqual(['chrX'])
  })

  test('keeps dots that belong to the chromosome name', () => {
    // Dotted accessions used to key as their last segment, so these two
    // scaffolds collapsed into one `2`/`1` bucket whose interleaved entries
    // broke the ascending-chrStart search.
    const index = parseTaiIndex(
      'hg38.CM000663.2\t0\t0\nhg38.CM000664.2\t0\t5000\nmm10.chr1.random\t0\t9000\n',
    )
    expect([...index.keys()]).toEqual([
      'CM000663.2',
      'CM000664.2',
      'chr1.random',
    ])
  })

  test('a token with no assembly prefix is the chromosome itself', () => {
    expect([...parseTaiIndex('chrI\t0\t0\n').keys()]).toEqual(['chrI'])
  })

  // The `.tai` keys are what `getRefNames` advertises and what
  // `queryBlockSpan` looks a query's refName up under, so a PanSN source name
  // that keeps its whole token as the key advertises a name no region ever
  // queries — the track resolves no span and draws nothing. The JBrowse
  // assembly for this repo's E. coli pangenome calls the reference `chr`.
  test('PanSN source names key on the contig, not the whole token', () => {
    const index = parseTaiIndex('K12#1#chr\t0\t0\nK12#1#chr\t500\t9000\n')
    expect([...index.keys()]).toEqual(['chr'])
    expect(index.get('chr')).toHaveLength(2)
  })

  test('a PanSN contig keeps its own separators', () => {
    expect([...parseTaiIndex('HG002#1#ctg#7\t0\t0\n').keys()]).toEqual([
      'ctg#7',
    ])
  })

  // `nextChrStartBlock` reads "the chromosome after this one" off the key
  // order, so integer-like names are the case a plain object silently got
  // wrong: `Object.keys` sorts `1`..`22` numerically whatever the insertion
  // order, which put `2` next to `1` in a lexicographically sorted file and
  // left chromosomes 10-19 inside the bound.
  test('integer-like chromosome names keep file order, not numeric order', () => {
    const index = parseTaiIndex(
      `${['1', '10', '11', '2', '20', 'X']
        .map((chr, i) => `hg38.${chr}\t0\t${i * 65536}`)
        .join('\n')}\n`,
    )
    expect([...index.keys()]).toEqual(['1', '10', '11', '2', '20', 'X'])
  })

  test('a bare versioned accession keys on the whole accession', () => {
    // `NC_000001.11` split as assembly `NC_000001` + chr `11` collided with the
    // file's real chromosome 11, interleaving two chromosomes' offsets under one
    // key and breaking the ascending binary search over it.
    const index = parseTaiIndex('NC_000001.11\t0\t0\nNC_000011.10\t0\t5000\n')
    expect([...index.keys()]).toEqual(['NC_000001.11', 'NC_000011.10'])
  })
})

describe('makeRefChrFilter', () => {
  test('accepts a reference row on the queried chromosome, whatever its prefix', () => {
    const onChr1 = makeRefChrFilter('chr1')
    expect(onChr1('hg38.chr1')).toBe(true)
    expect(onChr1('chr1')).toBe(true)
    expect(onChr1('Species1.1.chr1')).toBe(true)
    expect(onChr1('K12#1#chr1')).toBe(true)
  })

  // The read deliberately runs past the chromosome's end, so blocks of the
  // next chromosome arrive and can overlap the query numerically.
  test('rejects a reference row on another chromosome', () => {
    const onChr1 = makeRefChrFilter('chr1')
    expect(onChr1('hg38.chr2')).toBe(false)
    expect(onChr1('hg38.chr10')).toBe(false)
  })

  test('agrees with the keys parseTaiIndex builds', () => {
    const source = 'hg38.CM000663.2'
    const [key] = parseTaiIndex(`${source}\t0\t0\n`).keys()
    expect(makeRefChrFilter(key!)(source)).toBe(true)
  })
})

describe('lowerBound', () => {
  const arr = records(0, 100, 200, 300)
  const key = (r: ByteRange) => r.chrStart

  test('returns first index with key >= target', () => {
    expect(lowerBound(arr, 0, key)).toBe(0)
    expect(lowerBound(arr, 1, key)).toBe(1)
    expect(lowerBound(arr, 100, key)).toBe(1)
    expect(lowerBound(arr, 250, key)).toBe(3)
  })

  test('returns length when target is past the end', () => {
    expect(lowerBound(arr, 9999, key)).toBe(4)
  })

  test('returns 0 on empty array', () => {
    expect(lowerBound([], 5, key)).toBe(0)
  })
})

describe('selectIndexEntries', () => {
  test('firstEntry is the index entry containing queryStart', () => {
    const recs = records(0, 1000, 2000, 3000)
    const { firstEntry } = selectIndexEntries(recs, 1100, 1200)
    // entry before the first chrStart >= 1100 (which is 2000) -> chrStart 1000
    expect(firstEntry).toMatchObject({ chrStart: 1000 })
  })

  test('nextEntry reaches one entry past queryEnd as a read cushion', () => {
    const recs = records(0, 100, 200, 300, 400, 500)
    const { nextEntry, ranPastEnd } = selectIndexEntries(recs, 110, 120)
    // first chrStart >= 120 is index 2 (200); +1 -> index 3 (300)
    expect(nextEntry).toMatchObject({ chrStart: 300 })
    expect(ranPastEnd).toBe(false)
  })

  test('ranPastEnd is true only when there is no cushion entry past queryEnd', () => {
    const recs = records(0, 100, 200, 300)
    // queryEnd 150 -> first chrStart >= 150 is index 2 (200); cushion index 3 (300)
    expect(selectIndexEntries(recs, 50, 150).ranPastEnd).toBe(false)
    // queryEnd 250 -> first chrStart >= 250 is index 3 (300); cushion index 4 absent
    expect(selectIndexEntries(recs, 50, 250).ranPastEnd).toBe(true)
    // queryEnd past everything -> no cushion
    expect(selectIndexEntries(recs, 50, 9999).ranPastEnd).toBe(true)
  })

  test('query before all entries clamps firstEntry to the first record', () => {
    const recs = records(1000, 2000, 3000)
    const { firstEntry } = selectIndexEntries(recs, 0, 500)
    expect(firstEntry).toMatchObject({ chrStart: 1000 })
  })

  test('query past the end falls back to the last entry', () => {
    const recs = records(0, 100, 200)
    const { firstEntry, nextEntry } = selectIndexEntries(recs, 5000, 6000)
    expect(firstEntry).toMatchObject({ chrStart: 200 })
    expect(nextEntry).toMatchObject({ chrStart: 200 })
  })

  test('single-entry index returns that entry for both ends', () => {
    const recs = records(0)
    const { firstEntry, nextEntry, ranPastEnd } = selectIndexEntries(
      recs,
      10,
      50,
    )
    expect(firstEntry).toMatchObject({ chrStart: 0 })
    expect(nextEntry).toMatchObject({ chrStart: 0 })
    expect(ranPastEnd).toBe(true)
  })
})

describe('nextChrStartBlock', () => {
  // blockPosition = compressed byte offset; chrStart is irrelevant here.
  const at = (blockPosition: number): ByteRange => ({
    chrStart: 0,
    virtualOffset: { blockPosition, dataPosition: 0 },
  })
  const index: IndexData = new Map([
    ['chr1', [at(0), at(1000)]],
    ['chr2', [at(5000), at(6000)]],
    ['chr3', [at(9000)]],
  ])

  test('interior chromosome bounds at the next chromosome first block', () => {
    expect(nextChrStartBlock(index, 'chr1')).toBe(5000)
    expect(nextChrStartBlock(index, 'chr2')).toBe(9000)
  })

  test('last chromosome has no next block', () => {
    expect(nextChrStartBlock(index, 'chr3')).toBeUndefined()
  })

  test('single-chromosome index has no next block', () => {
    expect(
      nextChrStartBlock(new Map([['chr1', [at(0)]]]), 'chr1'),
    ).toBeUndefined()
  })

  // The `Map` is what makes this hold: as a plain object these keys enumerate
  // `1`, `2`, `10` whatever the insertion order, so chromosome `1` bounded at
  // `2`'s offset — past `10` — and reported a ~2x read.
  test('integer-like names bound at the next chromosome in FILE order', () => {
    const index: IndexData = new Map([
      ['1', [at(0)]],
      ['10', [at(1000)]],
      ['2', [at(9000)]],
    ])
    expect(nextChrStartBlock(index, '1')).toBe(1000)
    expect(nextChrStartBlock(index, '10')).toBe(9000)
    expect(nextChrStartBlock(index, '2')).toBeUndefined()
  })
})

describe('queryBlockSpan', () => {
  const entry = (chrStart: number, blockPosition: number): ByteRange => ({
    chrStart,
    virtualOffset: { blockPosition, dataPosition: 0 },
  })

  test('interior query spans to the cushion entry', () => {
    const index: IndexData = new Map([
      [
        'chr1',
        [entry(0, 0), entry(100, 1000), entry(200, 2000), entry(300, 3000)],
      ],
    ])
    const span = queryBlockSpan(index, 'chr1', 50, 120)!
    expect(span.ranPastEnd).toBe(false)
    expect(span.startBlock).toBe(0)
    // first chrStart >= 120 is index 2; cushion index 3 -> block 3000
    expect(span.endBlock).toBe(3000)
  })

  test('past the last sparse entry it bounds at the next chromosome', () => {
    const index: IndexData = new Map([
      ['chr1', [entry(0, 0), entry(100, 1000)]],
      ['chr2', [entry(0, 90000)]],
    ])
    const span = queryBlockSpan(index, 'chr1', 50, 99999)!
    expect(span.ranPastEnd).toBe(true)
    // the whole of chr1's data, not the distance to its last entry (1000)
    expect(span.endBlock - span.startBlock).toBe(90000)
  })

  // The estimate is what the fetch gate sees; measuring to the fallback entry
  // reported 0 bytes here while the read pulled the entire chromosome.
  test('a single-entry chromosome still measures its whole data span', () => {
    const index: IndexData = new Map([
      ['chr1', [entry(0, 0)]],
      ['chr2', [entry(0, 40000)]],
    ])
    const span = queryBlockSpan(index, 'chr1', 0, 99999)!
    expect(span.endBlock - span.startBlock).toBe(40000)
  })

  // A dense MAF puts ~190KB of compressed data between two sparse entries, so
  // bounding the last chromosome's tail at one block dropped its last several
  // kb with no error.
  test('the last chromosome bounds its tail at the file size', () => {
    const index: IndexData = new Map([
      ['chr1', [entry(0, 0), entry(100, 1000)]],
    ])
    const span = queryBlockSpan(index, 'chr1', 50, 99999, 200_000)!
    expect(span.ranPastEnd).toBe(true)
    expect(span.endBlock).toBe(200_000)
    expect(span.readLength).toBe(200_000)
  })

  test('without a file size the last chromosome falls back to one block', () => {
    const index: IndexData = new Map([
      ['chr1', [entry(0, 0), entry(100, 1000)]],
    ])
    const span = queryBlockSpan(index, 'chr1', 50, 99999)!
    expect(span.endBlock).toBe(span.startBlock)
    expect(span.readLength).toBe(65536)
  })

  test('the cushion never reads past the file size', () => {
    const index: IndexData = new Map([
      ['chr1', [entry(0, 0), entry(100, 1000), entry(200, 2000)]],
    ])
    const span = queryBlockSpan(index, 'chr1', 0, 50, 3000)!
    expect(span.ranPastEnd).toBe(false)
    expect(span.readLength).toBe(3000)
  })

  // `readLength` is what both `getFeatures` and `getRegionByteSize` use. A
  // zero-width block span still costs one whole bgzf block to read, and
  // reporting the raw span told the fetch gate that read was free.
  test('readLength covers the one-block cushion the read adds', () => {
    const index: IndexData = new Map([
      [
        'chr1',
        [entry(0, 0), entry(100, 1000), entry(200, 2000), entry(300, 3000)],
      ],
    ])
    const wide = queryBlockSpan(index, 'chr1', 50, 120)!
    expect(wide.readLength).toBe(wide.endBlock - wide.startBlock + 65536)

    // A query resolving to a single block: zero span, one block of real read.
    const narrow = queryBlockSpan(
      new Map([['chr1', [entry(0, 0)]]]),
      'chr1',
      0,
      10,
    )!
    expect(narrow.endBlock).toBe(narrow.startBlock)
    expect(narrow.readLength).toBe(65536)
  })

  test('a chromosome absent from the index has no span', () => {
    expect(
      queryBlockSpan(new Map([['chr1', [entry(0, 0)]]]), 'chrZ', 0, 10),
    ).toBeUndefined()
    expect(
      queryBlockSpan(new Map([['chr1', []]]), 'chr1', 0, 10),
    ).toBeUndefined()
  })
})
