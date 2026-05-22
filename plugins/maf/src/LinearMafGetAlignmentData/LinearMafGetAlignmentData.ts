import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { subscribeToObservable } from '../util/observableUtils.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../LinearMafRenderer/mafBackendTypes.ts'
import type { AlignmentRecord, Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { NewickNode } from '@jbrowse/tree-sidebar'

type MafAdapter = BaseFeatureDataAdapter & {
  getSamples: () => Promise<{
    samples: Sample[]
    tree: NewickNode | undefined
  }>
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    LinearMafGetAlignmentData: {
      args: LinearMafGetAlignmentDataArgs
      return: LinearMafGetAlignmentDataResult
    }
  }
}

export interface LinearMafGetAlignmentDataArgs {
  adapterConfig: AnyConfigurationModel
  sessionId: string
  region: Region
  stopToken?: StopToken
  statusCallback?: (msg: string) => void
}

export interface LinearMafGetAlignmentDataResult {
  samples: Sample[]
  tree: NewickNode | undefined
  regionData: MafRegionData
}

/**
 * Fetch MAF alignment features for a single region. Returns raw
 * `MafRegionData` (one or more blocks; each carries its own ref seq + rows
 * — see `mafBackendTypes.ts`). The GPU instance buffer is built on the
 * main thread (in `startBackend`'s per-region encode) from this raw data plus the
 * current `gpuProps()` — that way color/style toggles never round-trip
 * through the RPC.
 *
 * All heavy sequence data uses Uint8Array for zero-copy transfer across
 * the worker boundary.
 */
export default class LinearMafGetAlignmentData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'LinearMafGetAlignmentData'

  async execute(
    args: LinearMafGetAlignmentDataArgs,
    rpcDriverClassName: string,
  ): Promise<LinearMafGetAlignmentDataResult> {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { region, adapterConfig, sessionId } = deserializedArgs

    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const adapter = dataAdapter as MafAdapter

    // Server is authoritative for samples + tree (derived from track config).
    // Shipping them with every region response avoids a separate setup RPC.
    const { samples, tree } = await adapter.getSamples()

    const enc = new TextEncoder()
    const sampleToRow = new Map(samples.map((s, i) => [s.id, i]))

    // One MAF feature = one alignment block. A single fetched region can
    // contain many disjoint blocks at unrelated genomic anchors.
    const blocks: MafBlock[] = []
    await subscribeToObservable(
      adapter.getFeatures(region, deserializedArgs),
      (feature: Feature) => {
        const refSeqBytes = enc.encode(feature.get('seq') as string)
        const startBp = feature.get('start')
        const alignments = feature.get('alignments') as Record<
          string,
          AlignmentRecord
        >
        const rows = Object.entries(alignments).flatMap(([sampleId, data]) => {
          const rowIndex = sampleToRow.get(sampleId)
          return rowIndex === undefined
            ? []
            : [{ rowIndex, alignmentBytes: enc.encode(data.seq) }]
        })
        blocks.push({ startBp, refSeqBytes, rows })
      },
    )

    return { samples, tree, regionData: { blocks } }
  }
}
