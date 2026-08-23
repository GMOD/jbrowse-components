import { overByteBudget } from '@jbrowse/core/rpc/byteBudget'
import { createStatusFanOut } from '@jbrowse/core/util'
import {
  callEachRegion,
  fetchRegionsBatched,
} from '@jbrowse/plugin-linear-genome-view'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafFrameRecord, MafSummaryRecord, Sample } from '../types.ts'
import type { Region } from '@jbrowse/core/util'
import type {
  FetchContext,
  FetchEachRegionModel,
} from '@jbrowse/plugin-linear-genome-view'

interface MafFetchSelf extends FetchEachRegionModel {
  adapterConfig: Record<string, unknown>
  // The sorted-set form, never the raw `subtreeFilter` node: this is also what
  // `rpcProps()` returns, so the payload and the cache key it is stored under
  // are one expression. See the getter for why the sort is load-bearing.
  subtreeFilterSet: string[] | undefined
  annotationDataActive: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  // read rather than restated, so the frames pre-flight below is bounded by the
  // same number as everything else on this display — and by the same one the
  // worker enforces, since undefined is how `gateActive` reaches here
  resolvedByteLimit: () => number | undefined
  setRpcData: (regionIndex: number, data: MafWireRegionData) => void
  setSummaryData: (regionIndex: number, records: MafSummaryRecord[]) => void
  setFramesData: (regionIndex: number, records: MafFrameRecord[]) => void
  setFramesGateBlocked: (blocked: boolean) => void
  clearAlignmentData: () => void
  setSamples: (arg: SampleSet) => void
}

type Needed = { region: Region; displayedRegionIndex: number }[]

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
 * Shared per-region fetch skeleton for both the detail and summary paths: call
 * one RPC per buffered region, bail on staleness, push the (config-derived)
 * `samples` + tree once, then hand the per-region results to `commit`.
 *
 * `fetchRegionsBatched` rather than `fetchEachRegion` because `setSamples` is a
 * cross-region decision over the whole result set, so the batch is what the
 * staleness guard has to wrap: a partial commit would publish a sample set
 * derived from a superseded viewport. Every region is marked loaded together,
 * which is honest here — MAF's size gate is the pre-flight kind, so a refusal
 * returns before `call` runs at all and nothing below can arrive empty-handed.
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
  needed: Needed,
  call: (
    region: Region,
    ctx: FetchContext,
    displayedRegionIndex: number,
  ) => Promise<R>,
  commit: (results: { displayedRegionIndex: number; result: R }[]) => void,
) {
  // #region rawFetchRegions
  await fetchRegionsBatched(self, needed, {
    call: async (regions, ctx) => {
      // The CDS-frame annotation overlay (when configured) fetches in the same
      // stop-token-guarded pass as the main data so the two share staleness +
      // loadedRegions book-keeping; the two RPCs run concurrently.
      //
      // Concurrently, and each is itself a per-region fan-out, so they get a
      // slot apiece rather than the shared callback: two fan-outs writing one
      // status field directly is last-writer-wins between them, and the
      // annotation branch's rows are a small fraction of the alignment's.
      const slot = createStatusFanOut(ctx.statusCallback)
      const [results] = await Promise.all([
        callEachRegion(regions, { ...ctx, statusCallback: slot() }, call),
        fetchAnnotationData(self, regions, { ...ctx, statusCallback: slot() }),
      ])
      return results
    },
    commit: results => {
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
 * Whether the frames read for `needed` is over budget, measured against the
 * `annotationAdapter` itself.
 *
 * The display's byte gate measures exactly one file — `byteGateAdapterConfig`,
 * the alignment or the summary depending on the tier — and `mafFrames` is a
 * third, fetched concurrently with whichever of those won. So nothing was
 * watching it, which is the premise `measuresBytesPreFlight`'s own docstring
 * rejects in as many words: "off means nothing is watching, and 'this tier is
 * cheap' is a premise, not a bound." It is not cheap at every zoom — the file is
 * one record per CDS exon **per species**, so on a deep alignment the read grows
 * with the span times the species count, exactly like the alignment the gate
 * does watch, and the summary tier carries it out to whole-genome spans.
 *
 * Measured here rather than through `byteGateBlocksFetch` because that one owns
 * the *banner*: it stamps `byteEstimate`, which is the number the too-large
 * message quotes, and quoting the frames file's cost for a track whose alignment
 * loaded fine would be a banner about the wrong download. This is a private
 * bound on an auxiliary overlay, so it reports nothing and simply declines.
 *
 * `undefined` bytes means unmeasurable (an adapter quoting no index estimate),
 * which keeps the byte axis out of the verdict here exactly as it does there.
 */
async function framesReadOverBudget(
  self: MafFetchSelf,
  needed: Needed,
  adapterConfig: Record<string, unknown>,
  ctx: FetchContext,
) {
  // undefined is the gate declining to act at all — force-load exempts the
  // track on every axis, so one click covers this read too rather than leaving
  // the overlay mysteriously off
  const limit = self.resolvedByteLimit()
  if (limit === undefined) {
    return false
  }
  // Through the envelope, which carries the stop token: an estimate off a tabix
  // index is a set of range reads, and this one runs on the fetch's critical
  // path — the frames read waits on it — so a cancelled fetch must not go on
  // measuring a file it will not download.
  //
  // A silent context, though: this reports nothing on purpose, for the same
  // reason it does not stamp `byteEstimate` — the phase belongs to an auxiliary
  // overlay and would be narrating over the alignment's own progress.
  const silent = { ...ctx, statusCallback: () => {} }
  const bytes = await silent.callRpc('CoreGetRegionByteEstimate', {
    regions: needed.map(n => n.region),
    adapterConfig,
    // same budget as the main gate, so the same scope
    scope: 'largestRegion',
  })
  return !ctx.isStale() && overByteBudget(bytes, limit)
}

/**
 * Fetch per-species CDS frame rows (UCSC `mafFrames`) for the buffered regions
 * from the MAF adapter's `annotationAdapter` sub-adapter, in parallel with the
 * main alignment/summary fetch and under its stop token. No-op when no adapter is
 * configured or neither the frame strip nor the codon view is on, so tracks
 * without frames pay nothing. Stale writes are skipped by `ctx.isStale()`.
 *
 * Fails soft: the overlay is auxiliary, so a frames-file error is logged but
 * swallowed rather than rejecting the combined fetch and blanking the alignment.
 * An over-budget read takes that same soft path — the overlay is the only thing
 * that goes missing — but it is *reported*, through `framesGateBlocked`, so the
 * menu can say why the strip stopped drawing instead of leaving it silently off.
 */
async function fetchAnnotationData(
  self: MafFetchSelf,
  needed: Needed,
  ctx: FetchContext,
) {
  const adapterConfig = self.annotationAdapterConfig
  if (!self.annotationDataActive || !adapterConfig) {
    return
  }
  try {
    if (await framesReadOverBudget(self, needed, adapterConfig, ctx)) {
      if (!ctx.isStale()) {
        self.setFramesGateBlocked(true)
      }
      return
    }
    const results = await callEachRegion(needed, ctx, (region, regionCtx) =>
      regionCtx.callRpc('LinearMafGetAnnotationData', {
        adapterConfig,
        regions: [region],
      }),
    )
    if (!ctx.isStale()) {
      self.setFramesGateBlocked(false)
      for (const { displayedRegionIndex, result } of results) {
        self.setFramesData(displayedRegionIndex, result.records)
      }
    }
  } catch (e) {
    if (!ctx.isStale()) {
      console.error('MAF CDS-frame annotation fetch failed', e)
    }
  }
}

export function fetchMafAlignmentData(self: MafFetchSelf, needed: Needed) {
  return fetchMafRegions(
    self,
    needed,
    (region, ctx) =>
      ctx.callRpc('LinearMafGetAlignmentData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
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
export function fetchMafSummaryData(self: MafFetchSelf, needed: Needed) {
  return fetchMafRegions(
    self,
    needed,
    (region, ctx) =>
      ctx.callRpc('LinearMafGetSummaryData', {
        adapterConfig: self.adapterConfig,
        regions: [region],
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
