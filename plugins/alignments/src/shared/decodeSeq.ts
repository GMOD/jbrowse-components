// Sequence decoder matching @gmod/bam format
const SEQRET_DECODER = '=ACMGRSVTWYHKDBN'.split('')

// Decodes packed NUMERIC_SEQ (Uint8Array) to string
// Each byte encodes 2 bases in 4-bit nibbles
export function decodeSeq(numericSeq: Uint8Array, seqLength: number): string {
  const buf = new Array(seqLength)
  let i = 0
  const fullBytes = seqLength >> 1

  for (let j = 0; j < fullBytes; ++j) {
    const sb = numericSeq[j]!
    buf[i++] = SEQRET_DECODER[(sb & 0xf0) >> 4]
    buf[i++] = SEQRET_DECODER[sb & 0x0f]
  }

  if (i < seqLength) {
    const sb = numericSeq[fullBytes]!
    buf[i] = SEQRET_DECODER[(sb & 0xf0) >> 4]
  }

  return buf.join('')
}

// Gets a single base at position idx from NUMERIC_SEQ
export function seqAt(
  numericSeq: Uint8Array,
  idx: number,
  seqLength: number,
): string | undefined {
  if (idx < seqLength) {
    const byteIndex = idx >> 1
    const sb = numericSeq[byteIndex]!
    return idx % 2 === 0
      ? SEQRET_DECODER[(sb & 0xf0) >> 4]
      : SEQRET_DECODER[sb & 0x0f]
  }
  return undefined
}
