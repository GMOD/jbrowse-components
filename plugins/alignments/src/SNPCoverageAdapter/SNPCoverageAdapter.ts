import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
  rectifyStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { fetchSequence } from '../util'
import {
  type CoverageBinsSoA,
  generateCoverageBinsPrefixSum,
} from './generateCoverageBinsPrefixSum'

import type { ColorBy, FeatureWithMismatchIterator, FilterBy } from '../shared/types'
import type {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

interface SNPCoverageOptions extends BaseOptions {
  filterBy?: FilterBy
  colorBy?: ColorBy
  staticBlocks?: Region[]
}

function makeFilterByKey(filterBy?: FilterBy) {
  return filterBy
    ? `${filterBy.flagExclude}|${filterBy.flagInclude}|${filterBy.readName ?? ''}|${filterBy.tagFilter?.tag ?? ''}|${filterBy.tagFilter?.value ?? ''}`
    : ''
}

function makeRegionFilterKey(region: Region, opts: SNPCoverageOptions) {
  return `${region.refName}:${region.start}-${region.end}|${makeFilterByKey(opts.filterBy)}`
}

function makeCacheKey(region: Region, opts: SNPCoverageOptions) {
  const { colorBy } = opts

  const colorByKey = colorBy
    ? `${colorBy.type}|${colorBy.tag ?? ''}|${colorBy.modifications?.twoColor ?? ''}|${colorBy.modifications?.isolatedModification ?? ''}|${colorBy.modifications?.threshold ?? ''}`
    : ''

  return `${makeRegionFilterKey(region, opts)}|${colorByKey}`
}

function computeStatsFromBins(
  bins: CoverageBinsSoA,
  regionStart: number,
  regionEnd: number,
) {
  const { starts, scores } = bins
  let scoreMin = Number.MAX_VALUE
  let scoreMax = Number.MIN_VALUE
  let scoreSum = 0
  let scoreSumSquares = 0
  let featureCount = 0

  for (let i = 0; i < starts.length; i++) {
    const pos = starts[i]!
    if (pos >= regionStart && pos < regionEnd) {
      const score = scores[i]!
      scoreMin = Math.min(scoreMin, score)
      scoreMax = Math.max(scoreMax, score)
      scoreSum += score
      scoreSumSquares += score * score
      featureCount++
    }
  }

  return {
    scoreMin: featureCount > 0 ? scoreMin : 0,
    scoreMax: featureCount > 0 ? scoreMax : 0,
    scoreSum,
    scoreSumSquares,
    featureCount,
    basesCovered: featureCount,
  }
}

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  private sequenceAdapterP?: Promise<BaseSequenceAdapter | undefined>

  private subadapterRef?: BaseFeatureDataAdapter

  // Full results cache (includes mismatch/modification data)
  private cache = new QuickLRU<string, CoverageBinsSoA>({ maxSize: 50 })

  // Depth-only cache for statsEstimationMode (keyed by region+filterBy only)
  private depthCache = new QuickLRU<string, CoverageBinsSoA>({ maxSize: 50 })

  private lastBpPerPx?: number

  /**
   * Override to propagate sequenceAdapterConfig to the subadapter
   */
  setSequenceAdapterConfig(config: Record<string, unknown>) {
    super.setSequenceAdapterConfig(config)
    // Propagate to subadapter if it exists
    if (this.subadapterRef) {
      this.subadapterRef.setSequenceAdapterConfig(config)
    }
  }

  protected async configure() {
    const subadapterConfigBase = this.getConf('subadapter')

    // Initialize from config if not set externally via setSequenceAdapterConfig
    this.sequenceAdapterConfig ??= this.getConf('sequenceAdapter')

    // Use the base subadapter config to ensure consistent cache keys
    const dataAdapter = await this.getSubAdapter?.(subadapterConfigBase)

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    const subadapter = dataAdapter.dataAdapter as BaseFeatureDataAdapter
    this.subadapterRef = subadapter

    // Propagate sequenceAdapterConfig to the subadapter
    if (this.sequenceAdapterConfig) {
      subadapter.setSequenceAdapterConfig(this.sequenceAdapterConfig)
    }

    return { subadapter }
  }

  async getSequenceAdapter() {
    const config = this.sequenceAdapterConfig ?? this.getConf('sequenceAdapter')
    if (!config || !this.getSubAdapter) {
      return undefined
    }
    this.sequenceAdapterP ??= this.getSubAdapter(config)
      .then(r => {
        const adapter = r.dataAdapter as BaseSequenceAdapter
        // verify adapter has getSequence method (e.g. ChromSizesAdapter doesn't)
        return 'getSequence' in adapter ? adapter : undefined
      })
      .catch((e: unknown) => {
        this.sequenceAdapterP = undefined
        throw e
      })
    return this.sequenceAdapterP
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { starts, ends, scores, snpinfo, skipmap } =
        await this.getFeaturesAsArrays(region, opts)

      // Emit coverage features
      for (const [i, start_] of starts.entries()) {
        const start = start_
        observer.next(
          new SimpleFeature({
            id: `${this.id}-${start}`,
            data: {
              score: scores[i],
              snpinfo: snpinfo[i],
              start,
              end: ends[i],
              refName: region.refName,
            },
          }),
        )
      }

      // Emit skip features for arc rendering
      for (const [key, skip] of Object.entries(skipmap)) {
        observer.next(
          new SimpleFeature({
            id: key,
            data: {
              type: 'skip',
              refName: region.refName,
              start: skip.start,
              end: skip.end,
              strand: skip.strand,
              score: skip.score,
              effectiveStrand: skip.effectiveStrand,
            },
          }),
        )
      }

      observer.complete()
    }, opts.stopToken)
  }

  async getFeaturesAsArrays(
    region: Region,
    opts: SNPCoverageOptions = {},
  ): Promise<CoverageBinsSoA> {
    const { bpPerPx, statsEstimationMode } = opts

    // For statsEstimationMode, check caches before computing
    if (statsEstimationMode) {
      const depthKey = makeRegionFilterKey(region, opts)

      // First check depthCache (exact match for region+filterBy)
      const cachedDepth = this.depthCache.get(depthKey)
      if (cachedDepth) {
        console.log(
          `[SNPCoverageAdapter] depthCache HIT for statsEstimation ${region.refName}:${region.start}-${region.end}`,
        )
        return cachedDepth
      }

      // Check main cache for any entry matching this region+filterBy (any colorBy)
      for (const key of this.cache.keys()) {
        if (key.startsWith(depthKey + '|')) {
          const cached = this.cache.get(key)
          if (cached) {
            console.log(
              `[SNPCoverageAdapter] main cache HIT for statsEstimation ${region.refName}:${region.start}-${region.end} (reusing full result)`,
            )
            return cached
          }
        }
      }

      console.log(
        `[SNPCoverageAdapter] cache MISS for statsEstimation ${region.refName}:${region.start}-${region.end}`,
      )
      const { subadapter } = await this.configure()
      const features = await firstValueFrom(
        subadapter.getFeatures(region, opts).pipe(toArray()),
      )
      const result = await generateCoverageBinsPrefixSum({
        features: features as FeatureWithMismatchIterator[],
        region,
        opts,
      })
      this.depthCache.set(depthKey, result)
      return result
    }

    // Clear caches when bpPerPx changes (zoom level changed)
    if (this.lastBpPerPx !== undefined && this.lastBpPerPx !== bpPerPx) {
      console.log(
        `[SNPCoverageAdapter] bpPerPx changed (${this.lastBpPerPx} -> ${bpPerPx}), clearing caches (had ${this.cache.size} + ${this.depthCache.size} entries)`,
      )
      this.cache.clear()
      this.depthCache.clear()
    }
    this.lastBpPerPx = bpPerPx

    const cacheKey = makeCacheKey(region, opts)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      console.log(
        `[SNPCoverageAdapter] cache HIT for ${region.refName}:${region.start}-${region.end} (size: ${this.cache.size})`,
      )
      return cached
    }
    console.log(
      `[SNPCoverageAdapter] cache MISS for ${region.refName}:${region.start}-${region.end} (size: ${this.cache.size})`,
    )

    const { subadapter } = await this.configure()
    const sequenceAdapter = await this.getSequenceAdapter()

    const features = await firstValueFrom(
      subadapter.getFeatures(region, opts).pipe(toArray()),
    )

    const result = await generateCoverageBinsPrefixSum({
      features: features as FeatureWithMismatchIterator[],
      region,
      opts,
      fetchSequence: sequenceAdapter
        ? (region: Region) => fetchSequence(region, sequenceAdapter)
        : undefined,
    })

    this.cache.set(cacheKey, result)
    return result
  }

  async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    const { subadapter } = await this.configure()
    return subadapter.getMultiRegionFeatureDensityStats(regions, opts)
  }

  async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts: SNPCoverageOptions = {},
  ) {
    if (!regions.length) {
      return blankStats()
    }

    const { staticBlocks } = opts

    // If staticBlocks provided, use them for caching and subselect for dynamic regions
    if (staticBlocks?.length) {
      // Fetch data for all static blocks (these will be cached)
      const staticBlockData = await Promise.all(
        staticBlocks.map(block =>
          this.getFeaturesAsArrays(block, {
            ...opts,
            statsEstimationMode: true,
          }).then(bins => ({ block, bins })),
        ),
      )

      console.log(
        `[SNPCoverageAdapter] fetched ${staticBlocks.length} static blocks for stats`,
      )

      // For each dynamic region, find overlapping static blocks and compute stats
      const regionStats = regions.map(region => {
        const overlappingBlocks = staticBlockData.filter(
          ({ block }) =>
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
            featureCount: 0,
            basesCovered: 0,
          }
        }

        // Compute stats from overlapping blocks, subselecting to region bounds
        const blockStats = overlappingBlocks.map(({ bins }) =>
          computeStatsFromBins(bins, region.start, region.end),
        )

        return aggregateQuantitativeStats(blockStats.map(s => rectifyStats(s)))
      })

      return aggregateQuantitativeStats(regionStats)
    }

    // Fallback: fetch directly for each dynamic region (original behavior)
    const stats = await Promise.all(
      regions.map(region => this.getRegionQuantitativeStats(region, opts)),
    )
    return aggregateQuantitativeStats(stats)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { subadapter } = await this.configure()
    return subadapter.getRefNames(opts)
  }

  freeResources(region: Region) {
    const prefix = `${region.refName}:`
    let cleared = 0
    let depthCleared = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        cleared++
      }
    }
    for (const key of this.depthCache.keys()) {
      if (key.startsWith(prefix)) {
        this.depthCache.delete(key)
        depthCleared++
      }
    }
    if (cleared > 0 || depthCleared > 0) {
      console.log(
        `[SNPCoverageAdapter] freeResources cleared ${cleared} + ${depthCleared} cache entries for ${region.refName} (remaining: ${this.cache.size} + ${this.depthCache.size})`,
      )
    }
  }
}
