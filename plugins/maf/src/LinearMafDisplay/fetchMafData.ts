import {
  isRegionRefused,
  largestRegionBytes,
  measuredBytes,
} from '@jbrowse/core/rpc/byteBudget'
import {
  createStatusFanOut,
  createStopToken,
  isAbortException,
  stopStopToken,
  stopTokenSignal,
} from '@jbrowse/core/util'
import {
  callEachRegion,
  fetchRegionsBatched,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord, MafSummaryRecord, Sample } from '../types.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type {
  FetchContext,
  FetchEachRegionModel,
  IndexedRegion,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'

interface MafFetchSelf extends FetchEachRegionModel {
  adapterConfig: Record<string, unknown>
  // The sorted-set form, never the raw `subtreeFilter` node: this is also what
  // `rpcProps()` returns, so the payload and the cache key it is stored under
  // are one expression. See the getter for why the sort is load-bearing.
  subtreeFilterSet: string[] | undefined
  annotationDataActive: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  // read rather than restated, so all three tiers are bounded by the same
  // number — and undefined is how `gateActive` reaches the worker, which then
  // measures nothing
  resolvedByteLimit: () => number | undefined
  setRpcData: (regionIndex: number, data: MafWireRegionData) => void
  setSummaryData: (regionIndex: number, records: MafSummaryRecord[]) => void
  setFramesData: (regionIndex: number, records: MafFrameRecord[]) => void
  setFramesGateBlocked: (blocked: boolean) => void
  clearAlignmentData: () => void
  setSamples: (arg: SampleSet) => void
}

interface SampleSet {
  samples: Sample[]
  treeNewick: string | undefined
  samplesCanonical: boolean
}

/**
 * Resolve the sample set this batch of per-region results reports, as the union
 * of their samples in first-seen (region) order.
 *
 * A sample-discovery track (no configured `samples`) derives its rows from the
 * genomes present in each region's blocks, so two regions can name different
 * sets and a region with no alignment blocks names none. Picking one region's
 * set to stand for the batch dropped the others' rows: a genome only region B
 * aligns has no row to be placed at, so it rendered nothing. Unioning keeps
 * every discovered row, and being order-stable and additive it settles in one
 * round instead of flip-flopping the set (and `sampleSetGeneration` with it) as
 * regions land in different batches.
 *
 * `treeNewick` and `samplesCanonical` are config-derived, hence identical across
 * a batch — read from the first result. Configured-samples tracks return that
 * same complete set for every region, so the union is that set.
 */
export function unionSampleSets(
  results: readonly { result: SampleSet }[],
): SampleSet | undefined {
  const first = results[0]?.result
  // Map preserves first-insertion order while later fields (label/color) win.
  const byId = new Map<string, Sample>()
  for (const { result } of results) {
    for (const sample of result.samples) {
      byId.set(sample.id, sample)
    }
  }
  return first
    ? {
        samples: [...byId.values()],
        treeNewick: first.treeNewick,
        samplesCanonical: first.samplesCanonical,
      }
    : undefined
}

/**
 * A stop token for one fan-out under `ctx`, stopped by the parent's or by the
 * first refusal it sees. `fetchRegionsBatched` holds the whole payload until
 * every region lands, so without this a refusal at chr1 would let every sibling
 * download in full and then be discarded; with it the siblings abort at the
 * socket. `guard` wraps each region's call: a refusal stops the scope, and an
 * abort the scope itself caused reads as "did not land" rather than an error.
 * A parent cancel still rejects.
 */
function refusalScope(ctx: FetchContext) {
  const stopToken = createStopToken()
  const parent = stopTokenSignal(ctx.stopToken)
  const stop = () => {
    stopStopToken(stopToken)
  }
  if (parent.signal.aborted) {
    stop()
  } else {
    parent.signal.addEventListener('abort', stop)
  }
  let refused = false
  return {
    ctx: { ...ctx, stopToken },
    async guard<R>(call: () => Promise<R | RegionTooLargeResult>) {
      try {
        const result = await call()
        if (isRegionRefused(result)) {
          refused = true
          stop()
        }
        return result
      } catch (e) {
        if (refused && isAbortException(e)) {
          return undefined
        } else {
          throw e
        }
      }
    },
    dispose: parent.dispose,
  }
}

function landed<R>(
  results: { displayedRegionIndex: number; result: R | undefined }[],
) {
  return results.flatMap(({ displayedRegionIndex, result }) =>
    result === undefined ? [] : [{ displayedRegionIndex, result }],
  )
}

/**
 * Shared per-region fetch skeleton for both the detail and summary paths: call
 * one RPC per buffered region, bail on staleness, push the (config-derived)
 * `samples` + tree once, then hand the per-region results to `commit`.
 *
 * `fetchRegionsBatched` rather than `fetchEachRegion` because `setSamples` is a
 * cross-region decision over the whole result set, so the batch is what the
 * staleness guard has to wrap: a partial commit would publish a sample set
 * derived from a superseded viewport. Every region is marked loaded together,
 * and **one refused region refuses the batch** for the same reason: the sample
 * union is a decision over all of them, so a set derived from the regions that
 * happened to fit is not the set this viewport has. The first refusal also
 * aborts the siblings still in flight (`refusalScope`), since their payloads
 * would only be discarded. The largest measurement among the regions that
 * landed still goes back to the gate, which is what puts a size in the banner
 * and releases it once the user zooms.
 *
 * The RPC payload carries no color/style settings — worker output is purely
 * data-dependent and the main thread encodes from it plus `gpuProps()`, so
 * toggling colors/theme never refetches.
 *
 * `call` receives that region's own `ctx`, whose `statusCallback` is its slot in
 * the fetch's fan-out, so the parallel per-region calls aggregate into one
 * progress bar instead of clobbering each other.
 */
async function fetchMafRegions<R extends SampleSet>(
  self: MafFetchSelf,
  needed: IndexedRegion[],
  call: (
    region: Region,
    ctx: FetchContext,
    displayedRegionIndex: number,
  ) => Promise<R | RegionTooLargeResult>,
  commit: (results: { displayedRegionIndex: number; result: R }[]) => void,
) {
  // #region rawFetchRegions
  type MafBatch = {
    results: { displayedRegionIndex: number; result: R }[]
    bytes?: number
  }
  await fetchRegionsBatched(self, needed, {
    // Annotated, because the two arms are what tells `fetchRegionsBatched`
    // which half is the payload: inferred, the marker's absent fields would
    // widen the payload's own.
    call: async (regions, ctx): Promise<MafBatch | RegionTooLargeResult> => {
      // The CDS-frame annotation overlay (when configured) fetches in the same
      // stop-token-guarded pass as the main data so the two share staleness +
      // loadedRegions book-keeping; the two RPCs run concurrently.
      //
      // Concurrently, and each is itself a per-region fan-out, so they get a
      // slot apiece rather than the shared callback: two fan-outs writing one
      // status field directly is last-writer-wins between them, and the
      // annotation branch's rows are a small fraction of the alignment's.
      const slot = createStatusFanOut(ctx.statusCallback)
      const scope = refusalScope(ctx)
      const results = await Promise.all([
        callEachRegion(
          regions,
          { ...scope.ctx, statusCallback: slot() },
          (region, regionCtx, displayedRegionIndex) =>
            scope.guard(() => call(region, regionCtx, displayedRegionIndex)),
        ),
        fetchAnnotationData(self, regions, {
          ...scope.ctx,
          statusCallback: slot(),
        }),
      ])
        .then(([answered]) => landed(answered))
        .finally(() => {
          scope.dispose()
        })
      // The batch's own byte number, whichever way it goes: the budget is what
      // one region may cost, so the largest is what was judged and what the
      // banner quotes.
      const perRegionBytes = results.map(r => measuredBytes(r.result))
      const bytes = largestRegionBytes(perRegionBytes)
      const kept: { displayedRegionIndex: number; result: R }[] = []
      let refused = false
      for (const { displayedRegionIndex, result } of results) {
        if (isRegionRefused(result)) {
          refused = true
        } else {
          kept.push({ displayedRegionIndex, result })
        }
      }
      return refused
        ? { regionTooLarge: true as const, bytes }
        : { results: kept, bytes }
    },
    commit: ({ results }) => {
      const sampleSet = unionSampleSets(results)
      if (sampleSet) {
        self.setSamples(sampleSet)
      }
      commit(results)
    },
  })
  // #endregion
}

/**
 * Fetch per-species CDS frame rows (UCSC `mafFrames`) for the buffered regions
 * from the MAF adapter's `annotationAdapter` sub-adapter, in parallel with the
 * main alignment/summary fetch and under its stop token. No-op when no adapter is
 * configured or neither the frame strip nor the codon view is on, so tracks
 * without frames pay nothing. Stale writes are skipped by `ctx.isStale()`.
 *
 * Gated like both main tiers, by the `byteLimit` the RPC carries: the display's
 * own gate measures exactly one file — the alignment or the summary depending
 * on the tier — and `mafFrames` is a third, fetched concurrently with whichever
 * of those won. `executeMafAnnotationData` measures it before it downloads,
 * which is the same one-round-trip shape the other two use.
 *
 * Fails soft: the overlay is auxiliary, so a frames-file error is logged but
 * swallowed rather than rejecting the combined fetch and blanking the alignment.
 * A refusal takes that same soft path — the overlay is the only thing that goes
 * missing — but it is *reported*, through `framesGateBlocked`, so the menu can
 * say why the strip stopped drawing instead of leaving it silently off.
 *
 * **One refused region refuses the overlay**, as it does for the main batch:
 * the frame strip spans the viewport, so drawing it over the regions that
 * happened to fit reads as "these exons are all there are".
 */
async function fetchAnnotationData(
  self: MafFetchSelf,
  needed: IndexedRegion[],
  ctx: FetchContext,
) {
  const adapterConfig = self.annotationAdapterConfig
  if (!self.annotationDataActive || !adapterConfig) {
    return
  }
  const scope = refusalScope(ctx)
  try {
    const results = landed(
      await callEachRegion(needed, scope.ctx, (region, regionCtx) =>
        scope.guard(() =>
          regionCtx.callRpc('LinearMafGetAnnotationData', {
            adapterConfig,
            regions: [region],
            // undefined is the gate declining to act at all — force-load
            // exempts the track on every axis, so one click covers this read
            // too rather than leaving the overlay mysteriously off
            byteLimit: self.resolvedByteLimit(),
          }),
        ),
      ),
    )
    const kept: { displayedRegionIndex: number; records: MafFrameRecord[] }[] =
      []
    let refused = false
    for (const { displayedRegionIndex, result } of results) {
      if (isRegionRefused(result)) {
        refused = true
      } else {
        kept.push({ displayedRegionIndex, records: result.records })
      }
    }
    if (!ctx.isStale()) {
      self.setFramesGateBlocked(refused)
      if (!refused) {
        for (const { displayedRegionIndex, records } of kept) {
          self.setFramesData(displayedRegionIndex, records)
        }
      }
    }
  } catch (e) {
    // an abort here is the main batch's refusal cutting the overlay short
    if (!ctx.isStale() && !isAbortException(e)) {
      console.error('MAF CDS-frame annotation fetch failed', e)
    }
  } finally {
    scope.dispose()
  }
}

export function fetchMafAlignmentData(
  self: MafFetchSelf,
  needed: IndexedRegion[],
) {
  return fetchMafRegions(
    self,
    needed,
    (region, ctx) =>
      ctx.callRpc('LinearMafGetAlignmentData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
        byteLimit: self.resolvedByteLimit(),
        // Row set, not row order: the worker ships only these genomes and
        // scores coverage over them. Placement is the client's (see
        // `placeMafRegionData`), so nothing order-dependent is sent.
        subtreeFilter: self.subtreeFilterSet,
      }),
    results => {
      for (const { displayedRegionIndex, result } of results) {
        self.setRpcData(displayedRegionIndex, result.regionData)
      }
    },
  )
}

/**
 * Zoom-out counterpart: pulls cheap per-species `bigMafSummary` rows instead of
 * full alignment sequence. Drops the alignment `rpcDataMap` so the GPU sequence
 * canvas paints nothing while the summary overlay draws the bars.
 */
export function fetchMafSummaryData(
  self: MafFetchSelf,
  needed: IndexedRegion[],
) {
  return fetchMafRegions(
    self,
    needed,
    (region, ctx) =>
      ctx.callRpc('LinearMafGetSummaryData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
        byteLimit: self.resolvedByteLimit(),
        // Same row set as the detail path. It has to be sent even though the
        // records are small: `subtreeFilter` is an `rpcProps()` cache key, so
        // narrowing the clade already discards every loaded region — a summary
        // fetch that ignored the filter would re-download byte-identical rows
        // and then drop the same ones client-side.
        subtreeFilter: self.subtreeFilterSet,
      }),
    results => {
      self.clearAlignmentData()
      for (const { displayedRegionIndex, result } of results) {
        self.setSummaryData(displayedRegionIndex, result.records)
      }
    },
  )
}
