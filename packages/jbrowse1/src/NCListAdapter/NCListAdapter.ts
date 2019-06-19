import NCListStore from '@gmod/nclist'
import { openUrl } from '@gmod/jbrowse-core/util/io'
import { Observer, Observable } from 'rxjs'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'

import NCListFeature from './NCListFeature'

export default class extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private nclist: any

  static capabilities = ['getFeatures']

  constructor(config: { rootUrlTemplate: string }) {
    super()
    const { rootUrlTemplate } = config

    this.nclist = new NCListStore({
      baseUrl: '',
      urlTemplate: rootUrlTemplate,
      readFile: (url: string) => openUrl(url).readFile(),
    })
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param {IRegion} param
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures(region: IRegion, opts: BaseOptions = {}): Observable<Feature> {
    return ObservableCreate<Feature>(
      async (observer: Observer<Feature>): Promise<void> => {
        const { signal } = opts
        for await (const feature of this.nclist.getFeatures(region, opts)) {
          checkAbortSignal(signal)
          observer.next(this.wrapFeature(feature))
        }
        observer.complete()
      },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wrapFeature(ncFeature: any): NCListFeature {
    return new NCListFeature(ncFeature)
  }

  async hasDataForRefName(refName: string): Promise<boolean> {
    const root = await this.nclist.getDataRoot(refName)
    return !!(root && root.stats && root.stats.featureCount)
  }

  /*
   * NCList is unable to get list of ref names so returns empty
   * @return Promise<string[]> of empty list
   */
  async getRefNames(): Promise<string[]> {
    return []
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
