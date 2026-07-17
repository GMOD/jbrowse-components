import {
  getAdapterToCanonicalRefNameMap,
  renameRegionsForAdapter,
} from './renameRegionsForAdapter.ts'

import type { DiagonalizeAdapterSpec } from './executeDiagonalize.ts'
import type { AssemblyManager, Region } from '@jbrowse/core/util'

/**
 * Build one adapter's {@link DiagonalizeAdapterSpec} for a diagonalize RPC.
 *
 * RefName reconciliation happens on the main thread because the worker has no
 * assemblyManager to resolve aliases, and each adapter has its own namespace:
 * the reference regions are renamed for the fetch, and the per-axis
 * adapter->canonical maps let the worker translate fetched alignments back to
 * canonical so they match the canonical regions the caller passes.
 *
 * `referenceRegions`/`currentRegions` are the caller's canonical regions.
 */
export async function prepareDiagonalizeAdapter({
  assemblyManager,
  sessionId,
  adapterConfig,
  referenceRegions,
  currentRegions,
}: {
  assemblyManager: AssemblyManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  referenceRegions: Region[]
  currentRegions: Region[]
}): Promise<DiagonalizeAdapterSpec> {
  const [fetchRegions, refRefNameMap, queryRefNameMap] = await Promise.all([
    renameRegionsForAdapter({
      assemblyManager,
      sessionId,
      adapterConfig,
      regions: referenceRegions,
    }),
    getAdapterToCanonicalRefNameMap({
      assemblyManager,
      sessionId,
      adapterConfig,
      regions: referenceRegions,
    }),
    getAdapterToCanonicalRefNameMap({
      assemblyManager,
      sessionId,
      adapterConfig,
      regions: currentRegions,
    }),
  ])
  return { adapterConfig, fetchRegions, refRefNameMap, queryRefNameMap }
}
