import type { Chromosome } from '@gmod/hic'

// The spellings one chromosome goes by across pipelines: `chr1` and `1`,
// `chrM` and `MT`.
function spellings(name: string) {
  const bare = name.replace(/^chr/i, '')
  const mito = /^(M|MT)$/i.test(bare) ? ['M', 'MT'] : [bare]
  return mito.flatMap(b => [b, `chr${b}`])
}

/**
 * The control file's name for each of the map's chromosomes it holds at the
 * same length. Two builds share names but not coordinates, and every bin of
 * the ratio would then compare unrelated loci, so a control whose shared
 * chromosomes mostly differ in length is refused. One that differs alone, as
 * hg19's chrM does from b37's MT, goes unpaired.
 */
export function controlChromosomes(mine: Chromosome[], theirs: Chromosome[]) {
  const byName = new Map(theirs.map(chr => [chr.name, chr]))
  const names = new Map<string, string>()
  const mismatched: string[] = []
  for (const chr of mine) {
    const match = spellings(chr.name)
      .map(name => byName.get(name))
      .find(c => c !== undefined)
    if (match && chr.name.toUpperCase() !== 'ALL') {
      if (match.size === chr.size) {
        names.set(chr.name, match.name)
      } else {
        mismatched.push(
          `${chr.name} is ${chr.size} bp in the map and ${match.size} bp in the control`,
        )
      }
    }
  }
  if (mismatched.length > names.size) {
    throw new Error(
      `The control .hic is on another assembly: ${mismatched.slice(0, 3).join('; ')}`,
    )
  }
  if (names.size === 0) {
    throw new Error('The control .hic shares no chromosome with the map')
  }
  return names
}
