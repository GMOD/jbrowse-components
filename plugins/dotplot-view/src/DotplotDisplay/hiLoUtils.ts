// Splits a genomic cumBp value into hi/lo Float32 parts for shader precision.
// The hi part is aligned to a 4096 bp boundary so the lo part fits comfortably
// inside Float32 precision when shader code recombines them.
//
// Per project rules, this lives at the GPU upload boundary only — JS-side
// code should always work with the original cumBp value.
export function splitHiLo(
  out: Float32Array,
  hiIdx: number,
  loIdx: number,
  cumBp: number,
) {
  const iv = Math.floor(cumBp)
  const loVal = iv - Math.floor(iv / 4096) * 4096
  out[hiIdx] = iv - loVal
  out[loIdx] = loVal + (cumBp - iv)
}
