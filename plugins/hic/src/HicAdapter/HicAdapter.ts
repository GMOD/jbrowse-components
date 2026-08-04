import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { openHicFilehandle } from './HicFilehandle.ts'
import HicStraw, { NO_DATA_FOR_RESOLUTION } from './hic-straw/index.ts'

import type { ContactRecords } from './hic-straw/contactRecords.ts'
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
 * `bin1`/`bin2` are `Uint32Array` rather than the `Int32Array` hic-straw
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

interface HicContactOptions extends BaseOptions {
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
  ) => Promise<{ records: ContactRecords; appliedNormalization: string }>
  getMetaData: () => Promise<HicMetadata>
  getNormalizationOptions: () => Promise<string[]>
  getChromosomeIndex: (chrAlias: string) => Promise<number | undefined>
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
    this.hic = new HicStraw({
      file: openHicFilehandle(this.getConf('hicLocation'), this.pluginManager),
    })
  }

  private async setup(opts?: BaseOptions) {
    const { statusCallback = () => {}, stopToken } = opts ?? {}
    // Only surface the "Downloading header" status on the genuine first
    // fetch: hic-straw memoizes the parsed header, so every later call (e.g. on
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
    const { resolutions } = await this.setup(opts)
    const norms = await this.hic.getNormalizationOptions()
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
      statusCallback = () => {},
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

    // Resolve each region's file chromosome index once (O(n)) rather than
    // re-deriving it inside every region pair (O(n²)) — it's fixed per region
    // and drives the transpose un-swap in fetchRegionPairRecords.
    const regionChrIdxs = await Promise.all(
      regions.map(r => this.hic.getChromosomeIndex(r.refName)),
    )

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

    await updateStatus(
      'Downloading data',
      statusCallback,
      async () => {
        for (let i = 0; i < regions.length; i++) {
          for (let j = i; j < regions.length; j++) {
            // cancel point between region pairs so a multi-region fetch can be
            // stopped part-way rather than running every pair to completion
            checkStopToken(stopToken)
            const pair = await this.fetchRegionPairRecords({
              region1: regions[i]!,
              region2: regions[j]!,
              chr1Idx: regionChrIdxs[i],
              chr2Idx: regionChrIdxs[j],
              normalization,
              resolution: res,
            })
            if (pair === undefined) {
              continue
            }
            if (pair.appliedNormalization !== normalization) {
              appliedNormalization = pair.appliedNormalization
            }
            if (pair.recs.bin1.length > 0) {
              perPair.push({ region1Idx: i, region2Idx: j, recs: pair.recs })
              numContacts += pair.recs.bin1.length
            }
          }
        }
      },
      stopToken,
    )

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
   * Fetch one region pair's contacts, un-swapping hic-straw's transpose so
   * `bin1` always maps back to `region1`'s coordinates.
   *
   * The un-swap is a swap of the two array references, not per-contact work:
   * the transpose applies uniformly to everything the pair returned.
   *
   * Returns `undefined` (contributing nothing) for a pair the file has no data
   * for at this resolution rather than throwing: inter-chromosomal pairs
   * commonly only carry coarse binsizes, so when several regions are displayed
   * the fine auto-picked resolution that intra-chromosomal pairs use can be
   * absent for the inter-chromosomal pairs (hic-straw throws in that case).
   * Isolating each pair keeps one missing matrix from failing the whole
   * multi-region fetch.
   */
  private async fetchRegionPairRecords({
    region1,
    region2,
    chr1Idx,
    chr2Idx,
    normalization,
    resolution,
  }: {
    region1: Region
    region2: Region
    chr1Idx: number | undefined
    chr2Idx: number | undefined
    normalization: string
    resolution: number
  }): Promise<
    { recs: ContactRecords; appliedNormalization: string } | undefined
  > {
    try {
      const { records, appliedNormalization } =
        await this.hic.getContactRecords(
          normalization,
          { chr: region1.refName, start: region1.start, end: region1.end },
          { chr: region2.refName, start: region2.start, end: region2.end },
          'BP',
          resolution,
        )
      // hic-straw transposes the query when idx1 > idx2 (or same chr, region1
      // starts after region2), swapping bin1/bin2 relative to our (i, j)
      // order — un-swap before storing. The indices come from hic-straw's own
      // alias table (resolved once per region by the caller) so this condition
      // matches its transpose exactly (a divergent chr-name scheme could throw
      // on a region it would have served).
      const transposed =
        chr1Idx !== undefined &&
        chr2Idx !== undefined &&
        (chr1Idx > chr2Idx ||
          (chr1Idx === chr2Idx && region1.start >= region2.end))
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
