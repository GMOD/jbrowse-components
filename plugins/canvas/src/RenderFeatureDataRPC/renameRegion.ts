import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

// Looks up the active assemblyManager, renames a single region through the
// adapter's refName aliases, and returns the renamed region (or undefined
// when the manager returned no result). Shared by the two canvas RPC methods
// that each take exactly one region.
export async function renameSingleRegion<R extends Region>(
  pluginManager: PluginManager,
  args: {
    sessionId: string
    adapterConfig: Record<string, unknown>
    region: R
  },
): Promise<R | undefined> {
  const assemblyManager =
    pluginManager.rootModel?.session?.assemblyManager
  if (!assemblyManager) {
    throw new Error('no assembly manager')
  }
  const result = await renameRegionsIfNeeded(assemblyManager, {
    sessionId: args.sessionId,
    adapterConfig: args.adapterConfig,
    regions: [args.region],
  })
  return result.regions[0]
}
