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
import { subscribeToObservable } from '../util/observableUtils.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentRecord, Sample } from '../types.ts'
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

    // Server is authoritative for samples + tree (derived from track config).
    // Shipping them with every region response avoids a separate setup RPC.
    const { samples, treeNewick } = await adapter.getSamples()

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
        // for...in + push avoids the Object.entries+flatMap temp array
        // allocations on a per-feature hot path.
        const rows: { rowIndex: number; alignmentBytes: Uint8Array }[] = []
        for (const sampleId in alignments) {
          const rowIndex = sampleToRow.get(sampleId)
          if (rowIndex !== undefined) {
            rows.push({
              rowIndex,
              alignmentBytes: enc.encode(alignments[sampleId]!.seq),
            })
          }
        }
        blocks.push({ startBp, refSeqBytes, rows })
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
