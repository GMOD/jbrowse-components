import { computePresentCigarKinds } from './presentCigarKinds.ts'
import {
  KIND_BASE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
  KIND_MARKER,
} from './syntenyColors.ts'

test('no indel ops when geometry is all base/marker (whole-genome zoom)', () => {
  const kinds = new Uint8Array([KIND_BASE, KIND_BASE, KIND_MARKER])
  expect(computePresentCigarKinds(kinds, 3)).toEqual({
    I: false,
    D: false,
    N: false,
  })
})

test('flags each indel kind actually drawn', () => {
  const kinds = new Uint8Array([KIND_BASE, KIND_CIGAR_I, KIND_CIGAR_D])
  expect(computePresentCigarKinds(kinds, 3)).toEqual({
    I: true,
    D: true,
    N: false,
  })
})

test('flags the rare skip (N) op when present', () => {
  const kinds = new Uint8Array([KIND_CIGAR_N])
  expect(computePresentCigarKinds(kinds, 1)).toEqual({
    I: false,
    D: false,
    N: true,
  })
})

// buildSyntenyGeometry over-allocates then subarrays to instanceCount; an indel
// kind sitting in the unused tail must not count as drawn.
test('honors instanceCount, ignoring trailing capacity slack', () => {
  const kinds = new Uint8Array([KIND_BASE, KIND_CIGAR_I])
  expect(computePresentCigarKinds(kinds, 1)).toEqual({
    I: false,
    D: false,
    N: false,
  })
})
