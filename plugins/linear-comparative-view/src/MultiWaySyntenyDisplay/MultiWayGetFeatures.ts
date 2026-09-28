import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { SimpleFeature } from '@jbrowse/core/util'
import { rpcResult, unwrapRpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { AlignmentOpsById } from './alignmentOps.ts'
import type { RegionLike, RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { RpcResult } from '@jbrowse/core/util/librpc'
import type { ComparativeOptions } from '@jbrowse/synteny-core'

export interface MultiWayFeatures {
  features: Feature[]
  ops: AlignmentOpsById
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
        opts?: Record<string, unknown>
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
    const { features, ops } = unwrapRpcResult(wire)
    return {
      features: features.map(feat => new SimpleFeature(feat)),
      ops: new Map(ops),
    }
  }

  async execute(args: RpcExecuteArgs<'MultiWayGetFeatures'>) {
    const { signal, statusCallback, regions, haplotypes, opts } = args
    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })
    const withOps: ComparativeOptions = {
      ...opts,
      haplotypes,
      keepAlignment: true,
      statusCallback,
      signal,
    }
    const found = await firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(regions, withOps)
        .pipe(toArray()),
    )
    const wire = liftAlignmentOps(found)
    return rpcResult(
      wire,
      wire.ops.map(([, packed]) => packed.buffer),
    )
  }
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
