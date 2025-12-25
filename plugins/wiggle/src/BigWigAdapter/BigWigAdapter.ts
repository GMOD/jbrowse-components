import { ArrayFeatureView, BigWig } from '@gmod/bbi'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import { updateStatus } from '@jbrowse/core/util'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { rectifyStats } from '@jbrowse/core/util/stats'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { UnrectifiedQuantitativeStats } from '@jbrowse/core/util/stats'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

interface WiggleOptions extends BaseOptions {
  resolution?: number
  staticBlocks?: Region[]
}

interface CachedStats {
  view: ArrayFeatureView
  region: Region
}

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

  // Cache for stats arrays (keyed by region string)
  private statsCache = new QuickLRU<string, CachedStats>({
    maxSize: 50,
    maxAge: 5 * 60 * 1000, // 5 minute TTL
  })

  public static capabilities = [
    'hasResolution',
    'hasLocalStats',
    'hasGlobalStats',
  ]

  // private estimateCacheBytes() {
  //   let total = 0
  //   for (const cached of this.statsCache.values()) {
  //     total += estimateArraysByteSize(cached.arrays)
  //   }
  //   return total
  // }

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

  /**
   * Override to use static blocks for caching when available.
   * Static blocks are stable "tiles" that don't change on small pans,
   * providing better cache hit rates than dynamic blocks.
   */
  async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts: WiggleOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }

    const { staticBlocks } = opts

    // If staticBlocks provided, use them for caching and subselect for dynamic regions
    if (staticBlocks?.length) {
      // Fetch data for all static blocks (with caching)
      const staticBlockData = await Promise.all(
        staticBlocks.map(async block => {
          const cacheKey = `${block.refName}:${block.start}-${block.end}`
          let cached = this.statsCache.get(cacheKey)

          if (!cached) {
            const { start, end } = block
            const view = await this.getArrayFeatureView(block, {
              ...opts,
              bpPerPx: (end - start) / 1000,
            })
            cached = { view, region: block }
            this.statsCache.set(cacheKey, cached)
          }

          return cached
        }),
      )

      // For each dynamic region, find overlapping static blocks and compute stats
      const regionStats = regions.map(region => {
        const overlappingBlocks = staticBlockData.filter(
          ({ region: block }) =>
            block.refName === region.refName &&
            block.start < region.end &&
            block.end > region.start,
        )

        if (overlappingBlocks.length === 0) {
          return {
            scoreMin: 0,
            scoreMax: 0,
            scoreSum: 0,
            scoreSumSquares: 0,
            scoreMean: 0,
            scoreStdDev: 0,
            featureCount: 0,
            basesCovered: region.end - region.start,
            featureDensity: 0,
          }
        }

        // Compute stats from overlapping blocks, subselecting to region bounds
        const blockStats = overlappingBlocks.map(({ view }) =>
          computeStatsFromView(view, region.start, region.end),
        )

        return aggregateQuantitativeStats(blockStats)
      })

      return aggregateQuantitativeStats(regionStats)
    }

    // Fallback: fetch directly for each dynamic region (original behavior)
    const stats = await Promise.all(
      regions.map(region => this.getRegionQuantitativeStats(region, opts)),
    )
    return aggregateQuantitativeStats(stats)
  }
}
