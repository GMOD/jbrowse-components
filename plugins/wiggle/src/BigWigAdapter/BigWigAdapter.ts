import { ArrayFeatureView, BigWig } from '@gmod/bbi'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { rectifyStats } from '@jbrowse/core/util/stats'

import type { WiggleAdapterOptions as WiggleOptions } from '../wiggleAdapterOptions.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { UnrectifiedQuantitativeStats } from '@jbrowse/core/util/stats'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

function computeStatsFromView(
  view: ArrayFeatureView,
  targetStart: number,
  targetEnd: number,
) {
  const len = view.length

  if (len === 0) {
    return {
      scoreMin: 0,
      scoreMax: 0,
      scoreSum: 0,
      scoreSumSquares: 0,
      scoreMean: 0,
      scoreStdDev: 0,
      featureCount: 0,
      basesCovered: targetEnd - targetStart,
      featureDensity: 0,
    }
  }

  let scoreMin = Number.MAX_VALUE
  let scoreMax = Number.MIN_VALUE
  let scoreMeanMin = Number.MAX_VALUE
  let scoreMeanMax = Number.MIN_VALUE
  let scoreSum = 0
  let scoreSumSquares = 0
  let featureCount = 0

  for (let i = 0; i < len; i++) {
    const featureStart = view.start(i)
    const featureEnd = view.end(i)

    // Skip features outside target range
    if (featureEnd <= targetStart || featureStart >= targetEnd) {
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
      basesCovered: targetEnd - targetStart,
      featureDensity: 0,
    }
  }

  const scoreMean = scoreSum / featureCount
  const scoreStdDev = Math.sqrt(
    scoreSumSquares / featureCount - scoreMean * scoreMean,
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
    basesCovered: targetEnd - targetStart,
    featureDensity: featureCount / (targetEnd - targetStart),
  }
}

export default class BigWigAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<{
    bigwig: BigWig
    header: Awaited<ReturnType<BigWig['getHeader']>>
  }>

  public static capabilities = [
    'hasResolution',
    'hasLocalStats',
    'hasGlobalStats',
  ]

  private async setupPre(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const pluginManager = this.pluginManager
    const bigwig = new BigWig({
      filehandle: openLocation(this.getConf('bigWigLocation'), pluginManager),
    })
    return {
      bigwig,
      header: await updateStatus(
        'Downloading bigwig header',
        statusCallback,
        () => bigwig.getHeader(opts),
      ),
    }
  }

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch((e: unknown) => {
        this.setupP = undefined
        throw e
      })
    }
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

  public async getGlobalStats(opts?: BaseOptions) {
    const { header } = await this.setup(opts)
    return rectifyStats(header.totalSummary as UnrectifiedQuantitativeStats)
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    const { refName, start, end } = region
    const {
      bpPerPx = 0,
      resolution = 1,
      stopToken,
      statusCallback = () => {},
    } = opts
    const source = this.getConf('source')
    const resolutionMultiplier = this.getConf('resolutionMultiplier')

    return ObservableCreate<Feature>(async observer => {
      const { bigwig } = await this.setup(opts)

      const arrays = await updateStatus(
        'Downloading bigwig data',
        statusCallback,
        () =>
          bigwig.getFeaturesAsArrays(refName, start, end, {
            ...opts,
            basesPerSpan: (bpPerPx / resolution) * resolutionMultiplier,
          }),
      )

      const view = new ArrayFeatureView(arrays, source, refName)

      for (let i = 0; i < view.length; i++) {
        const uniqueId = view.id(i)
        const idx = i
        observer.next({
          get: (str: string) => view.get(idx, str) as any,
          id: () => uniqueId,
          toJSON: () => ({
            start: view.start(idx),
            end: view.end(idx),
            score: view.score(idx),
            refName,
            source,
            uniqueId,
            summary: view.isSummary,
            minScore: view.minScore(idx),
            maxScore: view.maxScore(idx),
          }),
        })
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

    const arrays = await updateStatus(
      'Downloading bigwig data',
      statusCallback,
      () =>
        bigwig.getFeaturesAsArrays(refName, start, end, {
          ...opts,
          basesPerSpan: (bpPerPx / resolution) * resolutionMultiplier,
        }),
    )

    return new ArrayFeatureView(arrays, source, refName)
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

  // always render bigwig instead of calculating a feature density for it
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      featureDensity: 0,
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
