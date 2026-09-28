import { getSnapshot, isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { StatusCallback } from './progress.ts'
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
// feature join is per feature and features never cross the boundary, so the
// display resolves the LD file's name before the RPC and hands it to the
// adapter in `opts.ld.refName`
// (`plugins/gwas/src/LinearManhattanDisplay/ldJoinResolver.ts`). That and
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

// What a single assembly contributes to a rename: the adapter refName map and
// the FASTA-name lookup CRAM/BAM need for originalRefName.
interface AssemblyRenameData {
  refNameMap: Record<string, string>
  getSeqAdapterRefName: ((refName: string) => string) | undefined
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

interface RenameArgs {
  regions?: Region[]
  signal?: AbortSignal
  adapterConfig: Record<string, unknown>
  sessionId: string
  statusCallback?: StatusCallback
}

function checkRenameArgs(args: RenameArgs) {
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
    !args.regions?.length &&
    isRegionShaped((args as { region?: unknown }).region)
  ) {
    throw new Error(
      'renameRegionsIfNeeded got a singular `region` but no `regions` array; ' +
        'refName renaming applies only to `regions`. Pass `regions: [region]` ' +
        '(or extend RpcMethodTypeWithRenameRegion) so the region is renamed.',
    )
  }
}

// What one assembly contributes to a rename, off the loaded assembly: resolved
// via requireAssembly (which awaits registration and load) so the refName map
// and getSeqAdapterRefName come from one handle. A synchronous
// assemblyManager.get() could miss an assembly still registering, leaving
// originalRefName (CRAM/BAM's reference fetch name) on the canonical name
// instead of the FASTA's. Require, not wait: a region names an assembly, so
// failing to resolve it is renaming that cannot be done, not nothing to rename,
// and an empty map would query un-renamed refNames and draw an empty track
// with no word about why. Only an unnamed assembly is a legitimate no-op.
async function assemblyRenameData(
  assemblyManager: AssemblyManager,
  assemblyName: string | undefined,
  args: RenameArgs,
): Promise<AssemblyRenameData | undefined> {
  if (!assemblyName) {
    return undefined
  }
  const assembly = await assemblyManager.requireAssembly(assemblyName)
  return {
    refNameMap: await assembly.getRefNameMapForAdapter(
      args.adapterConfig,
      args,
    ),
    getSeqAdapterRefName: (r: string) => assembly.getSeqAdapterRefName(r),
  }
}

function renamed(region: Region, data: AssemblyRenameData | undefined) {
  return renameRegionIfNeeded(
    data?.refNameMap,
    region,
    data?.getSeqAdapterRefName,
  )
}

/**
 * Rename for a request about one genome, which is every request but a
 * comparative one. The call's genome is its regions' genome, and renaming
 * writes it as the call's `assemblyName`, the one field a call names its
 * genome in: `RpcMethodType.serializeArguments` turns it into the reference a
 * BAM/CRAM or scan adapter is built with. A region on another assembly is
 * refused: a request over a synteny adapter renames with
 * {@link renameComparativeRegions}.
 */
export async function renameRegionsIfNeeded<ARGTYPE extends RenameArgs>(
  assemblyManager: AssemblyManager,
  args: ARGTYPE,
) {
  checkRenameArgs(args)
  const { regions = [] } = args
  // read before the await, since MST regions may be dead after
  const assemblyName = regions[0]?.assemblyName
  const stray = regions.find(r => r.assemblyName !== assemblyName)
  if (stray) {
    throw new Error(
      `regions on ${assemblyName} and ${stray.assemblyName} in one request: a request is about one genome, and a comparative request (synteny, dotplot) renames with renameComparativeRegions`,
    )
  }
  const data = await assemblyRenameData(assemblyManager, assemblyName, args)
  return {
    ...args,
    assemblyName,
    regions: regions.map(region => renamed(region, data)),
  }
}

/**
 * Rename for a comparative request (synteny, dotplot, chords), whose regions
 * sit on two or more assemblies and are each renamed against their own. Such a
 * request has no genome of its own, so it names none and no reference rides
 * on it; a synteny adapter reads no reference.
 */
export async function renameComparativeRegions<ARGTYPE extends RenameArgs>(
  assemblyManager: AssemblyManager,
  args: ARGTYPE,
) {
  checkRenameArgs(args)
  const { regions = [] } = args
  const assemblyNames = regions.map(r => r.assemblyName)
  const data = new Map(
    await Promise.all(
      [...new Set(assemblyNames)].map(
        async name =>
          [
            name,
            await assemblyRenameData(assemblyManager, name, args),
          ] as const,
      ),
    ),
  )
  return {
    ...args,
    regions: regions.map((region, i) =>
      renamed(region, data.get(assemblyNames[i]!)),
    ),
  }
}
