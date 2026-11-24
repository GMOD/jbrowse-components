import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { SimpleFeature } from '@jbrowse/core/util'
import { rpcResult, unwrapRpcResult } from '@jbrowse/core/util/librpc'
import { splitSyntenyFeatureAtGaps } from '@jbrowse/synteny-core'
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
          | 'lodTier'
          | 'mateShape'
          | 'targetAssemblyName'
          | 'queryAssemblyName'
          | 'lanePairs'
          | 'readsLanesAgainstAnchor'
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

/**
 * A piece cut again by this build's splitter, since a source bundling an
 * older one leaves an indel beside a cut on the run next to it: `13I 13267D`
 * arrived as a run ending in 13I and read as a 13 kb deletion. One run keeps
 * the piece's id; several are numbered as a record's runs are.
 */
function recutAtGaps(
  id: string,
  data: SimpleFeatureSerialized,
  ops: Uint32Array,
) {
  const { mate } = data
  return mate === undefined
    ? [{ id, ops: ops.slice(), data }]
    : splitSyntenyFeatureAtGaps(
        ops,
        data.start,
        mate.start,
        mate.end,
        data.strand === -1 ? -1 : 1,
        SPLIT_AT_GAP_BP,
      ).map(({ start, end, mateStart, mateEnd, cigar }, i, runs) => {
        const suffix = runs.length > 1 ? `/${i}` : ''
        return {
          id: `${id}${suffix}`,
          ops: cigar,
          data: {
            ...data,
            uniqueId: `${id}${suffix}`,
            start,
            end,
            mate: { ...mate, start: mateStart, end: mateEnd },
            ...(data.syntenyId === undefined
              ? {}
              : { syntenyId: `${String(data.syntenyId)}${suffix}` }),
          },
        }
      })
}

export function liftAlignmentOps(found: Feature[]): MultiWayFeaturesWire {
  const ops: [string, Uint32Array][] = []
  const features = found.flatMap(feature => {
    const { alignmentOps, ...data } = feature.toJSON()
    return alignmentOps instanceof Uint32Array
      ? recutAtGaps(feature.id(), data, alignmentOps).map(run => {
          ops.push([run.id, run.ops])
          return run.data
        })
      : [data]
  })
  return { features, ops }
}
