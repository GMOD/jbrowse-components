import NCListStore from '@gmod/nclist'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { RemoteFile } from 'generic-filehandle'
// locals
import NCListFeature from './NCListFeature'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Region } from '@jbrowse/core/util/types'

export default class NCListAdapter extends BaseFeatureDataAdapter {
  private nclist: any

  private configRefNames?: string[]

  constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const refNames = this.getConf('refNames')
    const rootUrlTemplate = this.getConf('rootUrlTemplate')
    this.configRefNames = refNames

    this.nclist = new NCListStore({
      baseUrl: '',
      urlTemplate: rootUrlTemplate.uri,
      readFile: (url: string) =>
        new RemoteFile(
          String(
            rootUrlTemplate.baseUri
              ? new URL(url, rootUrlTemplate.baseUri).toString()
              : url,
          ),
        ).readFile(),
    })
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param region -
   * @param opts - [stopToken] optional stopTokenling object for aborting the fetch
   * @returns Observable of Feature objects in the region
   */
  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { stopToken } = opts
      for await (const feature of this.nclist.getFeatures(region, opts)) {
        checkStopToken(stopToken)
        observer.next(this.wrapFeature(feature))
      }
      observer.complete()
    })
  }

  wrapFeature(ncFeature: any): NCListFeature {
    return new NCListFeature(
      ncFeature,
      undefined,
      `${this.id}-${ncFeature.id()}`,
    )
  }

  async hasDataForRefName(refName: string) {
    const root = await this.nclist.getDataRoot(refName)
    return !!root?.stats?.featureCount
  }

  /**
   * NCList is unable to get list of ref names so returns empty
   */
  async getRefNames() {
    return this.configRefNames || []
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the foreseeable future and can be purged
   * from caches, etc
   */
  freeResources() {}
}
