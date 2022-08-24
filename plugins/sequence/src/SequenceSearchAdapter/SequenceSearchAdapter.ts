import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { SimpleFeature, Feature, Region } from '@jbrowse/core/util'
import { toArray } from 'rxjs/operators'

export default class extends BaseFeatureDataAdapter {
  public static capabilities = ['hasLocalStats']

  public async configure() {
    const adapter = await this.getSubAdapter?.(this.getConf('sequenceAdapter'))
    if (!adapter) {
      throw new Error('Error getting subadapter')
    }
    return adapter.dataAdapter as BaseFeatureDataAdapter
  }

  public async getRefNames() {
    const adapter = await this.configure()
    return adapter.getRefNames()
  }

  public getFeatures(query: Region, opts: BaseOptions) {
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
      const search = this.getConf('search')
      const regexp = new RegExp(search, 'g')
      const matches = residues.matchAll(regexp)
      if (search) {
        for (const match of matches) {
          const s = queryStart + match.index
          observer.next(
            new SimpleFeature({
              uniqueId: `${this.id}-match-${s}`,
              refName: query.refName,
              start: s,
              end: s + search.length,
            }),
          )
        }
      }

      observer.complete()
    })
  }

  public freeResources() {}
}
