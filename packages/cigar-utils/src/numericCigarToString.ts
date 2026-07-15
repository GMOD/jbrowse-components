// Packed CIGAR op index (packed & 0xf) to op char, indices per BAM spec:
// M=0 I=1 D=2 N=3 S=4 H=5 P=6 ==7 X=8
const CIGAR_CHARS = 'MIDNSHP=X'

// serialize a packed NUMERIC_CIGAR (each entry = (length << 4) | opIndex) back
// to a CIGAR string; inverse of the numeric packing produced across adapters
export function numericCigarToString(cigar: ArrayLike<number>) {
  let result = ''
  for (let i = 0, l = cigar.length; i < l; i++) {
    const packed = cigar[i]!
    result += (packed >> 4) + CIGAR_CHARS[packed & 0xf]!
  }
  return result
}
