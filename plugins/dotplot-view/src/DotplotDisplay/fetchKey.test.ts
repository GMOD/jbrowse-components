import { regionSignature } from '@jbrowse/synteny-core'

import { dotplotFetchKey } from './fetchKey.ts'

import type { Region } from '@jbrowse/core/util'

function region(refName: string, reversed = false): Region {
  return { assemblyName: 'a', refName, start: 0, end: 100, reversed }
}

// the view hands each axis' region signature in precomputed; build it the same
// way here so a reorder/flip is still exercised end to end
function axis(bpPerPx: number, regions: Region[]) {
  return { bpPerPx, regionSignature: regionSignature(regions) }
}

const h = axis(1, [region('chr1'), region('chr2')])
const v = axis(1, [region('q1'), region('q2')])
const win = [region('chr1')]

test('identical inputs produce an identical key', () => {
  expect(dotplotFetchKey('fine', h, v, win)).toBe(
    dotplotFetchKey('fine', h, v, win),
  )
})

test('reordering an axis changes the key (the diagonalize case)', () => {
  const vReordered = axis(1, [region('q2'), region('q1')])
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('fine', h, vReordered, win),
  )
})

test('flipping a region orientation changes the key (diagonalize reversal)', () => {
  const vFlipped = axis(1, [region('q1', true), region('q2')])
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('fine', h, vFlipped, win),
  )
})

// The zoom enters as a log2 bucket. A wheel notch inside one leaves the key
// alone — on a whole-genome plot, where `syntenyFetchRegions` has clamped its
// window to the displayed region, that key was the only thing moving, so every
// notch refetched every alignment in the file. See `bucketBpPerPx`.
test('a zoom within one bucket leaves the key alone', () => {
  expect(dotplotFetchKey('fine', { ...h, bpPerPx: 1100 }, v, win)).toBe(
    dotplotFetchKey('fine', { ...h, bpPerPx: 1900 }, v, win),
  )
})

test('a zoom across a bucket boundary changes the key', () => {
  expect(dotplotFetchKey('fine', { ...h, bpPerPx: 1100 }, v, win)).not.toBe(
    dotplotFetchKey('fine', { ...h, bpPerPx: 2100 }, v, win),
  )
})

// Both axes carry their own, so a v-only zoom is still a refetch: the worker
// reads vViewSnap.bpPerPx too (cigarWorthParsing takes the wider of the two).
test('the vertical axis has its own bucket', () => {
  expect(dotplotFetchKey('fine', h, { ...v, bpPerPx: 1100 }, win)).not.toBe(
    dotplotFetchKey('fine', h, { ...v, bpPerPx: 4000 }, win),
  )
})

test('a LOD tier change changes the key', () => {
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('coarse', h, v, win),
  )
})

test('a pan into a new snapped fetch window changes the key', () => {
  const panned = [{ ...region('chr1'), start: 4000, end: 8000 }]
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('fine', h, v, panned),
  )
})

test('the same window on a different refName changes the key', () => {
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('fine', h, v, [region('chr2')]),
  )
})
