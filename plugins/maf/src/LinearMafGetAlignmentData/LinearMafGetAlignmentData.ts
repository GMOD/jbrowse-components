import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'

import type { MafAlignedRow, MafRegionData } from '../LinearMafRenderer/mafBackendTypes.ts'
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
  showAsUpperCase: boolean
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
      showAsUpperCase,
    } = deserializedArgs

    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const adapter = dataAdapter as MafAdapter

    // Server is authoritative for samples + tree (derived from track config).
    // Shipping them with every region response avoids a separate setup RPC and
    // keeps the client's sample list aligned with the server-side filtering.
    const { samples, tree } = await adapter.getSamples()

    const enc = new TextEncoder()
    const sampleToRow = new Map(samples.map((s, i) => [s.id, i]))

    let referenceSeq = ''
    const rows: MafAlignedRow[] = []

    await subscribeToObservable(
      adapter.getFeatures(region, deserializedArgs),
      (feature: Feature) => {
        const seq = feature.get('seq') as string
        if (!referenceSeq) {
          referenceSeq = seq
        }
        const alignments = feature.get('alignments') as Record<string, AlignmentRecord>
        for (const [sampleId, data] of Object.entries(alignments)) {
          const rowIndex = sampleToRow.get(sampleId)
          if (rowIndex === undefined) {
            continue
          }
          rows.push({
            sampleId,
            rowIndex,
            alignmentBytes: enc.encode(data.seq),
            alignmentStart: data.start,
            chr: data.chr,
          })
        }
      },
    )

    const refSeqBytes = enc.encode(referenceSeq)

    const regionData: MafRegionData = {
      startBp: region.start,
      endBp: region.end,
      refSeqBytes,
      rows,
    }

    // Pre-encode the GPU instance buffer on the worker side.
    const { buffer: instanceBuffer, count: instanceCount } = buildInstanceBuffer({
      refSeqBytes,
      rows: rows.map(r => ({ rowIndex: r.rowIndex, alignmentBytes: r.alignmentBytes })),
      startBp: region.start,
      colorForBase,
      showAllLetters,
      mismatchRendering,
      showAsUpperCase,
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
