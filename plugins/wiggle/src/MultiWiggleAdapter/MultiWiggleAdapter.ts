import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { firstValueFrom, merge } from 'rxjs'
import { map, toArray } from 'rxjs/operators'

import { featuresToRaw } from '../util.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { WiggleAdapterOptions } from '../wiggleAdapterOptions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type {
  AugmentedRegion as Region,
  FileLocation,
} from '@jbrowse/core/util/types'

interface WiggleOptions extends WiggleAdapterOptions {
  sources?: { name: string }[]
}

function getFilename(uri: string) {
  const filename = uri.slice(uri.lastIndexOf('/') + 1)
  const dotIdx = filename.lastIndexOf('.')
  return dotIdx !== -1 ? filename.slice(0, dotIdx) : filename
}

interface AdapterConfig {
  type?: string
  source?: string
  name?: string
  bigWigLocation?: FileLocation
  [key: string]: unknown
}

function getFilenameFromAdapterConfig(config: AdapterConfig) {
  if (config.type === 'BigWigAdapter' && config.bigWigLocation) {
    const location = config.bigWigLocation
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
  return undefined
}

interface AdapterEntry {
  dataAdapter: BaseFeatureDataAdapter
  source: string
  [key: string]: unknown
}

function hasFeatureArrays(
  adapter: BaseFeatureDataAdapter,
): adapter is BaseFeatureDataAdapter & {
  getFeatureArrays(
    region: Region,
    opts: WiggleOptions,
  ): Promise<RawFeatureArrays>
} {
  return 'getFeatureArrays' in adapter
}

export default class MultiWiggleAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['hasResolution', 'hasLocalStats']

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
      subConfs.map(async (conf: AdapterConfig) => {
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

  private async getFilteredAdapters(sources?: { name: string }[]) {
    const adapters = await this.getAdapters()
    if (!sources?.length) {
      return adapters
    }
    const sourceNames = new Set(sources.map(s => s.name))
    return adapters.filter(adp => sourceNames.has(adp.source))
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const adapters = await this.getFilteredAdapters(opts.sources)

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

  public async getMultiSourceFeatureArrays(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<{ source: string; raw: RawFeatureArrays }[]> {
    const adapters = await this.getFilteredAdapters(opts.sources)
    return Promise.all(
      adapters.map(async adp => {
        const { source, dataAdapter } = adp
        if (hasFeatureArrays(dataAdapter)) {
          return {
            source,
            raw: await dataAdapter.getFeatureArrays(region, opts),
          }
        }
        const features = await firstValueFrom(
          dataAdapter.getFeatures(region, opts).pipe(toArray()),
        )
        return { source, raw: featuresToRaw(features) }
      }),
    )
  }

  public async getRegionQuantitativeStats(
    region: Region,
    opts?: WiggleOptions,
  ) {
    const adapters = await this.getAdapters()
    const allStats = await Promise.all(
      adapters.map(adp =>
        adp.dataAdapter.getRegionQuantitativeStats(region, opts),
      ),
    )
    return aggregateQuantitativeStats(allStats)
  }

  // subadapters are bigwig-like and cap data at screen resolution, so a
  // multiwiggle is never too large to render — skip the estimate entirely
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      alwaysRender: true,
    }
  }

  async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts: WiggleOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }

    const adapters = await this.getAdapters()

    const allStats = await Promise.all(
      adapters.map(adp =>
        adp.dataAdapter.getMultiRegionQuantitativeStats(regions, opts),
      ),
    )

    return aggregateQuantitativeStats(allStats)
  }

  // in another adapter type, this could be dynamic depending on region or
  // something, but it is static for this particular multi-wiggle adapter type
  async getSources(_regions: Region[]) {
    const adapters = await this.getAdapters()
    return adapters.map(
      ({ type: _t, bigWigLocation: _bw, dataAdapter: _da, ...rest }) => ({
        ...rest,
        name: rest.source,
      }),
    )
  }
}
