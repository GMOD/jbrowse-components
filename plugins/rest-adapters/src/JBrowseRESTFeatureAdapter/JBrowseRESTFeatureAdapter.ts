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
import { rectifyStats, UnrectifiedFeatureStats } from '@jbrowse/core/util/stats'

const validOptional = ['region_stats', 'region_feature_densities']

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

    // validate the optional_resources configuration
    for (const resourceName of getConf(
      this,
      'optional_resources',
    ) as string[]) {
      if (!validOptional.includes(resourceName)) {
        throw new Error(
          `invalid optional_resources "${resourceName}", must be one of ${JSON.stringify(
            validOptional,
          )}`,
        )
      }
    }
  }

  private implementsOptionalResource(resourceName: string) {
    const optionalResources = getConf(this, 'optional_resources') as string[]
    return optionalResources.includes(resourceName)
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param region -
   * @param opts - [signal] optional signalling object for aborting the fetch
   * @returns Observable of Feature objects in the region
   */
  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { signal } = opts

      const result = (await this.fetchJsonFromRestApi(
        'features/' +
          region.refName +
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

  private async fetchFromRestApi(relativeUrl: string, signal?: AbortSignal) {
    const fetcher = getFetcher(getConf(this, 'location'), this.pluginManager)

    let baseLocation = getConf(this, 'location') as FileLocation
    if (!isUriLocation(baseLocation)) {
      throw new Error('invalid location ' + baseLocation)
    }
    baseLocation = resolveUriLocation(baseLocation)

    const url = baseLocation.uri + '/' + relativeUrl
    return this.fetch(fetcher, url, signal)
  }

  // this method is mostly here to improve error reporting for unparseable responses
  private async fetchJsonFromRestApi(
    relativeUrl: string,
    signal?: AbortSignal,
  ) {
    const result = await this.fetchFromRestApi(relativeUrl, signal)
    try {
      return (await result.json()) as unknown
    } catch (e) {
      throw new Error(
        `invalid response from REST API call ${relativeUrl}: ${e}`,
      )
    }
  }

  // this method is here so that tests can mock fetching
  private async fetch(
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

  /*
   * @return Promise<string[]> of empty list
   */
  async getRefNames(opts?: BaseOptions) {
    const result = await this.fetchFromRestApi(
      'reference_sequences',
      opts?.signal,
    )
    const json = await result.json()
    if (!Array.isArray(json)) {
      throw new Error(
        'invalid reference_sequences API response, the response must be a JSON array of string reference sequence names',
      )
    }
    return json
  }

  public async getRegionStats(region: Region, opts?: BaseOptions) {
    if (!this.implementsOptionalResource('region_stats')) {
      return super.getRegionStats(region, opts)
    }

    const url =
      'stats/region/' +
      region.refName +
      '?start=' +
      region.start +
      '&end=' +
      region.end
    const stats = await this.fetchJsonFromRestApi(url, opts?.signal)
    if (Array.isArray(stats)) {
      throw new TypeError(`invalid REST response for ${url}, not a JSON object`)
    }
    return rectifyStats(stats as UnrectifiedFeatureStats)
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources() {}
}
