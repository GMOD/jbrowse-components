/**
 * Decide whether a single variant's genotype map indicates phased data.
 *
 * Phased VCF calls use `|` separators, unphased use `/`, so any `|` is a
 * definitive "phased" signal and any called `/` genotype is a definitive
 * "unphased" one. A purely-missing genotype (`./.`, `.`) carries a separator
 * but no phase information, so it returns 'unknown' — letting the caller keep
 * scanning rather than mis-classifying a phased file whose leading variant
 * happens to be all no-calls.
 */
export function phaseSignal(
  genotypes: Record<string, string>,
): 'phased' | 'unphased' | 'unknown' {
  for (const key in genotypes) {
    const gt = genotypes[key]!
    if (gt.includes('|')) {
      return 'phased'
    }
    if (gt.includes('/') && gt !== './.' && gt !== '.') {
      return 'unphased'
    }
  }
  return 'unknown'
}
