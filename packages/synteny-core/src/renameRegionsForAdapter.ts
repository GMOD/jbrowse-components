import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { AssemblyManager, Region } from '@jbrowse/core/util'

/**
 * Rename regions from the view's canonical assembly refNames into a comparative
 * adapter's own refName namespace (e.g. "1" -> "NC_012119.1").
 *
 * Comparative RPCs (synteny, dotplot) fetch features and build their cumBp
 * index inside a worker that has no assemblyManager, so it cannot resolve
 * refName aliases. RefName reconciliation therefore happens on the main thread
 * before the RPC call: callers rename every region they hand the worker with
 * this, and the worker reads feature refNames straight back against the
 * (already adapter-space) index. Returns the renamed regions directly, unlike
 * the lower-level renameRegionsIfNeeded which returns the whole args object.
 */
export async function renameRegionsForAdapter({
  assemblyManager,
  sessionId,
  adapterConfig,
  regions,
}: {
  assemblyManager: AssemblyManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
}): Promise<Region[]> {
  const { regions: renamed } = await renameRegionsIfNeeded(assemblyManager, {
    sessionId,
    adapterConfig,
    regions,
  })
  return renamed
}

/**
 * Inverse of the map `renameRegionsForAdapter` applies: adapter refName ->
 * canonical assembly refName (e.g. "NC_012119.1" -> "1"), covering every
 * assembly present in `regions`.
 *
 * The diagonalize RPCs rename their reference regions into adapter space (so the
 * worker's getFeatures + refName matching line up), but the reordered *query*
 * regions are handed straight back to the view, which must stay in canonical
 * space. The worker uses this map to translate the query-axis refName of each
 * fetched alignment back to canonical before the diagonalization matches it
 * against the (canonical) query regions. Built on the main thread because the
 * worker has no assemblyManager to resolve aliases.
 */
export async function getAdapterToCanonicalRefNameMap({
  assemblyManager,
  sessionId,
  adapterConfig,
  regions,
}: {
  assemblyManager: AssemblyManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
}): Promise<Record<string, string>> {
  const assemblyNames = [...new Set(regions.map(r => r.assemblyName))]
  const inverse: Record<string, string> = {}
  for (const name of assemblyNames) {
    const assembly = name
      ? await assemblyManager.waitForAssembly(name)
      : undefined
    // canonical -> adapter; invert so the worker can go adapter -> canonical
    const forward = assembly
      ? await assembly.getRefNameMapForAdapter(adapterConfig, { sessionId })
      : {}
    for (const [canonical, adapter] of Object.entries(forward)) {
      inverse[adapter] = canonical
    }
  }
  return inverse
}
