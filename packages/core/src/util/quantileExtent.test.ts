import { quantileExtent, selectNth } from './quantileExtent.ts'

const spiky = Float32Array.from([
  ...Array.from({ length: 99 }, (_, i) => i + 1),
  10000,
])

test('a quantile of 1 spans the finite extremes, and nothing finite spans nothing', () => {
  expect(quantileExtent([3, Number.NaN, -2, Infinity, 7], 5)).toEqual([-2, 7])
  expect(quantileExtent([Number.NaN], 1)).toEqual([Infinity, -Infinity])
})

test('a quantile below 1 clips a spike and anchors positive values at 0', () => {
  expect(quantileExtent(spiky, spiky.length, 0.95)).toEqual([0, 95])
  expect(quantileExtent(spiky, spiky.length, 1)).toEqual([1, 10000])
})

test('each sign clips on its own', () => {
  const signed = Float32Array.from([...spiky, ...Array.from(spiky, v => -v)])
  expect(quantileExtent(signed, signed.length, 0.95)).toEqual([-95, 95])
  expect(quantileExtent([-4, -2], 2, 0.95)).toEqual([-4, 0])
  expect(quantileExtent([], 0, 0.95)).toEqual([Infinity, -Infinity])
})

test('selectNth answers the kth smallest', () => {
  const a = Float32Array.from([5, 1, 4, 2, 3])
  expect(selectNth(a, 5, 0)).toBe(1)
  expect(selectNth(Float32Array.from([5, 1, 4, 2, 3]), 5, 4)).toBe(5)
})
