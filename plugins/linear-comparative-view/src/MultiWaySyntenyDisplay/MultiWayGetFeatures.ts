import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { SimpleFeature } from '@jbrowse/core/util'
import { rpcResult, unwrapRpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getMate } from '../syntenyMate.ts'
import { SPLIT_AT_GAP_BP } from './layoutMultiWay.ts'

import type { AlignmentOpsById } from './alignmentOps.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  RegionLike,
  RpcArgs,
  RpcCallContext,
  RpcExecuteArgs,
} from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { RpcResult } from '@jbrowse/core/util/librpc'
import type { ComparativeOptions } from '@jbrowse/synteny-core'

/**
 * A deletion one record states across the whole fetched window: `bp` of the
 * anchor that lane `assemblyName`'s `refName` lacks at lane bp `at`
 */
export interface WindowDeletion {
  assemblyName: string
  refName: string
  at: number
  bp: number
}

export interface MultiWayFeatures {
  features: Feature[]
  ops: AlignmentOpsById
  deletions: WindowDeletion[]
}

interface MultiWayFeaturesWire {
  features: SimpleFeatureSerialized[]
  ops: [string, Uint32Array][]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiWayGetFeatures: {
      args: {
        regions: RegionLike[]
        adapterConfig: Record<string, unknown>
        // outside `opts`, so the rename pass reads these lanes' refNames alone
        haplotypes?: string[]
        opts?: Pick<
          ComparativeOptions,
          | 'lodMode'
          | 'mateShape'
          | 'targetAssemblyName'
          | 'queryAssemblyName'
          | 'lanePairs'
        >
      }
      return: MultiWayFeatures
      wire: RpcResult<MultiWayFeaturesWire>
    }
  }
}

/** Carries alignment ops beside the features, which stay plain data. */
export default class MultiWayGetFeatures extends RpcMethodTypeWithRenameRegions<'MultiWayGetFeatures'> {
  name = 'MultiWayGetFeatures' as const

  async deserializeReturn(wire: RpcResult<MultiWayFeaturesWire>) {
    return multiWayFeaturesOf(unwrapRpcResult(wire))
  }

  async execute(args: RpcExecuteArgs<'MultiWayGetFeatures'>) {
    const wire = liftAlignmentOps(
      await executeMultiWayFeatures({
        ...args,
        pluginManager: this.pluginManager,
      }),
    )
    return rpcResult(
      wire,
      wire.ops.map(([, packed]) => packed.buffer),
    )
  }
}

/**
 * The features a multi-way fetch reads, each alignment carrying its
 * `alignmentOps`, clipped to the regions and split at the gaps a lane opens.
 */
export async function executeMultiWayFeatures({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  haplotypes,
  opts,
  statusCallback,
  signal,
}: RpcArgs<'MultiWayGetFeatures'> &
  RpcCallContext & { pluginManager: PluginManager }) {
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })
  const withOps: ComparativeOptions = {
    ...opts,
    haplotypes,
    keepAlignment: true,
    clipToRegion: true,
    splitAtGapBp: SPLIT_AT_GAP_BP,
    statusCallback,
    signal,
  }
  return firstValueFrom(
    dataAdapter.getFeaturesInMultipleRegions(regions, withOps).pipe(toArray()),
  )
}

/**
 * The features as a display holds them, the ops lifted off beside them, and
 * each record's deletion across the whole window lifted off too, since a
 * deletion is no placement and nothing may group, frame or draw it
 */
export function multiWayFeaturesOf({
  features,
  ops,
}: MultiWayFeaturesWire): MultiWayFeatures {
  const placed: Feature[] = []
  const deletions: WindowDeletion[] = []
  for (const feat of features) {
    const feature = new SimpleFeature(feat)
    const mate = getMate(feature)
    if (feature.get('spansWindow') && mate?.assemblyName !== undefined) {
      deletions.push({
        assemblyName: mate.assemblyName,
        refName: mate.refName,
        at: mate.start,
        bp: feature.get('end') - feature.get('start'),
      })
    } else {
      placed.push(feature)
    }
  }
  return { features: placed, ops: new Map(ops), deletions }
}

export function liftAlignmentOps(found: Feature[]): MultiWayFeaturesWire {
  const ops: [string, Uint32Array][] = []
  const features = found.map(feature => {
    const { alignmentOps, ...data } = feature.toJSON()
    if (alignmentOps instanceof Uint32Array) {
      ops.push([feature.id(), alignmentOps.slice()])
    }
    return data
  })
  return { features, ops }
}
