import { SimpleFeature } from '@jbrowse/core/util'

import {
  headerReadsAgainstAnchor,
  laneFetchesFor,
  rowsReadAgainstAnchor,
  stacksByStructure,
} from './sourceShape.ts'

const PAIRS = ['headerLanes', 'lanePairsOnAnchor', 'lanePairBatches']

test('a header asks for lanes against the anchor only with lanesReadAgainstAnchor true', () => {
  expect(headerReadsAgainstAnchor({ lanesReadAgainstAnchor: true })).toBe(true)
  expect(headerReadsAgainstAnchor({ lanesReadAgainstAnchor: false })).toBe(
    false,
  )
  expect(headerReadsAgainstAnchor({ lanesReadAgainstAnchor: 'yes' })).toBe(
    false,
  )
  expect(headerReadsAgainstAnchor({ anchorAssemblyName: 'hg38' })).toBe(false)
  expect(headerReadsAgainstAnchor(undefined)).toBe(false)
})

test('a star answering lane pairs on the anchor reads lanes against it when its header asks', () => {
  expect(rowsReadAgainstAnchor(PAIRS, 'hg38', 'assembly')).toBe(false)
  expect(rowsReadAgainstAnchor(PAIRS, 'hg38', 'assembly', false)).toBe(false)
  expect(rowsReadAgainstAnchor(PAIRS, 'hg38', 'assembly', true)).toBe(true)
})

test('a star answering no lane pairs reads lanes against its anchor whatever its header', () => {
  expect(rowsReadAgainstAnchor(['headerLanes'], 'hg38', 'assembly')).toBe(true)
})

test('a header without an anchor reads no lane against one', () => {
  expect(rowsReadAgainstAnchor(PAIRS, undefined, 'assembly', true)).toBe(false)
})

test('lanes read against the anchor fetch no lane pairs and stack densest-first', () => {
  const features = [
    new SimpleFeature({ uniqueId: 'r1', refName: 'ctgA', start: 0, end: 10 }),
  ]
  const rowsVsAnchor = rowsReadAgainstAnchor(PAIRS, 'hg38', 'assembly', true)
  const fetches = laneFetchesFor(features, rowsVsAnchor, 'hg38')
  expect(fetches.lanePairs).toBe(false)
  expect(stacksByStructure(PAIRS, fetches)).toBe(false)
  expect(
    stacksByStructure(
      PAIRS,
      laneFetchesFor(
        features,
        rowsReadAgainstAnchor(PAIRS, 'hg38', 'assembly'),
        'hg38',
      ),
    ),
  ).toBe(true)
})
