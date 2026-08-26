import { HicFile, NO_DATA_FOR_RESOLUTION } from '@gmod/hic'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  createProgressReporter,
  downloadStatus,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import type { ContactRecords, ProgressOpts } from '@gmod/hic'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

/**
 * One contiguous run of contacts belonging to a single region pair, as a
 * half-open `[start, end)` slice of the concatenated contact arrays.
 *
 * Region membership is a property of the *query*, not of a contact: every
 * contact a pair produces shares it. Carrying it as runs rather than two
 * more per-contact columns is what lets the consumer hoist all the
 * pair-invariant layout terms out of its inner loop — see
 * `executeRenderHicData`.
 *
 * The runs tile `[0, numContacts)` in order. They are not guaranteed unique
 * per pair, only contiguous, so consumers must iterate them rather than index
 * by pair.
 */
export interface RegionPairRun {
  region1Idx: number
  region2Idx: number
  start: number
  end: number
}

/**
 * A whole multi-region matrix as three parallel typed arrays plus the run
 * table describing which region pair each stretch came from.
 *
 * `bin1`/`bin2` are `Uint32Array` rather than the `Int32Array` `@gmod/hic`
 * decodes into because these are the arrays that transfer to the main thread
 * and feed the hover index unchanged — bins are non-negative chromosome
 * indices, so the reinterpretation is exact.
 */
export interface MultiRegionContacts {
  bin1: Uint32Array
  bin2: Uint32Array
  counts: Float32Array
  pairs: RegionPairRun[]
  numContacts: number
  resolution: number
  appliedNormalization: string
}

/**
 * What `RenderHicData` needs of the adapter behind a `HicTrack`, which is one
 * method. Structural rather than `HicAdapter` itself because a second adapter
 * serves the same display from a different source — `AlignmentsContactAdapter`
 * computes the matrix from a BAM/CRAM rather than reading a `.hic` file.
 */
export interface ContactAdapter {
  getMultiRegionContactRecords: (
    regions: Region[],
    opts: HicContactOptions,
  ) => Promise<MultiRegionContacts>
  /**
   * `BaseAdapter`'s, optional here because only an adapter reading alignments
   * has anything to decode against a reference. The RPC primes it either way.
   */
  setSequenceAdapterConfig?: (config?: Record<string, unknown>) => void
}

interface HicMetadata {
  chromosomes: {
    name: string
    size: number
    index: number
  }[]
  resolutions: number[]
}
interface Ref {
  chr: string
  start: number
  end: number
}

export interface HicContactOptions extends BaseOptions {
  // Caller is responsible for picking a binsize from `metadata.resolutions`
  // (the model's `effectiveResolution` getter does this); the adapter trusts
  // that value rather than re-running its own auto-pick.
  resolution: number
  normalization?: string
}

interface HicParser {
  getContactRecords: (
    normalize: string,
    ref: Ref,
    ref2: Ref,
    units: string,
    binsize: number,
    opts?: ProgressOpts,
  ) => Promise<{
    records: ContactRecords
    appliedNormalization: string
    transposed: boolean
  }>
  getMetaData: () => Promise<HicMetadata>
  getNormalizationOptions: (opts?: ProgressOpts) => Promise<string[]>
}

export default class HicAdapter extends BaseFeatureDataAdapter {
  private hic: HicParser
  private metadataP: Promise<HicMetadata> | undefined

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.hic = new HicFile({
      filehandle: openLocation(this.getConf('hicLocation'), this.pluginManager),
    })
  }

  private async setup(opts?: BaseOptions) {
    const { statusCallback, stopToken } = opts ?? {}
    // Only surface the "Downloading header" status on the genuine first
    // fetch: `@gmod/hic` memoizes the parsed header, so every later call (e.g. on
    // each zoom-level change) resolves from memory and shouldn't re-flash a
    // download message for work that isn't happening. Memoize the promise, and
    // clear it on failure (like hicFile's initPromise) so a failed load retries
    // rather than caching a rejected promise forever.
    this.metadataP ??= updateStatus(
      'Downloading header',
      statusCallback,
      () => this.hic.getMetaData(),
      stopToken,
    ).catch((e: unknown) => {
      this.metadataP = undefined
      throw e
    })
    return this.metadataP
  }

  public async getHeader(opts?: BaseOptions) {
    const { statusCallback, stopToken } = opts ?? {}
    const { resolutions } = await this.setup(opts)
    // Its own phase, and not folded into `setup`'s: on a v8 file with no
    // recorded index position this walks the whole normalized-expected-values
    // section with a chain of sequential range reads, which is the slowest part
    // of opening a `.hic` and the part that used to sit under a bare "Loading".
    // `@gmod/hic` counts the walk in expected-value chunks — one per
    // (normalization type, binsize), known before the first read — so this is a
    // bar rather than the spinner it was. `downloadStatus` is the same
    // composition the byte-counting adapters use; the unit is whatever the
    // reader counts.
    const norms = await downloadStatus(
      'Reading normalization index',
      statusCallback,
      onProgress => this.hic.getNormalizationOptions({ onProgress }),
      stopToken,
    )
    return { norms, resolutions }
  }

  async getRefNames(opts?: BaseOptions) {
    const metadata = await this.setup(opts)
    return metadata.chromosomes.map(chr => chr.name)
  }

  /**
   * Hi-C is not a per-region feature stream — the display fetches contact
   * matrices via `getMultiRegionContactRecords`. This method exists only to
   * satisfy the abstract `BaseFeatureDataAdapter` contract.
   */
  getFeatures(_region: Region, _opts?: BaseOptions) {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }

  async getMultiRegionContactRecords(
    regions: Region[],
    opts: HicContactOptions,
  ): Promise<MultiRegionContacts> {
    const {
      resolution: res,
      normalization = 'KR',
      statusCallback,
      stopToken,
    } = opts

    const metadata = await this.setup(opts)
    if (!metadata.resolutions.includes(res)) {
      throw new Error(
        `HicAdapter: requested binsize ${res} is not in the .hic file (available: ${metadata.resolutions.join(', ')})`,
      )
    }

    // Downgraded to whatever a pair actually got if any pair fell back, so the
    // display never claims a normalization only some of the matrix received —
    // vectors are stored per (type, chr, unit, binsize), so partial coverage is
    // a real state, not a theoretical one.
    let appliedNormalization = normalization

    // One entry per non-empty pair, holding that pair's own decode buffers. The
    // pair count is O(regions²) — tiny — so this is a handful of objects, not
    // per-contact overhead, and it buys the exact total needed to size the
    // concatenated arrays without a second pass over the data.
    const perPair: {
      region1Idx: number
      region2Idx: number
      recs: ContactRecords
    }[] = []
    let numContacts = 0

    // Every (i, j) with i <= j, in the order the run table has to end up in.
    const pairIndices: [number, number][] = []
    for (let i = 0; i < regions.length; i++) {
      for (let j = i; j < regions.length; j++) {
        pairIndices.push([i, j])
      }
    }
    const fetched = new Array<
      { recs: ContactRecords; appliedNormalization: string } | undefined
    >(pairIndices.length)

    // One spelling for the two writers of this phase — `updateStatus` announces
    // it, the reporter's ticks upgrade it to a bar — because two labels that
    // drift apart read to `aggregateStatus` as two phases rather than one.
    const downloadPhase = 'Downloading data'
    await updateStatus(
      downloadPhase,
      statusCallback,
      async () => {
        // Pairs run concurrently, bounded. Each is an independent chain of range
        // reads and the loop is latency-bound, not CPU-bound: measured against a
        // filehandle with 8ms added per read, six pairs spent 168ms of a 219ms
        // wall clock simply waiting, and the pair count is O(regions²) — a
        // whole-genome view over 25 chromosomes is 325 of these round trips end
        // to end.
        //
        // Bounded rather than an unbounded `Promise.all` because the block
        // cache is sized against the pairs a fetch runs at once: letting every
        // pair read at once would put more blocks in flight than the cache holds
        // and evict a fetch's own earlier reads before it finished.
        const CONCURRENCY = 6
        // Pairs are the denominator and blocks move the numerator: a pair
        // counts as the fraction of its own blocks that have landed.
        //
        // Blocks alone would be the finer measure and cannot be the total —
        // a pair's block count is only known once that pair has read its block
        // index, so a Σblocks denominator would describe the pairs that have
        // started rather than the fetch, and sit near complete for the whole
        // sweep while it grew. The pair count is the one total known before any
        // read. Pairs hold unequal numbers of blocks, so this weights them all
        // alike; what it buys is that the bar moves *within* a pair, which is
        // the whole of a single-region fetch and 1/325th of a whole-genome one.
        //
        // No stop token on the reporter: it would only add a throttled check
        // beside the exact per-pair one below.
        const report = createProgressReporter({
          label: downloadPhase,
          total: pairIndices.length,
          statusCallback,
        })
        // Each pair's own share, so a tick can replace what that pair last
        // contributed instead of the sum having to be retaken over all of them.
        const pairShare = new Float64Array(pairIndices.length)
        let progress = 0
        const advance = (at: number, share: number) => {
          progress += share - pairShare[at]!
          pairShare[at] = share
          report(progress)
        }
        let next = 0
        const worker = async () => {
          while (next < pairIndices.length) {
            const at = next++
            const [i, j] = pairIndices[at]!
            // Cancel point per pair, as before. In flight work still finishes,
            // but nothing new is started — the same granularity the serial loop
            // had, since a pair's own reads were never interruptible either.
            checkStopToken(stopToken)
            fetched[at] = await this.fetchRegionPairRecords({
              region1: regions[i]!,
              region2: regions[j]!,
              normalization,
              resolution: res,
              onProgress: (current, total) => {
                advance(at, current / total)
              },
            })
            // Whole, however few blocks it reported — a pair the file has no
            // matrix for reads nothing and would otherwise hold its share at
            // zero for the rest of the fetch.
            advance(at, 1)
          }
        }
        await Promise.all(
          Array.from(
            { length: Math.min(CONCURRENCY, pairIndices.length) },
            () => worker(),
          ),
        )
      },
      stopToken,
    )

    // Collected in (i, j) order regardless of the order they completed in, so
    // the run table below tiles `[0, numContacts)` the way every consumer
    // assumes — contacts arriving out of order would still be internally
    // consistent, but the layout would change run to run.
    for (const [at, [i, j]] of pairIndices.entries()) {
      const pair = fetched[at]
      if (pair === undefined || pair.recs.bin1.length === 0) {
        continue
      }
      // Only a pair that contributed contacts gets to downgrade this. An empty
      // pair reports NONE whenever the file has no vector for one of its
      // chromosomes at this binsize — routine for the small scaffolds and
      // inter-chromosomal pairs a multi-region view sweeps up — and letting it
      // speak ticked NONE in the track menu while every contact on screen was in
      // fact KR-normalized.
      if (pair.appliedNormalization !== normalization) {
        appliedNormalization = pair.appliedNormalization
      }
      perPair.push({ region1Idx: i, region2Idx: j, recs: pair.recs })
      numContacts += pair.recs.bin1.length
    }

    // Exact-size allocation, then one `set` (a memcpy) per pair. Sizing exactly
    // matters beyond tidiness: these buffers are transferred to the main thread
    // whole, so an oversized parent buffer would ship the slack too.
    const bin1 = new Uint32Array(numContacts)
    const bin2 = new Uint32Array(numContacts)
    const counts = new Float32Array(numContacts)
    const pairs: RegionPairRun[] = []
    let at = 0
    for (const { region1Idx, region2Idx, recs } of perPair) {
      bin1.set(recs.bin1, at)
      bin2.set(recs.bin2, at)
      counts.set(recs.counts, at)
      const end = at + recs.bin1.length
      pairs.push({ region1Idx, region2Idx, start: at, end })
      at = end
    }

    return {
      bin1,
      bin2,
      counts,
      pairs,
      numContacts,
      resolution: res,
      appliedNormalization,
    }
  }

  /**
   * Fetch one region pair's contacts, un-swapping the parser's transpose so
   * `bin1` always maps back to `region1`'s coordinates.
   *
   * The un-swap is a swap of the two array references, not per-contact work:
   * the transpose applies uniformly to everything the pair returned.
   *
   * Returns `undefined` (contributing nothing) for a pair the file has no data
   * for at this resolution rather than throwing: inter-chromosomal pairs
   * commonly only carry coarse binsizes, so when several regions are displayed
   * the fine auto-picked resolution that intra-chromosomal pairs use can be
   * absent for the inter-chromosomal pairs (`@gmod/hic` throws in that case).
   * Isolating each pair keeps one missing matrix from failing the whole
   * multi-region fetch.
   */
  private async fetchRegionPairRecords({
    region1,
    region2,
    normalization,
    resolution,
    onProgress,
  }: {
    region1: Region
    region2: Region
    normalization: string
    resolution: number
    onProgress: (current: number, total: number) => void
  }): Promise<
    { recs: ContactRecords; appliedNormalization: string } | undefined
  > {
    try {
      // `@gmod/hic` transposes the query when idx1 > idx2 (or same chr, region1
      // starts after region2), swapping bin1/bin2 relative to our (i, j) order —
      // un-swap before storing. `transposed` comes back from the query that made
      // the decision rather than being re-derived here off the region pair: the
      // condition is over the parser's own alias table and chromosome indices, so
      // a second derivation could disagree on a refName the file serves under a
      // different name and un-swap the wrong axis.
      const { records, appliedNormalization, transposed } =
        await this.hic.getContactRecords(
          normalization,
          { chr: region1.refName, start: region1.start, end: region1.end },
          { chr: region2.refName, start: region2.start, end: region2.end },
          'BP',
          resolution,
          { onProgress },
        )
      return {
        recs: transposed
          ? { bin1: records.bin2, bin2: records.bin1, counts: records.counts }
          : records,
        appliedNormalization,
      }
    } catch (e) {
      if (`${e}`.includes(NO_DATA_FOR_RESOLUTION)) {
        return undefined
      }
      throw e
    }
  }
}
