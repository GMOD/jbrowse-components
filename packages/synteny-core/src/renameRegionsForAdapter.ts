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
