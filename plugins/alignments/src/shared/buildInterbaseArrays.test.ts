import { buildGapArrays } from '../features/gap/buildArrays.ts'
import { buildInterbaseArrays } from './buildInterbaseArrays.ts'

// An insertion's length is bounded by the query, not by the reference span the
// read covers, so it is not bounded at all in an assembly-to-reference BAM
// (dipcall, `minimap2 -a` on contigs, a pangenome graph path re-encoded as
// CIGAR). These arrays were Uint16Array, which silently clamped: a 113,174 bp
// insertion drew and reported "65535".
test('an insertion past 65,535 bp keeps its length', () => {
  const { interbaseLengths } = buildInterbaseArrays(
    [{ readIndex: 0, position: 1094197, length: 113174 }],
    [],
    [],
    0,
  )
  expect(interbaseLengths[0]).toBe(113174)
})

// A gap's length is its two u32 endpoints subtracted; there is no length array
// to clamp it.
test('a deletion past 65,535 bp keeps its length', () => {
  const { gapPositions } = buildGapArrays(
    [
      {
        readIndex: 0,
        start: 1000,
        end: 1000 + 113174,
        type: 'deletion',
        strand: 1,
        featureStrand: 1,
      },
    ],
    0,
  )
  expect(gapPositions[1]! - gapPositions[0]!).toBe(113174)
})
