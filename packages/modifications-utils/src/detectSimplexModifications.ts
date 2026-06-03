import type { ModificationType } from './types.ts'

type ModificationTypeList = readonly ModificationType[]

/**
 * Which modification types were basecalled on only ONE strand ("simplex") vs
 * both ("duplex"). The MM tag reports each mod against a strand, e.g. `C+m` (5mC
 * on the read's strand) or `G-m` (5mC on the opposite strand, reading as a G).
 * A type on '+' with no '-' partner anywhere → simplex; both present → duplex.
 *
 * Callers use this to pick the modification-coverage denominator (see
 * calculateModificationCounts): duplex counts every read with the base, simplex
 * only reads on the examined strand, else the modified fraction is understated.
 *
 * Run over the WHOLE dataset, not one read: simplex-ness is a protocol property,
 * shared by all reads, and a single read can lack the '-' call just by covering
 * no eligible base — a per-read check would misclassify duplex data as simplex.
 *
 * Mirrors IGV: AlignmentDataManager builds the set globally,
 * BaseModificationCoverageRenderer uses it for the detectable count.
 */
export function detectSimplexModifications(
  modifications: ModificationTypeList,
): ReadonlySet<string> {
  // types seen on the '-' strand anywhere → those are duplex
  const minusTypes = new Set<string>()
  for (const { strand, type } of modifications) {
    if (strand === '-') {
      minusTypes.add(type)
    }
  }
  // a '+' type with no '-' partner was only examined on one strand → simplex
  const simplex = new Set<string>()
  for (const { strand, type } of modifications) {
    if (strand === '+' && !minusTypes.has(type)) {
      simplex.add(type)
    }
  }
  return simplex
}
