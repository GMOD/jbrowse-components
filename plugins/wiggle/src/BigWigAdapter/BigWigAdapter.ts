import { ArrayFeatureView, BigWig, BigWigFeature } from '@gmod/bbi'
import {
  BaseFeatureDataAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { downloadStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { calcStdFromSums } from '@jbrowse/core/util/stats'

import {
  binAlignedExtent,
  binRawRegion,
  syntheticBinBp,
  syntheticReductionLevels,
} from './syntheticTiers.ts'
import { tierSpanRange } from './tierSpanRange.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { WiggleAdapterOptions as WiggleOptions } from '../wiggleAdapterOptions.ts'
import type { BigWigAdapterConfig } from './configSchema.ts'
import type {
  BaseOptions,
  ZoomRange,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { RectifiedQuantitativeStats } from '@jbrowse/core/util/stats'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

function computeStatsFromView(
  view: ArrayFeatureView,
  targetStart: number,
  targetEnd: number,
): RectifiedQuantitativeStats {
  const basesCovered = targetEnd - targetStart
  // Number.MAX_VALUE not Infinity: precautionary, since Infinity serializes as
  // null in JSON and these stats cross the RPC boundary. In practice the
  // sentinels are always replaced (featureCount===0 returns zeros early).
  let scoreMin = Number.MAX_VALUE
  let scoreMax = -Number.MAX_VALUE
  let scoreMeanMin = Number.MAX_VALUE
  let scoreMeanMax = -Number.MAX_VALUE
  let scoreSum = 0
  let scoreSumSquares = 0
  let featureCount = 0

  for (let i = 0; i < view.length; i++) {
    if (view.end(i) <= targetStart || view.start(i) >= targetEnd) {
      continue
    }

    const score = view.score(i)
    const min = view.minScore(i) ?? score
    const max = view.maxScore(i) ?? score

    scoreMin = Math.min(scoreMin, min)
    scoreMax = Math.max(scoreMax, max)
    scoreMeanMin = Math.min(scoreMeanMin, score)
    scoreMeanMax = Math.max(scoreMeanMax, score)
    scoreSum += score
    scoreSumSquares += score * score
    featureCount++
  }

  if (featureCount === 0) {
    return {
      scoreMin: 0,
      scoreMax: 0,
      scoreSum: 0,
      scoreSumSquares: 0,
      scoreMean: 0,
      scoreStdDev: 0,
      featureCount: 0,
      basesCovered,
      featureDensity: 0,
    }
  }

  const scoreMean = scoreSum / featureCount
  // calcStdFromSums guards variance<0 (floating-point rounding can push it
  // slightly negative when every score in the window is equal — a flat region —
  // which a bare Math.sqrt would turn into NaN). population=true keeps the
  // divide-by-n behavior this used to compute inline.
  const scoreStdDev = calcStdFromSums(
    scoreSum,
    scoreSumSquares,
    featureCount,
    true,
  )

  return {
    scoreMin,
    scoreMax,
    scoreMeanMin,
    scoreMeanMax,
    scoreSum,
    scoreSumSquares,
    scoreMean,
    scoreStdDev,
    featureCount,
    basesCovered,
    featureDensity: featureCount / basesCovered,
  }
}

export default class BigWigAdapter extends BaseFeatureDataAdapter<BigWigAdapterConfig> {
  setup = cachedSetup({
    label: 'Downloading header',
    setup: opts => this.setupPre(opts),
  })

  public static capabilities = ['hasResolution']

  private async setupPre(opts?: BaseOptions) {
    const bigwig = new BigWig({
      filehandle: openLocation(
        this.getConf('bigWigLocation'),
        this.pluginManager,
      ),
    })
    const header = await bigwig.getHeader(opts)
    const fileLevels = header.zoomLevels.map(z => z.reductionLevel)
    return {
      bigwig,
      header,
      firstLevel: Math.min(...fileLevels),
      levels: [...syntheticReductionLevels(fileLevels), ...fileLevels],
    }
  }

  public async getRefNames(opts?: BaseOptions) {
    const { header } = await this.setup(opts)
    return Object.keys(header.refsByName)
  }

  public async refIdToName(refId: number) {
    const { header } = await this.setup()
    return header.refsByNumber[refId]?.name
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    const { signal } = opts
    return ObservableCreate<Feature>(async observer => {
      const view = await this.getArrayFeatureView(region, opts)
      for (let i = 0; i < view.length; i++) {
        observer.next(new BigWigFeature(view, i))
      }
      observer.complete()
    }, signal)
  }

  private basesPerSpan({ bpPerPx = 0, resolution = 1 }: WiggleOptions) {
    return (bpPerPx / resolution) * this.getConf('resolutionMultiplier')
  }

  public async getZoomRange(opts: WiggleOptions = {}): Promise<ZoomRange> {
    const { levels } = await this.setup(opts)
    const { resolution = 1 } = opts
    const bpPerPxPerSpan = resolution / this.getConf('resolutionMultiplier')
    const [lo, hi] = tierSpanRange(levels, this.basesPerSpan(opts))
    return {
      minBpPerPx: lo * bpPerPxPerSpan,
      maxBpPerPx: hi * bpPerPxPerSpan,
    }
  }

  private async getArrayFeatureView(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<ArrayFeatureView> {
    const [arrays] = await this.readRegions([region], opts)
    const { starts, ends, scores, minScores, maxScores } = arrays!
    return new ArrayFeatureView(
      minScores && maxScores
        ? { starts, ends, scores, minScores, maxScores, isSummary: true }
        : { starts, ends, scores, isSummary: false },
      this.getConf('source'),
      region.refName,
    )
  }

  // One bbi pass over all regions, coalescing adjacent on-disk blocks across
  // region boundaries. All regions share the tier picked from the view's
  // bpPerPx. A synthetic tier reads the raw section over bin-aligned extents
  // and bins each region; a file tier's rows are bbi's own.
  private async readRegions(regions: Region[], opts: WiggleOptions) {
    const { statusCallback } = opts
    const { bigwig, levels, firstLevel } = await this.setup(opts)
    const basesPerSpan = this.basesPerSpan(opts)
    const binBp = syntheticBinBp(
      tierSpanRange(levels, basesPerSpan)[0],
      firstLevel,
    )
    const rawSectionSpan = firstLevel / 4

    const res = await downloadStatus(
      'Downloading wiggle data',
      statusCallback,
      onProgress =>
        bigwig.getFeaturesAsArraysMulti(
          regions.map(({ refName, start, end }) => ({
            refName,
            ...(binBp === undefined
              ? { start, end }
              : binAlignedExtent(start, end, binBp)),
          })),
          {
            ...opts,
            basesPerSpan: binBp === undefined ? basesPerSpan : rawSectionSpan,
            onProgress,
          },
        ),
    )

    const { starts, ends, scores, regionOffsets } = res
    const minScores = res.isSummary ? res.minScores : undefined
    const maxScores = res.isSummary ? res.maxScores : undefined
    return regions.map((region, i) => {
      const lo = regionOffsets[i]!
      const hi = regionOffsets[i + 1]!
      return binBp === undefined
        ? {
            starts: starts.subarray(lo, hi),
            ends: ends.subarray(lo, hi),
            scores: scores.subarray(lo, hi),
            minScores: minScores?.subarray(lo, hi),
            maxScores: maxScores?.subarray(lo, hi),
            count: hi - lo,
          }
        : binRawRegion(
            starts,
            ends,
            scores,
            lo,
            hi,
            region.start,
            region.end,
            binBp,
          )
    })
  }

  // bicolorPivot is a display concern (pos/neg color split) and stays out of
  // the adapter API. Callers run processFeaturesFromArrays themselves with the
  // pivot — split happens inline with the data scan, no second pass.
  public async getFeatureArrays(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<RawFeatureArrays> {
    const [arrays] = await this.readRegions([region], opts)
    return arrays!
  }

  // Multi-region fast path: fewer range requests than N independent
  // getFeatureArrays calls — the win for collapsed-intron and whole-genome
  // overviews. regionOffsets slices each region out of bbi's packed arrays
  // copy-free.
  public async getFeatureArraysMulti(
    regions: Region[],
    opts: WiggleOptions = {},
  ): Promise<RawFeatureArrays[]> {
    return this.readRegions(regions, opts)
  }

  // UNUSED in-tree as of the client-side autoscale move: the wiggle displays
  // derive their domain from the rendered arrays (WiggleCommonMixin's
  // visibleScoreStats), so nothing calls these two or computeStatsFromView
  // above except their own tests. Kept because they override
  // BaseFeatureDataAdapter's much slower feature-walking versions and are part
  // of the adapter surface an external plugin can call. Delete together with
  // computeStatsFromView if that stops being worth carrying.
  public async getRegionQuantitativeStats(
    region: Region,
    opts?: WiggleOptions,
  ) {
    const { start, end } = region
    const view = await this.getArrayFeatureView(region, {
      ...opts,
      bpPerPx: (end - start) / 1000,
    })

    return computeStatsFromView(view, start, end)
  }

  async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts: WiggleOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }
    const stats = await Promise.all(
      regions.map(region => this.getRegionQuantitativeStats(region, opts)),
    )
    return aggregateQuantitativeStats(stats)
  }
}
