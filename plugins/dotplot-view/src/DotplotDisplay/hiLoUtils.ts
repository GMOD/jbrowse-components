export function splitHiLo(
  hi: Float32Array,
  lo: Float32Array,
  idx: number,
  cumBp: number,
) {
  const iv = Math.floor(cumBp)
  const loVal = iv - Math.floor(iv / 4096) * 4096
  hi[idx] = iv - loVal
  lo[idx] = loVal + (cumBp - iv)
}
