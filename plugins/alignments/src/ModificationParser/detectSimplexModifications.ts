import type { ModificationType } from '../shared/types'

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
 * Reference: IGV's BaseModificationCoverageRenderer.updateBaseModfications
 * https://github.com/igvteam/igv/blob/master/src/main/java/org/broad/igv/sam/mods/BaseModificationCoverageRenderer.java
 */
export function detectSimplexModifications(
  modifications: ModificationType[],
): Set<string> {
  const simplexModifications = new Set<string>()

  console.log('[Simplex Detection] All modifications:', modifications)

  // First, collect all modifications on the minus strand
  const minusStrandMods = new Set<string>()
  for (const mod of modifications) {
    if (mod.strand === '-') {
      minusStrandMods.add(mod.type)
      console.log('[Simplex Detection] Found minus strand mod:', mod)
    }
  }

  console.log('[Simplex Detection] Minus strand mods:', [...minusStrandMods])

  // Then, find positive strand modifications without minus strand counterparts
  for (const mod of modifications) {
    if (mod.strand === '+' && !minusStrandMods.has(mod.type)) {
      simplexModifications.add(mod.type)
      console.log('[Simplex Detection] Identified simplex mod:', mod)
    }
  }

  console.log('[Simplex Detection] Final simplex mods:', [...simplexModifications])

  return simplexModifications
}
