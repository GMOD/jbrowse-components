/**
 * The one disagreement between a file's reference names and an assembly's that
 * can be diagnosed from the names alone: they have **nothing** in common.
 *
 * Only the empty intersection is a verdict. Partial overlap is ordinary — a
 * track covering some contigs, a sample-specific VCF, a file that stops at the
 * primary assembly — so a name the assembly does not know says nothing on its
 * own, and a per-name warning would fire on most real tracks. `RefNameInfoDialog`
 * (`@jbrowse/product-core/ui`) is where the partial case belongs: it shows both
 * lists in full, on demand.
 *
 * The comparative case reaches the same conclusion from the other side.
 * `detectSwappedAssemblies` (`@jbrowse/synteny-core`) is conclusive only when
 * the two assemblies have distinct contig names, because an overlapping name
 * resolves on its own axis and tips nothing.
 */

/** the first few of a name list, plus how many there were in all */
export interface RefNameSample {
  names: string[]
  total: number
}

export interface RefNameMismatch {
  assemblyName: string
  /** what the file calls its contigs */
  adapter: RefNameSample
  /** what the assembly calls its contigs, canonically */
  assembly: RefNameSample
}

// enough to recognize a naming scheme (`1, 2, 3` against `chr1, chr2, chr3`)
// without carrying a mammalian assembly's whole contig list around in a
// volatile
const SAMPLE_SIZE = 5

function sample(names: string[]): RefNameSample {
  return { names: names.slice(0, SAMPLE_SIZE), total: names.length }
}

/**
 * Both name sets are non-empty and no name from the file resolves to one of the
 * assembly's — the `1/2/3` file loaded against a `chr1/chr2/chr3` assembly.
 * Returns undefined for every other case, including either list being empty:
 * an adapter that reports no refNames at all (many do) is not evidence of
 * anything.
 *
 * Names from the file go through `getCanonicalRefName`, which resolves aliases
 * and casing together — testing them against the assembly's names directly
 * would get neither, and would then report a mismatch on exactly the aliased
 * tracks `refNameAliases` exists to fix.
 */
export function detectRefNameMismatch({
  assemblyName,
  adapterRefNames,
  assemblyRefNames,
  getCanonicalRefName,
}: {
  assemblyName: string
  /** the names the adapter reports for its own file (`CoreGetRefNames`) */
  adapterRefNames: string[]
  /** the assembly's canonical refNames (`assembly.refNames`) */
  assemblyRefNames: string[]
  /** the assembly's one normalization layer, aliases and casing both */
  getCanonicalRefName: (refName: string) => string | undefined
}): RefNameMismatch | undefined {
  if (adapterRefNames.length === 0 || assemblyRefNames.length === 0) {
    return undefined
  }
  const canonical = new Set(assemblyRefNames)
  for (const name of adapterRefNames) {
    const resolved = getCanonicalRefName(name)
    if (resolved !== undefined && canonical.has(resolved)) {
      return undefined
    }
  }
  return {
    assemblyName,
    adapter: sample(adapterRefNames),
    assembly: sample(assemblyRefNames),
  }
}

function list({ names, total }: RefNameSample) {
  const rest = total - names.length
  return rest > 0 ? `${names.join(', ')} (and ${rest} more)` : names.join(', ')
}

/**
 * What to tell the user, in the voice the CORS and Range hints use: what is
 * wrong, the evidence, and the two things that fix it.
 */
export function refNameMismatchMessage({
  assemblyName,
  adapter,
  assembly,
}: RefNameMismatch) {
  return (
    `None of this track's reference sequence names match assembly "${assemblyName}", ` +
    `so no features can be drawn: the file uses ${list(adapter)}, the assembly uses ${list(assembly)}. ` +
    'Add a refNameAliases entry to the assembly configuration mapping the two ' +
    "naming schemes to each other, or rebuild the file with the assembly's names."
  )
}
