import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { openHicFilehandle } from './HicFilehandle.ts'
import HicStraw from './hic-straw/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

interface ContactRecord {
  bin1: number
  bin2: number
  counts: number
}

export interface MultiRegionContactRecord {
  bin1: number
  bin2: number
  counts: number
  region1Idx: number
  region2Idx: number
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
  ) => Promise<ContactRecord[]>
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
  ): Promise<{ records: MultiRegionContactRecord[]; resolution: number }> {
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

    const allRecords: MultiRegionContactRecord[] = []

    // Resolve each region's file chromosome index once (O(n)) rather than
    // re-deriving it inside every region pair (O(n²)) — it's fixed per region
    // and drives the transpose un-swap in getRegionPairRecords.
    const regionChrIdxs = await Promise.all(
      regions.map(r => this.hic.getChromosomeIndex(r.refName)),
    )

    await updateStatus(
      'Downloading data',
      statusCallback,
      async () => {
        for (let i = 0; i < regions.length; i++) {
          for (let j = i; j < regions.length; j++) {
            // cancel point between region pairs so a multi-region fetch can be
            // stopped part-way rather than running every pair to completion
            checkStopToken(stopToken)
            const pairRecords = await this.getRegionPairRecords({
              region1: regions[i]!,
              region2: regions[j]!,
              region1Idx: i,
              region2Idx: j,
              chr1Idx: regionChrIdxs[i],
              chr2Idx: regionChrIdxs[j],
              normalization,
              resolution: res,
            })
            // Push element-wise (not `push(...spread)`) so a large pair can't
            // overflow the call-stack argument limit.
            for (const rec of pairRecords) {
              allRecords.push(rec)
            }
          }
        }
      },
      stopToken,
    )

    return { records: allRecords, resolution: res }
  }

  /**
   * Fetch contacts for one region pair, un-swapping hic-straw's transpose so
   * `bin1` always maps back to `region1`'s coordinates.
   *
   * Returns `[]` for a pair the file has no data for at this resolution rather
   * than throwing: inter-chromosomal pairs commonly only carry coarse
   * binsizes, so when several regions are displayed the fine auto-picked
   * resolution that intra-chromosomal pairs use can be absent for the
   * inter-chromosomal pairs (hic-straw throws in that case). Isolating each
   * pair keeps one missing matrix from failing the whole multi-region fetch.
   */
  private async getRegionPairRecords({
    region1,
    region2,
    region1Idx,
    region2Idx,
    chr1Idx,
    chr2Idx,
    normalization,
    resolution,
  }: {
    region1: Region
    region2: Region
    region1Idx: number
    region2Idx: number
    chr1Idx: number | undefined
    chr2Idx: number | undefined
    normalization: string
    resolution: number
  }): Promise<MultiRegionContactRecord[]> {
    try {
      const records = await this.hic.getContactRecords(
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
      return records.map(({ bin1, bin2, counts }) => ({
        bin1: transposed ? bin2 : bin1,
        bin2: transposed ? bin1 : bin2,
        counts,
        region1Idx,
        region2Idx,
      }))
    } catch (e) {
      if (`${e}`.includes('No data available for resolution')) {
        return []
      }
      throw e
    }
  }

  // hic is binned at screen resolution like bigwig, so it's never too large to
  // render — skip the density/byte estimate
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      alwaysRender: true,
    }
  }
}
