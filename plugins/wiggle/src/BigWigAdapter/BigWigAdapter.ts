import { BigWig } from '@gmod/bbi'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { rectifyStats } from '@jbrowse/core/util/stats'

import type { WiggleFeatureArrays } from '../drawXY'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { UnrectifiedQuantitativeStats } from '@jbrowse/core/util/stats'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

interface WiggleOptions extends BaseOptions {
  resolution?: number
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

      const { starts, ends, scores, isSummary } = arrays
      const minScores = isSummary ? arrays.minScores : undefined
      const maxScores = isSummary ? arrays.maxScores : undefined

      for (const [i, start_] of starts.entries()) {
        const featureStart = start_
        const featureEnd = ends[i]!
        const score = scores[i]!
        const uniqueId = `${source}:${refName}:${featureStart}-${featureEnd}`

        observer.next({
          get: (str: string) => {
            switch (str) {
              case 'start':
                return featureStart
              case 'end':
                return featureEnd
              case 'score':
                return score
              case 'refName':
                return refName
              case 'source':
                return source
              case 'summary':
                return isSummary
              case 'minScore':
                return minScores?.[i]
              case 'maxScore':
                return maxScores?.[i]
              default:
                return undefined
            }
          },
          id: () => uniqueId,
          toJSON: () => ({
            start: featureStart,
            end: featureEnd,
            score,
            refName,
            source,
            uniqueId,
            summary: isSummary,
            minScore: isSummary ? arrays.minScores[i] : undefined,
            maxScore: isSummary ? arrays.maxScores[i] : undefined,
          }),
        })
      }
      observer.complete()
    }, stopToken)
  }

  /**
   * Returns raw feature arrays directly from the BigWig file.
   * This is more efficient than getFeatures() when you don't need Feature objects.
   */
  public async getFeaturesAsArrays(
    region: Region,
    opts: WiggleOptions = {},
  ): Promise<WiggleFeatureArrays> {
    const { refName, start, end } = region
    const { bpPerPx = 0, resolution = 1, statusCallback = () => {} } = opts
    const resolutionMultiplier = this.getConf('resolutionMultiplier')

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

    return {
      starts: arrays.starts,
      ends: arrays.ends,
      scores: arrays.scores,
      minScores: arrays.isSummary ? arrays.minScores : undefined,
      maxScores: arrays.isSummary ? arrays.maxScores : undefined,
    }
  }

  /**
   * Optimized stats calculation using arrays directly instead of Feature objects.
   */
  public async getRegionQuantitativeStats(
    region: Region,
    opts?: WiggleOptions,
  ) {
    const { start, end } = region
    const arrays = await this.getFeaturesAsArrays(region, {
      ...opts,
      // use low resolution for stats estimation
      bpPerPx: (end - start) / 1000,
    })

    const { scores, minScores, maxScores } = arrays
    const len = scores.length

    if (len === 0) {
      return {
        scoreMin: 0,
        scoreMax: 0,
        scoreSum: 0,
        scoreSumSquares: 0,
        scoreMean: 0,
        scoreStdDev: 0,
        featureCount: 0,
        basesCovered: end - start,
        featureDensity: 0,
      }
    }

    let scoreMin = Number.MAX_VALUE
    let scoreMax = Number.MIN_VALUE
    let scoreSum = 0
    let scoreSumSquares = 0

    for (let i = 0; i < len; i++) {
      const score = scores[i]!
      const min = minScores?.[i] ?? score
      const max = maxScores?.[i] ?? score

      scoreMin = Math.min(scoreMin, min)
      scoreMax = Math.max(scoreMax, max)
      scoreSum += score
      scoreSumSquares += score * score
    }

    const scoreMean = scoreSum / len
    const scoreStdDev = Math.sqrt(scoreSumSquares / len - scoreMean * scoreMean)

    return {
      scoreMin,
      scoreMax,
      scoreSum,
      scoreSumSquares,
      scoreMean,
      scoreStdDev,
      featureCount: len,
      basesCovered: end - start,
      featureDensity: len / (end - start),
    }
  }

  // always render bigwig instead of calculating a feature density for it
  async getMultiRegionFeatureDensityStats(_regions: Region[]) {
    return {
      featureDensity: 0,
    }
  }
}

export { type WiggleFeatureArrays } from '../drawXY'
