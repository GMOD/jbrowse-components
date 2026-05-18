import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'

import type { MafBlock, MafRegionData } from '../LinearMafRenderer/mafBackendTypes.ts'
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
  colorForBase: Record<string, string>
  showAllLetters: boolean
  mismatchRendering: boolean
  stopToken?: StopToken
  statusCallback?: (msg: string) => void
}

export interface LinearMafGetAlignmentDataResult {
  samples: Sample[]
  tree: NewickNode | undefined
  regionData: MafRegionData
  instanceBuffer: ArrayBuffer
  instanceCount: number
}

/**
 * RPC method that fetches MAF alignment features for a single region and
 * returns:
 *   - instanceBuffer: pre-encoded GPU instance buffer (transferable ArrayBuffer)
 *   - instanceCount: number of quads
 *   - regionData: MafRegionData with Uint8Array alignment sequences for
 *                 Canvas2D text/insertion rendering
 *
 * All heavy data uses TypedArrays for zero-copy transfer across the worker
 * boundary. The instance buffer is encoded here in the worker so the main
 * thread only needs to upload it to the GPU without re-processing.
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
    const {
      region,
      adapterConfig,
      sessionId,
      colorForBase,
      showAllLetters,
      mismatchRendering,
    } = deserializedArgs

    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const adapter = dataAdapter as MafAdapter

    // Server is authoritative for samples + tree (derived from track config).
    // Shipping them with every region response avoids a separate setup RPC and
    // keeps the client's sample list aligned with the server-side filtering.
    const { samples, tree } = await adapter.getSamples()

    const enc = new TextEncoder()
    const sampleToRow = new Map(samples.map((s, i) => [s.id, i]))

    // One MAF feature = one alignment block. A single fetched region can
    // contain many disjoint blocks at unrelated genomic anchors, so each is
    // stored independently with its own ref seq + start.
    const blocks: MafBlock[] = []

    await subscribeToObservable(
      adapter.getFeatures(region, deserializedArgs),
      (feature: Feature) => {
        const refSeqBytes = enc.encode(feature.get('seq') as string)
        const startBp = feature.get('start')
        const alignments = feature.get('alignments') as Record<string, AlignmentRecord>
        const rows = Object.entries(alignments).flatMap(([sampleId, data]) => {
          const rowIndex = sampleToRow.get(sampleId)
          return rowIndex === undefined
            ? []
            : [{ rowIndex, alignmentBytes: enc.encode(data.seq) }]
        })
        blocks.push({ startBp, refSeqBytes, rows })
      },
    )

    const regionData: MafRegionData = { blocks }

    // Pre-encode the GPU instance buffer on the worker side. Concatenates
    // runs across all blocks; positions are absolute genomic uint32.
    const { buffer: instanceBuffer, count: instanceCount } = buildInstanceBuffer({
      blocks,
      colorForBase,
      showAllLetters,
      mismatchRendering,
    })

    return {
      samples,
      tree,
      regionData,
      instanceBuffer,
      instanceCount,
    }
  }
}
