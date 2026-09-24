import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { withProgress } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { rpcResult } from '@jbrowse/core/util/librpc'

import {
  INSTANCE_STRIDE_WORDS,
  setInstanceCount,
  setInstancePosition,
} from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { buildResultRegions } from '../regionOffsets.ts'
import { computeCountStats } from './countStats.ts'

import type HicAdapter from '../HicAdapter/HicAdapter.ts'
import type { HicDataResult, RegionPairRun } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RpcResult } from '@jbrowse/core/util/librpc'

export async function executeRenderHicData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'RenderHicData'>
}): Promise<RpcResult<HicDataResult>> {
  const {
    sessionId,
    adapterConfig,
    regions,
    axisBlocks,
    originBp,
    resolution,
    normalization,
    signal,
    statusCallback,
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const { pairs, numContacts, appliedNormalization } = await (
    dataAdapter as HicAdapter
  ).getMultiRegionContactRecords(regions, {
    resolution,
    normalization,
    signal,
    statusCallback,
  })
  checkAbortSignal(signal)

  const w = resolution / Math.SQRT2
  const resultRegions = buildResultRegions(regions, axisBlocks, resolution)
  const instances = new Float32Array(numContacts * INSTANCE_STRIDE_WORDS)
  const pairRuns: RegionPairRun[] = []

  await withProgress(
    {
      label: 'Building contact matrix',
      total: numContacts,
      statusCallback,
      signal,
    },
    report => {
      let at = 0
      for (const { region1Idx, region2Idx, bin1, bin2, counts } of pairs) {
        const r1 = resultRegions[region1Idx]!
        const r2 = resultRegions[region2Idx]!
        const off1 = r1.combinedOffset
        const off2 = r2.combinedOffset
        // a cell spans `[u, u+w]`, so its reflection's min corner is
        // `start + end - w - u`
        const mirror1 = r1.reversed ? r1.dataXStart + r1.dataXEnd - w : 0
        const mirror2 = r2.reversed ? r2.dataXStart + r2.dataXEnd - w : 0
        const n = bin1.length
        for (let k = 0; k < n; k++) {
          const u1 = (bin1[k]! + off1) * w
          const u2 = (bin2[k]! + off2) * w
          const m1 = r1.reversed ? mirror1 - u1 : u1
          const m2 = r2.reversed ? mirror2 - u2 : u2
          // Only a pair inside one reversed region can come out of order, and
          // the matrix is symmetric, so re-canonicalize to stay above the axis.
          setInstancePosition(
            instances,
            at + k,
            Math.min(m1, m2),
            Math.max(m1, m2),
          )
          setInstanceCount(instances, at + k, counts[k]!)
        }
        pairRuns.push({ region1Idx, region2Idx, start: at, end: at + n })
        at += n
        report(at)
      }
    },
  )

  const { maxScore, percentile95 } = computeCountStats(instances, numContacts)

  return rpcResult(
    {
      instances,
      numContacts,
      maxScore,
      percentile95,
      binWidth: w,
      originBp,
      resolution,
      appliedNormalization,
      regions: resultRegions,
      pairRuns,
    },
    [instances.buffer],
  )
}
