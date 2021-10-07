import NCListStore from '@gmod/nclist'
import { Region } from '@jbrowse/core/util/types'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkAbortSignal } from '@jbrowse/core/util'
import { RemoteFile } from 'generic-filehandle'
import { Instance } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import NCListFeature from './NCListFeature'
import MyConfigSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'

export default class NCListAdapter extends BaseFeatureDataAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nclist: any

  private configRefNames?: string[]

  constructor(
    config: Instance<typeof MyConfigSchema>,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const refNames = readConfObject(config, 'refNames')
    const rootUrlTemplate = readConfObject(config, 'rootUrlTemplate')
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
   * @param opts - [signal] optional signalling object for aborting the fetch
   * @returns Observable of Feature objects in the region
   */
  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { signal } = opts
      for await (const feature of this.nclist.getFeatures(region, opts)) {
        checkAbortSignal(signal)
        observer.next(this.wrapFeature(feature))
      }
      observer.complete()
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrapFeature(ncFeature: any): NCListFeature {
    return new NCListFeature(
      ncFeature,
      undefined,
      `${this.id}-${ncFeature.id()}`,
    )
  }

  async hasDataForRefName(refName: string) {
    const root = await this.nclist.getDataRoot(refName)
    return !!(root && root.stats && root.stats.featureCount)
  }

  /*
   * NCList is unable to get list of ref names so returns empty
   * @return Promise<string[]> of empty list
   */
  getRefNames() {
    return Promise.resolve(this.configRefNames || [])
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources() {}
}
