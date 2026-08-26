import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  INSTANCE_STRIDE_WORDS,
  setInstanceCount,
  setInstancePosition,
} from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { buildResultRegions } from '../regionOffsets.ts'
import { computeCountStats } from './countStats.ts'

import type { ContactAdapter } from '../HicAdapter/HicAdapter.ts'
import type { HicDataResult } from './types.ts'
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
    sequenceAdapter,
    regions,
    axisBlocks,
    originBp,
    resolution,
    normalization,
    stopToken,
    statusCallback,
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  const adapter = dataAdapter as unknown as ContactAdapter
  // A `.hic` file needs no reference, so this primes only the adapter that
  // does: `AlignmentsContactAdapter` hands it to a CRAM subadapter, which
  // cannot decode a read without one.
  adapter.setSequenceAdapterConfig?.(sequenceAdapter)

  const {
    bin1: contactBin1,
    bin2: contactBin2,
    counts,
    pairs,
    numContacts,
    resolution: res,
    appliedNormalization,
  } = await adapter.getMultiRegionContactRecords(regions, {
    resolution,
    normalization,
    stopToken,
    statusCallback,
  })

  // the fetch may have completed after the user navigated away; bail before
  // the O(numContacts) buffer build + sort rather than doing throwaway work
  checkStopToken(stopToken)

  const w = res / Math.SQRT2
  // The regions arrive split in two — the framework's renamed `regions` and the
  // view-side `axisBlocks` it can't carry — and are one thing again from here
  // on. Everything downstream, on both sides of the worker boundary, reads this.
  const resultRegions = buildResultRegions(regions, axisBlocks, res)

  // The adapter's `contactBin1`/`contactBin2`/`counts` are worker-local scratch
  // now: this loop is the only reader, and what leaves the worker is the packed
  // instance buffer it writes. Only the `pairs` run table is forwarded
  // untouched.
  //
  // Written through the shader's own generated setters rather than a literal
  // stride, so a field added to or retyped in `HicInstance` is a compile error
  // here instead of a silently mis-strided buffer. See
  // `HicDataResult.instances`.
  const instances = new Float32Array(numContacts * INSTANCE_STRIDE_WORDS)

  // Its own phase: the adapter's download phase has closed by here, and packing
  // a whole-genome matrix is not free — at 4.5M contacts this loop is a chunk of
  // time that used to run under a blank status field, with the display saying
  // only "Loading". `report` carries the throttled stop-token check too, which
  // is what makes the pack interruptible at all: the only cancel point before it
  // was the one above, so a navigation during the pack was answered after the
  // whole buffer had been written.
  await withProgress(
    {
      label: 'Building contact matrix',
      total: numContacts,
      statusCallback,
      stopToken,
    },
    report => {
      for (const { region1Idx, region2Idx, start, end } of pairs) {
        // Every layout term below is pair-invariant, so it resolves once per run
        // instead of once per contact — four indexed loads and two unpredictable
        // branches that used to sit in the inner loop purely because region
        // membership was stored per contact.
        const r1 = resultRegions[region1Idx]!
        const r2 = resultRegions[region2Idx]!
        const off1 = r1.combinedOffset
        const off2 = r2.combinedOffset
        const rev1 = r1.reversed
        const rev2 = r2.reversed
        // A cell spans `[u, u+w]`, so its reflection's *min* corner is
        // `mirrorU(u) - w`, which folds to `mirrorBase - u`.
        const mirrorBase1 = r1.dataXStart + r1.dataXEnd - w
        const mirrorBase2 = r2.dataXStart + r2.dataXEnd - w

        for (let i = start; i < end; i++) {
          const u1 = (contactBin1[i]! + off1) * w
          const u2 = (contactBin2[i]! + off2) * w
          // Reflect each endpoint inside its own reversed region.
          const m1 = rev1 ? mirrorBase1 - u1 : u1
          const m2 = rev2 ? mirrorBase2 - u2 : u2
          // Renderers draw the triangle above the axis only for `u1 ≤ u2` (a lower
          // pair rotates to a negative y). Reflecting a region flips the order of
          // contacts *within* it, so re-canonicalize — legal because the matrix is
          // symmetric, `contact(a,b) === contact(b,a)`. Cross-region pairs can't
          // invert (each stays in its own region), so this only fires when both
          // endpoints share one reversed region.
          setInstancePosition(instances, i, Math.min(m1, m2), Math.max(m1, m2))
          setInstanceCount(instances, i, counts[i]!)
        }
        // Once per run rather than once per contact: the runs tile
        // `[0, numContacts)` in order, so `end` is exactly how many contacts are
        // packed — the bar is contact-weighted, which unequal runs (a dense
        // diagonal block against a sparse inter-chromosomal one) need it to be,
        // and the tick still stays out of the inner loop. Run count is
        // O(regions²), so the builds big enough to want a bar are the ones with
        // runs to tick on.
        report(end)
      }
    },
  )

  const { maxScore, percentile95 } = computeCountStats(instances, numContacts)

  const result: HicDataResult = {
    instances,
    numContacts,
    maxScore,
    percentile95,
    binWidth: w,
    originBp,
    resolution: res,
    appliedNormalization,
    regions: resultRegions,
    pairRuns: pairs,
  }
  // Move the one per-contact buffer zero-copy instead of structured-cloning it.
  return rpcResult(result, [instances.buffer])
}
