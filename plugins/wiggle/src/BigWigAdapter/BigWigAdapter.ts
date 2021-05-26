import { BigWig, Feature as BBIFeature } from '@gmod/bbi'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { map, mergeAll } from 'rxjs/operators'
import { readConfObject } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import { rectifyStats, UnrectifiedFeatureStats } from '@jbrowse/core/util/stats'

import configSchema from './configSchema'

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

  public constructor(config: Instance<typeof configSchema>) {
    super(config)
    this.bigwig = new BigWig({
      filehandle: openLocation(readConfObject(config, 'bigWigLocation')),
    })
  }

  private async setup(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    statusCallback('Downloading bigwig header')
    const result = await this.bigwig.getHeader(opts)
    statusCallback('')
    return result
  }

  public async getRefNames(opts?: BaseOptions) {
    const header = await this.setup(opts)
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number) {
    const h = await this.setup()
    return (h.refsByNumber[refId] || { name: undefined }).name
  }

  public async getGlobalStats(opts?: BaseOptions) {
    const header = await this.setup(opts)
    return rectifyStats(header.totalSummary as UnrectifiedFeatureStats)
  }

  public getFeatures(region: NoAssemblyRegion, opts: WiggleOptions = {}) {
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
        map((record: BBIFeature) => {
          return new SimpleFeature({
            id: `${refName}:${record.start}-${record.end}`,
            data: { ...record, refName },
          })
        }),
      ).subscribe(observer)
    }, signal)
  }

  public freeResources(): void {}
}
const adapterCapabilities = BigWigAdapter.capabilities
export { adapterCapabilities }
