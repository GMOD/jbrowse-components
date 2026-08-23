import { TwoBitFile } from '@gmod/twobit'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  downloadPhase,
  fetchAndMaybeUnzipText,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import {
  isPlaceholderLocation,
  parseChromSizes,
  refSizesToRegions,
} from '../chromSizesUtils.ts'
import { sequenceFeatures } from '../sequenceFeatures.ts'

import type { TwoBitAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class TwoBitAdapter extends BaseSequenceAdapter<TwoBitAdapterConfig> {
  protected setupP?: Promise<{
    twobit: TwoBitFile
    chromSizesData: Record<string, number> | undefined
  }>

  // @gmod/twobit does its own reads, so the phase can't be handed the URL by
  // the fetch: it comes off the config the filehandle was opened from
  private sizesPhase() {
    return downloadPhase(
      'Downloading chromosome sizes',
      this.getConf('twoBitLocation'),
    )
  }

  private async initChromSizes(opts?: BaseOptions) {
    const conf = this.getConf('chromSizesLocation')
    if (!isPlaceholderLocation(conf, '/path/to/default.chrom.sizes')) {
      // fetchAndMaybeUnzipText rather than readFile('utf8') so the read reports
      // byte progress (readFile's utf8 path takes res.text(), which can't)
      return parseChromSizes(
        await fetchAndMaybeUnzipText(
          openLocation(conf, this.pluginManager),
          opts,
          downloadPhase('Downloading chromosome sizes', conf),
        ),
      )
    }
    return undefined
  }

  async setupPre(opts?: BaseOptions) {
    return {
      twobit: new TwoBitFile({
        filehandle: openLocation(
          this.getConf('twoBitLocation'),
          this.pluginManager,
        ),
      }),
      chromSizesData: await this.initChromSizes(opts),
    }
  }
  async setup(opts?: BaseOptions) {
    this.setupP ??= this.setupPre(opts).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  public async getRefNames(opts?: BaseOptions) {
    const { chromSizesData, twobit } = await this.setup(opts)
    return chromSizesData
      ? Object.keys(chromSizesData)
      : updateStatus(this.sizesPhase(), opts?.statusCallback, () =>
          twobit.getSequenceNames(),
        )
  }

  public async getRegions(opts?: BaseOptions) {
    const { chromSizesData, twobit } = await this.setup(opts)
    // without a chrom.sizes sidecar the sizes come from the 2bit's own header +
    // per-sequence records, which is the wait an assembly load sits in here
    return refSizesToRegions(
      chromSizesData ??
        (await updateStatus(this.sizesPhase(), opts?.statusCallback, () =>
          twobit.getSequenceSizes(),
        )),
    )
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    return sequenceFeatures(
      region,
      opts,
      async () => (await this.setup(opts)).twobit,
    )
  }
}
