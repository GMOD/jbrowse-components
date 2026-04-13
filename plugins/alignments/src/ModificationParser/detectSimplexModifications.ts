import type { ModificationType } from '../shared/types.ts'

type ModificationTypeList = readonly ModificationType[]

/**
 * Detects simplex modifications based on the IGV algorithm.
 *
 * A modification is considered "simplex" if it appears on the positive strand
 * but has no corresponding modification on the negative strand.
 *
 * For example:
 * - C+m without G-m would be simplex
 * - C+m with G-m would be duplex
 *
 * This affects how we calculate the "detectable" count in coverage rendering:
 * - Simplex: detectable uses strand-specific counts
 * - Duplex: detectable equals modifiable (uses all counts)
 *
 * Reference: IGV's BaseModificationCoverageRenderer.updateBaseModifications
 * https://github.com/igvteam/igv/blob/master/src/main/java/org/broad/igv/sam/mods/BaseModificationCoverageRenderer.java
 */
export function detectSimplexModifications(
  modifications: ModificationTypeList,
): ReadonlySet<string> {
  const minusStrandMods = new Set<string>()
  const simplexModifications = new Set<string>()

  for (const { strand, type } of modifications) {
    if (strand === '-') {
      minusStrandMods.add(type)
    }
  }

  for (const { strand, type } of modifications) {
    if (strand === '+' && !minusStrandMods.has(type)) {
      simplexModifications.add(type)
    }
  }

  return simplexModifications
}
