import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, revcom, doesIntersect2 } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class SequenceSearchAdapter extends BaseFeatureDataAdapter {
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
      const hw = 10000
      const queryEnd = query.end + hw
      const queryStart = Math.max(0, query.start - hw)

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
      const re = new RegExp(search, `g${caseInsensitive ? 'i' : ''}`)

      if (search) {
        if (searchForward) {
          const matches = residues.matchAll(re)
          for (const match of matches) {
            const s = queryStart + match.index
            const e = queryStart + match.index + match[0].length
            if (doesIntersect2(s, e, query.start, query.end)) {
              observer.next(
                new SimpleFeature({
                  uniqueId: `${this.id}-${s}-${match[0]}-pos`,
                  refName: query.refName,
                  start: s,
                  end: e,
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
            const e = queryEnd - match.index
            const s = queryEnd - match.index - match[0].length
            if (doesIntersect2(s, e, query.start, query.end)) {
              observer.next(
                new SimpleFeature({
                  uniqueId: `${this.id}-${s}-${match[0]}-neg`,
                  refName: query.refName,
                  start: s,
                  end: e,
                  name: match[0],
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
