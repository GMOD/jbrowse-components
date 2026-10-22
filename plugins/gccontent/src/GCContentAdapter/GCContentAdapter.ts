import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getSequenceSubAdapter } from '@jbrowse/core/data_adapters/getSequenceSubAdapter'
import {
  SimpleFeature,
  createStatusFanOut,
  updateStatus,
} from '@jbrowse/core/util'
import { createAbortBreakpoint } from '@jbrowse/core/util/aborting'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { resolveGCWindow } from './gcWindow.ts'

import type { GCContentAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { RawFeatureArrays } from '@jbrowse/plugin-wiggle'

// the wiggle display's points per pixel, which an `auto` step follows
interface GCOptions extends BaseOptions {
  resolution?: number
}

const G = 1
const C = 2
const VALID = 4
const BASE_CLASS = new Uint8Array(256)
for (const [letters, kind] of [
  ['AaTt', VALID],
  ['Gg', G | VALID],
  ['Cc', C | VALID],
] as const) {
  for (const letter of letters) {
    BASE_CLASS[letter.charCodeAt(0)] = kind
  }
}

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
   * GC content is a fraction of the bases in a window, so [0, 1] is the
   * quantity's own range and holds the axis across loci. Skew is left to
   * autoscale: its range is [-1, 1], but real skew sits within roughly ±0.3,
   * and a [-1, 1] axis would flatten the sign flip at the replication origin
   * the track is read for.
   */
  public async getValueDomain(): Promise<[number, number] | undefined> {
    return this.getConf('op') === 'content' ? [0, 1] : undefined
  }

  /** The zoom an `auto` step's rung serves; a fixed step serves every zoom. */
  public async getZoomRange(opts?: GCOptions) {
    return this.gcWindow(opts).zoomRange
  }

  private gcWindow(opts?: GCOptions) {
    return resolveGCWindow({
      window: this.getConf('window'),
      step: this.getConf('step'),
      bpPerPx: opts?.bpPerPx,
      resolution: opts?.resolution,
    })
  }

  /**
   * The scored bins as the typed arrays the wiggle displays consume, one per
   * region, written straight out of the sliding window. `getFeatures` boxes
   * these on demand; the render path never asks it to.
   */
  public async getFeatureArrays(
    regions: Region[],
    opts?: GCOptions,
  ): Promise<RawFeatureArrays[]> {
    const slot = createStatusFanOut(opts?.statusCallback)
    return Promise.all(
      regions.map(region =>
        this.regionArrays(region, { ...opts, statusCallback: slot() }),
      ),
    )
  }

  private async regionArrays(
    query: Region,
    opts?: GCOptions,
  ): Promise<RawFeatureArrays> {
    const { statusCallback, signal } = opts ?? {}
    const sequenceAdapter = await this.configure()
    const { window: width, step } = this.gcWindow(opts)
    const skew = this.getConf('op') === 'skew'
    // the window scored at position i is [i - leftHalf, i + rightHalf)
    const leftHalf = width >> 1
    const rightHalf = width - leftHalf

    // Snapped to a step grid, the scored positions
    // `qs + leftHalf + k * step` are the same whatever the query, so
    // panning extends the curve instead of sliding it. 0 is on every grid.
    const qs = Math.max(0, Math.floor((query.start - leftHalf) / step) * step)
    const qe = Math.ceil((query.end + rightHalf) / step) * step

    const residues =
      (await sequenceAdapter.getSequence(
        { ...query, start: qs, end: qe },
        opts,
      )) ?? ''

    return updateStatus('Calculating GC', statusCallback, async () => {
      const capacity = Math.max(
        0,
        Math.floor((residues.length - width) / step) + 1,
      )
      const starts = new Int32Array(capacity)
      const ends = new Int32Array(capacity)
      const scores = new Float32Array(capacity)
      let n = 0

      // lo and hi only advance, so each base enters and leaves the window
      // once: O(residues) however much the windows overlap
      let ng = 0
      let nc = 0
      let valid = 0
      let lo = 0
      let hi = 0
      const breakpoint = createAbortBreakpoint(signal)
      for (let i = leftHalf; i + rightHalf <= residues.length; i += step) {
        if (breakpoint.due()) {
          await breakpoint.yield()
        }
        while (hi < i + rightHalf) {
          const k = BASE_CLASS[residues.charCodeAt(hi++) & 255]!
          ng += k & G
          nc += (k & C) >> 1
          valid += k >> 2
        }
        while (lo < i - leftHalf) {
          const k = BASE_CLASS[residues.charCodeAt(lo++) & 255]!
          ng -= k & G
          nc -= (k & C) >> 1
          valid -= k >> 2
        }
        const denominator = skew ? ng + nc : valid
        if (denominator > 0) {
          // the middle step bases of the window, so bins tile
          const binStart = qs + i - leftHalf + ((width - step) >> 1)
          starts[n] = binStart
          ends[n] = binStart + step
          scores[n] = (skew ? ng - nc : ng + nc) / denominator
          n++
        }
      }

      return {
        starts: n < capacity ? starts.subarray(0, n) : starts,
        ends: n < capacity ? ends.subarray(0, n) : ends,
        scores: n < capacity ? scores.subarray(0, n) : scores,
        minScores: undefined,
        maxScores: undefined,
        count: n,
      }
    })
  }

  public getFeatures(query: Region, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const { starts, ends, scores, count } = await this.regionArrays(
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
