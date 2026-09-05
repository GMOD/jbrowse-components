import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getSequenceSubAdapter } from '@jbrowse/core/data_adapters/getSequenceSubAdapter'
import { SimpleFeature, updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopTokenThrottled,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import type { GCContentAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { RawFeatureArrays } from '@jbrowse/plugin-wiggle'

export default class GCContentAdapter extends BaseFeatureDataAdapter<GCContentAdapterConfig> {
  // #region subAdapter
  public async configure() {
    // the assembly's sequence, unless the config names another one
    return getSequenceSubAdapter(this, this.getConf('sequenceAdapter'))
  }
  // #endregion

  public async getRefNames(opts?: BaseOptions) {
    const adapter = await this.configure()
    return adapter.getRefNames(opts)
  }

  /**
   * The scored bins as the typed arrays the wiggle displays consume, written
   * straight out of the sliding window. `getFeatures` boxes these on demand;
   * the render path never asks it to.
   */
  public async getFeatureArrays(
    query: Region,
    opts?: BaseOptions,
  ): Promise<RawFeatureArrays> {
    const { statusCallback, stopToken } = opts ?? {}
    const sequenceAdapter = await this.configure()
    const windowSize = this.getConf('windowSize')
    const windowDelta = this.getConf('windowDelta')
    const gcMode = this.getConf('gcMode')
    const halfWindowSize = Math.ceil(windowSize / 2)

    // windowSize 1 is a single-base window; wider windows are centered on the
    // feature position, spanning [i - halfWindowSize, i + halfWindowSize)
    const leftHalf = windowSize === 1 ? 0 : halfWindowSize
    const rightHalf = windowSize === 1 ? 1 : halfWindowSize

    // Snap the fetched region to a **windowDelta** grid. The scored positions
    // are `qs + leftHalf + k * windowDelta`, so they are block-independent
    // exactly when `qs` is constant mod windowDelta — the step, not the window
    // width. Snapping to windowSize instead only looks right because the two
    // default to the same 100: with windowSize 10 and windowDelta 3, two
    // queries over the same span produced grids offset by (100 mod 3) and
    // shared *no* sampling positions at all, so panning slid the whole curve.
    // 0 is a multiple of every delta, so the clamp at the contig start stays on
    // the same grid.
    const qs = Math.max(
      0,
      Math.floor((query.start - halfWindowSize) / windowDelta) * windowDelta,
    )
    const qe =
      Math.ceil((query.end + halfWindowSize) / windowDelta) * windowDelta

    const residues =
      (await sequenceAdapter.getSequence(
        { ...query, start: qs, end: qe },
        opts,
      )) ?? ''

    return updateStatus('Calculating GC', statusCallback, () => {
      const count = Math.max(
        0,
        Math.floor((residues.length - leftHalf - rightHalf) / windowDelta) + 1,
      )
      const starts = new Int32Array(count)
      const ends = new Int32Array(count)
      const scores = new Float32Array(count)
      let n = 0
      const stopTokenCheck = createStopTokenChecker(stopToken)

      // Monotonic two-pointer sliding window: lo/hi only advance, so each base
      // is added once as it enters the window and removed once as it leaves,
      // giving O(residues) regardless of window overlap.
      let nc = 0
      let ng = 0
      let len = 0
      let lo = 0
      let hi = 0
      // The bound is exactly "the window [i - leftHalf, i + rightHalf) fits in
      // what we fetched", spelled with the two halves rather than
      // halfWindowSize. Written with halfWindowSize on both sides it dropped
      // the last complete window of every fetch, and at windowSize 1 — where
      // the window is [i, i+1) but halfWindowSize is still 1 — it never scored
      // the first or last base of a contig at all.
      for (
        let i = leftHalf;
        i + rightHalf <= residues.length;
        i += windowDelta
      ) {
        checkStopTokenThrottled(stopTokenCheck)

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

        // Center the emitted bin on the position it scores. The bin is one
        // step wide so consecutive bins still tile exactly, but anchoring it
        // at `pos` drew each score half a step to the right of the sequence it
        // came from: at the defaults, the window [0,100) was painted over
        // [50,150), a 50bp mis-registration against the features underneath.
        // Clamped at 0 for the out-of-contract windowDelta > windowSize, where
        // half a step can reach past the start of the first window.
        const pos = qs + i
        const binStart = Math.max(0, pos - Math.floor(windowDelta / 2))
        starts[n] = binStart
        ends[n] = binStart + windowDelta
        scores[n] = score
        n++
      }

      return {
        starts,
        ends,
        scores,
        minScores: undefined,
        maxScores: undefined,
        count: n,
      }
    })
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const { starts, ends, scores, count } = await this.getFeatureArrays(
        query,
        opts,
      )
      for (let i = 0; i < count; i++) {
        const start = starts[i]!
        observer.next(
          new SimpleFeature({
            uniqueId: `${this.id}_${start}`,
            refName: query.refName,
            start,
            end: ends[i]!,
            score: scores[i]!,
          }),
        )
      }
      observer.complete()
    })
  }
}
