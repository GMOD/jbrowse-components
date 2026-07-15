import { SimpleFeature } from '@jbrowse/core/util'

import { getEndpoint } from './chordGeometry.ts'

import type { Block } from './types.ts'

function block(refName: string): Block {
  return {
    bpPerRadian: 1,
    startRadians: 0,
    endRadians: 1,
    region: { start: 0, end: 1, refName },
  }
}

const chr1 = block('chr1')
const chr2 = block('chr2')
const chr3 = block('chr3')
const blocksForRefs = { chr1, chr2, chr3 }

test('falls back to the feature end in its own block', () => {
  const feature = new SimpleFeature({
    uniqueId: 'x',
    refName: 'chr1',
    start: 100,
    end: 200,
  })
  expect(getEndpoint(feature, blocksForRefs, chr1)).toEqual({
    endBlock: chr1,
    endPosition: 200,
  })
})

test('uses an explicit mate field (already 0-based)', () => {
  const feature = new SimpleFeature({
    uniqueId: 'x',
    refName: 'chr1',
    start: 100,
    end: 200,
    mate: { refName: 'chr2', start: 500, end: 600 },
  })
  expect(getEndpoint(feature, blocksForRefs, chr1)).toEqual({
    endBlock: chr2,
    endPosition: 500,
  })
})

test('converts a VCF breakend ALT mate from 1-based to 0-based', () => {
  const feature = new SimpleFeature({
    uniqueId: 'x',
    refName: 'chr1',
    start: 100,
    end: 200,
    ALT: ['A[chr3:900['],
  })
  expect(getEndpoint(feature, blocksForRefs, chr1)).toEqual({
    endBlock: chr3,
    endPosition: 899,
  })
})

test('converts a symbolic translocation (INFO END/CHR2) to 0-based', () => {
  const feature = new SimpleFeature({
    uniqueId: 'x',
    refName: 'chr1',
    start: 100,
    end: 200,
    ALT: ['<TRA>'],
    INFO: { END: [900], CHR2: ['chr3'] },
  })
  expect(getEndpoint(feature, blocksForRefs, chr1)).toEqual({
    endBlock: chr3,
    endPosition: 899,
  })
})
