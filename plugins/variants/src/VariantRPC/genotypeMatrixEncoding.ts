// How a genotype matrix encodes "no data", and what the clustering does about
// it.
//
// The matrix builders emit Float32Array rows with NaN for a genotype that
// carries no usable value (a no-call, a sample absent from the VCF, an unphased
// call in phased mode). NaN is the only missing marker: a sentinel *on* the
// value scale — the -1 these builders used to write — is worse than useless
// under a Euclidean metric, because |-1 - 2| = 3 makes a no-call further from a
// hom-alt genotype than any two real genotypes are from each other. Samples
// then cluster by how much data they are missing rather than by their
// genotypes.
//
// Consumers each handle NaN their own way: the R/TSV export writes `NA` (R's
// `dist()` scales the sum up over the columns it could use), and the WASM
// clustering imputes to the site mean, since it rejects non-finite input
// outright.

export const MISSING = Number.NaN

// Replace every no-call with its site's mean across the samples that do have a
// call, so it contributes nothing to that site's term in the distance. This is
// the standard treatment in genotype PCA / GRM work. A site with no calls at
// all imputes to 0, i.e. drops out entirely.
export function imputeMissingToSiteMean(rows: Record<string, Float32Array>) {
  const arrays = Object.values(rows)
  const numRows = arrays.length
  const numSites = arrays[0]?.length ?? 0
  if (numRows === 0 || numSites === 0) {
    return rows
  }
  const sums = new Float64Array(numSites)
  const counts = new Uint32Array(numSites)
  for (let r = 0; r < numRows; r++) {
    const row = arrays[r]!
    for (let s = 0; s < numSites; s++) {
      const v = row[s]!
      if (!Number.isNaN(v)) {
        sums[s] = sums[s]! + v
        counts[s] = counts[s]! + 1
      }
    }
  }
  const means = new Float32Array(numSites)
  for (let s = 0; s < numSites; s++) {
    const count = counts[s]!
    means[s] = count === 0 ? 0 : sums[s]! / count
  }
  for (let r = 0; r < numRows; r++) {
    const row = arrays[r]!
    for (let s = 0; s < numSites; s++) {
      if (Number.isNaN(row[s]!)) {
        row[s] = means[s]!
      }
    }
  }
  return rows
}

// Write the per-haplotype alt-allele indicator of one phased genotype into
// `out[outOffset .. outOffset + ploidy)`: 0 for the reference allele, 1 for any
// alt, NaN where the haplotype has nothing to say.
//
// The indicator is deliberately binary rather than the raw allele index the
// phased builder used to write. An allele index is a category, not a quantity —
// under Euclidean distance a raw index makes allele 5 four times further from
// allele 1 than allele 2 is, which is meaningless. The cost is that two
// different alts at one multiallelic site look identical here; the position
// -anchored haplotype sort compares allele identity exactly and is the tool for
// that.
//
// An unphased genotype yields NaN across every haplotype: `0/1` says a sample
// carries one alt but not which haplotype has it, so neither row may claim it.
export function readPhasedAlleleIndicators(
  val: string,
  start: number,
  end: number,
  out: Float32Array,
  outOffset: number,
  ploidy: number,
) {
  let hp = 0
  let called = false
  let isRef = true
  let started = false
  for (let i = start; i < end; i++) {
    const c = val.charCodeAt(i)
    if (c === 124 /* | */) {
      if (hp < ploidy) {
        out[outOffset + hp] = called ? (isRef ? 0 : 1) : MISSING
      }
      hp++
      called = false
      isRef = true
      started = false
    } else if (c === 47 /* / */) {
      for (let j = 0; j < ploidy; j++) {
        out[outOffset + j] = MISSING
      }
      return
    } else {
      started = true
      if (c !== 46 /* . */) {
        called = true
        if (c !== 48 /* 0 */) {
          isRef = false
        }
      }
    }
  }
  if (started) {
    if (hp < ploidy) {
      out[outOffset + hp] = called ? (isRef ? 0 : 1) : MISSING
    }
    hp++
  }
  for (let j = hp; j < ploidy; j++) {
    out[outOffset + j] = MISSING
  }
}
