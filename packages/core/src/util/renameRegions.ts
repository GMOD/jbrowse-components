import { getSnapshot, isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { getSequenceAdapterConfig } from '../assemblyManager/getSequenceAdapterConfig.ts'

import type { StatusCallback } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { AssemblyManager, Region } from './types/index.ts'
import type { Region as MUIRegion } from './types/mst.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Maps a region's refName to the track adapter's name (via refNameMap), and
// sets originalRefName to the seq adapter (FASTA) name so that CRAM/BAM
// adapters can fetch reference sequence correctly.
//
// This is DESTRUCTIVE, and it runs inside `serializeArguments` — so the array
// that reaches a worker is not the one the display handed to `rpcManager.call`,
// with no cue at the call site. `refName` means the assembly's canonical name
// before this and the track adapter's name after, in the same field of the same
// type. Renaming is required for anything the worker compares or fetches
// against the file, and wrong for anything it hands back as user-facing text: a
// worker that labels a locus from its own output must be given the view's names
// separately, captured before the call (hic's `HicViewBlock` does this, because
// its hover prints a locus directly under the ruler). `originalRefName` is NOT
// that name — it is a third scheme, the FASTA's, load-bearing for CRAM/BAM
// reference fetch.
//
// That third scheme is the general case in miniature, and worth naming: a
// rename is a property of an (assembly, adapter) PAIR, and this renames against
// exactly one adapter — `args.adapterConfig`. An RPC that reaches a SECOND file
// gets no renaming for it, and the failure is silent in the usual way: the query
// goes out under the first file's spelling, matches nothing, and reads as "no
// data here". So an RPC naming two adapters needs two passes, not one.
//
// **Prefer giving the second file its own RPC**, where `adapterConfig` names the
// file being read and the ordinary pass is simply right — MAF's annotation
// overlay is called that way. Thread a second name only when the two results
// cannot be joined by the caller: GWAS LD coloring can't, because the r²-to-
// feature join is per feature and features never cross the boundary, so it
// resolves a second pass in `serializeArguments` and ships `ldRefName`
// (`plugins/gwas/src/ManhattanRPC/GetManhattanData.ts`). That and
// `originalRefName` are the only two, and there is no reason to expect a third:
// a sub-adapter is normally the same data in another form, named the same way.
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

// What a single assembly contributes to a rename: the adapter refName map, the
// FASTA-name lookup CRAM/BAM need for originalRefName, and the sequence adapter
// config those two are names *into*.
interface AssemblyRenameData {
  refNameMap: Record<string, string>
  getSeqAdapterRefName: ((refName: string) => string) | undefined
  sequenceAdapter: Record<string, unknown> | undefined
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
  // annotated, because Object.fromEntries over an array whose element type is
  // not a tuple selects its `any` overload — which left refNameMap and
  // getSeqAdapterRefName unchecked all the way to renameRegionIfNeeded
  const assemblyData: Record<string, AssemblyRenameData | undefined> =
    Object.fromEntries(
      await Promise.all(
        uniqueAssemblyNames.map(async name => {
          // resolve the assembly once via requireAssembly (which awaits both
          // registration and load) and derive the refName map AND
          // getSeqAdapterRefName from this single loaded handle. A synchronous
          // assemblyManager.get() here could miss an assembly still being
          // registered, leaving getSeqAdapterRefName undefined so
          // originalRefName (used by CRAM/BAM to fetch reference bases) falls
          // back to the canonical name instead of the FASTA name.
          //
          // require, not wait: a region names an assembly, so failing to
          // resolve it is not "nothing to rename", it is renaming that cannot
          // be done. Substituting an empty map leaves the adapter querying
          // un-renamed refNames, which finds nothing and draws an empty track
          // with no indication that the assembly is what is missing. Only an
          // unnamed assembly is a legitimate no-op.
          const assembly = name
            ? await assemblyManager.requireAssembly(name)
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
              sequenceAdapter: getSequenceAdapterConfig(assembly),
            },
          ] as const
        }),
      ),
    )

  return {
    ...args,
    // Supplied here, not by each caller: this is the one place that has already
    // resolved the assembly a fetch is against, and it is the same handle
    // `originalRefName` is a name into. Every caller that passed its own wrote
    // these same two lines, and the three that forgot — `CoreGetExportData`,
    // `BreakpointGetFeatures`, `fetchTrackData` — failed silently, saved only by
    // whichever call happened to prime the adapter instance first.
    sequenceAdapter: assemblyData[assemblyNames[0]!]?.sequenceAdapter,
    regions: regions.map((region, i) => {
      const data = assemblyData[assemblyNames[i]!]
      return renameRegionIfNeeded(
        data?.refNameMap,
        region,
        data?.getSeqAdapterRefName,
      )
    }),
  }
}
