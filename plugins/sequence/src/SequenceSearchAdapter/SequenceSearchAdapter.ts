import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  SimpleFeature,
  Feature,
  Region,
  revcom,
  doesIntersect2,
} from '@jbrowse/core/util'
import { toArray } from 'rxjs/operators'
import { firstValueFrom } from 'rxjs'

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
      const feats = await firstValueFrom(ret.pipe(toArray()))
      const residues: string = feats[0]?.get('seq') || ''
      const search = this.getConf('search') as string
      const searchForward = this.getConf('searchForward')
      const searchReverse = this.getConf('searchReverse')
      const caseInsensitive = this.getConf('caseInsensitive')
      const re = new RegExp(search, 'g' + (caseInsensitive ? 'i' : ''))

      if (search) {
        if (searchForward) {
          const matches = residues.matchAll(re)
          for (const match of matches) {
            const s = queryStart + (match.index || 0)

            if (doesIntersect2(s, s + search.length, query.start, query.end)) {
              observer.next(
                new SimpleFeature({
                  uniqueId: `${this.id}-match-${s}-p`,
                  refName: query.refName,
                  start: s,
                  end: s + match[0].length,
                  name: match[0],
                  strand: 1,
                }),
              )
            }
          }
        }
        if (searchReverse) {
          const matches = revcom(residues).matchAll(re)
          for (const match of matches) {
            const s = queryEnd - (match.index || 0)
            if (doesIntersect2(s, s + search.length, query.start, query.end)) {
              observer.next(
                new SimpleFeature({
                  uniqueId: `${this.id}-match-${s}-n`,
                  refName: query.refName,
                  start: s - match[0].length,
                  name: match[0],
                  end: s,
                  strand: -1,
                }),
              )
            }
          }
        }
      }

      observer.complete()
    })
  }

  public freeResources() {}
}
