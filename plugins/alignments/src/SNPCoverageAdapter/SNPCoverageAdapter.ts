import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  aggregateQuantitativeStats,
  blankStats,
} from '@jbrowse/core/data_adapters/BaseAdapter/stats'
import QuickLRU from '@jbrowse/core/util/QuickLRU'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { rectifyStats } from '@jbrowse/core/util/stats'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { fetchSequence } from '../util.ts'
import {
  finalizeLazyBin,
  generateCoverageBinsPrefixSum,
} from './generateCoverageBinsPrefixSum.ts'

import type { CoverageBinsResult } from './generateCoverageBinsPrefixSum.ts'
import type {
  ColorBy,
  FeatureWithMismatchIterator,
  FilterBy,
} from '../shared/types.ts'
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
  statsEstimationMode?: boolean
}

function makeFilterByKey(filterBy?: FilterBy) {
  return filterBy
    ? `${filterBy.flagExclude}|${filterBy.flagInclude}|${filterBy.readName ?? ''}|${filterBy.tagFilter?.tag ?? ''}|${filterBy.tagFilter?.value ?? ''}`
    : ''
}

function makeRegionFilterKey(region: Region, opts: SNPCoverageOptions) {
  return `${region.refName}:${region.start}-${region.end}|${makeFilterByKey(opts.filterBy)}|${opts.trackInstanceId || ''}`
}

function makeCacheKey(region: Region, opts: SNPCoverageOptions) {
  const { colorBy } = opts

  const colorByKey = colorBy
    ? `${colorBy.type}|${colorBy.tag ?? ''}|${colorBy.modifications?.twoColor ?? ''}|${colorBy.modifications?.isolatedModification ?? ''}|${colorBy.modifications?.threshold ?? ''}`
    : ''

  return `${makeRegionFilterKey(region, opts)}|${colorByKey}`
}

function computeStatsFromBins(
  result: CoverageBinsResult,
  targetStart: number,
  targetEnd: number,
) {
  const { bins, regionStart } = result
  let scoreMin = Number.MAX_VALUE
  let scoreMax = Number.MIN_VALUE
  let scoreSum = 0
  let scoreSumSquares = 0
  let featureCount = 0

  for (let i = 0, l = bins.length; i < l; i++) {
    const bin = bins[i]
    if (bin) {
      const pos = regionStart + i
      if (pos >= targetStart && pos < targetEnd) {
        const score = bin.depth
        scoreMin = Math.min(scoreMin, score)
        scoreMax = Math.max(scoreMax, score)
        scoreSum += score
        scoreSumSquares += score * score
        featureCount++
      }
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

  // Cache for coverage results (keyed by region+filterBy+colorBy)
  // Stats estimation uses empty colorBy key, full rendering includes colorBy
  private cache = new QuickLRU<string, CoverageBinsResult>({
    maxSize: 50,
    maxAge: 5 * 60 * 1000, // 5 minute TTL
  })

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
      const { bins, regionStart, skipmap } = await this.getCoverageBins(
        region,
        opts,
      )

      const { refName } = region
      const adapterId = this.id

      // Emit coverage features using lightweight inline feature objects
      for (let i = 0, l = bins.length; i < l; i++) {
        const bin = bins[i]
        if (bin) {
          const start = regionStart + i
          const snpinfo = finalizeLazyBin(bin)
          const score = bin.depth
          observer.next({
            get: (field: string): any => {
              switch (field) {
                case 'start':
                  return start
                case 'end':
                  return start + 1
                case 'score':
                  return score
                case 'snpinfo':
                  return snpinfo
                case 'refName':
                  return refName
                default:
                  return undefined
              }
            },
            id: () => `${adapterId}-${start}`,
            toJSON: () => ({
              uniqueId: `${adapterId}-${start}`,
              start,
              end: start + 1,
              score,
              snpinfo,
              refName,
            }),
          })
        }
      }

      // Emit skip features for arc rendering
      for (const [key, skip] of Object.entries(skipmap)) {
        observer.next(
          new SimpleFeature({
            id: key,
            data: {
              type: 'skip',
              refName,
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

  private async getCoverageBins(
    region: Region,
    opts: SNPCoverageOptions = {},
  ): Promise<CoverageBinsResult> {
    const { bpPerPx, statsEstimationMode } = opts

    // Clear cache when bpPerPx changes (zoom level changed)
    if (this.lastBpPerPx !== undefined && this.lastBpPerPx !== bpPerPx) {
      // console.log(
      //   `[SNPCoverageAdapter] bpPerPx changed (${this.lastBpPerPx} -> ${bpPerPx}), clearing cache`,
      // )
      this.cache.clear()
    }
    this.lastBpPerPx = bpPerPx

    // For statsEstimationMode, check for any cached result with same region+filterBy
    if (statsEstimationMode) {
      const regionFilterKey = makeRegionFilterKey(region, opts)

      // Check cache for any entry matching this region+filterBy (any colorBy)
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${regionFilterKey}|`)) {
          const cached = this.cache.get(key)
          if (cached) {
            // console.log(
            //   `[SNPCoverageAdapter] cache HIT for statsEstimation ${region.refName}:${region.start}-${region.end}`,
            // )
            return cached
          }
        }
      }

      // console.log(
      //   `[SNPCoverageAdapter] cache MISS for statsEstimation ${region.refName}:${region.start}-${region.end}`,
      // )
      const { subadapter } = await this.configure()
      const features = await firstValueFrom(
        subadapter.getFeatures(region, opts).pipe(toArray()),
      )
      const result = await generateCoverageBinsPrefixSum({
        features: features as FeatureWithMismatchIterator[],
        region,
        opts,
      })
      // Cache with empty colorBy key for stats-only results
      const statsKey = `${regionFilterKey}|`
      this.cache.set(statsKey, result)
      // console.log(
      //   `[SNPCoverageAdapter] cached statsEstimation result`,
      // )
      return result
    }

    const cacheKey = makeCacheKey(region, opts)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      // console.log(
      //   `[SNPCoverageAdapter] cache HIT for ${region.refName}:${region.start}-${region.end}`,
      // )
      return cached
    }
    // console.log(
    //   `[SNPCoverageAdapter] cache MISS for ${region.refName}:${region.start}-${region.end}`,
    // )

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
    // console.log(
    //   `[SNPCoverageAdapter] cached full result: ${formatBytes(estimateBinsByteSize(result))} (total cache: ${formatBytes(this.estimateCacheBytes())})`,
    // )
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
          this.getCoverageBins(block, {
            ...opts,
            statsEstimationMode: true,
          }).then(bins => ({ block, bins })),
        ),
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
          return rectifyStats({
            scoreMin: 0,
            scoreMax: 0,
            scoreSum: 0,
            scoreSumSquares: 0,
            featureCount: 0,
            basesCovered: 0,
          })
        }

        // Compute stats from overlapping blocks, subselecting to region bounds
        const blockStats = overlappingBlocks.map(({ bins }) =>
          rectifyStats(computeStatsFromBins(bins, region.start, region.end)),
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

  async getRefNames(opts: BaseOptions = {}) {
    const { subadapter } = await this.configure()
    return subadapter.getRefNames(opts)
  }

  freeResources(region: Region) {
    const prefix = `${region.refName}:`
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }
}
