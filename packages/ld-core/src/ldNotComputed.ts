/**
 * The value a banded `ldValues` cell carries when no estimator ever ran on that
 * pair. Every metric lands in [-1, 1], so -2 is a value no kernel and no CPU
 * path can produce, and `ldValueComputed` — the generated twin the two shaders
 * test with — is what both renderers ask before painting.
 *
 * A cell needs it whenever the drawn layout and the computed layout disagree
 * about which pairs exist. `applyDisplayOrder` is the case: reordering the SNP
 * axis into screen order can put two SNPs within the band that were further
 * apart in the order the band was computed in, and the band never computed that
 * pair. Filling 0 there says the two variants are in linkage equilibrium, which
 * is a measurement; nothing measured them.
 */
export const LD_NOT_COMPUTED = -2
