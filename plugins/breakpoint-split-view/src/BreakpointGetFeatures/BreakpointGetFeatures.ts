import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type { RenderArgs } from '@jbrowse/core/rpc/methods/util'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

const startClip = /(\d+)[SH]$/
const endClip = /^(\d+)([SH])/

function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(startClip.exec(cigar)?.[1] ?? 0)
    : +(endClip.exec(cigar)?.[1] ?? 0)
}

// Minimal feature fields needed for breakpoint split view
const BREAKPOINT_FIELDS = [
  'uniqueId',
  'refName',
  'start',
  'end',
  'strand',
  'flags',
  'name',
  'id',
  'tags',
  'pair_orientation',
  'INFO',
  'ALT',
  'mate',
  'type',
] as const

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
  tags?: Record<string, unknown>
  pair_orientation?: string
  INFO?: Record<string, unknown>
  ALT?: unknown[]
  mate?: Record<string, unknown>
  type?: string
  clipLengthAtStartOfRead?: number
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

    // Only serialize the minimal fields needed for breakpoint view
    // Process in a single pass to avoid multiple iterations
    const result = new Array(features.length)
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]!
      const cigar = feature.get('CIGAR')
      const strand = feature.get('strand')
      result[i] = {
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
        clipLengthAtStartOfRead:
          cigar && strand !== undefined ? getClip(cigar, strand) : undefined,
      }
    }
    return result
  }
}
