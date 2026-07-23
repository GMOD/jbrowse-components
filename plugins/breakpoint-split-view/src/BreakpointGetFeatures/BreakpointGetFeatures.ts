import { getClip } from '@jbrowse/cigar-utils'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface BreakpointGetFeaturesArgs {
  sessionId: string
  regions: Region[]
  adapterConfig: Record<string, unknown>
  assemblyName?: string
  statusCallback?: StatusCallback
  stopToken?: StopToken
  opts?: Record<string, unknown>
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    BreakpointGetFeatures: {
      args: BreakpointGetFeaturesArgs
      return: Feature[]
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

// The opposite endpoint of a bedpe-style paired feature, as emitted by
// BedpeAdapter. Present on both halves of the pair, each pointing at the other.
export interface BreakpointMate {
  refName: string
  start: number
  end: number
  strand?: number
}

// Shape emitted by the worker for each feature. Consumed by `deserializeReturn`
// which wraps each one in a `SimpleFeature`. Covers both:
//   1. AlignmentsTrack (BAM/CRAM): strand/flags/pair_orientation/CIGAR-derived
//      clipLengthAtStartOfRead; rendered by AlignmentConnections.
//   2. VariantTrack (VCF): ALT/INFO/type=('translocation'|'paired_feature'|
//      'breakend'); rendered by Translocations, PairedFeatures, or Breakends.
// Each feature only populates the fields relevant to its source.
export interface BreakpointSerializedFeature {
  uniqueId: string
  refName: string
  start: number
  end: number
  name?: string
  id?: string
  type?: string
  // Alignment-specific
  strand?: number
  flags?: number
  tags?: { SA?: string } & Record<string, unknown>
  pair_orientation?: string
  clipLengthAtStartOfRead?: number
  // Variant-specific
  ALT?: string[]
  INFO?: BreakpointVcfInfo
  // paired_feature (bedpe) only: the record's other endpoint. Both halves of a
  // pair carry it, which is what lets getMatchedPairedFeatures rejoin them.
  mate?: BreakpointMate
}

export default class BreakpointGetFeatures extends RpcMethodTypeWithRenameRegions {
  name = 'BreakpointGetFeatures'

  async deserializeReturn(
    feats: BreakpointSerializedFeature[],
    args: unknown,
    rpcDriver: string,
  ) {
    const superDeserialized = (await super.deserializeReturn(
      feats,
      args,
      rpcDriver,
    )) as BreakpointSerializedFeature[]
    return superDeserialized.map(
      feat => new SimpleFeature(feat as unknown as SimpleFeatureSerialized),
    )
  }

  async execute(
    args: BreakpointGetFeaturesArgs,
    rpcDriver: string,
  ): Promise<BreakpointSerializedFeature[]> {
    const {
      stopToken,
      statusCallback,
      sessionId,
      adapterConfig,
      regions,
      opts,
    } = await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    const features = await dataAdapter.getFeaturesInMultipleRegionsArray(
      regions,
      {
        ...opts,
        statusCallback,
        stopToken,
      },
    )

    return features.map((feature): BreakpointSerializedFeature => {
      const cigar = feature.get('CIGAR') as string | undefined
      const strand = feature.get('strand')
      return {
        uniqueId: feature.id(),
        start: feature.get('start'),
        end: feature.get('end'),
        refName: feature.get('refName'),
        strand,
        flags: feature.get('flags') as number | undefined,
        name: feature.get('name'),
        id: feature.get('id'),
        tags: feature.get('tags') as
          | ({ SA?: string } & Record<string, unknown>)
          | undefined,
        pair_orientation: feature.get('pair_orientation') as string | undefined,
        type: feature.get('type'),
        ALT: feature.get('ALT') as string[] | undefined,
        INFO: feature.get('INFO') as BreakpointVcfInfo | undefined,
        mate: feature.get('mate') as BreakpointMate | undefined,
        clipLengthAtStartOfRead:
          cigar && strand !== undefined ? getClip(cigar, strand) : undefined,
      }
    })
  }
}
