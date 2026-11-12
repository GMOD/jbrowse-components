import { types } from '@jbrowse/mobx-state-tree'

import { setupRowSortAutorun } from './rowSortAutorun.ts'

import type { RowSortSpec } from './rowSortAutorun.ts'

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
