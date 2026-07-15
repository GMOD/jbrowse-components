import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import type { GCContentAdapterConfig } from './configSchema.ts'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export default class GCContentAdapter extends BaseFeatureDataAdapter<GCContentAdapterConfig> {
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
  ): Promise<Feature[]> {
    const { statusCallback = () => {}, stopToken } = opts ?? {}
    const sequenceAdapter = await this.configure()
    const windowSize = this.getConf('windowSize')
    const windowDelta = this.getConf('windowDelta')
    const gcMode = this.getConf('gcMode')
    const halfWindowSize = Math.ceil(windowSize / 2)

    // windowSize 1 is a single-base window; wider windows are centered on the
    // feature position, spanning [i - halfWindowSize, i + halfWindowSize)
    const leftHalf = windowSize === 1 ? 0 : halfWindowSize
    const rightHalf = windowSize === 1 ? 1 : halfWindowSize

    // snap the fetched region to a windowSize grid so a given genomic window
    // scores identically no matter which block requested it
    const qs = Math.max(
      0,
      Math.floor((query.start - halfWindowSize) / windowSize) * windowSize,
    )
    const qe = Math.ceil((query.end + halfWindowSize) / windowSize) * windowSize

    const residues =
      (await sequenceAdapter.getSequence(
        { ...query, start: qs, end: qe },
        opts,
      )) ?? ''

    return updateStatus('Calculating GC', statusCallback, () => {
      const features: Feature[] = []
      const stopTokenCheck = createStopTokenChecker(stopToken)

      // Monotonic two-pointer sliding window: lo/hi only advance, so each base
      // is added once as it enters the window and removed once as it leaves,
      // giving O(residues) regardless of window overlap.
      let nc = 0
      let ng = 0
      let len = 0
      let lo = 0
      let hi = 0
      for (
        let i = halfWindowSize;
        i < residues.length - halfWindowSize;
        i += windowDelta
      ) {
        checkStopToken2(stopTokenCheck)

        const winEnd = i + rightHalf
        while (hi < winEnd) {
          const letter = residues[hi++]
          if (letter === 'c' || letter === 'C') {
            nc++
          } else if (letter === 'g' || letter === 'G') {
            ng++
          }
          if (letter !== 'N' && letter !== 'n') {
            len++
          }
        }

        const winStart = i - leftHalf
        while (lo < winStart) {
          const letter = residues[lo++]
          if (letter === 'c' || letter === 'C') {
            nc--
          } else if (letter === 'g' || letter === 'G') {
            ng--
          }
          if (letter !== 'N' && letter !== 'n') {
            len--
          }
        }

        const score =
          gcMode === 'skew'
            ? (ng - nc) / (ng + nc || 1)
            : (ng + nc) / (len || 1)

        features.push(
          new SimpleFeature({
            uniqueId: `${this.id}_${qs + i}`,
            refName: query.refName,
            start: qs + i,
            end: qs + i + windowDelta,
            score,
          }),
        )
      }

      return features
    })
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      for (const feature of await this.calculateGCContent(query, opts)) {
        observer.next(feature)
      }
      observer.complete()
    })
  }
}
