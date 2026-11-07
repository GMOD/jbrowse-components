import { toLocale } from '@jbrowse/core/util'

import type { MenuItem } from '@jbrowse/core/ui'

interface WholeGenomeAssembly {
  regions?: readonly unknown[]
  wholeGenomeRegions: readonly { refName: string }[]
  sequenceRoles?: ReadonlyMap<string, { molecule?: string }>
}

function moleculeKind(molecule: string) {
  const noun = molecule.toLowerCase()
  return noun === 'mitochondrion' ? 'mitochondria' : `${noun}s`
}

/**
 * The kinds of molecule the whole genome comprises, in assembly order, where
 * the assembly states them and they are more than chromosomes: `chromosomes,
 * plasmids` for a bacterium, `chromosomes, mitochondria` for a mammal.
 */
function wholeGenomeMolecules(assembly: WholeGenomeAssembly) {
  const kinds = new Set(
    assembly.wholeGenomeRegions
      .map(({ refName }) => assembly.sequenceRoles?.get(refName)?.molecule)
      .filter(molecule => molecule !== undefined),
  )
  return [...kinds].some(m => m !== 'Chromosome')
    ? [...kinds].map(moleculeKind).join(', ')
    : undefined
}

/**
 * What the action showing an assembly's whole genome says, naming what the
 * whole genome comprises where the assembly states more than chromosomes.
 */
export function showWholeGenomeLabel(
  assembly: WholeGenomeAssembly | undefined,
) {
  const molecules = assembly ? wholeGenomeMolecules(assembly) : undefined
  return molecules ? `Show whole genome (${molecules})` : 'Show whole genome'
}

/**
 * The rows that show every region of an assembly whose whole genome leaves
 * regions out; none otherwise.
 */
export function everyRegionMenuItems(
  assembly: WholeGenomeAssembly | undefined,
  showEveryRegion: () => void,
): MenuItem[] {
  const all = assembly?.regions?.length ?? 0
  return assembly && all > assembly.wholeGenomeRegions.length
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
