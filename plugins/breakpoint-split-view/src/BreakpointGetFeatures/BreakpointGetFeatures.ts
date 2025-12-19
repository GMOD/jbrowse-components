import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgs } from '@jbrowse/core/rpc/methods/util'
import type { Region } from '@jbrowse/core/util'

const startClip = /(\d+)[SH]$/
const endClip = /^(\d+)([SH])/

function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(startClip.exec(cigar)?.[1] ?? 0)
    : +(endClip.exec(cigar)?.[1] ?? 0)
}

// This interface covers features from two different track types:
//
// 1. AlignmentsTrack (BAM/CRAM) - uses fields like:
//    - CIGAR, strand, flags, pair_orientation, clipLengthAtStartOfRead
//    - Rendered by AlignmentConnections component
//
// 2. VariantTrack (VCF) - uses fields like:
//    - ALT, INFO, type (e.g. 'translocation', 'paired_feature', or breakend)
//    - Rendered by Translocations, PairedFeatures, or Breakends components
interface MinimalFeature {
  [key: string]: unknown
  uniqueId: string
  refName: string
  start: number
  end: number
  strand: number
  flags: number
  name?: string
  id?: string
  // Alignment-specific fields
  tags?: Record<string, unknown>
  pair_orientation?: string
  clipLengthAtStartOfRead?: number
  // Variant-specific fields
  INFO?: Record<string, unknown>
  ALT?: unknown[]
  mate?: Record<string, unknown>
  type?: string
}

export default class BreakpointGetFeatures extends RpcMethodType {
  name = 'BreakpointGetFeatures'

  async deserializeReturn(
    feats: MinimalFeature[],
    args: unknown,
    rpcDriver: string,
  ) {
    const superDeserialized = (await super.deserializeReturn(
      feats,
      args,
      rpcDriver,
    )) as MinimalFeature[]
    return superDeserialized.map(feat => new SimpleFeature(feat))
  }

  async serializeArguments(args: RenderArgs, rpcDriver: string) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    return super.serializeArguments(
      renamedArgs,
      rpcDriver,
    ) as Promise<RenderArgs>
  }

  async execute(
    args: {
      sessionId: string
      regions: Region[]
      adapterConfig: Record<string, unknown>
      statusCallback: (arg: string) => void
      stopToken?: string
      opts?: Record<string, unknown>
    },
    rpcDriver: string,
  ) {
    const {
      stopToken,
      statusCallback,
      sessionId,
      adapterConfig,
      regions,
      opts,
    } = await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const features = await firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(regions, {
          ...opts,
          statusCallback,
          stopToken,
        })
        .pipe(toArray()),
    )

    // Serialize minimal fields needed for breakpoint view. This includes fields
    // for both alignment features (CIGAR, strand, pair_orientation) and variant
    // features (ALT, INFO, type). Each feature will only have the relevant
    // fields populated based on its source adapter.
    return features.map(feature => {
      const cigar = feature.get('CIGAR')
      const strand = feature.get('strand')
      return {
        uniqueId: feature.id(),
        start: feature.get('start'),
        end: feature.get('end'),
        refName: feature.get('refName'),
        strand,
        flags: feature.get('flags'),
        name: feature.get('name'),
        id: feature.get('id'),
        tags: feature.get('tags'),
        pair_orientation: feature.get('pair_orientation'),
        type: feature.get('type'),
        ALT: feature.get('ALT'),
        INFO: feature.get('INFO'),
        clipLengthAtStartOfRead:
          cigar && strand !== undefined ? getClip(cigar, strand) : undefined,
      }
    })
  }
}
