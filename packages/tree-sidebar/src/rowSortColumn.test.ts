import {
  loadedRegionIndexAt,
  orderRowsByValueAt,
  regionCoversColumn,
} from './rowSortColumn.ts'

function regions(...spans: [number, string, number, number][]) {
  return new Map(
    spans.map(([index, refName, start, end]) => [
      index,
      { refName, start, end },
    ]),
  )
}

function rows(...names: string[]) {
  return names.map(name => ({ name }))
}

function values(...pairs: [string, number][]) {
  return new Map(pairs)
}

// descending, which is multi-wiggle's; multi-row's ranks by block size first
const HIGHEST_FIRST = (a: number, b: number) => b - a

describe('regionCoversColumn', () => {
  test('is half-open on the end, matching how a region is fetched', () => {
    const r = { refName: 'chr1', start: 100, end: 200 }
    expect(regionCoversColumn(r, 'chr1', 100)).toBe(true)
    expect(regionCoversColumn(r, 'chr1', 199)).toBe(true)
    expect(regionCoversColumn(r, 'chr1', 200)).toBe(false)
    expect(regionCoversColumn(r, 'chr1', 99)).toBe(false)
  })

  test('a matching span on another contig is not a match', () => {
    // coordinates repeat across contigs — every refName starts near 0
    expect(
      regionCoversColumn({ refName: 'chr2', start: 0, end: 500 }, 'chr1', 100),
    ).toBe(false)
  })

  test('no region covers nothing', () => {
    expect(regionCoversColumn(undefined, 'chr1', 100)).toBe(false)
  })
})

describe('loadedRegionIndexAt', () => {
  test('names the region whose span holds the column', () => {
    const loaded = regions([0, 'chr1', 0, 100], [1, 'chr1', 100, 200])
    expect(loadedRegionIndexAt(loaded, 'chr1', 150)).toBe(1)
    expect(loadedRegionIndexAt(loaded, 'chr1', 50)).toBe(0)
  })

  test('is undefined past the end of what is loaded', () => {
    const loaded = regions([0, 'chr1', 0, 100])
    expect(loadedRegionIndexAt(loaded, 'chr1', 5000)).toBeUndefined()
    expect(loadedRegionIndexAt(loaded, 'chr2', 50)).toBeUndefined()
    expect(loadedRegionIndexAt(regions(), 'chr1', 50)).toBeUndefined()
  })
})

describe('orderRowsByValueAt', () => {
  test('ranks by the comparator and returns the rows themselves', () => {
    // every field a row carries (a user's color, its group) has to survive,
    // because the caller writes the result straight to `layout`
    const a = { name: 'a', color: 'red' }
    const b = { name: 'b', color: 'blue' }
    expect(
      orderRowsByValueAt([a, b], values(['a', 1], ['b', 5]), HIGHEST_FIRST),
    ).toEqual([b, a])
  })

  test('sinks valueless rows below every ranked one, however low', () => {
    // inventing a neutral 0 for the missing rows would rank them above the
    // negative scores, which is the whole reason this rule is not the caller's
    expect(
      orderRowsByValueAt(
        rows('a', 'b', 'c', 'd'),
        values(['a', -5], ['c', -1]),
        HIGHEST_FIRST,
      ).map(s => s.name),
    ).toEqual(['c', 'a', 'b', 'd'])
  })

  test('keeps the valueless tail in its incoming order', () => {
    expect(
      orderRowsByValueAt(
        rows('x', 'y', 'z'),
        values(['y', 1]),
        HIGHEST_FIRST,
      ).map(s => s.name),
    ).toEqual(['y', 'x', 'z'])
  })

  test('leaves tied rows in their incoming order', () => {
    // what lets an earlier sort still order each block a later one produces
    expect(
      orderRowsByValueAt(
        rows('b', 'a', 'c'),
        values(['a', 4], ['b', 4], ['c', 4]),
        HIGHEST_FIRST,
      ).map(s => s.name),
    ).toEqual(['b', 'a', 'c'])
  })

  test('never hands the comparator a missing value', () => {
    const seen: number[] = []
    orderRowsByValueAt(
      rows('a', 'b', 'c'),
      values(['a', 1], ['c', 2]),
      (x, y) => {
        seen.push(x, y)
        return y - x
      },
    )
    expect(seen.every(v => typeof v === 'number')).toBe(true)
  })
})
