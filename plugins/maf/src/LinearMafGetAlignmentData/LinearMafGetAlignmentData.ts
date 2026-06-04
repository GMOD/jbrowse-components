import {
  computeInterbaseCoverage,
  computeSNPCoverage,
  packCoverageBinsForGpu,
  packIndicatorsForGpu,
  packInterbaseSegmentsForGpu,
  packSnpSegmentsForGpu,
} from '@jbrowse/alignments-core'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { computeMafCoverage } from './computeMafCoverage.ts'
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
    const sampleToRow = new Map(samples.map((s, i) => [s.id, i]))

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

    const mafCov = computeMafCoverage(blocks, region.start, region.end)
    const coverageForSnp = {
      depths: mafCov.depths,
      maxDepth: mafCov.maxDepth,
      startPos: mafCov.startPos,
    }
    const snpCoverage = computeSNPCoverage(
      mafCov.mismatches,
      region.start,
      coverageForSnp,
    )
    const interbaseCoverage = computeInterbaseCoverage(
      mafCov.insertions,
      [],
      [],
      region.start,
      coverageForSnp,
    )

    // Pack mismatch list into MismatchArrays form so alignments-core's
    // `buildCoverageTooltipBin` / `countSnpsAtPosition` can read it directly
    // — same shape the alignments worker ships.
    const mmCount = mafCov.mismatches.length
    const mismatchPositions = new Uint32Array(mmCount)
    const mismatchBases = new Uint8Array(mmCount)
    for (let i = 0; i < mmCount; i++) {
      const m = mafCov.mismatches[i]!
      mismatchPositions[i] = m.position
      mismatchBases[i] = m.base
    }

    const coverage = {
      coverageDepths: mafCov.depths,
      coverageStartPos: mafCov.startPos,
      coverageMaxDepth: mafCov.maxDepth,
      mismatchPositions,
      mismatchBases,
      coveragePackedBuffer: packCoverageBinsForGpu(
        mafCov.depths,
        mafCov.maxDepth,
        mafCov.startPos,
        mafCov.depths.length,
      ),
      snpPackedBuffer: packSnpSegmentsForGpu(
        snpCoverage.positions,
        snpCoverage.yOffsets,
        snpCoverage.heights,
        snpCoverage.colorTypes,
        snpCoverage.relDepths,
        snpCoverage.count,
      ),
      interbasePackedBuffer: packInterbaseSegmentsForGpu(
        interbaseCoverage.positions,
        interbaseCoverage.yOffsets,
        interbaseCoverage.heights,
        interbaseCoverage.colorTypes,
        interbaseCoverage.segmentCount,
      ),
      interbaseMaxCount: interbaseCoverage.maxCount,
      indicatorPackedBuffer: packIndicatorsForGpu(
        interbaseCoverage.indicatorPositions,
        interbaseCoverage.indicatorColorTypes,
        interbaseCoverage.indicatorCount,
      ),
    }

    return { samples, treeNewick, regionData: { blocks, coverage } }
  }
}
