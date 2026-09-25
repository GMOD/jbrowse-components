import {
  isAbnormalPairDirection,
  pairDirection,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_UNMAPPED,
  getClip,
} from '@jbrowse/cigar-utils'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { getTag } from '@jbrowse/modifications-utils'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

export interface BreakpointGetFeaturesArgs {
  regions: Region[]
  adapterConfig: Record<string, unknown>
  /** the display's active filters, `jexl:`-prefixed */
  jexlFilters?: string[]
  // renameRegionsIfNeeded adds it, so no caller writes it
  sequenceAdapter?: Record<string, unknown>
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

// Shape emitted by the worker for each feature. Consumed by `deserializeReturn`
// which wraps each one in a `SimpleFeature`. Covers both:
//   1. AlignmentsTrack (BAM/CRAM): strand/flags/pair_orientation/CIGAR-derived
//      clipLengthAtStartOfRead; rendered by AlignmentConnections.
//   2. VariantTrack: ALT/INFO for a VCF record, `mate` for a paired adapter's;
//      rendered by Variants.
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
  // A paired adapter's records only: the record's other endpoint. Both halves
  // of a pair carry it, which is what lets getVariantJunctions rejoin them.
  mate?: BreakpointMate
  // Which side of its own junction this end keeps, where the adapter knows it
  // (STAR-Fusion reads it off the fusion's direction). Without it junctionEnds
  // falls back to the BEDPE strand rule, which reads a STAR-Fusion acceptor's
  // gene strand backwards.
  mateDirection?: number
}

// Mirrors what getMatchedAlignmentFeatures/getBadlyPairedAlignments
// (BreakpointSplitView/featureMatching.ts) keep, so a read dropped here never
// crosses the RPC with its full tags (MM/ML on haplotagged long reads) for
// nothing. Same flag constants and pair-direction helpers as that side. A
// feature with no `flags` isn't an alignment and always passes through.
export function keepAlignmentFeature(feature: Feature) {
  const flags = feature.get('flags') as number | undefined
  if (flags === undefined) {
    return true
  }
  if (flags & SAM_FLAG_UNMAPPED) {
    return false
  }
  // getTag, not get('tags'): this runs on every fetched read, and the full
  // tags decode allocates a Record per read to answer one presence check
  if (getTag(feature, 'SA')) {
    return true
  }
  if (!(flags & SAM_FLAG_PAIRED)) {
    return false
  }
  return (
    !(flags & SAM_FLAG_PROPER_PAIR) ||
    isAbnormalPairDirection(
      pairDirection(feature.get('pair_orientation') as string | undefined),
    )
  )
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
    const {
      signal,
      statusCallback,
      sessionId,
      adapterConfig,
      sequenceAdapter,
      regions,
      jexlFilters = [],
    } = args
    const filterChain = new SerializableFilterChain({
      filters: jexlFilters,
      jexl: this.pluginManager.jexl,
    })

    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })

    const features = await dataAdapter.getFeaturesInMultipleRegionsArray(
      regions,
      { statusCallback, signal },
    )

    return features
      .filter(f => keepAlignmentFeature(f) && filterChain.passes(f))
      .map((feature): BreakpointSerializedFeature => {
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
          pair_orientation: feature.get('pair_orientation') as
            | string
            | undefined,
          type: feature.get('type'),
          ALT: feature.get('ALT') as string[] | undefined,
          INFO: feature.get('INFO') as BreakpointVcfInfo | undefined,
          mate: feature.get('mate') as BreakpointMate | undefined,
          mateDirection: feature.get('mateDirection') as number | undefined,
          clipLengthAtStartOfRead:
            cigar && strand !== undefined ? getClip(cigar, strand) : undefined,
        }
      })
  }
}
