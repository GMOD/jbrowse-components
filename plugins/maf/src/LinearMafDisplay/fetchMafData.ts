import {
  isRegionRefused,
  largestRegionBytes,
  measuredBytes,
} from '@jbrowse/core/rpc/byteBudget'
import { createStatusFanOut, isAbortException } from '@jbrowse/core/util'
import {
  callEachRegion,
  fetchRegionsBatched,
} from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'

import type {
  MafFrameRecord,
  MafRegionPayload,
  MafSummaryRecord,
  MafSource,
} from '../types.ts'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/display-kit/FetchMixin'
import type { CoarseTierResult } from '@jbrowse/display-kit/coarseTier'
import type { FetchEachRegionModel } from '@jbrowse/display-kit/fetchEachRegion'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'

interface MafFetchSelf extends FetchEachRegionModel {
  adapterConfig: Record<string, unknown>
  rpcProps: () => { rowFocus: string[] | undefined }
  summaryReadArgs: {
    adapterConfig: Record<string, unknown>
    rowFocus: string[] | undefined
  }
  // what the summary tier reads the frames for; the detail tier always does
  framesActive: boolean
  framesAdapterConfig: Record<string, unknown> | undefined
  resolvedByteLimit: () => number | undefined
  setFramesGateBlocked: (blocked: boolean) => void
  setSamples: (arg: SampleSet) => void
  setRefSampleId: (id: string | undefined) => void
}

interface SampleSet {
  samples: MafSource[]
  treeNewick: string | undefined
  samplesCanonical: boolean
}

/**
 * Resolve the sample set a batch of per-region results reports: the union of
 * their samples in first-seen order. A discovery track derives rows per region,
 * so regions can name different sets; the union keeps every row and settles in
 * one round.
 *
 * `treeNewick` and `samplesCanonical` are config-derived, so the first result
 * supplies them.
 */
export function unionSampleSets(
  results: readonly { result: SampleSet }[],
): SampleSet | undefined {
  const first = results[0]?.result
  const byName = new Map<string, MafSource>()
  for (const { result } of results) {
    for (const sample of result.samples) {
      byName.set(sample.name, sample)
    }
  }
  return first
    ? {
        samples: [...byName.values()],
        treeNewick: first.treeNewick,
        samplesCanonical: first.samplesCanonical,
      }
    : undefined
}

/**
 * A signal for one fan-out under `ctx`, aborted by the parent's or by the first
 * refusal it sees, so siblings abort at the socket instead of downloading
 * payloads the batch will discard. `guard` wraps each region's call: an abort
 * the scope caused reads as "did not land"; a parent cancel still rejects.
 */
function refusalScope(ctx: FetchContext) {
  const controller = new AbortController()
  const stop = () => {
    controller.abort()
  }
  let refused = false
  return {
    ctx: { ...ctx, signal: AbortSignal.any([ctx.signal, controller.signal]) },
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
  }
}

function landed<R>(
  results: { displayedRegionIndex: number; result: R | undefined }[],
) {
  return results.flatMap(({ displayedRegionIndex, result }) =>
    result === undefined ? [] : [{ displayedRegionIndex, result }],
  )
}

interface MafBatch<R> {
  results: {
    displayedRegionIndex: number
    result: R
    frames: MafFrameRecord[] | undefined
  }[]
  bytes?: number
  /** `bytes` is the max over the regions that reported, not over the set */
  partial?: boolean
  /** the frames read declined a region, so no region carries frames */
  framesRefused: boolean
}

/**
 * The per-region call shared by both tiers: one RPC per buffered region, the
 * CDS-frame overlay beside it, and one answer for the batch. One refused region
 * refuses the batch, because the sample union decides over all of them; the
 * first refusal aborts the siblings (`refusalScope`). The largest measurement
 * among the landed regions still goes to the gate, flagged `partial` when the
 * abort cut the set short.
 *
 * The RPC payload carries no color or style settings, so toggling colors or
 * theme never refetches.
 *
 * `call` receives that region's own `ctx`, whose `statusCallback` is its slot
 * in the fan-out, so parallel calls aggregate into one progress bar.
 */
async function callMafRegions<R extends SampleSet>(
  self: MafFetchSelf,
  regions: IndexedRegion[],
  ctx: FetchContext,
  withFrames: boolean,
  call: (
    region: Region,
    ctx: FetchContext,
    displayedRegionIndex: number,
  ) => Promise<R | RegionTooLargeResult>,
): Promise<MafBatch<R> | RegionTooLargeResult> {
  // #region rawFetchRegions
  // The CDS frames (when configured) fetch in the same
  // signal-guarded pass as the main data so the two share staleness
  // book-keeping; the two RPCs run concurrently.
  //
  // Concurrently, and each is itself a per-region fan-out, so they get a
  // slot apiece rather than the shared callback: two fan-outs writing one
  // status field directly is last-writer-wins between them, and the
  // frames branch's rows are a small fraction of the alignment's.
  const slot = createStatusFanOut(ctx.statusCallback)
  const scope = refusalScope(ctx)
  const [results, frames] = await Promise.all([
    callEachRegion(
      regions,
      { ...scope.ctx, statusCallback: slot() },
      (region, regionCtx, displayedRegionIndex) =>
        scope.guard(() => call(region, regionCtx, displayedRegionIndex)),
    ).then(landed),
    withFrames
      ? fetchFramesData(self, regions, {
          ...scope.ctx,
          statusCallback: slot(),
        })
      : NO_FRAMES,
  ])
  // The batch's byte number whichever way it goes: the largest region is what
  // was judged and what the banner quotes. `partial` travels with it.
  const perRegionBytes = results.map(r => measuredBytes(r.result))
  const bytes = largestRegionBytes(perRegionBytes)
  const partial = results.length < regions.length
  const kept: MafBatch<R>['results'] = []
  let refused = false
  for (const { displayedRegionIndex, result } of results) {
    if (isRegionRefused(result)) {
      refused = true
    } else {
      kept.push({
        displayedRegionIndex,
        result,
        frames: frames.byIndex.get(displayedRegionIndex),
      })
    }
  }
  return refused
    ? { regionTooLarge: true as const, bytes, partial }
    : { results: kept, bytes, partial, framesRefused: frames.refused }
  // #endregion
}

/**
 * The batch-wide decisions a landed batch publishes, under whichever guard the
 * tier's commit runs: the sample set is a union over every region, and the
 * frames verdict is one answer for the whole viewport.
 */
function publishBatch(self: MafFetchSelf, batch: MafBatch<SampleSet>) {
  const sampleSet = unionSampleSets(batch.results)
  if (sampleSet) {
    self.setSamples(sampleSet)
  }
  self.setFramesGateBlocked(batch.framesRefused)
}

const NO_FRAMES = Promise.resolve({
  byIndex: new Map<number, MafFrameRecord[]>(),
  refused: false,
})

/**
 * Fetch per-species CDS frame rows (UCSC `mafFrames`) for the buffered regions
 * from the MAF adapter's `framesAdapter`, in parallel with the main fetch
 * and under its signal. The detail tier always reads them; the summary tier
 * reads them while the strip is on. They land under the tier's own commit and
 * staleness guard.
 *
 * Gated by the `byteLimit` the RPC carries: `executeMafFramesData` measures
 * the frames file before it downloads.
 *
 * Fails soft: a frames-file error is logged, not thrown. A refusal is reported
 * as `refused`, which the commit writes to `framesGateBlocked`. One refused
 * region refuses the overlay, since a strip drawn over the regions that fit
 * reads as the full exon set.
 */
async function fetchFramesData(
  self: MafFetchSelf,
  needed: IndexedRegion[],
  ctx: FetchContext,
): Promise<{ byIndex: Map<number, MafFrameRecord[]>; refused: boolean }> {
  const byIndex = new Map<number, MafFrameRecord[]>()
  const adapterConfig = self.framesAdapterConfig
  if (!adapterConfig) {
    return { byIndex, refused: false }
  }
  const scope = refusalScope(ctx)
  try {
    const results = landed(
      await callEachRegion(needed, scope.ctx, (region, regionCtx) =>
        scope.guard(() =>
          regionCtx.callRpc('LinearMafGetFramesData', {
            adapterConfig,
            regions: [region],
            byteLimit: self.resolvedByteLimit(),
          }),
        ),
      ),
    )
    for (const { displayedRegionIndex, result } of results) {
      if (isRegionRefused(result)) {
        return { byIndex: new Map(), refused: true }
      }
      byIndex.set(displayedRegionIndex, result.records)
    }
  } catch (e) {
    // an abort here is the main batch's refusal cutting the overlay short
    if (!ctx.isStale() && !isAbortException(e)) {
      console.error('MAF CDS-frame fetch failed', e)
    }
  }
  return { byIndex, refused: false }
}

/**
 * The detail tier, through `fetchRegionsBatched` because `setSamples` is a
 * cross-region decision, so the staleness guard wraps the whole batch. Every
 * region is marked loaded together.
 */
export function fetchMafAlignmentData(
  self: MafFetchSelf,
  needed: IndexedRegion[],
) {
  return fetchRegionsBatched(self, needed, {
    call: (regions, ctx) =>
      callMafRegions(self, regions, ctx, true, (region, regionCtx) =>
        regionCtx.callRpc('LinearMafGetAlignmentData', {
          ...rpcArgs(self),
          regions: [region],
        }),
      ),
    commit: batch => {
      publishBatch(self, batch)
      const named = batch.results.find(
        r => r.result.regionData.refSampleId !== undefined,
      )
      if (named) {
        self.setRefSampleId(named.result.regionData.refSampleId)
      }
    },
    payloadFor: (displayedRegionIndex, batch) =>
      payloadOf(batch, displayedRegionIndex, r => r.regionData),
  })
}

function payloadOf<R, T>(
  batch: MafBatch<R>,
  displayedRegionIndex: number,
  data: (result: R) => T,
): MafRegionPayload<T> {
  const entry = batch.results.find(
    r => r.displayedRegionIndex === displayedRegionIndex,
  )
  if (entry === undefined) {
    throw new Error(
      `MAF batch landed no result for region ${displayedRegionIndex}`,
    )
  }
  return { data: data(entry.result), frames: entry.frames }
}

/**
 * The summary tier, as `CoarseTierMixin`'s read: `bigMafSummary` rows, one
 * payload per region. It publishes the sample set under the same staleness
 * guard, via the skeleton's `isStale`.
 */
export async function fetchMafSummaryData(
  self: MafFetchSelf,
  regions: IndexedRegion[],
  ctx: FetchContext,
): Promise<CoarseTierResult<MafRegionPayload<MafSummaryRecord[]>>> {
  const batch = await callMafRegions(
    self,
    regions,
    ctx,
    self.framesActive,
    (region, regionCtx) =>
      regionCtx.callRpc('LinearMafGetSummaryData', {
        ...self.summaryReadArgs,
        byteLimit: self.resolvedByteLimit(),
        regions: [region],
      }),
  )
  if (isRegionRefused(batch)) {
    return batch
  }
  if (!ctx.isStale()) {
    publishBatch(self, batch)
  }
  return {
    entries: batch.results.map(({ displayedRegionIndex, result, frames }) => ({
      displayedRegionIndex,
      payload: { data: result.records, frames },
    })),
    bytes: batch.bytes,
    partial: batch.partial,
  }
}
