import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

export interface BreakpointGetFeaturesArgs {
  regions: Region[]
  adapterConfig: Record<string, unknown>
  /** the display's active filters, `jexl:`-prefixed */
  jexlFilters?: string[]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    BreakpointGetFeatures: {
      args: BreakpointGetFeaturesArgs
      return: Feature[]
      // deserializeReturn wraps each of these in a SimpleFeature
      wire: BreakpointSerializedFeature[]
    }
  }
}

// Subset of VCF INFO fields the breakpoint view actually reads. `STRANDS`
// encodes the directionality of a translocation; `CHR2`/`END` give the mate
// position. Other INFO fields may exist on the wire but the renderer ignores
// them.
export interface BreakpointVcfInfo {
  CHR2?: string[]
  END?: number[]
  STRANDS?: string[]
}

// The opposite endpoint of a paired feature, as emitted by BedpeAdapter and
// StarFusionAdapter. Present on both halves of the pair, each pointing at the
// other.
export interface BreakpointMate {
  refName: string
  start: number
  end: number
  strand?: number
  mateDirection?: number
}

// Shape emitted by the worker for each variant record, which
// `deserializeReturn` wraps in a `SimpleFeature` for the Variants overlay. An
// alignments track's reads come off its own display, not through here.
export interface BreakpointSerializedFeature {
  uniqueId: string
  refName: string
  start: number
  end: number
  name?: string
  id?: string
  type?: string
  strand?: number
  ALT?: string[]
  INFO?: BreakpointVcfInfo
  // A paired adapter's records only: the record's other endpoint. Both halves
  // of a pair carry it, which is what lets getVariantJunctions rejoin them.
  mate?: BreakpointMate
  // Which side of its own junction this end keeps, where the adapter knows it
  // (STAR-Fusion reads it off the fusion's direction). Without it junctionEnds
  // falls back to the BEDPE strand rule, which reads a STAR-Fusion acceptor's
  // gene strand backwards.
  mateDirection?: number
}

export default class BreakpointGetFeatures extends RpcMethodTypeWithRenameRegions<'BreakpointGetFeatures'> {
  name = 'BreakpointGetFeatures' as const

  async deserializeReturn(
    feats: BreakpointSerializedFeature[],
    _args: unknown,
  ) {
    return unwrapRpcResult(feats).map(
      feat => new SimpleFeature(feat as unknown as SimpleFeatureSerialized),
    )
  }

  async execute(args: RpcExecuteArgs<'BreakpointGetFeatures'>) {
    const { signal, statusCallback, regions, jexlFilters = [] } = args
    const filterChain = new SerializableFilterChain({
      filters: jexlFilters,
      jexl: this.pluginManager.jexl,
    })

    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })

    const features = await dataAdapter.getFeaturesInMultipleRegionsArray(
      regions,
      { statusCallback, signal },
    )

    return features
      .filter(f => filterChain.passes(f))
      .map((feature): BreakpointSerializedFeature => ({
        uniqueId: feature.id(),
        start: feature.get('start'),
        end: feature.get('end'),
        refName: feature.get('refName'),
        strand: feature.get('strand'),
        name: feature.get('name'),
        id: feature.get('id'),
        type: feature.get('type'),
        ALT: feature.get('ALT') as string[] | undefined,
        INFO: feature.get('INFO') as BreakpointVcfInfo | undefined,
        mate: feature.get('mate') as BreakpointMate | undefined,
        mateDirection: feature.get('mateDirection') as number | undefined,
      }))
  }
}
