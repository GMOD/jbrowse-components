import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  SimpleFeature,
  Feature,
  Region,
  complement,
  reverse,
} from '@jbrowse/core/util'
import { toArray } from 'rxjs/operators'

export default class extends BaseFeatureDataAdapter {
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
      const hw = 0
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
      const residues: string = feats[0]?.get('seq') || ''
      const search = this.getConf('search')
      const searchFoward = this.getConf('searchForward')
      const searchBackwards = this.getConf('searchBackwards')

      if (search) {
        if (searchFoward) {
          const matches = residues.matchAll(new RegExp(search, 'g'))
          for (const match of matches) {
            const s = queryStart + (match.index || 0)
            observer.next(
              new SimpleFeature({
                uniqueId: `${this.id}-match-${s}-p`,
                refName: query.refName,
                start: s,
                end: s + search.length,
                strand: 1,
              }),
            )
          }
        }
        if (searchBackwards) {
          const matches = complement(residues).matchAll(
            new RegExp(reverse(search), 'g'),
          )
          for (const match of matches) {
            const s = queryStart + (match.index || 0)
            observer.next(
              new SimpleFeature({
                uniqueId: `${this.id}-match-${s}-n`,
                refName: query.refName,
                start: s,
                end: s + search.length,
                strand: -1,
              }),
            )
          }
        }
      }

      observer.complete()
    })
  }

  public freeResources() {}
}
