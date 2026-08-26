import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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

// The display slice both entry points below read: the adapter to interrogate,
// and (for the installer) where the answer is written.
interface SwapCheckHost extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
}

/**
 * {@link detectAssembliesSwapped} wired to a synteny/dotplot display: pulls the
 * adapter refNames via the CoreGetRefNames RPC and the assembly refNames from
 * the session's assemblyManager.
 */
export function detectDisplayAssembliesSwapped(
  self: SwapCheckHost,
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
      // No handles, and neither is an oversight. On the adapters that make this
      // slow — a whole-file PAF — `getRefNames` awaits the same
      // `cachedSetup` parse the band fetch is already awaiting and
      // already narrating, so a second report here would be two labels for one
      // download; and cancelling that parse is what `cachedSetup`
      // deliberately refuses, since the fetch waiting on it would be rejected
      // too. This is a one-shot check at view load, off the per-render path.
      // eslint-disable-next-line no-restricted-syntax
      rpcManager.call(sessionId, 'CoreGetRefNames', {
        adapterConfig,
        assemblyName: name,
      }),
    getAssemblyRefNames: name => assemblyManager.get(name)?.refNames,
    getCanonicalRefName: (name, refName) =>
      assemblyManager.get(name)?.getCanonicalRefName2(refName) ?? refName,
  })
}

/**
 * Install the one-shot reversed-assembly check both comparative displays run at
 * view load: read the two axis assemblies, ask the adapter which one its
 * refNames belong to, and record the verdict on the display.
 *
 * Deliberately off the per-render fetch path, so it never re-fires (or
 * misfires) on zoom — it re-runs only when `axisAssemblies` reads something
 * that changed, which is why that callback must do its own tracked reads
 * (returning undefined until the view is ready still tracks whatever decided
 * that, so the autorun rewakes).
 *
 * Shared rather than written per display because of the two `isAlive` guards:
 * the first because teardown fires the parent atom that `axisAssemblies` reads
 * and `getContainingView` throws on a detached node, the second because the
 * RPC resolves long after a view can be closed and writing to a dead node
 * throws out of an unawaited promise. Both are invisible until a user closes a
 * view mid-load.
 */
export function installAssemblySwapCheck(
  self: SwapCheckHost & { setAssembliesSwapped: (arg: boolean) => void },
  {
    name,
    axisAssemblies,
  }: {
    name: string
    /** the two axis assembly names, or undefined while the view isn't ready */
    axisAssemblies: () => [string | undefined, string | undefined] | undefined
  },
) {
  addDisposer(
    self,
    autorun(
      async function assemblySwapCheck() {
        if (!isAlive(self)) {
          return
        }
        const axes = axisAssemblies()
        if (!axes) {
          return
        }
        const swapped = await detectDisplayAssembliesSwapped(self, ...axes)
        if (isAlive(self)) {
          self.setAssembliesSwapped(swapped)
        }
      },
      { name },
    ),
  )
}
