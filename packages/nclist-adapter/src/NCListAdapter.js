import NCListStore from '@gmod/nclist'
import { openUrl } from '@gmod/jbrowse-core/util/io'

import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'

import NCListFeature from './NCListFeature'

export default class BamAdapter extends BaseAdapter {
  static capabilities = ['getFeatures']

  constructor(config) {
    super()
    const { rootUrlTemplate } = config

    this.nclist = new NCListStore({
      baseUrl: '',
      urlTemplate: rootUrlTemplate,
      readFile: url => openUrl(url).readFile(),
    })
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param {Region} param
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures({ refName, start, end }, signal) {
    return ObservableCreate(async (observer) => {
      for await (const feature of this.nclist.getFeatures({ refName, start, end }, { signal })) {
        checkAbortSignal(signal)
        observer.next(this.wrapFeature(feature))
      }
      observer.complete()
    })
  }

  wrapFeature(ncFeature) {
    return new NCListFeature(ncFeature)
  }

  async hasDataForRefName(refName) {
    const root = await this.nclist.getDataRoot(refName)
    return !!(root && root.stats && root.stats.featureCount)
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */) {}
}
