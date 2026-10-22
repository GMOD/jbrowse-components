import type { Chromosome } from '@gmod/hic'

// The spellings one chromosome goes by across pipelines: `chr1` and `1`,
// `chrM` and `MT`.
function spellings(name: string) {
  const bare = name.replace(/^chr/i, '')
  const mito = /^(M|MT)$/i.test(bare) ? ['M', 'MT'] : [bare]
  return mito.flatMap(b => [b, `chr${b}`])
}

/**
 * The control file's name for each of the map's chromosomes it holds. Two
 * files on different builds share names but not coordinates, and every bin
 * of the ratio would then compare unrelated loci, so a shared chromosome of a
 * different size refuses the pair.
 */
export function controlChromosomes(mine: Chromosome[], theirs: Chromosome[]) {
  const byName = new Map(theirs.map(chr => [chr.name, chr]))
  const names = new Map<string, string>()
  for (const chr of mine) {
    const match = spellings(chr.name)
      .map(name => byName.get(name))
      .find(c => c !== undefined)
    if (match && chr.name.toUpperCase() !== 'ALL') {
      if (match.size !== chr.size) {
        throw new Error(
          `The control .hic is on another assembly: ${chr.name} is ${chr.size} bp in the map and ${match.size} bp in the control`,
        )
      }
      names.set(chr.name, match.name)
    }
  }
  if (names.size === 0) {
    throw new Error('The control .hic shares no chromosome with the map')
  }
  return names
}
