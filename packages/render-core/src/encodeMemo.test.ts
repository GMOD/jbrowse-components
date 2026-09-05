import { autorun, observable, runInAction } from 'mobx'

import { createEncodeMemo } from './encodeMemo.ts'

interface Cell {
  value: number
}

function setup() {
  const cells = observable.map<number, Cell>(undefined, { deep: false })
  const marker = observable.box(0)
  let encodes = 0
  const memo = createEncodeMemo(
    () => cells,
    () => ({ marker: marker.get() }),
    ({ value }, { marker }) => {
      encodes++
      return { value, marker }
    },
  )
  return { cells, marker, memo, encodes: () => encodes }
}

test('encodes a cell once until its data reference moves', () => {
  const { cells, memo, encodes } = setup()
  const a = { value: 1 }
  runInAction(() => {
    cells.set(0, a)
    cells.set(1, { value: 2 })
  })
  const dispose = autorun(() => {
    memo()
  })
  const first = memo()
  expect(encodes()).toBe(2)
  expect(memo()).toBe(first)
  expect(encodes()).toBe(2)

  runInAction(() => {
    cells.set(0, { value: 3 })
  })
  const second = memo()
  expect(second).not.toBe(first)
  expect(second.get(1)).toBe(first.get(1))
  expect(second.get(0)).toEqual({ value: 3, marker: 0 })
  expect(encodes()).toBe(3)
  dispose()
})

test('an inputs identity change re-encodes every cell', () => {
  const { cells, marker, memo, encodes } = setup()
  runInAction(() => {
    cells.set(0, { value: 1 })
    cells.set(1, { value: 2 })
  })
  const dispose = autorun(() => {
    memo()
  })
  expect(encodes()).toBe(2)
  runInAction(() => {
    marker.set(5)
  })
  expect(encodes()).toBe(4)
  expect(memo().get(1)).toEqual({ value: 2, marker: 5 })
  dispose()
})

test('a fresh inputs object with the same reads does not re-encode', () => {
  const { cells, memo, encodes } = setup()
  runInAction(() => {
    cells.set(0, { value: 1 })
  })
  const dispose = autorun(() => {
    memo()
  })
  expect(encodes()).toBe(1)
  runInAction(() => {
    cells.set(1, { value: 2 })
  })
  expect(encodes()).toBe(2)
  dispose()
})

test('a departed key is dropped and re-encoded on return', () => {
  const { cells, memo, encodes } = setup()
  const a = { value: 1 }
  runInAction(() => {
    cells.set(0, a)
  })
  const dispose = autorun(() => {
    memo()
  })
  runInAction(() => {
    cells.delete(0)
  })
  expect(memo().has(0)).toBe(false)
  runInAction(() => {
    cells.set(0, a)
  })
  expect(memo().get(0)).toEqual({ value: 1, marker: 0 })
  expect(encodes()).toBe(2)
  dispose()
})

test('an unobserved memo re-encodes per read, which is what a keep-alive observer prevents', () => {
  const { cells, memo, encodes } = setup()
  runInAction(() => {
    cells.set(0, { value: 1 })
  })
  memo()
  memo()
  expect(encodes()).toBe(2)
  const dispose = autorun(() => {
    memo()
  })
  memo()
  expect(encodes()).toBe(3)
  dispose()
})

test('the map identity holds while nothing moved', () => {
  const { cells, memo } = setup()
  runInAction(() => {
    cells.set(0, { value: 1 })
  })
  const dispose = autorun(() => {
    memo()
  })
  const first = memo()
  expect(memo()).toBe(first)
  expect(memo()).toBe(first)
  dispose()
})
