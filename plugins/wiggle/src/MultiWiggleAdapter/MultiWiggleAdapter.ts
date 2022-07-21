import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { SimpleFeature, Feature } from '@jbrowse/core/util'
import { merge } from 'rxjs'
import { map } from 'rxjs/operators'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

interface WiggleOptions extends BaseOptions {
  resolution?: number
}

interface BigWigEntry {
  uri: string
  color?: string
  name?: string
}

function getFilename(uri: string) {
  const filename = uri.slice(uri.lastIndexOf('/') + 1)
  return filename.slice(0, filename.lastIndexOf('.'))
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
    let subConfs = this.getConf('subadapters') as AnyConfigurationModel[]
    if (!subConfs?.length) {
      const entries = this.getConf('bigWigs')
      subConfs = entries.map((entry: string | BigWigEntry) => {
        if (typeof entry === 'string') {
          return {
            type: 'BigWigAdapter',
            source: getFilename(entry),
            bigWigLocation: {
              uri: entry,
            },
          }
        } else {
          const { uri, ...rest } = entry
          return {
            type: 'BigWigAdapter',
            ...rest,
            source: rest.name || getFilename(uri),
            bigWigLocation: {
              uri,
            },
          }
        }
      })
    }

    return Promise.all(
      subConfs.map(async (c, i) => {
        const adapter = await getSubAdapter(c)
        return {
          ...subConfs[i],
          source: subConfs[i].source,
          dataAdapter: adapter.dataAdapter,
        } as {
          source: string
          dataAdapter: BaseFeatureDataAdapter
          [key: string]: unknown
        }
      }),
    )
  }

  // note: can't really have dis-agreeing refNames
  public async getRefNames(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    return adapters[0].dataAdapter.getRefNames(opts)
  }

  public async getGlobalStats(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    const stats = (
      await Promise.all(
        // @ts-ignore
        adapters.map(adp => adp.dataAdapter.getGlobalStats?.(opts)),
      )
    ).filter(f => !!f)
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
  // something, but it is static for this particular multi-wiggle adapter type
  async getSources() {
    const adapters = await this.getAdapters()
    return adapters.map(({ dataAdapter, source, ...rest }) => ({
      name: source,
      ...rest,
    }))
  }

  public freeResources(): void {}
}
