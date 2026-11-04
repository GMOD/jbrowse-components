import { toLocale } from '@jbrowse/core/util'

import type { MenuItem } from '@jbrowse/core/ui'

interface WholeGenomeAssembly {
  chromosomes: readonly unknown[]
  regions?: readonly unknown[]
}

/**
 * What the action showing an assembly's whole genome says it shows: its
 * chromosomes where the assembly knows them, else every region it has.
 */
export function showWholeGenomeLabel(
  assembly: WholeGenomeAssembly | undefined,
) {
  return assembly?.chromosomes.length
    ? 'Show all chromosomes'
    : 'Show all regions in assembly'
}

/**
 * The rows that show every region of an assembly whose whole genome is its
 * chromosomes, where that leaves regions out; none otherwise.
 */
export function everyRegionMenuItems(
  assembly: WholeGenomeAssembly | undefined,
  showEveryRegion: () => void,
): MenuItem[] {
  const all = assembly?.regions?.length ?? 0
  const chromosomes = assembly?.chromosomes.length ?? 0
  return chromosomes && all > chromosomes
    ? [
        {
          label: `Show all ${toLocale(all)} regions`,
          onClick: () => {
            showEveryRegion()
          },
        },
      ]
    : []
}
