import { ArrayFeatureView, BigWig, BigWigFeature } from '@gmod/bbi'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { downloadStatus, updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { calcStdFromSums } from '@jbrowse/core/util/stats'

import type { BigWigAdapterConfig } from './configSchema.ts'
import type { RawFeatureArrays } from '../util.ts'
import type { WiggleAdapterOptions as WiggleOptions } from '../wiggleAdapterOptions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
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
  private setupP?: Promise<{
    bigwig: BigWig
    header: Awaited<ReturnType<BigWig['getHeader']>>
  }>

  public static capabilities = ['hasResolution']

  private async setupPre(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    const pluginManager = this.pluginManager
    const bigwig = new BigWig({
      filehandle: openLocation(this.getConf('bigWigLocation'), pluginManager),
    })
    return {
      bigwig,
      header: await updateStatus(
        'Downloading header',
        statusCallback,
        () => bigwig.getHeader(opts),
      ),
    }
  }

  async setup(opts?: BaseOptions) {
    this.setupP ??= this.setupPre(opts).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
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
    const { stopToken } = opts
    return ObservableCreate<Feature>(async observer => {
      const view = await this.getArrayFeatureView(region, opts)
      for (let i = 0; i < view.length; i++) {
        observer.next(new BigWigFeature(view, i))
      }
      observer.complete()
    }, stopToken)
  }

  private async getArrayFeatureView(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<ArrayFeatureView> {
    const { refName, start, end } = region
    const { bpPerPx = 0, resolution = 1, statusCallback = () => {} } = opts
    const resolutionMultiplier = this.getConf('resolutionMultiplier')
    const source = this.getConf('source')

    const { bigwig } = await this.setup(opts)

    const arrays = await downloadStatus(
      'Downloading wiggle data',
      statusCallback,
      onProgress =>
        bigwig.getFeaturesAsArrays(refName, start, end, {
          ...opts,
          basesPerSpan: (bpPerPx / resolution) * resolutionMultiplier,
          onProgress,
        }),
    )

    return new ArrayFeatureView(arrays, source, refName)
  }

  // bicolorPivot is a display concern (pos/neg color split) and stays out of
  // the adapter API. Callers run processFeaturesFromArrays themselves with the
  // pivot — split happens inline with the data scan, no second pass.
  public async getFeatureArrays(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<RawFeatureArrays> {
    const view = await this.getArrayFeatureView(region, opts)
    return {
      starts: view.starts,
      ends: view.ends,
      scores: view.scores,
      minScores: view.minScores,
      maxScores: view.maxScores,
      count: view.length,
    }
  }

  // Multi-region fast path: one bbi pass over all regions, coalescing adjacent
  // on-disk blocks across region boundaries (fewer range requests than N
  // independent getFeatureArrays calls — the win for collapsed-intron and
  // whole-genome overviews). All regions share one zoom level, selected from the
  // view's bpPerPx, so a single basesPerSpan is correct. The bbi result packs
  // every region into one backing set of typed arrays plus regionOffsets;
  // regionOffsets[i]..regionOffsets[i+1] is region i's copy-free slice.
  public async getFeatureArraysMulti(
    regions: Region[],
    opts: WiggleOptions = {},
  ): Promise<RawFeatureArrays[]> {
    const { bpPerPx = 0, resolution = 1, statusCallback = () => {} } = opts
    const resolutionMultiplier = this.getConf('resolutionMultiplier')
    const { bigwig } = await this.setup(opts)

    const res = await downloadStatus(
      'Downloading wiggle data',
      statusCallback,
      onProgress =>
        bigwig.getFeaturesAsArraysMulti(
          regions.map(r => ({
            refName: r.refName,
            start: r.start,
            end: r.end,
          })),
          {
            ...opts,
            basesPerSpan: (bpPerPx / resolution) * resolutionMultiplier,
            onProgress,
          },
        ),
    )

    const { starts, ends, scores, regionOffsets } = res
    const minScores = res.isSummary ? res.minScores : undefined
    const maxScores = res.isSummary ? res.maxScores : undefined
    return regions.map((_region, i) => {
      const lo = regionOffsets[i]!
      const hi = regionOffsets[i + 1]!
      return {
        starts: starts.subarray(lo, hi),
        ends: ends.subarray(lo, hi),
        scores: scores.subarray(lo, hi),
        minScores: minScores?.subarray(lo, hi),
        maxScores: maxScores?.subarray(lo, hi),
        count: hi - lo,
      }
    })
  }

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

  // bbi zoom levels cap returned data at screen resolution, so a bigwig is
  // never too large to render — skip the density/byte estimate entirely
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      alwaysRender: true,
    }
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
