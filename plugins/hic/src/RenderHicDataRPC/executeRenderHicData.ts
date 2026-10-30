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
    binSize,
    normalization,
    field,
    quantile,
    floors = {},
    signal,
    statusCallback,
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const { pairs, numContacts, appliedNormalizations } = await (
    dataAdapter as HicAdapter
  ).getMultiRegionContactRecords(regions, {
    resolution: binSize,
    normalization,
    expected: field === 'observed/expected',
    control: field === 'observed/control',
    signal,
    statusCallback,
  })
  checkAbortSignal(signal)

  // A file with no baseline at this binsize, no expected values or no control
  // matrix, paints its counts and says so; one missing it for some pairs
  // leaves those pairs out, since a count on a ratio ramp would read as
  // enrichment.
  const hasBaseline = (pair: (typeof pairs)[number]) =>
    field === 'observed/expected' ? !!pair.expected : !!pair.control
  const appliedField =
    field !== 'observed' && (pairs.length === 0 || pairs.some(hasBaseline))
      ? field
      : 'observed'
  const overExpected = appliedField === 'observed/expected'
  const overControl = appliedField === 'observed/control'
  // the two counts a control ratio was made of, for the hover
  const observedOut = overControl ? new Float32Array(numContacts) : undefined
  const controlOut = overControl ? new Float32Array(numContacts) : undefined

  // a floor read as its bound and whether the bound itself is out, so the
  // loop makes two compares; an unset floor passes every count
  const obsMin = floors.observed?.min ?? Number.NEGATIVE_INFINITY
  const obsStrict = floors.observed?.strict ?? false
  const ctrlMin = floors.control?.min ?? Number.NEGATIVE_INFINITY
  const ctrlStrict = floors.control?.strict ?? false

  const w = binSize / Math.SQRT2
  const resultRegions = buildResultRegions(regions, axisBlocks, binSize)
  const packed = new Float32Array(numContacts * INSTANCE_STRIDE_WORDS)
  const pairRuns: RegionPairRun[] = []
  let at = 0

  await withProgress(
    {
      label: 'Building contact matrix',
      total: numContacts,
      statusCallback,
      signal,
    },
    report => {
      let read = 0
      for (const pair of pairs) {
        const {
          region1Idx,
          region2Idx,
          bin1,
          bin2,
          counts,
          expected,
          control,
        } = pair
        if (appliedField !== 'observed' && !hasBaseline(pair)) {
          read += bin1.length
          report(read)
          continue
        }
        // Hoisted so the loop reads one array or one number: within a
        // chromosome the expected count indexes by distance, between
        // chromosomes it is the map's average.
        const byDistance =
          expected?.kind === 'intra' ? expected.values : undefined
        const firstDistance =
          expected?.kind === 'intra' ? expected.firstDistance : 0
        const average = expected?.kind === 'inter' ? expected.average : 1
        // Both counts in contacts, scaled to the two libraries' geometric-mean
        // depth, then a pseudocount of 1 so a cell one condition lacks still
        // divides.
        // Juicebox adds the 1 to each map's average contact instead, which
        // at any binsize under one contact per bin pair swamps the depth and
        // paints the deeper library's partner depleted everywhere. Scaling
        // both halves of the way keeps A over B the inverse of B over A.
        const ctrlCounts = control?.counts
        const toMean = control
          ? Math.sqrt(control.controlDepth / control.depth)
          : 1
        const gain = control ? control.contactsPerCount * toMean : 1
        const controlGain = control
          ? control.controlContactsPerCount / toMean
          : 1
        const r1 = resultRegions[region1Idx]!
        const r2 = resultRegions[region2Idx]!
        const off1 = r1.combinedOffset
        const off2 = r2.combinedOffset
        // a cell spans `[u, u+w]`, so its reflection's min corner is
        // `start + end - w - u`
        const mirror1 = r1.reversed ? r1.dataXStart + r1.dataXEnd - w : 0
        const mirror2 = r2.reversed ? r2.dataXStart + r2.dataXEnd - w : 0
        const n = bin1.length
        const start = at
        for (let k = 0; k < n; k++) {
          const count = counts[k]!
          // NaN is the .hic no-value marker, which `@gmod/hic` filters only on
          // its dense path
          if (
            Number.isNaN(count) ||
            count < obsMin ||
            (obsStrict && count === obsMin)
          ) {
            continue
          }
          let value = count
          if (overExpected) {
            const e = byDistance
              ? byDistance[Math.abs(bin2[k]! - bin1[k]!) - firstDistance]!
              : average
            value = count / e
            // a zero expected count makes no ratio
            if (!Number.isFinite(value)) {
              continue
            }
          } else if (ctrlCounts) {
            const ctrl = ctrlCounts[k]!
            if (ctrl < ctrlMin || (ctrlStrict && ctrl === ctrlMin)) {
              continue
            }
            value = (count * gain + 1) / (ctrl * controlGain + 1)
            observedOut![at] = count
            controlOut![at] = ctrl
          }
          const u1 = (bin1[k]! + off1) * w
          const u2 = (bin2[k]! + off2) * w
          const m1 = r1.reversed ? mirror1 - u1 : u1
          const m2 = r2.reversed ? mirror2 - u2 : u2
          // Only a pair inside one reversed region can come out of order, and
          // the matrix is symmetric, so re-canonicalize to stay above the axis.
          setInstancePosition(packed, at, Math.min(m1, m2), Math.max(m1, m2))
          setInstanceCount(packed, at, value)
          at++
        }
        if (at > start) {
          pairRuns.push({
            region1Idx,
            region2Idx,
            start,
            end: at,
            expected: overExpected ? expected : undefined,
          })
        }
        read += n
        report(read)
      }
    },
  )

  const instances = packed.subarray(0, at * INSTANCE_STRIDE_WORDS)
  const { maxScore, quantileScore } = computeCountStats(instances, at, quantile)
  const operands =
    observedOut && controlOut
      ? {
          observed: observedOut.subarray(0, at),
          control: controlOut.subarray(0, at),
        }
      : undefined

  return rpcResult(
    {
      instances,
      numContacts: at,
      maxScore,
      quantileScore,
      quantile,
      binWidth: w,
      originBp,
      binSize,
      appliedNormalizations,
      appliedField,
      operands,
      regions: resultRegions,
      pairRuns,
    },
    [
      instances.buffer,
      ...(operands ? [operands.observed.buffer, operands.control.buffer] : []),
      ...new Set(
        pairRuns.flatMap(run =>
          run.expected?.kind === 'intra' ? [run.expected.values.buffer] : [],
        ),
      ),
    ],
  )
}
