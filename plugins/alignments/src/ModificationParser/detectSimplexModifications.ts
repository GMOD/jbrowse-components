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
  // Use two-pass algorithm for efficiency:
  // Pass 1: Collect all modification types on minus strand (O(n))
  // Pass 2: Find plus strand mods without minus strand counterpart (O(n))
  // Total: O(n) time, O(m) space where m = unique modification types

  const minusStrandMods = new Set<string>()
  const simplexModifications = new Set<string>()

  // First pass: collect all modifications on the minus strand
  for (const modification of modifications) {
    const mod = modification
    if (mod.strand === '-') {
      minusStrandMods.add(mod.type)
    }
  }

  // Second pass: find positive strand modifications without minus strand counterparts
  for (const modification of modifications) {
    const mod = modification
    if (mod.strand === '+' && !minusStrandMods.has(mod.type)) {
      simplexModifications.add(mod.type)
    }
  }

  return simplexModifications
}
