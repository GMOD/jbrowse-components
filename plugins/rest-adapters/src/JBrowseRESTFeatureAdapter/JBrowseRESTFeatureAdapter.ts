import { FileLocation, isUriLocation, Region } from '@jbrowse/core/util/types'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature, { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkAbortSignal } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { getFetcher, resolveUriLocation } from '@jbrowse/core/util/io'

export default class NCListAdapter extends BaseFeatureDataAdapter {
  // constructor(
  //   config: Instance<typeof MyConfigSchema>,
  //   getSubAdapter?: getSubAdapterType,
  //   pluginManager?: PluginManager,
  // ) {
  //   super(config, getSubAdapter, pluginManager)
  // }

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
      
      if(!this.pluginManager) {throw new Error('no pluginmanager provided')}
      const fetch = getFetcher(getConf(this.config, 'location'), this.pluginManager)

      let baseLocation = getConf(this.config, 'location') as FileLocation
      if (!isUriLocation(baseLocation)) {throw new Error('invalid location'+baseLocation)}
      baseLocation = resolveUriLocation(baseLocation)

    
      const result = await fetch(new URL('features/'+region.refName, baseLocation.uri).toString())
      if(!result.ok) {throw new Error(await result.text())}

      const parsed = (await result.json()) as { features: Record<string, unknown>[] }

      for(const feature of parsed.features) {
        checkAbortSignal(signal)
        // regularize uniqueID -> uniqueId
        if(feature.uniqueID) {
          feature.uniqueId = feature.uniqueID
          delete feature.uniqueID
        }
        if(!feature.uniqueId) {
          feature.uniqueId = `${region.refName}:${feature.start}-${feature.end}`
        }
        observer.next(new SimpleFeature(feature as SimpleFeatureSerialized))
      }
      
      observer.complete()
    })
  }

  /*
   * @return Promise<string[]> of empty list
   */
  getRefNames() {
    return Promise.resolve([])
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources() {}
}

