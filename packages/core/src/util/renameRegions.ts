import { getSnapshot, isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { StatusCallback } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { AssemblyManager, Region } from './types/index.ts'
import type { Region as MUIRegion } from './types/mst.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Maps a region's refName to the track adapter's name (via refNameMap), and
// sets originalRefName to the seq adapter (FASTA) name so that CRAM/BAM
// adapters can fetch reference sequence correctly.
export function renameRegionIfNeeded(
  refNameMap: Record<string, string> | undefined,
  region: Region | Instance<typeof MUIRegion>,
  getSeqAdapterRefName?: (refName: string) => string,
): Region & { originalRefName?: string } {
  if (isStateTreeNode(region) && !isAlive(region)) {
    return region
  }
  const newRef = refNameMap?.[region.refName]
  if (newRef) {
    return {
      ...(isStateTreeNode(region) ? getSnapshot(region) : region),
      refName: newRef,
      originalRefName: getSeqAdapterRefName?.(region.refName) ?? region.refName,
    }
  }
  return region
}

export async function renameRegionsIfNeeded<
  ARGTYPE extends {
    assemblyName?: string
    regions?: Region[]
    stopToken?: StopToken
    adapterConfig: Record<string, unknown>
    sessionId: string
    statusCallback?: StatusCallback
  },
>(assemblyManager: AssemblyManager, args: ARGTYPE) {
  const { regions = [], adapterConfig } = args
  if (!args.sessionId) {
    throw new Error('sessionId is required')
  }

  // capture assembly names before the await, since MST regions may be dead after
  const assemblyNames = regions.map(r => r.assemblyName)
  const uniqueAssemblyNames = [...new Set(assemblyNames)]
  const assemblyData = Object.fromEntries(
    await Promise.all(
      uniqueAssemblyNames.map(async name => {
        // resolve the assembly once via waitForAssembly (which awaits both
        // registration and load) and derive the refName map AND
        // getSeqAdapterRefName from this single loaded handle. A synchronous
        // assemblyManager.get() here could miss an assembly still being
        // registered, leaving getSeqAdapterRefName undefined so originalRefName
        // (used by CRAM/BAM to fetch reference bases) falls back to the
        // canonical name instead of the FASTA name.
        const assembly = name
          ? await assemblyManager.waitForAssembly(name)
          : undefined
        return [
          name,
          {
            refNameMap: assembly
              ? await assembly.getRefNameMapForAdapter(adapterConfig, args)
              : {},
            getSeqAdapterRefName: assembly
              ? (r: string) => assembly.getSeqAdapterRefName(r)
              : undefined,
          },
        ]
      }),
    ),
  )

  return {
    ...args,
    regions: regions.map((region, i) => {
      const { refNameMap, getSeqAdapterRefName } =
        assemblyData[assemblyNames[i]!]
      return renameRegionIfNeeded(refNameMap, region, getSeqAdapterRefName)
    }),
  }
}
