import { parseCigar2 } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { offAnchorIntervals, splitByIntervals } from './offAnchor.ts'

const record = (
  id: string,
  mate: { start: number; end: number },
  strand = 1,
  assemblyName = 'HG1#1',
  anchor = { start: 1000, end: 2000 },
) =>
  new SimpleFeature({
    uniqueId: id,
    refName: 'chr1',
    ...anchor,
    strand,
    mate: { assemblyName, refName: 'h1', ...mate },
  })

test('an insertion the anchor lacks is the lane stretch its I op covers', () => {
  const f = record('a', { start: 100, end: 1300 })
  const ops = new Map([['a', Uint32Array.from(parseCigar2('400=200I600='))]])
  expect(offAnchorIntervals([f], ops).get('HG1#1')).toEqual([
    { refName: 'h1', start: 500, end: 700 },
  ])
})

test('an insertion under the cutoff is left out', () => {
  const f = record('a', { start: 100, end: 1130 })
  const ops = new Map([['a', Uint32Array.from(parseCigar2('400=30I600='))]])
  expect(offAnchorIntervals([f], ops).get('HG1#1')).toBeUndefined()
})

test('a deletion opens nothing on the lane', () => {
  const f = record('a', { start: 100, end: 1100 })
  const ops = new Map([['a', Uint32Array.from(parseCigar2('400=500D600='))]])
  expect(offAnchorIntervals([f], ops).get('HG1#1')).toBeUndefined()
})

test('the lane between two records that the anchor runs straight across is off the anchor', () => {
  const left = record('l', { start: 0, end: 500 }, 1, 'HG1#1', {
    start: 1000,
    end: 1500,
  })
  const right = record('r', { start: 54_500, end: 55_000 }, 1, 'HG1#1', {
    start: 1500,
    end: 2000,
  })
  expect(offAnchorIntervals([left, right], new Map()).get('HG1#1')).toEqual([
    { refName: 'h1', start: 500, end: 54_500 },
  ])
})

test('a lane gap the anchor spans alike, as between two displayed regions, is not', () => {
  const left = record('l', { start: 0, end: 10_000 }, 1, 'HG1#1', {
    start: 0,
    end: 10_000,
  })
  const right = record('r', { start: 40_000, end: 50_000 }, 1, 'HG1#1', {
    start: 40_000,
    end: 50_000,
  })
  expect(
    offAnchorIntervals([left, right], new Map()).get('HG1#1'),
  ).toBeUndefined()
})

test('only the lane gap past the anchor gap is off the anchor', () => {
  const left = record('l', { start: 0, end: 1000 }, 1, 'HG1#1', {
    start: 0,
    end: 1000,
  })
  const right = record('r', { start: 4000, end: 5000 }, 1, 'HG1#1', {
    start: 3000,
    end: 4000,
  })
  expect(offAnchorIntervals([left, right], new Map()).get('HG1#1')).toEqual([
    { refName: 'h1', start: 2000, end: 3000 },
  ])
})

test('a reverse record walks its lane from the mate end', () => {
  const f = record('a', { start: 100, end: 1300 }, -1)
  const ops = new Map([['a', Uint32Array.from(parseCigar2('400=200I600='))]])
  expect(offAnchorIntervals([f], ops).get('HG1#1')).toEqual([
    { refName: 'h1', start: 700, end: 900 },
  ])
})

test('the sequence past a lane end is not counted', () => {
  const f = record('a', { start: 100, end: 1100 })
  expect(offAnchorIntervals([f], new Map()).get('HG1#1')).toBeUndefined()
})

test('a span splits at the intervals on its refName', () => {
  const intervals = [
    { refName: 'h1', start: 20, end: 40 },
    { refName: 'h2', start: 0, end: 100 },
  ]
  expect(splitByIntervals(intervals, 'h1', 0, 100)).toEqual({
    inside: [[20, 40]],
    outside: [
      [0, 20],
      [40, 100],
    ],
  })
  expect(splitByIntervals(intervals, 'h1', 100, 0).inside).toEqual([[20, 40]])
})
