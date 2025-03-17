import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, max, min, notEmpty } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import pLimit from 'p-limit'
import { map } from 'rxjs/operators'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

interface WiggleOptions extends BaseOptions {
  resolution?: number
}

function getFilename(uri: string) {
  const filename = uri.slice(uri.lastIndexOf('/') + 1)
  return filename.slice(0, filename.lastIndexOf('.'))
}

interface AdapterEntry {
  dataAdapter: BaseFeatureDataAdapter
  source: string
  [key: string]: unknown
}

type MaybeStats = { scoreMin: number; scoreMax: number } | undefined

export default class MultiWiggleAdapter extends BaseFeatureDataAdapter {
  public static capabilities = [
    'hasResolution',
    'hasLocalStats',
    'hasGlobalStats',
  ]

  public async getAdapters(): Promise<AdapterEntry[]> {
    const getSubAdapter = this.getSubAdapter
    if (!getSubAdapter) {
      throw new Error('no getSubAdapter available')
    }
    let subConfs = this.getConf('subadapters')
    if (!subConfs?.length) {
      const entries = this.getConf('bigWigs') as string[]
      subConfs = entries.map(entry => ({
        type: 'BigWigAdapter',
        source: getFilename(entry),
        bigWigLocation: {
          uri: entry,
        },
      }))
    }

    return Promise.all(
      subConfs.map(async (conf: any) => {
        const dataAdapter = (await getSubAdapter(conf))
          .dataAdapter as BaseFeatureDataAdapter
        return {
          source: conf.name || dataAdapter.id,
          ...conf,
          dataAdapter,
        }
      }),
    )
  }

  // note: can't really have dis-agreeing refNames
  public async getRefNames(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    const limit = pLimit(10)
    const allNames = await Promise.all(
      adapters.map(a => limit(() => a.dataAdapter.getRefNames(opts))),
    )
    return [...new Set(allNames.flat())]
  }

  public async getGlobalStats(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    const limit = pLimit(10)
    const stats = (
      (await Promise.all(
        // @ts-expect-error
        limit(() =>
          // @ts-expect-error
          adapters.map(adp => adp.dataAdapter.getGlobalStats?.(opts)),
        ),
      )) as MaybeStats[]
    ).filter(notEmpty)

    return {
      scoreMin: min(stats.map(s => s.scoreMin)),
      scoreMax: max(stats.map(s => s.scoreMax)),
    }
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    const limit = pLimit(10)
    return ObservableCreate<Feature>(async observer => {
      const adapters = await this.getAdapters()
      Promise.all(
        adapters.map(adp =>
          limit(
            () =>
              new Promise<void>((resolve, reject) => {
                adp.dataAdapter
                  .getFeatures(region, opts)
                  .pipe(
                    map(p =>
                      // add source field if it does not exist
                      p.get('source')
                        ? p
                        : new SimpleFeature({
                            ...p.toJSON(),
                            uniqueId: `${adp.source}-${p.id()}`,
                            source: adp.source,
                          }),
                    ),
                  )
                  .subscribe({
                    next: feature => {
                      observer.next(feature)
                    },
                    error: err => {
                      reject(err as Error)
                    },
                    complete: () => {
                      resolve()
                    },
                  })
              }),
          ),
        ),
      )
        .then(() => {
          observer.complete()
        })
        .catch((error: unknown) => {
          observer.error(error)
        })
    }, opts.stopToken)
  }

  // always render bigwig instead of calculating a feature density for it
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      featureDensity: 0,
    }
  }

  // in another adapter type, this could be dynamic depending on region or
  // something, but it is static for this particular multi-wiggle adapter type
  async getSources(_regions: Region[]) {
    const adapters = await this.getAdapters()
    return adapters.map(({ dataAdapter, source, name, ...rest }) => ({
      name: source,
      __name: name,
      ...rest,
    }))
  }
}
