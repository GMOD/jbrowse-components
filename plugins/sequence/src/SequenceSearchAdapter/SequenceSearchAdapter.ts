import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { SimpleFeature, Feature, Region } from '@jbrowse/core/util'
import { toArray } from 'rxjs/operators'

export default class extends BaseFeatureDataAdapter {
  private windowSize = 1000

  private windowDelta = 1000

  private gcMode = 'content'

  public static capabilities = ['hasLocalStats']

  public async configure() {
    // instantiate the sequence adapter
    const adapter = this.getConf('sequenceAdapter')

    const dataAdapter = await this.getSubAdapter?.(adapter)
    if (!dataAdapter) {
      throw new Error('Error getting subadapter')
    }
    return dataAdapter.dataAdapter as BaseFeatureDataAdapter
  }

  public async getRefNames() {
    const adapter = await this.configure()
    return adapter.getRefNames()
  }

  public getFeatures(query: Region, opts: BaseOptions) {
    this.windowSize = 1000
    this.windowDelta = 1000
    return ObservableCreate<Feature>(async observer => {
      const sequenceAdapter = await this.configure()
      const hw = 1000

      let { start: queryStart, end: queryEnd } = query
      queryStart = Math.max(0, queryStart - hw)
      queryEnd += hw

      if (queryEnd < 0 || queryStart > queryEnd) {
        observer.complete()
        return
      }

      const ret = sequenceAdapter.getFeatures(
        {
          ...query,
          start: queryStart,
          end: queryEnd,
        },
        opts,
      )
      const feats = await ret.pipe(toArray()).toPromise()
      const residues = feats[0]?.get('seq') || ''

      observer.next(
        new SimpleFeature({
          uniqueId: `${this.id}`,
          start: 0,
          end: 100,
        }),
      )
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
