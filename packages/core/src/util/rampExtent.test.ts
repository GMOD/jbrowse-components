import { rampExtent, selectNth } from './rampExtent.ts'

const spiky = Float32Array.from([
  ...Array.from({ length: 99 }, (_, i) => i + 1),
  10000,
])

test('local spans the finite extremes, and nothing finite spans nothing', () => {
  expect(rampExtent([3, Number.NaN, -2, Infinity, 7], 5)).toEqual([-2, 7])
  expect(rampExtent([Number.NaN], 1)).toEqual([Infinity, -Infinity])
})

test('localpercentile clips a spike and anchors positive values at 0', () => {
  expect(rampExtent(spiky, spiky.length, 'localpercentile', 0.95)).toEqual([
    0, 95,
  ])
  expect(rampExtent(spiky, spiky.length, 'local')).toEqual([1, 10000])
})

test('localpercentile clips each sign on its own', () => {
  const signed = Float32Array.from([...spiky, ...Array.from(spiky, v => -v)])
  expect(rampExtent(signed, signed.length, 'localpercentile', 0.95)).toEqual([
    -95, 95,
  ])
  expect(rampExtent([-4, -2], 2, 'localpercentile', 1)).toEqual([-4, 0])
  expect(rampExtent([], 0, 'localpercentile')).toEqual([Infinity, -Infinity])
})

test('selectNth answers the kth smallest', () => {
  const a = Float32Array.from([5, 1, 4, 2, 3])
  expect(selectNth(a, 5, 0)).toBe(1)
  expect(selectNth(Float32Array.from([5, 1, 4, 2, 3]), 5, 4)).toBe(5)
})
