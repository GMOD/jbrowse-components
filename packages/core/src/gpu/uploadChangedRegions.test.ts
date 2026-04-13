import { uploadChangedRegions } from './uploadChangedRegions.ts'

test('uploads all regions on first call', () => {
  const data0 = {}
  const data1 = {}
  const cache = new Map<number, object>()
  const calls: number[] = []

  uploadChangedRegions(
    new Map([
      [0, data0],
      [1, data1],
    ]),
    cache,
    n => calls.push(n),
  )
  expect(calls).toEqual([0, 1])
})

test('skips upload when data reference is unchanged', () => {
  const data0 = {}
  const data1 = {}
  const cache = new Map<number, object>()
  const calls: number[] = []

  uploadChangedRegions(
    new Map([
      [0, data0],
      [1, data1],
    ]),
    cache,
    n => calls.push(n),
  )
  calls.length = 0

  uploadChangedRegions(
    new Map([
      [0, data0],
      [1, data1],
    ]),
    cache,
    n => calls.push(n),
  )
  expect(calls).toEqual([])
})

test('uploads only the region whose reference changed', () => {
  const data0a = {}
  const data0b = {}
  const data1 = {}
  const cache = new Map<number, object>()
  const calls: number[] = []

  uploadChangedRegions(
    new Map([
      [0, data0a],
      [1, data1],
    ]),
    cache,
    n => calls.push(n),
  )
  calls.length = 0

  uploadChangedRegions(
    new Map([
      [0, data0b],
      [1, data1],
    ]),
    cache,
    n => calls.push(n),
  )
  expect(calls).toEqual([0])
  expect(cache.get(0)).toBe(data0b)
  expect(cache.get(1)).toBe(data1)
})

test('prunes stale regions from cache and returns active list', () => {
  const data0 = {}
  const data1 = {}
  const cache = new Map<number, object>()

  uploadChangedRegions(
    new Map([
      [0, data0],
      [1, data1],
    ]),
    cache,
    () => {},
  )

  const active = uploadChangedRegions(new Map([[0, data0]]), cache, () => {})
  expect(active).toEqual([0])
  expect(cache.has(0)).toBe(true)
  expect(cache.has(1)).toBe(false)
})
