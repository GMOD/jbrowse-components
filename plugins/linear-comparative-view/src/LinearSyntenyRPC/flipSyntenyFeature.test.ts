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

// An MCScan gene pair names a gene on each side; the flipped ribbon on the
// query axis is the query's gene, with the target's as its mate
test('the gene names change places with the ends', () => {
  const f = flipSyntenyFeature(
    alignment({
      name: 'Fgfr2',
      mate: {
        name: 'FGFR2',
        refName: 'q1',
        start: 100,
        end: 300,
        assemblyName: 'query',
      },
    }),
  )!
  expect(f.get('name')).toBe('FGFR2')
  expect(f.get('mate')).toMatchObject({ name: 'Fgfr2', refName: 't1' })
})

test('a named row with a nameless mate drops its own name on the query axis', () => {
  const f = flipSyntenyFeature(alignment({ name: 'geneT' }))!
  expect(f.get('name')).toBeUndefined()
  expect(f.get('mate')).toMatchObject({ name: 'geneT' })
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
// along: the color-by channels read these by name off the feature.
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

// The coarse tier's fold carries the same trap as the CIGAR: a run's own and
// mate lengths and its indel sense belong to the perspective the row was
// fetched under, and the spread would carry them across unchanged.
test('a coarse fold is turned round with the row', () => {
  const plus = flipSyntenyFeature(
    alignment({ coarseCigar: '100:80M5000I100M' }),
  )!
  expect(plus.get('coarseCigar')).toBe('80:100M5000D100M')
  expect(plus.get('CIGAR')).toBeUndefined()

  const minus = flipSyntenyFeature(
    alignment({ strand: -1, coarseCigar: '100:80M5000I100M' }),
  )!
  expect(minus.get('coarseCigar')).toBe('100M5000D80:100M')
})

// A PAF row's `get('name')` is its contig, the alignments read name; the
// flipped ribbon's mate carries what the source named the row, which is nothing
test('a flipped PAF block names no mate', () => {
  const block = Object.assign(alignment({ name: 'q1' }), {
    recordName: () => undefined,
  })
  expect(flipSyntenyFeature(block)!.get('mate')).toMatchObject({
    refName: 't1',
    name: undefined,
  })
})
