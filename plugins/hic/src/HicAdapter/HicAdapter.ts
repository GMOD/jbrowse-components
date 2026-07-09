import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

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
    const { statusCallback = () => {} } = opts ?? {}
    return updateStatus('Downloading .hic header', statusCallback, () =>
      this.hic.getMetaData(),
    )
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
    } = opts

    const metadata = await this.setup(opts)
    if (!metadata.resolutions.includes(res)) {
      throw new Error(
        `HicAdapter: requested binsize ${res} is not in the .hic file (available: ${metadata.resolutions.join(', ')})`,
      )
    }

    const allRecords: MultiRegionContactRecord[] = []

    await updateStatus('Downloading .hic data', statusCallback, async () => {
      for (let i = 0; i < regions.length; i++) {
        for (let j = i; j < regions.length; j++) {
          const pairRecords = await this.getRegionPairRecords({
            region1: regions[i]!,
            region2: regions[j]!,
            region1Idx: i,
            region2Idx: j,
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
    })

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
    normalization,
    resolution,
  }: {
    region1: Region
    region2: Region
    region1Idx: number
    region2Idx: number
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
      // order — un-swap before storing. Resolve the indices through hic-straw's
      // own alias table so this condition matches its transpose exactly (a
      // divergent chr-name scheme could throw on a region it would have served).
      const idx1 = await this.hic.getChromosomeIndex(region1.refName)
      const idx2 = await this.hic.getChromosomeIndex(region2.refName)
      const transposed =
        idx1 !== undefined &&
        idx2 !== undefined &&
        (idx1 > idx2 || (idx1 === idx2 && region1.start >= region2.end))
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
