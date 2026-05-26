import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import HicStraw from 'hic-straw'

import { openHicFilehandle } from './HicFilehandle.ts'

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
  hicFile: {
    init: () => Promise<void>
    masterIndex: Record<string, { start: number; size: number }>
  }
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
    const { chromosomes, resolutions, ...rest } = await this.setup(opts)
    const norms = await this.hic.getNormalizationOptions()

    await this.hic.hicFile.init()
    const { masterIndex } = this.hic.hicFile
    const hasInterChromosomalData = Object.keys(masterIndex).some(key => {
      const [idx1, idx2] = key.split('_')
      return idx1 !== idx2
    })

    return { ...rest, norms, resolutions, hasInterChromosomalData }
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

    // hic-straw transposes queries when idx(chr1) > idx(chr2), returning
    // bin1/bin2 in the swapped order. We mirror that logic so bin1 always
    // maps back to region[i] coordinates.
    const chrIndexMap = new Map(
      metadata.chromosomes.map(c => [c.name, c.index]),
    )
    const getChrIndex = (refName: string) => {
      const direct = chrIndexMap.get(refName)
      if (direct !== undefined) {
        return direct
      }
      const alt = refName.startsWith('chr') ? refName.slice(3) : `chr${refName}`
      const altIdx = chrIndexMap.get(alt)
      if (altIdx === undefined) {
        throw new Error(`refName ${refName} not found in .hic file`)
      }
      return altIdx
    }

    const allRecords: MultiRegionContactRecord[] = []

    await updateStatus('Downloading .hic data', statusCallback, async () => {
      for (let i = 0; i < regions.length; i++) {
        for (let j = i; j < regions.length; j++) {
          const region1 = regions[i]!
          const region2 = regions[j]!

          const records = await this.hic.getContactRecords(
            normalization,
            { chr: region1.refName, start: region1.start, end: region1.end },
            { chr: region2.refName, start: region2.start, end: region2.end },
            'BP',
            res,
          )

          // hic-straw transposes the query when idx1 > idx2 (or same chr,
          // region1 starts after region2). In that case bin1/bin2 are swapped
          // relative to our (i, j) order, so we un-swap before storing.
          const idx1 = getChrIndex(region1.refName)
          const idx2 = getChrIndex(region2.refName)
          const transposed =
            idx1 > idx2 || (idx1 === idx2 && region1.start >= region2.end)

          for (const { bin1, bin2, counts } of records) {
            allRecords.push({
              bin1: transposed ? bin2 : bin1,
              bin2: transposed ? bin1 : bin2,
              counts,
              region1Idx: i,
              region2Idx: j,
            })
          }
        }
      }
    })

    return { records: allRecords, resolution: res }
  }

  // don't do feature stats estimation, similar to bigwigadapter
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      featureDensity: 0,
    }
  }
}
