import { BigWig } from '@gmod/bbi'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { map, mergeAll } from 'rxjs/operators'
import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { rectifyStats, UnrectifiedFeatureStats } from '@jbrowse/core/util/stats'
import PluginManager from '@jbrowse/core/PluginManager'

import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

interface WiggleOptions extends BaseOptions {
  resolution?: number
}

export default class BigWigAdapter extends BaseFeatureDataAdapter {
  private bigwig: BigWig

  public static capabilities = [
    'hasResolution',
    'hasLocalStats',
    'hasGlobalStats',
  ]

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    this.bigwig = new BigWig({
      filehandle: openLocation(
        readConfObject(config, 'bigWigLocation'),
        this.pluginManager,
      ),
    })
  }

  private async setup(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading bigwig header', statusCallback, () =>
      this.bigwig.getHeader(opts),
    )
  }

  public async getRefNames(opts?: BaseOptions) {
    const { refsByName } = await this.setup(opts)
    return Object.keys(refsByName)
  }

  public async refIdToName(refId: number) {
    const { refsByNumber } = await this.setup()
    return refsByNumber[refId]?.name
  }

  public async getGlobalStats(opts?: BaseOptions) {
    const { totalSummary } = await this.setup(opts)
    return rectifyStats(totalSummary as UnrectifiedFeatureStats)
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    const { refName, start, end } = region
    const {
      bpPerPx = 0,
      signal,
      resolution = 1,
      statusCallback = () => {},
    } = opts
    return ObservableCreate<Feature>(async observer => {
      statusCallback('Downloading bigwig data')
      const ob = await this.bigwig.getFeatureStream(refName, start, end, {
        ...opts,
        basesPerSpan: bpPerPx / resolution,
      })
      ob.pipe(
        mergeAll(),
        map(record => {
          return new SimpleFeature({
            id: `${refName}:${record.start}-${record.end}`,
            data: { ...record, refName },
          })
        }),
      ).subscribe(observer)
    }, signal)
  }

  // always render bigwig instead of calculating a feature density for it
  async estimateRegionsStats(_regions: Region[]) {
    return { featureDensity: 0 }
  }

  public freeResources(): void {}
}
