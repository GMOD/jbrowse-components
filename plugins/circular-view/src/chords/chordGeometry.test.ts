import { SimpleFeature } from '@jbrowse/core/util'

import { Slice } from '../CircularView/slices.ts'
import { chordControlRadius, getEndpoint } from './chordGeometry.ts'

function block(refName: string) {
  return new Slice(
    { bpPerRadian: 1 },
    { elided: false, widthBp: 1, start: 0, end: 1, refName, assemblyName: 'a' },
    0,
  )
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

describe('chordControlRadius', () => {
  const radius = 143
  const bezierRadius = 14.3

  test('an antipodal chord keeps the full bow', () => {
    expect(
      chordControlRadius({
        startRadians: 0,
        endRadians: Math.PI,
        radius,
        bezierRadius,
      }),
    ).toBeCloseTo(bezierRadius)
  })

  test('a chord wider than half the circle does not bow back out', () => {
    expect(
      chordControlRadius({
        startRadians: 0,
        endRadians: 1.9 * Math.PI,
        radius,
        bezierRadius,
      }),
    ).toBeCloseTo(bezierRadius)
  })

  test('a quarter-circle chord bows partway', () => {
    const r = chordControlRadius({
      startRadians: 0,
      endRadians: Math.PI / 2,
      radius,
      bezierRadius,
    })
    expect(r).toBeGreaterThan(bezierRadius)
    expect(r).toBeLessThan(radius)
  })

  test('a local event collapses to the rim instead of spiking to the center', () => {
    // the separation a 172 bp deletion subtends at whole-genome scale, which is
    // the median DEL in the C-GIAB benchmark
    expect(
      chordControlRadius({
        startRadians: 1,
        endRadians: 1 + 2.6e-7,
        radius,
        bezierRadius,
      }),
    ).toBeCloseTo(radius)
  })

  test('depth grows with separation', () => {
    const depths = [0.01, 0.1, 0.5, 1, 2, 3].map(sweep =>
      chordControlRadius({
        startRadians: 0,
        endRadians: sweep,
        radius,
        bezierRadius,
      }),
    )
    expect(depths).toEqual([...depths].sort((a, b) => b - a))
  })
})
