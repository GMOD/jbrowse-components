import { isNoCall } from './getPhasedColor.ts'

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
    if (gt.includes('/') && !isNoCall(gt)) {
      return 'unphased'
    }
  }
  return 'unknown'
}

/**
 * Which estimator the caller asked for. 'auto' takes the most precise statistic
 * the file supports; 'precomputed' is not here because it is a property of the
 * adapter rather than a request.
 */
export type LDMethodRequest = 'auto' | 'phased' | 'composite'

/**
 * Which estimator to run — count gametes ('phased') or correlate dosages
 * ('composite') — given what the file carries and what was asked for.
 *
 * The two directions are not symmetric, which is the whole content of this
 * function. Composite LD is well defined on a phased callset — collapsing a
 * haplotype pair to a dosage loses phase and nothing else — so 'composite' is
 * honoured whatever the file is, and forcing it is how a phased panel is made
 * comparable to an unphased cohort or to plink `--r2`. Haplotypic LD counts
 * gametes that an unphased file does not carry, so 'phased' is a preference
 * that unphased data declines rather than an instruction that can fail.
 */
export function resolveLDMethod(
  detectedPhased: boolean,
  request: LDMethodRequest,
) {
  return detectedPhased && request !== 'composite' ? 'phased' : 'composite'
}
