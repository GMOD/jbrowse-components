import { SEQRET } from './bamSeqDecoder.ts'
import { encodeSeqNumeric } from './bamSeqEncoder.ts'

// what @gmod/bam's forEachMismatchNumeric does to read base i
function decode(packed: Uint8Array, length: number) {
  let out = ''
  for (let i = 0; i < length; i++) {
    const nibble = (packed[i >> 1]! >> ((1 - (i & 1)) << 2)) & 0xf
    out += SEQRET[nibble]!
  }
  return out
}

test('round-trips through the layout the mismatch walk reads', () => {
  const seq = 'ACGTACGTNNAC'
  expect(decode(encodeSeqNumeric(seq), seq.length)).toBe(seq)
})

test('packs two bases per byte', () => {
  expect(encodeSeqNumeric('AC')).toEqual(new Uint8Array([0x12]))
})

test('an odd-length sequence leaves the trailing nibble empty', () => {
  const packed = encodeSeqNumeric('ACG')
  expect(packed).toHaveLength(2)
  expect(decode(packed, 3)).toBe('ACG')
})

// a soft-masked reference or a lowercase FASTA query would otherwise pack as N
// and report every base as a mismatch
test('lowercase bases encode as their uppercase nibble', () => {
  expect(encodeSeqNumeric('acgt')).toEqual(encodeSeqNumeric('ACGT'))
})

test('an unknown character encodes as N', () => {
  expect(encodeSeqNumeric('-')).toEqual(encodeSeqNumeric('N'))
})

test('an empty sequence packs to nothing', () => {
  expect(encodeSeqNumeric('')).toHaveLength(0)
})
