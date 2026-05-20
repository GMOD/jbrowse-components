import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { merge } from 'rxjs'
import { map } from 'rxjs/operators'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

interface MultiBedOptions extends BaseOptions {
  sources?: { name: string }[]
}

interface AdapterConfig {
  type?: string
  source?: string
  name?: string
  color?: string
  [key: string]: unknown
}

interface AdapterEntry {
  dataAdapter: BaseFeatureDataAdapter
  source: string
  color?: string
  [key: string]: unknown
}

export default class MultiBedAdapter extends BaseFeatureDataAdapter {
  private adaptersP?: Promise<AdapterEntry[]>

  public async getAdapters(): Promise<AdapterEntry[]> {
    this.adaptersP ??= this.getAdaptersImpl()
    return this.adaptersP
  }

  private async getAdaptersImpl(): Promise<AdapterEntry[]> {
    const getSubAdapter = this.getSubAdapter
    if (!getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    const subConfs = this.getConf('subadapters') as AdapterConfig[]
    return Promise.all(
      subConfs.map(async conf => {
        const dataAdapter = (await getSubAdapter(conf))
          .dataAdapter as BaseFeatureDataAdapter
        const source = conf.source || conf.name || dataAdapter.id
        return {
          ...conf,
          dataAdapter,
          source,
        }
      }),
    )
  }

  public async getRefNames(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    const allNames = await Promise.all(
      adapters.map(a => a.dataAdapter.getRefNames(opts)),
    )
    return [...new Set(allNames.flat())]
  }

  private async getFilteredAdapters(sources?: { name: string }[]) {
    const adapters = await this.getAdapters()
    if (!sources?.length) {
      return adapters
    }
    const sourceNames = new Set(sources.map(s => s.name))
    return adapters.filter(adp => sourceNames.has(adp.source))
  }

  public getFeatures(region: Region, opts: MultiBedOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const adapters = await this.getFilteredAdapters(opts.sources)
      merge(
        ...adapters.map(adp => {
          const { source, dataAdapter } = adp
          return dataAdapter.getFeatures(region, opts).pipe(
            map(f => {
              if (f.get('source')) {
                return f
              }
              const data = f.toJSON()
              data.uniqueId = `${source}-${f.id()}`
              data.source = source
              return new SimpleFeature(data)
            }),
          )
        }),
      ).subscribe(observer)
    }, opts.stopToken)
  }

  async getSources(_regions: Region[]) {
    const adapters = await this.getAdapters()
    return adapters.map(({ type: _t, dataAdapter: _da, ...rest }) => ({
      ...rest,
      name: rest.source,
    }))
  }
}
