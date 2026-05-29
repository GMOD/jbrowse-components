// A keyed lookup of refNames — satisfied by both Set<string> and
// Map<string, ...> (e.g. BpRegionIndex.entries).
interface RefNameLookup {
  has: (name: string) => boolean
}

/**
 * Decide whether two synteny axes look reversed. `reported` is the set of
 * refNames the adapter assigns to the X/top axis (from its getRefNames). When
 * those names belong to the Y/bottom axis's assembly instead of the X axis's,
 * the assemblies were configured in the wrong order. Conclusive only when the
 * two assemblies have distinct chromosome names — overlapping names resolve on
 * their own axis and never tip the count.
 */
export function refNamesLookSwapped({
  reported,
  xEntries,
  yEntries,
  canonicalizeX = name => name,
  canonicalizeY = name => name,
}: {
  reported: string[]
  xEntries: RefNameLookup
  yEntries: RefNameLookup
  canonicalizeX?: (name: string) => string
  canonicalizeY?: (name: string) => string
}) {
  let ownHits = 0
  let otherHits = 0
  for (const name of reported) {
    if (xEntries.has(canonicalizeX(name))) {
      ownHits++
    } else if (yEntries.has(canonicalizeY(name))) {
      otherHits++
    }
  }
  return otherHits > ownHits
}

/**
 * Render-time guard around {@link refNamesLookSwapped}: only worth probing when
 * nothing rendered and the two axes are distinct named assemblies. Fetches the
 * adapter's reported refNames for the top/X axis and compares them against both
 * axes' displayed refNames.
 */
export async function probeAssembliesSwapped({
  rendered,
  topAssembly,
  bottomAssembly,
  getReportedRefNames,
  xEntries,
  yEntries,
  canonicalizeX,
  canonicalizeY,
}: {
  rendered: number
  topAssembly: string | undefined
  bottomAssembly: string | undefined
  getReportedRefNames: (assemblyName: string) => Promise<string[]>
  xEntries: RefNameLookup
  yEntries: RefNameLookup
  canonicalizeX?: (name: string) => string
  canonicalizeY?: (name: string) => string
}) {
  const top = rendered === 0 ? topAssembly : undefined
  return top !== undefined &&
    bottomAssembly !== undefined &&
    top !== bottomAssembly
    ? refNamesLookSwapped({
        // Adapters that don't implement getRefNames just yield no signal here,
        // rather than turning an empty plot into an error.
        reported: await getReportedRefNames(top).catch(() => []),
        xEntries,
        yEntries,
        canonicalizeX,
        canonicalizeY,
      })
    : false
}
