import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { buildMafCoverageRegion } from './buildMafCoverageRegion.ts'
import { DASH } from '../util/asciiBytes.ts'
import { subscribeToObservable } from '../util/observableUtils.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentRecord, EmptyRecord, Sample } from '../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

type MafAdapter = BaseFeatureDataAdapter & {
  getSamples: () => Promise<{
    samples: Sample[]
    treeNewick: string | undefined
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
  // Display row order (the client's layout, narrowed by any subtree filter). A
  // block row is emitted at its index in this list, so the worker's `rowIndex`
  // is the on-screen row (and coverage is scoped to the set). Undefined on the
  // first fetch — falls back to canonical sample order. Mirrors variants.
  orderedSampleIds?: string[]
  stopToken?: StopToken
  statusCallback?: (msg: string) => void
}

export interface LinearMafGetAlignmentDataResult {
  samples: Sample[]
  treeNewick: string | undefined
  regionData: MafRegionData
}

/**
 * Fetch MAF alignment features for a single region. Returns raw
 * `MafRegionData` (one or more blocks; each carries its own ref seq + rows
 * — see `mafRenderingBackendTypes.ts`). The GPU instance buffer is built on the
 * main thread (in `startRenderingBackend`'s per-region encode) from this raw data plus the
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

    // Sample set + tree ship with every region response (avoids a setup RPC).
    const { samples: configSamples, treeNewick } = await adapter.getSamples()
    const hasConfiguredSamples = configSamples.length > 0

    // Samples come from config or the guide tree (see getSamples). With a
    // set, the adapter resolves tokens against it. With neither, the adapter
    // discovers the genomes from the alignment data, so the track still
    // renders without a hand-listed sample list.
    const opts = hasConfiguredSamples
      ? { ...deserializedArgs, samples: configSamples }
      : deserializedArgs

    const enc = new TextEncoder()

    // Pass 1: buffer blocks + collect sample order. Row indices are assigned
    // in pass 2 once the full set is known; encoding is deferred to then too.
    const rawBlocks: {
      startBp: number
      refSeqBytes: Uint8Array
      alignments: Record<string, AlignmentRecord>
      empties: Record<string, EmptyRecord>
    }[] = []
    const discoveredOrder = new Map<string, number>()
    const discover = (sampleId: string) => {
      if (!discoveredOrder.has(sampleId)) {
        discoveredOrder.set(sampleId, discoveredOrder.size)
      }
    }
    await subscribeToObservable(
      adapter.getFeatures(region, opts),
      (feature: Feature) => {
        const alignments = feature.get('alignments') as Record<
          string,
          AlignmentRecord
        >
        const empties = feature.get('empties') as Record<string, EmptyRecord>
        for (const sampleId in alignments) {
          discover(sampleId)
        }
        // A species present only on `e` lines (bridged in every fetched block)
        // still needs a row so its bridge line renders.
        for (const sampleId in empties) {
          discover(sampleId)
        }
        rawBlocks.push({
          startBp: feature.get('start'),
          refSeqBytes: enc.encode(feature.get('seq') as string),
          alignments,
          empties,
        })
      },
    )

    const samples: Sample[] = hasConfiguredSamples
      ? configSamples
      : [...discoveredOrder.keys()].map(id => ({ id, label: id }))
    // Block rows are keyed/ordered by the client's display order; samples not
    // in it are dropped. The returned `samples` stays the full canonical set so
    // the sidebar tree + "clear filter" still see every genome.
    const { orderedSampleIds } = deserializedArgs
    const rowOrder = orderedSampleIds?.length
      ? orderedSampleIds
      : samples.map(s => s.id)
    const sampleToRow = new Map(rowOrder.map((id, i) => [id, i]))

    // One MAF feature = one alignment block. A single fetched region can
    // contain many disjoint blocks at unrelated genomic anchors.
    const blocks: MafBlock[] = rawBlocks.map(
      ({ startBp, refSeqBytes, alignments, empties }) => {
        // for...in + push avoids the Object.entries+flatMap temp array
        // allocations on a per-block hot path.
        const rows: MafBlock['rows'] = []
        for (const sampleId in alignments) {
          const rowIndex = sampleToRow.get(sampleId)
          if (rowIndex !== undefined) {
            const a = alignments[sampleId]!
            rows.push({
              rowIndex,
              alignmentBytes: enc.encode(a.seq),
              chr: a.chr,
              start: a.start,
              strand: a.strand ?? 1,
              srcSize: a.srcSize,
              context: a.context,
            })
          }
        }
        const emptyRows: MafBlock['empties'] = []
        for (const sampleId in empties) {
          const rowIndex = sampleToRow.get(sampleId)
          if (rowIndex !== undefined) {
            const e = empties[sampleId]!
            emptyRows.push({ rowIndex, ...e })
          }
        }
        // Genomic extent of the block = non-dash reference columns.
        let refLen = 0
        for (const b of refSeqBytes) {
          if (b !== DASH) {
            refLen++
          }
        }
        return {
          startBp,
          endBp: startBp + refLen,
          refSeqBytes,
          rows,
          empties: emptyRows,
        }
      },
    )

    // `blocks` already contains exactly the display rows (narrowed by the
    // subtree filter via `rowOrder`), so coverage over them is automatically
    // scoped to the visible subtree — no separate row filtering needed.
    const coverage = buildMafCoverageRegion(blocks, region.start, region.end)

    return { samples, treeNewick, regionData: { blocks, coverage } }
  }
}
