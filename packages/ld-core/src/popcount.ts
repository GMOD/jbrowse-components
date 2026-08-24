/**
 * Population count of a 32-bit word, the SWAR variant. Shared by the two
 * bit-packed LD kernels, which are both a popcount loop over word pairs.
 */
export function popcount32(v: number) {
  v = v | 0
  v -= (v >>> 1) & 0x55555555
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  v = (v + (v >>> 4)) & 0x0f0f0f0f
  return Math.imul(v, 0x01010101) >>> 24
}
