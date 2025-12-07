import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class GCContentAdapter extends BaseFeatureDataAdapter {
  private gcMode = 'content'

  public static capabilities = ['hasLocalStats']

  public async configure() {
    const adapter = await this.getSubAdapter?.(this.getConf('sequenceAdapter'))
    if (!adapter) {
      throw new Error('Error getting subadapter')
    }
    return adapter.dataAdapter as BaseSequenceAdapter
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
      const halfWindowSize = windowSize === 1 ? 1 : Math.ceil(windowSize / 2) // Half the window size
      const isWindowSizeOneBp = windowSize === 1

      const qs = Math.max(
        0,
        Math.floor((query.start - halfWindowSize) / windowSize) * windowSize,
      )
      const qe =
        Math.ceil((query.end + halfWindowSize) / windowSize) * windowSize

      if (qe < 0 || qs > qe) {
        observer.complete()
        return
      }

      const residues =
        (await sequenceAdapter.getSequence(
          {
            ...query,
            start: qs,
            end: qe,
          },
          opts,
        )) ?? ''

      await updateStatus('Calculating GC', statusCallback, () => {
        // Initialize the first window
        let nc = 0
        let ng = 0
        let len = 0
        let start = performance.now()

        // Calculate initial window
        const startIdx = halfWindowSize
        for (
          let j = startIdx - halfWindowSize;
          j < startIdx + halfWindowSize;
          j++
        ) {
          const letter = residues[j]
          if (letter === 'c' || letter === 'C') {
            nc++
          } else if (letter === 'g' || letter === 'G') {
            ng++
          }
          if (letter !== 'N') {
            len++
          }
        }

        for (
          let i = halfWindowSize;
          i < residues.length - halfWindowSize;
          i += windowDelta
        ) {
          if (performance.now() - start > 400) {
            checkStopToken(stopToken)
            start = performance.now()
          }

          // For windowSize === 1, just get the single character
          if (isWindowSizeOneBp) {
            const letter = residues[i]
            nc = letter === 'c' || letter === 'C' ? 1 : 0
            ng = letter === 'g' || letter === 'G' ? 1 : 0
            len = letter !== 'N' ? 1 : 0
          } else if (i > halfWindowSize) {
            // Rolling window: remove characters that are no longer in window
            // and add new characters that entered the window
            const prevStart = i - windowDelta - halfWindowSize
            const prevEnd = i - windowDelta + halfWindowSize
            const currStart = i - halfWindowSize
            const currEnd = i + halfWindowSize

            // Remove old characters
            for (let j = prevStart; j < Math.min(prevEnd, currStart); j++) {
              if (j >= 0 && j < residues.length) {
                const letter = residues[j]
                if (letter === 'c' || letter === 'C') {
                  nc--
                } else if (letter === 'g' || letter === 'G') {
                  ng--
                }
                if (letter !== 'N') {
                  len--
                }
              }
            }

            // Add new characters
            for (let j = Math.max(prevEnd, currStart); j < currEnd; j++) {
              if (j >= 0 && j < residues.length) {
                const letter = residues[j]
                if (letter === 'c' || letter === 'C') {
                  nc++
                } else if (letter === 'g' || letter === 'G') {
                  ng++
                }
                if (letter !== 'N') {
                  len++
                }
              }
            }
          }

          const pos = qs
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
}
