import { TwoBitFile } from '@gmod/twobit'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import {
  isPlaceholderLocation,
  parseChromSizes,
  refSizesToRegions,
} from '../chromSizesUtils.ts'

import type { TwoBitAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'

export default class TwoBitAdapter extends BaseSequenceAdapter<TwoBitAdapterConfig> {
  protected setupP?: Promise<{
    twobit: TwoBitFile
    chromSizesData: Record<string, number> | undefined
  }>

  private async initChromSizes(opts?: BaseOptions) {
    const conf = this.getConf('chromSizesLocation')
    if (!isPlaceholderLocation(conf, '/path/to/default.chrom.sizes')) {
      // fetchAndMaybeUnzipText rather than readFile('utf8') so the read reports
      // byte progress (readFile's utf8 path takes res.text(), which can't)
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
      : updateStatus('Downloading 2bit header', opts?.statusCallback, () =>
          twobit.getSequenceNames(),
        )
  }

  public async getRegions(opts?: BaseOptions) {
    const { chromSizesData, twobit } = await this.setup(opts)
    // without a chrom.sizes sidecar the sizes come from the 2bit's own header +
    // per-sequence records, which is the wait an assembly load sits in here
    return refSizesToRegions(
      chromSizesData ??
        (await updateStatus(
          'Downloading 2bit header',
          opts?.statusCallback,
          () => twobit.getSequenceSizes(),
        )),
    )
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(
    { refName, start, end }: NoAssemblyRegion,
    opts?: BaseOptions,
  ) {
    const { statusCallback = () => {}, stopToken } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      await updateStatus(
        'Downloading sequence',
        statusCallback,
        async () => {
          const { twobit } = await this.setup()
          const size = await twobit.getSequenceSize(refName)
          const regionEnd = size === undefined ? end : Math.min(size, end)
          const seq = await twobit.getSequence(refName, start, regionEnd)
          checkStopToken(stopToken)
          if (seq) {
            observer.next(
              new SimpleFeature({
                id: `${refName}-${start}-${regionEnd}`,
                data: { refName, start, end: regionEnd, seq },
              }),
            )
          }
        },
        stopToken,
      )
      observer.complete()
    })
  }
}
