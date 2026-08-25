import { makeSyntenyFeature } from '../PAFAdapter/util.ts'

// A contig's blocks chain in the alignments display by two fields a BAM read
// carries and a PAF line has to supply: the QNAME the blocks share, and each
// block's offset along the read (`clipLengthAtStartOfRead`), which is the sort
// key that puts the blocks in contig order rather than fetch order.

function block({
  strand,
  flip,
  mateStart,
}: {
  strand: number
  flip: boolean
  mateStart: number
}) {
  return makeSyntenyFeature({
    syntenyId: 1,
    assemblyName: 'hg38',
    refName: 'chr3',
    start: 1000,
    end: 1500,
    strand,
    extra: { cg: '500M' },
    flip,
    mate: {
      refName: 'contig_7',
      start: mateStart,
      end: mateStart + 500,
      assemblyName: 'asm',
    },
  })
}

test('a block is named for the sequence on its other side', () => {
  expect(block({ strand: 1, flip: false, mateStart: 0 }).get('name')).toBe(
    'contig_7',
  )
})

test('its read offset is where the block sits on that sequence, whatever the strand', () => {
  for (const strand of [1, -1]) {
    for (const flip of [false, true]) {
      const f = block({ strand, flip, mateStart: 12_000 })
      expect(f.clipLengthAtStartOfRead).toBe(12_000)
      expect(f.get('clipLengthAtStartOfRead')).toBe(12_000)
    }
  }
})

test('the alignments extractor reads the offset as a property, not a field', () => {
  // `extractFeatureArrays` takes `feature.clipLengthAtStartOfRead` off any
  // feature with `forEachMismatch`, which a SyntenyFeature has
  const f = block({ strand: 1, flip: false, mateStart: 40 })
  expect('forEachMismatch' in f).toBe(true)
  expect(Object.keys(f.toJSON())).not.toContain('name')
})
