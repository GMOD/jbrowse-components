import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import { pickMatesForRegion } from './pickMatesForRegion.ts'

import type { MateDiscoveryResult } from './pickMatesForRegion.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * Which assemblies a region aligns to, and where each one's panel will open —
 * resolved where the features already are.
 *
 * The reduction is the point of running this in the worker. A locus on an
 * all-vs-all file carries one alignment per sample, and a launch can be offered
 * for a whole chromosome (the visible-region entry exists for exactly that
 * case), so the fetch below can span millions of rows — while what the launch
 * needs from them is a handful of numbers per mate assembly.
 *
 * WHICH IS WHY THE COORDINATES ARE RESOLVED HERE and not on the far side. A
 * panel spans every block its mate aligns the region with, so shipping the
 * alignments would mean shipping every one of those blocks WITH ITS CIGAR — the
 * one field the resolution actually needs, and the one whose size is unbounded
 * (an asm5 PAF block's `cg` tag alone runs to 100 KB, and a whole-chromosome
 * launch against an HSP table is tens of thousands of blocks). `resolvePanel`
 * turns each group into six numbers, and the CIGARs stay in the worker.
 *
 * No `lodMode`, so an indexed PIF serves its fine tier here whatever the display
 * that launched this is drawing: walking the CIGAR is what puts a panel on the
 * matching slice of its mate rather than on the whole block, and the coarse
 * tier's fold only bounds that to its gap. (Serving the fold here would spare
 * the whole-genome fine fetch a region launch makes; a perf follow-up.)
 */
export async function executeDiscoverMates({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  trackAssemblyNames,
  anchorAssembly,
  stopToken,
  statusCallback,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  // one region, plural so refName renaming applies to it (see
  // RpcMethodTypeWithRenameRegions)
  regions: Region[]
  trackAssemblyNames: string[]
  anchorAssembly: string
  stopToken?: StopToken
  statusCallback?: StatusCallback
}): Promise<MateDiscoveryResult> {
  const region = regions[0]
  if (!region) {
    throw new Error('No region to discover synteny mates in')
  }
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })
  const features = await dataAdapter.getFeaturesInMultipleRegionsArray(
    regions,
    {
      stopToken,
      statusCallback,
    },
  )
  return pickMatesForRegion({
    features,
    region,
    trackAssemblyNames,
    anchorAssembly,
  })
}
