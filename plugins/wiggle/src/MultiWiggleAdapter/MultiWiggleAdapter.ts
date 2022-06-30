import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { SimpleFeature, Feature } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { merge } from 'rxjs'
import { map } from 'rxjs/operators'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

interface WiggleOptions extends BaseOptions {
  resolution?: number
}

export default class MultiWiggleAdapter extends BaseFeatureDataAdapter {
  public static capabilities = [
    'hasResolution',
    'hasLocalStats',
    'hasGlobalStats',
  ]

  public async getAdapters() {
    const getSubAdapter = this.getSubAdapter
    if (!getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    const subConfs = this.getConf('subadapters') as AnyConfigurationModel[]
    return Promise.all(
      subConfs.map(async c => {
        const adapter = await getSubAdapter(c)
        return {
          dataAdapter: adapter.dataAdapter as BaseFeatureDataAdapter,
          source: c.source as string,
        }
      }),
    )
  }

  public async getRefNames(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    return adapters[0].dataAdapter.getRefNames(opts)
  }

  public async getGlobalStats(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    // @ts-ignore
    const stats = adapters.map(adp => adp.dataAdapter.getGlobalStats?.(opts))
    const scoreMin = Math.min(...stats.map(s => s.scoreMin))
    const scoreMax = Math.max(...stats.map(s => s.scoreMax))
    return { scoreMin, scoreMax }
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const adapters = await this.getAdapters()
      merge(
        ...adapters.map(adp =>
          adp.dataAdapter.getFeatures(region, opts).pipe(
            map(p =>
              // add source field if it does not exist
              p.get('source')
                ? p
                : new SimpleFeature({
                    ...p.toJSON(),
                    uniqueId: adp.source + '-' + p.id(),
                    source: adp.source,
                  }),
            ),
          ),
        ),
      ).subscribe(observer)
    }, opts.signal)
  }

  // always render bigwig instead of calculating a feature density for it
  async estimateRegionsStats(_regions: Region[]) {
    return { featureDensity: 0 }
  }

  // in another adapter type, this could be dynamic depending on region or
  // something, but it is static depending on config here
  async getSources() {
    const subConfs = this.getConf('subadapters') as AnyConfigurationModel[]
    return subConfs.map(conf => readConfObject(conf, 'source'))
  }

  public freeResources(): void {}
}
