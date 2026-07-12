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
  const isNode = isStateTreeNode(region)
  if (isNode && !isAlive(region)) {
    return region
  }
  const newRef = refNameMap?.[region.refName]
  if (newRef) {
    return {
      ...(isNode ? getSnapshot(region) : region),
      refName: newRef,
      originalRefName: getSeqAdapterRefName?.(region.refName) ?? region.refName,
    }
  }
  return region
}

// Region-shaped enough that, if it slipped through under a `region` key, it was
// meant to be renamed. Used only by the guard below.
function isRegionShaped(r: unknown): r is Region {
  return (
    !!r &&
    typeof r === 'object' &&
    'refName' in r &&
    'assemblyName' in r &&
    'start' in r &&
    'end' in r
  )
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

  // Renaming only ever touches the `regions` array. An RPC method that instead
  // carries a singular `region` (e.g. by pairing a one-region wire contract
  // with a *plural* rename base class) would silently fetch against un-renamed
  // refNames — the exact bug where an assembly's `5` never maps to an adapter's
  // `chr5`. The legitimate singular base class (RpcMethodTypeWithRenameRegion)
  // always mirrors `region` into a populated `regions`, so flag only the
  // un-mirrored case and fail loudly instead of returning wrong data.
  if (
    regions.length === 0 &&
    isRegionShaped((args as { region?: unknown }).region)
  ) {
    throw new Error(
      'renameRegionsIfNeeded got a singular `region` but no `regions` array; ' +
        'refName renaming applies only to `regions`. Pass `regions: [region]` ' +
        '(or extend RpcMethodTypeWithRenameRegion) so the region is renamed.',
    )
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
