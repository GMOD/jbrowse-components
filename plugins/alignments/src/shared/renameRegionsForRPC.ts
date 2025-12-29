import { renameRegionsIfNeeded } from '@jbrowse/core/util'

import type { AssemblyManager } from '@jbrowse/core/assemblyManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * Renames both displayedRegions and staticBlocks.contentBlocks for RPC calls.
 *
 * This is necessary because:
 * 1. displayedRegions are used by bpToPx for coordinate conversion
 * 2. contentBlocks are used for fetching features from adapters
 *
 * Both need originalRefName set so adapters (like CRAM) can map between
 * assembly refNames (e.g., "chr1") and adapter refNames (e.g., "1").
 */
export async function renameViewRegionsForRPC({
  assemblyManager,
  viewSnapshot,
  sessionId,
  adapterConfig,
}: {
  assemblyManager: AssemblyManager
  viewSnapshot: Record<string, unknown>
  sessionId: string
  adapterConfig: AnyConfigurationModel
}) {
  const displayedRegions =
    (viewSnapshot as any).displayedRegions || ([] as any[])

  if (!displayedRegions.length) {
    return viewSnapshot
  }

  // Rename displayedRegions (used by bpToPx for coordinate conversion)
  const renamedDisplayed = await renameRegionsIfNeeded(assemblyManager, {
    sessionId,
    adapterConfig,
    regions: displayedRegions,
  })

  // Also rename contentBlocks (used for fetching features)
  // contentBlocks is a getter on BlockSet, so we need to filter blocks manually
  const allBlocks = (viewSnapshot as any).staticBlocks?.blocks || ([] as any[])
  const contentBlocks = allBlocks.filter(
    (b: { type?: string }) => b.type === 'ContentBlock',
  )

  const renamedContent = await renameRegionsIfNeeded(assemblyManager, {
    sessionId,
    adapterConfig,
    regions: contentBlocks,
  })

  // Create a map of renamed contentBlocks by key for efficient lookup
  const renamedByKey = new Map(
    renamedContent.regions.map((r: any) => [r.key, r]),
  )

  // Update blocks array with renamed contentBlocks while preserving other block types
  const updatedBlocks = allBlocks.map((block: any) =>
    block.type === 'ContentBlock' && renamedByKey.has(block.key)
      ? renamedByKey.get(block.key)
      : block,
  )

  return {
    ...viewSnapshot,
    displayedRegions: renamedDisplayed.regions,
    staticBlocks: {
      ...(viewSnapshot as any).staticBlocks,
      blocks: updatedBlocks,
      contentBlocks: renamedContent.regions,
    },
  }
}
