import { SimpleFeature } from '@jbrowse/core/util'

import { flipSyntenyFeature } from './flipSyntenyFeature.ts'

function alignment(over: Record<string, unknown> = {}) {
  return new SimpleFeature({
    uniqueId: 'a1',
    refName: 't1',
    start: 500,
    end: 700,
    strand: 1,
    assemblyName: 'target',
    identity: 0.98,
    mate: {
      refName: 'q1',
      start: 100,
      end: 300,
      assemblyName: 'query',
    },
    ...over,
  })
}

test('the ends change places, and so do their assemblies', () => {
  const f = flipSyntenyFeature(alignment())!
  expect(f.get('refName')).toBe('q1')
  expect(f.get('start')).toBe(100)
  expect(f.get('end')).toBe(300)
  expect(f.get('assemblyName')).toBe('query')
  expect(f.get('mate')).toEqual({
    refName: 't1',
    start: 500,
    end: 700,
    assemblyName: 'target',
  })
})

// The half that would look plausible if it were wrong: an insertion in one
// perspective is a deletion in the other, so a CIGAR carried across unchanged
// paints every indel wedge on the wrong side of its block.
test('an insertion becomes a deletion', () => {
  const f = flipSyntenyFeature(alignment({ CIGAR: '100M5I95M' }))!
  expect(f.get('CIGAR')).toBe('100M5D95M')
})

// On the reverse strand the ops run the other way as well.
test('a reverse-strand CIGAR is reversed as well as swapped', () => {
  const f = flipSyntenyFeature(alignment({ CIGAR: '100M5I95M', strand: -1 }))!
  expect(f.get('CIGAR')).toBe('95M5D100M')
})

// Which is what makes it usable in both directions: the adapters apply the same
// transform when they orient a file row, and flipping twice has to be the row
// you started with or the second fetch could not be turned round at all.
test('flipping twice is the alignment you started with', () => {
  const once = flipSyntenyFeature(alignment({ CIGAR: '100M5I95M' }))!
  const twice = flipSyntenyFeature(once)!
  expect(twice.get('CIGAR')).toBe('100M5I95M')
  expect(twice.get('refName')).toBe('t1')
  expect(twice.get('mate')).toMatchObject({ refName: 'q1', start: 100 })
})

test('a row with no CIGAR stays one', () => {
  expect(flipSyntenyFeature(alignment())!.get('CIGAR')).toBeUndefined()
})

// Everything that is a property of the alignment rather than of an end rides
// along: the colour-by channels read these by name off the feature.
test('the per-alignment attributes and the id ride along', () => {
  const f = flipSyntenyFeature(alignment())!
  expect(f.get('identity')).toBe(0.98)
  expect(f.id()).toBe('a1')
})

test('a feature with no mate is not an alignment to flip', () => {
  expect(
    flipSyntenyFeature(
      new SimpleFeature({ uniqueId: 'x', refName: 't1', start: 0, end: 1 }),
    ),
  ).toBeUndefined()
})
