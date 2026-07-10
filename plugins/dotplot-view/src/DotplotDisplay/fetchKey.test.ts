import { dotplotFetchKey } from './fetchKey.ts'

import type { Region } from '@jbrowse/core/util'

function region(refName: string, reversed = false): Region {
  return { assemblyName: 'a', refName, start: 0, end: 100, reversed }
}

const h = { bpPerPx: 1, displayedRegions: [region('chr1'), region('chr2')] }
const v = { bpPerPx: 1, displayedRegions: [region('q1'), region('q2')] }

test('identical inputs produce an identical key', () => {
  expect(dotplotFetchKey('auto', h, v)).toBe(dotplotFetchKey('auto', h, v))
})

test('reordering an axis changes the key (the diagonalize case)', () => {
  const vReordered = {
    bpPerPx: 1,
    displayedRegions: [region('q2'), region('q1')],
  }
  expect(dotplotFetchKey('auto', h, v)).not.toBe(
    dotplotFetchKey('auto', h, vReordered),
  )
})

test('flipping a region orientation changes the key (diagonalize reversal)', () => {
  const vFlipped = {
    bpPerPx: 1,
    displayedRegions: [region('q1', true), region('q2')],
  }
  expect(dotplotFetchKey('auto', h, v)).not.toBe(
    dotplotFetchKey('auto', h, vFlipped),
  )
})

test('a zoom (bpPerPx) change changes the key', () => {
  expect(dotplotFetchKey('auto', h, v)).not.toBe(
    dotplotFetchKey('auto', { ...h, bpPerPx: 2 }, v),
  )
})

test('a LOD mode change changes the key', () => {
  expect(dotplotFetchKey('auto', h, v)).not.toBe(dotplotFetchKey('fine', h, v))
})
