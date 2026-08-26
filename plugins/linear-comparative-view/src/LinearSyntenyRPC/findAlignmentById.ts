import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

/**
 * What it takes to find one alignment again after the bulk fetch dropped it.
 *
 * The two facts stated ONCE, where both methods that ask this question extend
 * them rather than re-documenting them:
 *
 * - `regions` is the block's own extent on the QUERY axis, which is the axis a
 *   band's fetch queries (`executeSyntenyFeaturesAndPositions` is single-axis).
 *   So both directions of a resolve look the feature up the same way; only what
 *   is done with it differs.
 * - `lodMode` is the tier the block was fetched at, because ids are only
 *   comparable within one — a tiered PIF numbers its coarse and fine rows from
 *   different file offsets, so a lookup at the wrong tier misses rather than
 *   answering wrongly.
 */
export interface AlignmentLookupArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  featureId: string
  lodMode?: BaseOptions['lodMode']
}

/**
 * The alignment `featureId` names, or `undefined`.
 *
 * IT ANSWERS WITH THE FEATURE, not with a miss value, which is what lets one
 * helper serve two methods whose misses are not the same thing:
 * `SyntenyGetCigarMap` declares `transferables: true`, so every return of its —
 * misses included — has to be wrapped by `rpcResult`, while
 * `SyntenyResolveMatchingRegion` returns a bare `undefined`. Neither fact
 * belongs to the lookup, so neither reaches it.
 *
 * BOTH HANDLES FORWARDED rather than a fresh opts object: locating one
 * alignment by id re-reads the whole region out of the PAF/chain file, so a
 * method that rebuilt them here would be uncancellable and silent.
 */
export async function findAlignmentById(
  pluginManager: PluginManager,
  args: AlignmentLookupArgs & RpcCallContext,
) {
  const {
    sessionId,
    adapterConfig,
    regions,
    featureId,
    lodMode,
    stopToken,
    statusCallback,
  } = args
  const region = regions[0]
  if (!region) {
    return undefined
  }
  const dataAdapter = await getFeatureAdapter({
    pluginManager,
    sessionId,
    adapterConfig,
  })
  const features =
    (await dataAdapter?.getFeaturesArray(region, {
      lodMode,
      stopToken,
      statusCallback,
    })) ?? []
  return features.find(f => f.id() === featureId)
}
