import { TwoBitFile } from '@gmod/twobit'
import {
  BaseSequenceAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  downloadPhase,
  fetchAndMaybeUnzipText,
  updateStatus,
} from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { parseChromSizes, refSizesToRegions } from '../chromSizesUtils.ts'
import { sequenceFeatures } from '../sequenceFeatures.ts'

import type { TwoBitAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class TwoBitAdapter extends BaseSequenceAdapter<TwoBitAdapterConfig> {
  // No `label`: `initChromSizes` narrates its own download.
  setup = cachedSetup({ setup: opts => this.setupPre(opts) })

  private sizesPhase() {
    return downloadPhase(
      'Downloading chromosome sizes',
      this.getConf('twoBitLocation'),
    )
  }

  private async initChromSizes(opts?: BaseOptions) {
    const conf = this.getConf('chromSizesLocation')
    if (conf) {
      // not readFile('utf8'), which reports no byte progress
      return parseChromSizes(
        await fetchAndMaybeUnzipText(
          openLocation(conf, this.pluginManager),
          opts,
          'Downloading chromosome sizes',
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
    return refSizesToRegions(
      chromSizesData ??
        (await updateStatus(this.sizesPhase(), opts?.statusCallback, () =>
          twobit.getSequenceSizes(),
        )),
    )
  }

  public getFeatures(region: NoAssemblyRegion, opts?: BaseOptions) {
    return sequenceFeatures(
      region,
      opts,
      async () => (await this.setup(opts)).twobit,
    )
  }
}
