import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { SimpleFeature, max, min } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { merge } from 'rxjs'
import { map } from 'rxjs/operators'

import type { WiggleAdapterOptions } from '../wiggleAdapterOptions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type {
  AugmentedRegion as Region,
  FileLocation,
} from '@jbrowse/core/util/types'

interface WiggleOptions extends WiggleAdapterOptions {
  staticBlocks?: Region[]
  sources?: { name: string }[]
}

function getFilename(uri: string) {
  const filename = uri.slice(uri.lastIndexOf('/') + 1)
  return filename.slice(0, filename.lastIndexOf('.'))
}

/**
 * Extract filename from a config, only works for BigWigAdapter
 * Could try to generalize across more adapter types potentially
 */
function getFilenameFromAdapterConfig(config: any) {
  try {
    // Handle BigWigAdapter specifically
    if (config.type === 'BigWigAdapter' && config.bigWigLocation) {
      const location = config.bigWigLocation as FileLocation
      if ('uri' in location && location.uri) {
        return getFilename(location.uri)
      }
      if ('localPath' in location && location.localPath) {
        return getFilename(location.localPath)
      }
      if ('blob' in location && location.blob) {
        const blob = location.blob as File
        return blob.name ? getFilename(blob.name) : undefined
      }
    }

    // Fallback for other adapter types or locations
    return undefined
  } catch (e) {
    return undefined
  }
}

interface AdapterEntry {
  dataAdapter: BaseFeatureDataAdapter
  source: string
  name: string
  [key: string]: unknown
}

type MaybeStats = { scoreMin: number; scoreMax: number } | undefined

export default class MultiWiggleAdapter extends BaseFeatureDataAdapter {
  public static capabilities = [
    'hasResolution',
    'hasLocalStats',
    'hasGlobalStats',
  ]

  private adaptersP?: Promise<AdapterEntry[]>

  public async getAdapters(): Promise<AdapterEntry[]> {
    if (!this.adaptersP) {
      this.adaptersP = this.getAdaptersImpl()
    }
    return this.adaptersP
  }

  private async getAdaptersImpl(): Promise<AdapterEntry[]> {
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

    // There was confusion about whether source or name was required, and
    // effort to remove one or the other was thwarted. Adapters like
    // BigWigAdapter, even in the BigWigAdapter configSchema.ts, use a 'source'
    // field though, while the word 'name' still allowed in the config too. To
    // solve, we made name===source
    return Promise.all(
      subConfs.map(async (conf: any) => {
        const dataAdapter = (await getSubAdapter(conf))
          .dataAdapter as BaseFeatureDataAdapter
        const source =
          conf.source ||
          conf.name ||
          getFilenameFromAdapterConfig(conf) ||
          dataAdapter.id
        return {
          ...conf,
          dataAdapter,
          source,
        }
      }),
    )
  }

  // note: can't really have dis-agreeing refNames
  public async getRefNames(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    const allNames = await Promise.all(
      adapters.map(a => a.dataAdapter.getRefNames(opts)),
    )
    return [...new Set(allNames.flat())]
  }

  public async getGlobalStats(opts?: BaseOptions) {
    const adapters = await this.getAdapters()
    const stats = (
      (await Promise.all(
        // @ts-expect-error
        adapters.map(adp => adp.dataAdapter.getGlobalStats?.(opts)),
      )) as MaybeStats[]
    ).filter(f => !!f)
    return {
      scoreMin: min(stats.map(s => s.scoreMin)),
      scoreMax: max(stats.map(s => s.scoreMax)),
    }
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      let adapters = await this.getAdapters()

      // Filter adapters if sources filter is provided (e.g., from subtree filter)
      if (opts.sources?.length) {
        const sourceNames = new Set(opts.sources.map(s => s.name))
        adapters = adapters.filter(adp => sourceNames.has(adp.source))
      }

      merge(
        ...adapters.map(adp => {
          const { source, dataAdapter } = adp
          return dataAdapter.getFeatures(region, opts).pipe(
            map(f => {
              // BigWigAdapter sets source, so avoid expensive wrapping when possible
              if (f.get('source')) {
                return f
              }
              // Fallback for adapters that don't set source
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

  public async getRegionQuantitativeStats(
    region: Region,
    opts?: WiggleOptions,
  ) {
    const adapters = await this.getAdapters()
    const allStats = await Promise.all(
      adapters.map(async adp => {
        const { dataAdapter } = adp
        return dataAdapter.getRegionQuantitativeStats(region, opts)
      }),
    )
    return aggregateQuantitativeStats(allStats.filter(Boolean))
  }

  // always render bigwig instead of calculating a feature density for it
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      featureDensity: 0,
    }
  }

  /**
   * Override to pass staticBlocks through to sub-adapters for caching.
   */
  async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts: WiggleOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }

    const adapters = await this.getAdapters()

    // Delegate to sub-adapters, passing staticBlocks through
    const allStats = await Promise.all(
      adapters.map(async adp => {
        const { dataAdapter } = adp
        return dataAdapter.getMultiRegionQuantitativeStats(regions, opts)
      }),
    )

    return aggregateQuantitativeStats(allStats.filter(Boolean))
  }

  // in another adapter type, this could be dynamic depending on region or
  // something, but it is static for this particular multi-wiggle adapter type
  async getSources(_regions: Region[]) {
    const adapters = await this.getAdapters()
    return adapters.map(({ type, bigWigLocation, dataAdapter, ...rest }) => {
      return {
        ...rest,
        name: rest.source,
      }
    })
  }
}
