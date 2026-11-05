import NCListStore from '@gmod/nclist'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { isUriLocation } from '@jbrowse/core/util/types'
import { RemoteFile } from 'generic-filehandle2'

import NCListFeature from './NCListFeature.ts'

import type { NCListRawFeature } from './NCListFeature.ts'
import type { NCListAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

export default class NCListAdapter extends BaseFeatureDataAdapter<NCListAdapterConfig> {
  private nclist: NCListStore

  private configRefNames?: string[]

  constructor(
    config: NCListAdapterConfig,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const refNames = this.getConf('refNames')
    const rootUrlTemplate = this.getConf('rootUrlTemplate')
    if (!isUriLocation(rootUrlTemplate)) {
      throw new Error(
        'NCListAdapter fetches its rootUrlTemplate over HTTP, so it takes a { "uri" } location',
      )
    }
    this.configRefNames = refNames

    this.nclist = new NCListStore({
      baseUrl: '',
      urlTemplate: rootUrlTemplate.uri,
      readFile: (url: string) =>
        new RemoteFile(
          rootUrlTemplate.baseUri
            ? new URL(url, rootUrlTemplate.baseUri).toString()
            : url,
        ).readFile(),
    })
  }

  /**
   * Fetch features for a certain region.
   * @param region -
   * @param opts - [signal] optional signalling object for aborting the fetch
   * @returns Observable of Feature objects in the region
   */
  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { signal } = opts
      for await (const feature of this.nclist.getFeatures(region)) {
        checkAbortSignal(signal)
        observer.next(this.wrapFeature(feature))
      }
      observer.complete()
    }, opts.signal)
  }

  wrapFeature(ncFeature: NCListRawFeature): NCListFeature {
    return new NCListFeature(ncFeature, undefined, ncFeature.id())
  }

  async hasDataForRefName(refName: string) {
    const root = await this.nclist.getDataRoot(refName)
    return !!root?.stats?.featureCount
  }

  /**
   * NCList is unable to get list of ref names so returns empty
   */
  async getRefNames() {
    return this.configRefNames ?? []
  }
}
