import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from './cigarConstants.ts'
import { getNextRefPos } from './getNextRefPos.ts'

// This function had no test of its own — it was covered only through the two
// modification consumers, which is why turning it inside out (from a loop over
// read BASES to a loop over POSITIONS) had nothing local to check it. Each case
// below is one op class's contribution to the read->reference offset, since that
// is what the two shapes have to agree about.

const op = (len: number, code: number) => (len << 4) | code

function collect(ops: number[], positions: number[]) {
  const out: { ref: number; idx: number }[] = []
  getNextRefPos(ops, positions, (ref, idx) => {
    out.push({ ref, idx })
  })
  return out
}

test('a fully aligned read maps read offset to the same reference offset', () => {
  expect(collect([op(100, CIGAR_M)], [0, 7, 42, 99])).toEqual([
    { ref: 0, idx: 0 },
    { ref: 7, idx: 1 },
    { ref: 42, idx: 2 },
    { ref: 99, idx: 3 },
  ])
})

test('idx is the index into positions, not the position', () => {
  expect(collect([op(10, CIGAR_M)], [3, 5])).toEqual([
    { ref: 3, idx: 0 },
    { ref: 5, idx: 1 },
  ])
})

// D and N consume reference without consuming read, so everything after one is
// pushed further along the reference.
test('a deletion shifts every later position', () => {
  const ops = [op(10, CIGAR_M), op(50, CIGAR_D), op(10, CIGAR_M)]
  expect(collect(ops, [2, 9, 10, 19])).toEqual([
    { ref: 2, idx: 0 },
    { ref: 9, idx: 1 },
    { ref: 60, idx: 2 },
    { ref: 69, idx: 3 },
  ])
})

test('a skip shifts them the same way', () => {
  const ops = [op(5, CIGAR_M), op(1000, CIGAR_N), op(5, CIGAR_M)]
  expect(collect(ops, [4, 5])).toEqual([
    { ref: 4, idx: 0 },
    { ref: 1005, idx: 1 },
  ])
})

// S and I consume read without consuming reference, so a position inside one has
// no reference position and must be swallowed rather than mapped.
test('positions inside a soft clip are consumed and never emitted', () => {
  const ops = [op(5, CIGAR_S), op(10, CIGAR_M)]
  expect(collect(ops, [0, 4, 5, 14])).toEqual([
    { ref: 0, idx: 2 },
    { ref: 9, idx: 3 },
  ])
})

test('positions inside an insertion are consumed and never emitted', () => {
  const ops = [op(10, CIGAR_M), op(4, CIGAR_I), op(10, CIGAR_M)]
  expect(collect(ops, [9, 10, 13, 14])).toEqual([
    { ref: 9, idx: 0 },
    { ref: 10, idx: 3 },
  ])
})

test('X and = are aligned ops like M', () => {
  const ops = [op(5, CIGAR_EQ), op(2, CIGAR_X), op(5, CIGAR_EQ)]
  expect(collect(ops, [4, 5, 6, 7])).toEqual([
    { ref: 4, idx: 0 },
    { ref: 5, idx: 1 },
    { ref: 6, idx: 2 },
    { ref: 7, idx: 3 },
  ])
})

test('a position past the end of the read emits nothing for itself', () => {
  expect(collect([op(10, CIGAR_M)], [5, 500])).toEqual([{ ref: 5, idx: 0 }])
})

test('no positions, and no ops, each emit nothing', () => {
  expect(collect([op(10, CIGAR_M)], [])).toEqual([])
  expect(collect([], [1, 2, 3])).toEqual([])
})

// The read's whole coordinate space is covered by S/I/M/X/= — D and N consume no
// read — so a trailing clip has to swallow its positions rather than run off the
// op list still holding them.
test('a trailing soft clip swallows the positions inside it', () => {
  const ops = [op(10, CIGAR_M), op(5, CIGAR_S)]
  expect(collect(ops, [9, 10, 14])).toEqual([{ ref: 9, idx: 0 }])
})

test('leading and trailing clips together', () => {
  const ops = [op(3, CIGAR_S), op(4, CIGAR_M), op(3, CIGAR_S)]
  expect(collect(ops, [0, 3, 6, 7, 9])).toEqual([
    { ref: 0, idx: 1 },
    { ref: 3, idx: 2 },
  ])
})
