import { FileLocation, isUriLocation, Region } from '@jbrowse/core/util/types'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature, {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkAbortSignal } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { getFetcher, resolveUriLocation } from '@jbrowse/core/util/io'

import type { Instance } from 'mobx-state-tree'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type MyConfigSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'
import {
  FeatureCoverageStats,
  FeatureScoreStats,
  isMinimumFeatureCoverageStats,
  isMinimumFeatureScoreStats,
  rectifyStats,
} from '@jbrowse/core/util/stats'

export default class JBrowseRESTFeatureAdapter extends BaseFeatureDataAdapter {
  pluginManager: PluginManager
  configuration: Instance<typeof MyConfigSchema>

  constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    if (!pluginManager) {
      throw new Error('no pluginmanager provided')
    }

    if (!config) {
      throw new Error('no config provided')
    }

    super(config, getSubAdapter, pluginManager)
    this.configuration = config
    this.pluginManager = pluginManager

    this.validateConfiguration()
  }

  private validateConfiguration() {
    if (
      !(
        this.implementsOptionalResource('has_data_for_reference') ||
        this.implementsOptionalResource('reference_sequences')
      )
    ) {
      throw new Error(
        `REST API at ${this.getConf(
          'location',
        )} must implement at least one of has_data_for_reference or reference_sequences'`,
      )
    }

    if (
      !this.implementsOptionalResource('assembly_names') &&
      this.getConf('assemblyNames').length === 0
    ) {
      throw new Error(
        `REST API at ${this.getConf(
          'location',
        )} must either implement the assembly_names optional resource, or assemblyNames must be provided in its configuration'`,
      )
    }
  }

  protected implementsOptionalResource(resourceName: string) {
    const value = getConf(this, ['optionalResources', resourceName])
    return value === true
  }

  /** construct the full URL to fetch from */
  protected makeFetchUrl(relativeUrl: string) {
    let baseLocation = getConf(this, 'location') as FileLocation
    if (!isUriLocation(baseLocation)) {
      throw new Error('invalid location for REST API: ' + baseLocation)
    }
    baseLocation = resolveUriLocation(baseLocation)

    let url = baseLocation.uri + '/' + relativeUrl

    // add the extra_query vars if present
    const extra_query = Object.entries(
      (getConf(this, 'extraQuery') || {}) as Record<string, string>,
    )
    if (extra_query.length) {
      const p = new URL(url)
      extra_query.forEach(q => p.searchParams.append(...q))
      url = p.toString()
    }
    return url
  }

  // this method is mostly here to improve error reporting for unparsable responses
  protected async fetchJsonFromRestApi(
    relativeUrl: string,
    signal?: AbortSignal,
  ) {
    const result = await this.fetchFromRestApi(relativeUrl, signal)
    try {
      return (await result.json()) as unknown
    } catch (e) {
      throw this.invalidResponseError(relativeUrl, e, e)
    }
  }

  private invalidResponseError(
    relativeUrl: string,
    error: unknown,
    cause?: unknown,
  ) {
    return new Error(
      `invalid response from JBrowse REST API call ${this.makeFetchUrl(
        relativeUrl,
      )}: ${error}`,
      { cause },
    )
  }

  protected async fetchFromRestApi(relativeUrl: string, signal?: AbortSignal) {
    const fetcher = getFetcher(getConf(this, 'location'), this.pluginManager)
    const url = this.makeFetchUrl(relativeUrl)
    return this.fetch(fetcher, url, signal)
  }

  //* this method is here primarily to enable mocking fetch in tests */
  protected async fetch(
    fetcher: ReturnType<typeof getFetcher>,
    url: RequestInfo,
    signal?: AbortSignal,
  ) {
    const result = await fetcher(url, { signal })
    if (!result.ok) {
      throw new Error(await result.text())
    }
    return result
  }

  public async hasDataForRefName(
    refName: string,
    opts?: BaseOptions,
  ): Promise<boolean> {
    if (this.implementsOptionalResource('has_data_for_reference')) {
      const assemblyNames: string[] = await this.getRequestAssemblyNames(opts)

      return (await this.fetchJsonFromRestApi(
        'has_data_for_reference/' +
          encodeURIComponent(assemblyNames[0]) +
          '/' +
          encodeURIComponent(refName),
        opts?.signal,
      )) as boolean
    }
    // superclass implementation will use getRefNames
    return super.hasDataForRefName(refName, opts)
  }

  /** get a list of the configured assemblies */
  public async getAssemblyNames(opts?: BaseOptions): Promise<string[]> {
    if (this.implementsOptionalResource('assembly_names')) {
      const response = await this.fetchJsonFromRestApi(
        'assembly_names',
        opts?.signal,
      )
      if (Array.isArray(response)) {
        return response
      }
    }
    return this.getConf('assemblyNames')
  }

  /*
   * @return Promise<string[]>
   */
  public async getRefNames(opts?: BaseOptions): Promise<string[]> {
    // if opts.regions is passed, use that for assemblies, otherwise
    // use the configured assemblyNames
    const assemblyNames: string[] = await this.getRequestAssemblyNames(opts)

    const relativeUrl =
      'reference_sequences/' + encodeURIComponent(assemblyNames[0])

    const json = await this.fetchJsonFromRestApi(relativeUrl, opts?.signal)
    if (Array.isArray(json)) {
      return json
    }
    throw this.invalidResponseError(
      relativeUrl,
      'response must be a JSON array of reference sequence names',
    )
  }

  private async getRequestAssemblyNames(opts?: BaseOptions) {
    let assemblyNames: string[]
    if (opts?.assemblyName) {
      assemblyNames = [opts.assemblyName as string]
    } else if (opts?.regions) {
      const regions = opts.regions as Region[]
      assemblyNames = regions.map(r => r.assemblyName)
    } else {
      assemblyNames = await this.getAssemblyNames()
    }
    if (!assemblyNames[0]) {
      throw new Error('could not determine which assemblies to use for request')
    }
    return assemblyNames
  }

  public async getRegionStats(
    region: Region,
    opts?: BaseOptions,
  ): Promise<FeatureCoverageStats | FeatureScoreStats> {
    if (!this.implementsOptionalResource('region_stats')) {
      return super.getRegionStats(region, opts)
    }

    const url =
      'stats/region/' +
      encodeURIComponent(region.assemblyName) +
      '/' +
      encodeURIComponent(region.refName) +
      '?start=' +
      region.start +
      '&end=' +
      region.end
    const stats = await this.fetchJsonFromRestApi(url, opts?.signal)
    if (isMinimumFeatureScoreStats(stats)) {
      return rectifyStats(stats)
    } else if (isMinimumFeatureCoverageStats(stats)) {
      return {
        ...stats,
        featureDensity: (stats.featureCount || 1) / stats.basesCovered,
      } as FeatureCoverageStats
    } else {
      throw new TypeError(`region stats returned from ${url} is not valid`)
    }
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param region -
   * @param opts - [signal] optional signalling object for aborting the fetch
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { signal } = opts

      const result = (await this.fetchJsonFromRestApi(
        'features/' +
          encodeURIComponent(region.assemblyName) +
          '/' +
          encodeURIComponent(region.refName) +
          '?start=' +
          region.start +
          '&end=' +
          region.end,
        signal,
      )) as { features: Record<string, unknown>[] }

      for (const feature of result.features) {
        checkAbortSignal(signal)
        // regularize uniqueID -> uniqueId
        if (feature.uniqueID) {
          feature.uniqueId = feature.uniqueID
          delete feature.uniqueID
        }
        if (!feature.uniqueId) {
          feature.uniqueId = `${region.refName}:${feature.start}-${feature.end}`
        }
        observer.next(new SimpleFeature(feature as SimpleFeatureSerialized))
      }

      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the foreseeable future and can be purged
   * from caches, etc
   */
  freeResources() {}
}
