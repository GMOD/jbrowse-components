import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

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
function refNamesLookSwapped({
  reported,
  xEntries,
  yEntries,
  canonicalizeX,
  canonicalizeY,
}: {
  reported: string[]
  xEntries: RefNameLookup
  yEntries: RefNameLookup
  canonicalizeX: (name: string) => string
  canonicalizeY: (name: string) => string
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
 * A one-shot, zoom-independent check (run at view load): compares the refNames
 * the adapter reports for the top/X axis against each axis assembly's full
 * refName set. Returns false unless the two axes are distinct named assemblies.
 * Adapters lacking getRefNames yield no signal rather than erroring.
 */
export async function detectAssembliesSwapped({
  topAssembly,
  bottomAssembly,
  getAdapterRefNames,
  getAssemblyRefNames,
  getCanonicalRefName,
}: {
  topAssembly: string | undefined
  bottomAssembly: string | undefined
  getAdapterRefNames: (assemblyName: string) => Promise<string[]>
  getAssemblyRefNames: (assemblyName: string) => string[] | undefined
  getCanonicalRefName: (assemblyName: string, refName: string) => string
}) {
  return topAssembly !== undefined &&
    bottomAssembly !== undefined &&
    topAssembly !== bottomAssembly
    ? refNamesLookSwapped({
        reported: await getAdapterRefNames(topAssembly).catch(() => []),
        xEntries: new Set(getAssemblyRefNames(topAssembly)),
        yEntries: new Set(getAssemblyRefNames(bottomAssembly)),
        canonicalizeX: name => getCanonicalRefName(topAssembly, name),
        canonicalizeY: name => getCanonicalRefName(bottomAssembly, name),
      })
    : false
}

/**
 * {@link detectAssembliesSwapped} wired to a synteny/dotplot display: pulls the
 * adapter refNames via the CoreGetRefNames RPC and the assembly refNames from
 * the session's assemblyManager.
 */
export function detectDisplayAssembliesSwapped(
  self: IAnyStateTreeNode & { adapterConfig: Record<string, unknown> },
  topAssembly: string | undefined,
  bottomAssembly: string | undefined,
) {
  const { assemblyManager, rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const { adapterConfig } = self
  return detectAssembliesSwapped({
    topAssembly,
    bottomAssembly,
    getAdapterRefNames: name =>
      rpcManager.call(sessionId, 'CoreGetRefNames', {
        adapterConfig,
        assemblyName: name,
      }),
    getAssemblyRefNames: name => assemblyManager.get(name)?.refNames,
    getCanonicalRefName: (name, refName) =>
      assemblyManager.get(name)?.getCanonicalRefName(refName) ?? refName,
  })
}
