import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import { getCigar, getMate } from '../syntenyMate.ts'
import { pickMatesForRegion } from './pickMatesForRegion.ts'

import type { SyntenyMate } from '../syntenyMate.ts'
import type { SyntenyDiscoverMatesReturn } from './SyntenyDiscoverMatesRpc.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// Only the fields the launch reads back out — see resolveSpans and
// buildSyntenyViewSpec, which want the block's span on both axes, its strand and
// its CIGAR, and nothing else.
//
// Narrowed rather than passed through as `toJSON()` because a synteny row's
// other alignment detail is large and dead here: a `cs` tag carries the real
// query bases and routinely outweighs the CIGAR beside it, and the launched view
// refetches its own features anyway — these exist only to be turned into two
// locstrings.
function launchFields(
  feature: Feature,
  mate: SyntenyMate,
): SimpleFeatureSerialized {
  return {
    uniqueId: feature.id(),
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    strand: feature.get('strand'),
    CIGAR: getCigar(feature),
    mate,
  }
}

/**
 * Which assemblies a region aligns to, and on which alignment each — resolved
 * where the features already are.
 *
 * The reduction is the point of running this in the worker. A locus on an
 * all-vs-all file carries one alignment per sample, and a launch can be offered
 * for a whole chromosome (the visible-region entry exists for exactly that
 * case), so the fetch below can span millions of rows — while what the launch
 * needs from them is one alignment per mate assembly, a handful. Reducing on the
 * main thread meant every one of those rows crossed the worker boundary with its
 * full CIGAR attached, to be thrown away on arrival.
 *
 * No `lodMode`, so an indexed PIF serves its fine tier here whatever the display
 * that launched this is drawing: the coarse tier carries no CIGAR, and walking
 * the CIGAR is what puts a panel on the matching slice of its mate rather than
 * on the whole block.
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
}): Promise<SyntenyDiscoverMatesReturn> {
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
  const { mates, unconfigured } = pickMatesForRegion({
    features,
    region,
    trackAssemblyNames,
    anchorAssembly,
  })
  return {
    // guarded rather than asserted: pickMatesForRegion only keeps features whose
    // mate resolved, so the empty case is unreachable, and a mate-less feature is
    // still not a panel if that ever stops being true
    mates: mates.map(({ assemblyName, features }) => ({
      assemblyName,
      features: features.flatMap(feature => {
        const mate = getMate(feature)
        return mate ? [launchFields(feature, mate)] : []
      }),
    })),
    unconfigured,
  }
}
