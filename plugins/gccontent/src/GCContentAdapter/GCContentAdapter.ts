import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class GCContentAdapter extends BaseFeatureDataAdapter {
  private gcMode = 'content'

  public static capabilities = ['hasLocalStats']

  public async configure() {
    const adapter = await this.getSubAdapter?.(this.getConf('sequenceAdapter'))
    if (!adapter) {
      throw new Error('Error getting subadapter')
    }
    return adapter.dataAdapter as BaseFeatureDataAdapter
  }

  public async getRefNames(opts?: BaseOptions) {
    const adapter = await this.configure()
    return adapter.getRefNames(opts)
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    const { statusCallback = () => {}, stopToken } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const sequenceAdapter = await this.configure()
      const windowSize = this.getConf('windowSize')
      const windowDelta = this.getConf('windowDelta')
      const hw = windowSize === 1 ? 1 : windowSize / 2 // Half the window size
      const f = windowSize === 1

      let { start: queryStart, end: queryEnd } = query
      queryStart = Math.max(0, queryStart - hw)
      queryEnd += hw

      if (queryEnd < 0 || queryStart > queryEnd) {
        observer.complete()
        return
      }

      const feats = await firstValueFrom(
        sequenceAdapter
          .getFeatures(
            {
              ...query,
              start: queryStart,
              end: queryEnd,
            },
            opts,
          )
          .pipe(toArray()),
      )
      const residues = feats[0]?.get('seq') || ''

      let start = performance.now()
      await updateStatus('Calculating GC', statusCallback, () => {
        for (let i = hw; i < residues.length - hw; i += windowDelta) {
          if (performance.now() - start > 400) {
            checkStopToken(stopToken)
            start = performance.now()
          }
          const r = f ? residues[i] : residues.slice(i - hw, i + hw)
          let nc = 0
          let ng = 0
          let len = 0
          for (const letter of r) {
            if (letter === 'c' || letter === 'C') {
              nc++
            } else if (letter === 'g' || letter === 'G') {
              ng++
            }
            if (letter !== 'N') {
              len++
            }
          }
          const pos = queryStart
          const score =
            this.gcMode === 'content'
              ? (ng + nc) / (len || 1)
              : this.gcMode === 'skew'
                ? (ng - nc) / (ng + nc || 1)
                : 0

          observer.next(
            new SimpleFeature({
              uniqueId: `${this.id}_${pos + i}`,
              refName: query.refName,
              start: pos + i,
              end: pos + i + windowDelta,
              score,
            }),
          )
        }
      })

      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the foreseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */) {}
}
