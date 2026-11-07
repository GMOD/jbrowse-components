import { pluralize, toLocale } from '@jbrowse/core/util'

import type { MenuItem } from '@jbrowse/core/ui'

interface WholeGenomeAssembly {
  regions?: readonly unknown[]
  wholeGenomeRegions: readonly { refName: string }[]
  sequenceRoles?: ReadonlyMap<string, { molecule?: string }>
}

function moleculeNoun(molecule: string, count: number) {
  const noun = molecule.toLowerCase()
  return pluralize(
    count,
    noun,
    noun === 'mitochondrion' ? 'mitochondria' : `${noun}s`,
  )
}

/**
 * The molecule types the whole genome comprises, in assembly order, where the
 * assembly states them and they are more than chromosomes: `chromosome,
 * plasmid` for a bacterium, `chromosomes, mitochondrion` for a mammal.
 */
function wholeGenomeMolecules(assembly: WholeGenomeAssembly) {
  const counts = new Map<string, number>()
  for (const { refName } of assembly.wholeGenomeRegions) {
    const molecule = assembly.sequenceRoles?.get(refName)?.molecule
    if (molecule) {
      counts.set(molecule, (counts.get(molecule) ?? 0) + 1)
    }
  }
  return [...counts.keys()].some(m => m !== 'Chromosome')
    ? [...counts].map(([m, count]) => moleculeNoun(m, count)).join(', ')
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
