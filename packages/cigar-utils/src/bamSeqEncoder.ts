import { SEQRET } from './bamSeqDecoder.ts'

// char code -> 4-bit nibble, the inverse of SEQRET. Unrecognized characters
// (including lowercase, IUPAC codes we don't list, and '.') land on 'N' (15),
// which the mismatch walk compares equal to nothing.
const NIBBLE_FROM_CHAR_CODE = (() => {
  const table = new Uint8Array(128).fill(15)
  for (let i = 0; i < SEQRET.length; i++) {
    const code = SEQRET.charCodeAt(i)
    table[code] = i
    table[code | 0x20] = i
  }
  return table
})()

/**
 * Pack a SEQ string into BAM's 4-bit-per-base encoding, two bases per byte with
 * the first base in the high nibble — the layout `forEachMismatchNumeric` reads
 * via `(byte >> ((1 - (i & 1)) << 2)) & 0xf`. Lets a text source (SAM, a
 * PSL-derived alignment) drive the same zero-allocation mismatch walk that
 * BAM's own packed sequence does.
 */
export function encodeSeqNumeric(seq: string) {
  const out = new Uint8Array((seq.length + 1) >> 1)
  for (let i = 0; i < seq.length; i += 2) {
    const hiCode = seq.charCodeAt(i)
    const hi = hiCode < 128 ? NIBBLE_FROM_CHAR_CODE[hiCode]! : 15
    // the odd base of a final unpaired byte reads as '=' (0), which is what a
    // BAM's own trailing nibble holds
    const loCode = i + 1 < seq.length ? seq.charCodeAt(i + 1) : -1
    const lo =
      loCode < 0 ? 0 : loCode < 128 ? NIBBLE_FROM_CHAR_CODE[loCode]! : 15
    out[i >> 1] = (hi << 4) | lo
  }
  return out
}
