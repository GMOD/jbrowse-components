import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import {
  getAdapterToCanonicalRefNameMap,
  renameRegionsForAdapter,
} from './renameRegionsForAdapter.ts'

import type { DiagonalizeAdapterSpec } from './executeDiagonalize.ts'
import type { AssemblyManager, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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
async function prepareDiagonalizeAdapter({
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

/**
 * The adapter specs for one diagonalize call over every display drawn between
 * a pair of axes, and the rpcSessionId to route it by: the first display's,
 * which lives on its track, so the call lands on the sticky worker that already
 * parsed the adapter rather than re-parsing it into a fresh cache.
 */
export async function prepareDiagonalizeAdapters({
  assemblyManager,
  displays,
  referenceRegions,
  currentRegions,
}: {
  assemblyManager: AssemblyManager
  displays: readonly [DiagonalizeDisplay, ...DiagonalizeDisplay[]]
  referenceRegions: Region[]
  currentRegions: Region[]
}) {
  const sessionId = getRpcSessionId(displays[0])
  const adapters = await Promise.all(
    displays.map(d =>
      prepareDiagonalizeAdapter({
        assemblyManager,
        sessionId,
        adapterConfig: d.adapterConfig,
        referenceRegions,
        currentRegions,
      }),
    ),
  )
  return { sessionId, adapters }
}

interface DiagonalizeDisplay extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
}
