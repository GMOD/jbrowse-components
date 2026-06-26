import {
  lowerBound,
  nextChrStartBlock,
  parseTaiIndex,
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
    } as ByteRange['virtualOffset'],
  }))
}

describe('parseTaiIndex', () => {
  test('absolute rows: strips assembly prefix, splits virtual offset', () => {
    const index = parseTaiIndex(
      'hg38.chr1\t0\t65536\nhg38.chr1\t1000\t131072\n',
    )
    expect(Object.keys(index)).toEqual(['chr1'])
    expect(index.chr1).toHaveLength(2)
    expect(index.chr1![0]).toMatchObject({ chrStart: 0 })
    // 65536 -> block 1, data 0
    expect(index.chr1![0]!.virtualOffset).toMatchObject({
      blockPosition: 1,
      dataPosition: 0,
    })
    expect(index.chr1![1]).toMatchObject({ chrStart: 1000 })
    // 131072 -> block 2, data 0
    expect(index.chr1![1]!.virtualOffset).toMatchObject({
      blockPosition: 2,
      dataPosition: 0,
    })
  })

  test('relative `*` rows accumulate deltas onto the previous absolute values', () => {
    // first row absolute: chrStart 100, voff 70000 (block 1, data 4464)
    // second row relative: +50 chrStart, +1000 voff -> 150, 71000
    const index = parseTaiIndex('hg38.chrI\t100\t70000\n*\t50\t1000\n')
    expect(index.chrI).toHaveLength(2)
    expect(index.chrI![0]).toMatchObject({ chrStart: 100 })
    expect(index.chrI![0]!.virtualOffset).toMatchObject({
      blockPosition: 1,
      dataPosition: 70000 - 65536,
    })
    expect(index.chrI![1]).toMatchObject({ chrStart: 150 })
    // 71000 -> block 1, data 71000-65536=5464
    expect(index.chrI![1]!.virtualOffset).toMatchObject({
      blockPosition: 1,
      dataPosition: 71000 - 65536,
    })
  })

  test('chained relative rows keep accumulating from running totals', () => {
    const index = parseTaiIndex(
      'a.chr1\t0\t0\n*\t10\t100\n*\t10\t100\n*\t10\t100\n',
    )
    expect(index.chr1!.map(r => r.chrStart)).toEqual([0, 10, 20, 30])
    expect(index.chr1!.map(r => r.virtualOffset.dataPosition)).toEqual([
      0, 100, 200, 300,
    ])
  })

  test('relative rows inherit the previous absolute chromosome', () => {
    const index = parseTaiIndex('a.chr1\t0\t0\n*\t10\t100\na.chr2\t0\t5000\n')
    expect(Object.keys(index)).toEqual(['chr1', 'chr2'])
    expect(index.chr1).toHaveLength(2)
    expect(index.chr2).toHaveLength(1)
  })

  test('ignores blank and whitespace-only lines', () => {
    const index = parseTaiIndex('\n  \na.chr1\t0\t0\n\n')
    expect(index.chr1).toHaveLength(1)
  })

  test('empty input yields empty index', () => {
    expect(parseTaiIndex('')).toEqual({})
  })

  test('takes the last dotted segment as the chromosome', () => {
    const index = parseTaiIndex('hg38.1.chrX\t0\t0\n')
    expect(Object.keys(index)).toEqual(['chrX'])
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
    virtualOffset: { blockPosition, dataPosition: 0 } as ByteRange['virtualOffset'],
  })
  const index: IndexData = {
    chr1: [at(0), at(1000)],
    chr2: [at(5000), at(6000)],
    chr3: [at(9000)],
  }

  test('interior chromosome bounds at the next chromosome first block', () => {
    expect(nextChrStartBlock(index, 'chr1')).toBe(5000)
    expect(nextChrStartBlock(index, 'chr2')).toBe(9000)
  })

  test('last chromosome has no next block', () => {
    expect(nextChrStartBlock(index, 'chr3')).toBeUndefined()
  })

  test('single-chromosome index has no next block', () => {
    expect(nextChrStartBlock({ chr1: [at(0)] }, 'chr1')).toBeUndefined()
  })
})
