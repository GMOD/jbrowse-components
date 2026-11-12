import { types } from '@jbrowse/mobx-state-tree'

import {
  loadedRegionIndexAt,
  orderRowsByValueAt,
  regionCoversColumn,
  setupRowSortAutorun,
  sortRowsAtColumn,
} from './rowSort.ts'

import type { RowSortSpec } from './rowSort.ts'

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

describe('sortRowsAtColumn', () => {
  function host(names: string[]) {
    const written: string[][] = []
    return {
      loadedRegions: regions([0, 'chr1', 0, 1000]),
      editableSources: rows(...names),
      setRowOrder: (next: { name: string }[]) => {
        written.push(next.map(s => s.name))
      },
      written,
    }
  }

  const reversed = (sources: { name: string }[]) => [...sources].reverse()

  test('orders the rows and says it sorted', () => {
    const self = host(['a', 'b', 'c'])
    expect(sortRowsAtColumn(self, 'chr1', 500, () => 'data', reversed)).toBe(
      true,
    )
    expect(self.written).toEqual([['c', 'b', 'a']])
  })

  // The list handed to `order` is `editableSources`, which the subtree filter
  // has not touched: a hidden row must keep its place and its overrides rather
  // than being dropped from `layout` for good. An `order` deriving a statistic
  // from what it is given is therefore counting rows that are not on screen.
  test('orders the unfiltered list, hidden rows included', () => {
    const self = host(['a', 'hidden', 'c'])
    const seen: string[][] = []
    sortRowsAtColumn(
      self,
      'chr1',
      500,
      () => 'data',
      sources => {
        seen.push(sources.map(s => s.name))
        return sources
      },
    )
    expect(seen).toEqual([['a', 'hidden', 'c']])
  })

  // `setRowOrder` drops the cluster tree whenever the row set changes, so neither
  // decline is a harmless no-op — each would trade a dendrogram for a write
  // that reorders nothing.
  test('declines when no loaded region covers the column', () => {
    const self = host(['a', 'b'])
    expect(sortRowsAtColumn(self, 'chr2', 500, () => 'data', reversed)).toBe(
      false,
    )
    expect(self.written).toEqual([])
  })

  test('declines when the display has no data at the column', () => {
    const self = host(['a', 'b'])
    expect(sortRowsAtColumn(self, 'chr1', 500, () => undefined, reversed)).toBe(
      false,
    )
    expect(self.written).toEqual([])
  })

  test('declines below two rows', () => {
    const self = host(['a'])
    expect(sortRowsAtColumn(self, 'chr1', 500, () => 'data', reversed)).toBe(
      false,
    )
    expect(self.written).toEqual([])
  })
})

jest.mock('@jbrowse/core/util', () => ({
  canonicalizeViewRefName: (_node: unknown, refName: string) => refName,
}))

function makeDisplay(
  sortRows: (refName: string, pos: number) => void | boolean | Promise<boolean>,
) {
  const model = types
    .model({
      sortRowsBy: types.frozen<RowSortSpec | undefined>(),
    })
    .volatile(() => ({
      loadedRegions: new Map([[0, { refName: 'chr1', start: 0, end: 1000 }]]),
    }))
    .actions(self => ({
      setSortRowsBy(arg?: RowSortSpec) {
        self.sortRowsBy = arg
      },
    }))
    .create({ sortRowsBy: { refName: 'chr1', pos: 500 } })
  setupRowSortAutorun(model, { name: 'Test', sortRows })
  return model
}

test('clears the trigger when the sort does not decline', () => {
  const sortRows = jest.fn()
  const model = makeDisplay(sortRows)
  expect(sortRows).toHaveBeenCalledWith('chr1', 500)
  expect(model.sortRowsBy).toBeUndefined()
})

// The gate only knows a region covers the column. A display can decline for a
// reason the gate cannot ask about — the multi-sample variant sort needs a
// RECORD at the position, not merely a loaded region over it — and clearing
// anyway lost the trigger, so the session opened with unsorted rows and nothing
// left to re-fire.
test('leaves the trigger set when the sort declines', () => {
  const model = makeDisplay(() => false)
  expect(model.sortRowsBy).toEqual({ refName: 'chr1', pos: 500 })
})

test('a truthy return still clears, so sortRowsAtColumn can report success', () => {
  const model = makeDisplay(() => true)
  expect(model.sortRowsBy).toBeUndefined()
})

test('leaves the trigger set until a region covering the column is loaded', () => {
  const sortRows = jest.fn()
  const model = types
    .model({ sortRowsBy: types.frozen<RowSortSpec | undefined>() })
    .volatile(() => ({
      loadedRegions: new Map([[0, { refName: 'chr2', start: 0, end: 1000 }]]),
    }))
    .actions(self => ({
      setSortRowsBy(arg?: RowSortSpec) {
        self.sortRowsBy = arg
      },
    }))
    .create({ sortRowsBy: { refName: 'chr1', pos: 500 } })
  setupRowSortAutorun(model, { name: 'Test', sortRows })
  expect(sortRows).not.toHaveBeenCalled()
  expect(model.sortRowsBy).toEqual({ refName: 'chr1', pos: 500 })
})

// `regionCoversColumn(r, refName, undefined)` is `start <= undefined`, false for
// every region, so a spec with no numeric `pos` never sorted and never cleared.
test.each([
  [{ refName: 'chr1', pos: '500' }, 'pos'],
  [{ refName: 'chr1' }, 'pos'],
  [{ pos: 500 }, 'refName'],
])('warns naming the malformed field of %j', (spec, field) => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const sortRows = jest.fn()
  const model = types
    .model({ sortRowsBy: types.frozen<unknown>() })
    .volatile(() => ({
      loadedRegions: new Map([[0, { refName: 'chr1', start: 0, end: 1000 }]]),
    }))
    .actions(self => ({
      setSortRowsBy(arg?: RowSortSpec) {
        self.sortRowsBy = arg
      },
    }))
    .create({ sortRowsBy: spec })
  setupRowSortAutorun(model as Parameters<typeof setupRowSortAutorun>[0], {
    name: 'Test',
    sortRows,
  })
  expect(sortRows).not.toHaveBeenCalled()
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining(`sortRowsBy.${field}`),
  )
  warn.mockRestore()
})

// Multi-row reads its values in the worker. Cleared at dispatch, a figure
// waiting on the trigger would capture the rows before the order landed.
describe('an async sort', () => {
  const settle = () => new Promise(r => setTimeout(r, 0))

  function deferred() {
    let resolve: (sorted: boolean) => void = () => {}
    const promise = new Promise<boolean>(r => {
      resolve = r
    })
    return { promise, resolve }
  }

  test('holds the trigger until it resolves true', async () => {
    const sort = deferred()
    const model = makeDisplay(() => sort.promise)
    expect(model.sortRowsBy).toEqual({ refName: 'chr1', pos: 500 })
    sort.resolve(true)
    await settle()
    expect(model.sortRowsBy).toBeUndefined()
  })

  test('keeps it where the sort resolves false', async () => {
    const model = makeDisplay(() => Promise.resolve(false))
    await settle()
    expect(model.sortRowsBy).toEqual({ refName: 'chr1', pos: 500 })
  })

  test('a sort landing after a newer spec leaves that spec set', async () => {
    const first = deferred()
    const second = deferred()
    const sortRows = jest
      .fn<Promise<boolean>, [string, number]>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const model = makeDisplay(sortRows)
    model.setSortRowsBy({ refName: 'chr1', pos: 600 })
    expect(sortRows).toHaveBeenLastCalledWith('chr1', 600)
    first.resolve(true)
    await settle()
    expect(model.sortRowsBy).toEqual({ refName: 'chr1', pos: 600 })
    second.resolve(true)
    await settle()
    expect(model.sortRowsBy).toBeUndefined()
  })
})
