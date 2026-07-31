import { dotplotFetchKey } from './fetchKey.ts'

import type { Region } from '@jbrowse/core/util'

function region(refName: string, reversed = false): Region {
  return { assemblyName: 'a', refName, start: 0, end: 100, reversed }
}

const h = { bpPerPx: 1, displayedRegions: [region('chr1'), region('chr2')] }
const v = { bpPerPx: 1, displayedRegions: [region('q1'), region('q2')] }
const win = [region('chr1')]

test('identical inputs produce an identical key', () => {
  expect(dotplotFetchKey('fine', h, v, win)).toBe(
    dotplotFetchKey('fine', h, v, win),
  )
})

test('reordering an axis changes the key (the diagonalize case)', () => {
  const vReordered = {
    bpPerPx: 1,
    displayedRegions: [region('q2'), region('q1')],
  }
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('fine', h, vReordered, win),
  )
})

test('flipping a region orientation changes the key (diagonalize reversal)', () => {
  const vFlipped = {
    bpPerPx: 1,
    displayedRegions: [region('q1', true), region('q2')],
  }
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('fine', h, vFlipped, win),
  )
})

test('a zoom (bpPerPx) change changes the key', () => {
  expect(dotplotFetchKey('fine', h, v, win)).not.toBe(
    dotplotFetchKey('fine', { ...h, bpPerPx: 2 }, v, win),
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
