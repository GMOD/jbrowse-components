import { quantileExtent, scaleExtent, selectNth } from './quantileExtent.ts'

const spiky = Float32Array.from([
  ...Array.from({ length: 99 }, (_, i) => i + 1),
  10000,
])

test('a quantile of 1 spans the finite extremes, and nothing finite spans nothing', () => {
  expect(quantileExtent([3, Number.NaN, -2, Infinity, 7], 5)).toEqual([-2, 7])
  expect(quantileExtent([Number.NaN], 1)).toEqual([Infinity, -Infinity])
})

test('a quantile below 1 clips both tails of one-signed values, and 0 stays out', () => {
  expect(quantileExtent(spiky, spiky.length, 0.95)).toEqual([6, 95])
  expect(quantileExtent(spiky, spiky.length, 1)).toEqual([1, 10000])
  expect(quantileExtent([-4, -2], 2, 0.95)).toEqual([-4, -2])
})

test('a quantile under 0.5 meets at the median rather than crossing it', () => {
  expect(quantileExtent(spiky, spiky.length, 0.2)).toEqual([50, 50])
  expect(quantileExtent(spiky, spiky.length, Number.NaN)).toEqual([1, 10000])
})

test('a quantile just below 1 keeps the extremes of values far from 0', () => {
  const scores = Array.from({ length: 501 }, (_, i) => 500 + i)
  expect(quantileExtent(scores, scores.length, 0.999)).toEqual([500, 1000])
})

test('each sign clips on its own, so a sparse tail of the other keeps its end', () => {
  const signed = Float32Array.from([...spiky, ...Array.from(spiky, v => -v)])
  expect(quantileExtent(signed, signed.length, 0.95)).toEqual([-95, 95])
  const copyNumber = [
    ...Array.from({ length: 995 }, () => 0.5),
    -1,
    -1,
    -1,
    -1,
    -1,
  ]
  expect(quantileExtent(copyNumber, copyNumber.length, 0.99)).toEqual([-1, 0.5])
  expect(quantileExtent([], 0, 0.95)).toEqual([Infinity, -Infinity])
})

test('a log scale reads only the positive values, quantile and all', () => {
  const values = [0, -3, 0.25, 2, 8, Number.NaN]
  expect(scaleExtent(values, values.length, 'log')).toEqual([0.25, 8])
  expect(scaleExtent(values, values.length, 'linear')).toEqual([-3, 8])
  expect(scaleExtent([0, -1], 2, 'log')).toEqual([Infinity, -Infinity])
  const logSpiky = Float32Array.from([0, 0, ...spiky])
  expect(scaleExtent(logSpiky, logSpiky.length, 'log', 0.95)).toEqual([6, 95])
})

test('selectNth answers the kth smallest', () => {
  const a = Float32Array.from([5, 1, 4, 2, 3])
  expect(selectNth(a, 5, 0)).toBe(1)
  expect(selectNth(Float32Array.from([5, 1, 4, 2, 3]), 5, 4)).toBe(5)
})
