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

  private async calculateGCContent(
    query: Region,
    opts?: BaseOptions,
  ): Promise<{ starts: number[]; ends: number[]; scores: number[] }> {
    const { statusCallback = () => {}, stopToken } = opts || {}
    const sequenceAdapter = await this.configure()
    const windowSize = this.getConf('windowSize')
    const windowDelta = this.getConf('windowDelta')
    const halfWindowSize = windowSize === 1 ? 1 : Math.ceil(windowSize / 2)
    const isWindowSizeOneBp = windowSize === 1

    const qs = Math.max(
      0,
      Math.floor((query.start - halfWindowSize) / windowSize) * windowSize,
    )
    const qe = Math.ceil((query.end + halfWindowSize) / windowSize) * windowSize

    if (qe < 0 || qs > qe) {
      return { starts: [], ends: [], scores: [] }
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

    return updateStatus('Calculating GC', statusCallback, () => {
      const starts: number[] = []
      const ends: number[] = []
      const scores: number[] = []

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

        starts.push(pos + i)
        ends.push(pos + i + windowDelta)
        scores.push(score)
      }

      return { starts, ends, scores }
    })
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const result = await this.calculateGCContent(query, opts)

      for (let i = 0; i < result.starts.length; i++) {
        observer.next(
          new SimpleFeature({
            uniqueId: `${this.id}_${result.starts[i]}`,
            refName: query.refName,
            start: result.starts[i]!,
            end: result.ends[i]!,
            score: result.scores[i],
          }),
        )
      }

      observer.complete()
    })
  }
}
