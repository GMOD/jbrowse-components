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

import { fetchSequence } from '../util'
import { generateCoverageBinsPrefixSum } from './generateCoverageBinsPrefixSum'

import type { CoverageBinsSoA } from './generateCoverageBinsPrefixSum'
import type {
  ColorBy,
  FeatureWithMismatchIterator,
  FilterBy,
} from '../shared/types'
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
  return `${region.refName}:${region.start}-${region.end}|${makeFilterByKey(opts.filterBy)}`
}

function makeCacheKey(region: Region, opts: SNPCoverageOptions) {
  const { colorBy } = opts

  const colorByKey = colorBy
    ? `${colorBy.type}|${colorBy.tag ?? ''}|${colorBy.modifications?.twoColor ?? ''}|${colorBy.modifications?.isolatedModification ?? ''}|${colorBy.modifications?.threshold ?? ''}`
    : ''

  return `${makeRegionFilterKey(region, opts)}|${colorByKey}`
}

// function estimateBinsByteSize(bins: CoverageBinsSoA) {
//   const { starts, ends, scores, snpinfo, skipmap } = bins
//   // TypedArrays: 4 bytes per element each
//   const typedArrayBytes =
//     starts.byteLength + ends.byteLength + scores.byteLength
//   // Rough estimate for snpinfo objects (varies based on content)
//   const snpinfoBytes = snpinfo.length * 100 // ~100 bytes per bin estimate
//   // Rough estimate for skipmap
//   const skipmapBytes = Object.keys(skipmap).length * 50
//   return typedArrayBytes + snpinfoBytes + skipmapBytes
// }

// function formatBytes(bytes: number) {
//   if (bytes < 1024) {
//     return `${bytes}B`
//   }
//   if (bytes < 1024 * 1024) {
//     return `${(bytes / 1024).toFixed(1)}KB`
//   }
//   return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
// }

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

  for (const [i, start] of starts.entries()) {
    const pos = start
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

  // Cache for coverage results (keyed by region+filterBy+colorBy)
  // Stats estimation uses empty colorBy key, full rendering includes colorBy
  private cache = new QuickLRU<string, CoverageBinsSoA>({
    maxSize: 50,
    maxAge: 5 * 60 * 1000, // 5 minute TTL
  })

  private lastBpPerPx?: number

  // private estimateCacheBytes() {
  //   let total = 0
  //   for (const bins of this.cache.values()) {
  //     total += estimateBinsByteSize(bins)
  //   }
  //   return total
  // }

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
          this.getFeaturesAsArrays(block, {
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
