import { Observable, firstValueFrom, merge } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'

// locals
import { ObservableCreate } from '../util/rxjs'
import { checkAbortSignal, sum, max, min } from '../util'
import { Feature } from '../util/simpleFeature'
import {
  readConfObject,
  AnyConfigurationModel,
  ConfigurationSchema,
} from '../configuration'
import { getSubAdapterType } from './dataAdapterCache'
import { AugmentedRegion as Region, NoAssemblyRegion } from '../util/types'
import { blankStats, rectifyStats, scoresToStats } from '../util/stats'
import BaseResult from '../TextSearch/BaseResults'
import idMaker from '../util/idMaker'
import PluginManager from '../PluginManager'

export interface BaseOptions {
  signal?: AbortSignal
  bpPerPx?: number
  sessionId?: string
  statusCallback?: (message: string) => void
  headers?: Record<string, string>
  [key: string]: unknown
}

export type SearchType = 'full' | 'prefix' | 'exact'

export interface BaseArgs {
  searchType?: SearchType
  queryString: string
  signal?: AbortSignal
  limit?: number
  pageNumber?: number
}
// see
// https://www.typescriptlang.org/docs/handbook/2/classes.html#abstract-construct-signatures
// for why this is the abstract construct signature
export interface AnyAdapter {
  new (
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager | undefined,
  ): AnyDataAdapter
}

export type AnyDataAdapter =
  | BaseAdapter
  | BaseFeatureDataAdapter
  | BaseRefNameAliasAdapter
  | BaseTextSearchAdapter
  | RegionsAdapter
  | BaseSequenceAdapter

export interface SequenceAdapter
  extends BaseFeatureDataAdapter,
    RegionsAdapter {}

const EmptyConfig = ConfigurationSchema('empty', {})

export abstract class BaseAdapter {
  public id: string

  static capabilities = [] as string[]

  constructor(
    public config: AnyConfigurationModel = EmptyConfig.create(),
    public getSubAdapter?: getSubAdapterType,
    public pluginManager?: PluginManager,
  ) {
    // note: we use switch on jest here for more simple feature IDs
    // in test environment
    if (typeof jest === 'undefined') {
      const data = isStateTreeNode(config) ? getSnapshot(config) : config
      this.id = `${idMaker(data)}`
    } else {
      this.id = 'test'
    }
  }

  getConf(arg: string | string[]) {
    return readConfObject(this.config, arg)
  }

  /**
   * Called to provide a hint that data tied to a certain region will not be
   * needed for the foreseeable future and can be purged from caches, etc
   * @param region - Region
   */
  public abstract freeResources(region: Region): void
}

export interface Stats {
  featureDensity?: number
  fetchSizeLimit?: number
  bytes?: number
}

/**
 * Base class for feature adapters to extend. Defines some methods that
 * subclasses must implement.
 */
export abstract class BaseFeatureDataAdapter extends BaseAdapter {
  /**
   * Get all reference sequence names used in the data source
   *
   * NOTE: If an adapter is unable to determine the reference sequence names,
   * the array will be empty
   * @param opts - Feature adapter options
   */
  public abstract getRefNames(opts?: BaseOptions): Promise<string[]>
  // public abstract async getRefNames(opts?: BaseOptions): Promise<string[]>
  //   await this.setup()
  //   const { refNames } = this.metadata
  //   return refNames
  // }
  //

  /**
   * Get features from the data source that overlap a region
   * @param region - Region
   * @param opts - Feature adapter options
   * @returns Observable of Feature objects in the region
   */
  public abstract getFeatures(
    region: Region,
    opts?: BaseOptions,
  ): Observable<Feature>
  // public abstract getFeatures(
  //   region: Region,
  //   opts: BaseOptions,
  // ): Observable<Feature> {
  //   return ObservableCreate(observer => {
  //     const records = getRecords(assembly, refName, start, end)
  //     records.forEach(record => {
  //       observer.next(this.recordToFeature(record))
  //     })
  //     observer.complete()
  //   })
  // }

  /**
   * Return "header info" that is fetched from the data file, or other info
   * that would not simply be in the config of the file. The return value can
   * be `{tag:string, data: any}[]` e.g. list of tags with their values which
   * is how VCF,BAM,CRAM return values for getInfo or it can be a nested JSON
   * object
   */
  public async getHeader(_opts?: BaseOptions): Promise<unknown> {
    return null
  }

  /**
   * Return info that is primarily used for interpreting the data that is there,
   * primarily in reference to being used for augmenting feature details panels
   */
  public async getMetadata(_opts?: BaseOptions): Promise<unknown> {
    return null
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   */
  public getFeaturesInRegion(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const hasData = await this.hasDataForRefName(region.refName, opts)
      checkAbortSignal(opts.signal)
      if (!hasData) {
        observer.complete()
      } else {
        this.getFeatures(region, opts).subscribe(observer)
      }
    })
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters
   * that are frequently called on multiple regions simultaneously may
   * want to implement a more efficient custom version of this method.
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters that
   * are frequently called on multiple regions simultaneously may want to
   * implement a more efficient custom version of this method.
   *
   * @param regions - Regions
   * @param opts - Feature adapter options
   * @returns Observable of Feature objects in the regions
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    return merge(
      ...regions.map(region => {
        return this.getFeaturesInRegion(region, opts)
      }),
    )
  }

  /**
   * Check if the store has data for the given reference name.
   * @param refName - Name of the reference sequence
   * @returns Whether data source has data for the given reference name
   */
  public async hasDataForRefName(refName: string, opts: BaseOptions = {}) {
    const refNames = await this.getRefNames(opts)
    return refNames.includes(refName)
  }

  public async getRegionStats(region: Region, opts?: BaseOptions) {
    const feats = this.getFeatures(region, opts)
    return scoresToStats(region, feats)
  }

  public async getMultiRegionStats(regions: Region[] = [], opts?: BaseOptions) {
    if (!regions.length) {
      return blankStats()
    }
    const feats = await Promise.all(
      regions.map(region => this.getRegionStats(region, opts)),
    )

    const scoreMax = max(feats.map(a => a.scoreMax))
    const scoreMin = min(feats.map(a => a.scoreMin))
    const scoreSum = sum(feats.map(a => a.scoreSum))
    const scoreSumSquares = sum(feats.map(a => a.scoreSumSquares))
    const featureCount = sum(feats.map(a => a.featureCount))
    const basesCovered = sum(feats.map(a => a.basesCovered))

    return rectifyStats({
      scoreMin,
      scoreMax,
      featureCount,
      basesCovered,
      scoreSumSquares,
      scoreSum,
    })
  }

  public async estimateRegionsStats(regions: Region[], opts?: BaseOptions) {
    if (!regions.length) {
      throw new Error('No regions to estimate stats for')
    }
    const region = regions[0]
    let lastTime = +Date.now()
    const statsFromInterval = async (length: number, expansionTime: number) => {
      const { start, end } = region
      const sampleCenter = start * 0.75 + end * 0.25
      const query = {
        ...region,
        start: Math.max(0, Math.round(sampleCenter - length / 2)),
        end: Math.min(Math.round(sampleCenter + length / 2), end),
      }

      const features = await firstValueFrom(
        this.getFeatures(query, opts).pipe(toArray()),
      )

      return maybeRecordStats(
        length,
        { featureDensity: features.length / length },
        features.length,
        expansionTime,
      )
    }

    const maybeRecordStats = async (
      interval: number,
      stats: Stats,
      statsSampleFeatures: number,
      expansionTime: number,
    ): Promise<Stats> => {
      const refLen = region.end - region.start
      if (statsSampleFeatures >= 70 || interval * 2 > refLen) {
        return stats
      } else if (expansionTime <= 5000) {
        const currTime = +Date.now()
        expansionTime += currTime - lastTime
        lastTime = currTime
        return statsFromInterval(interval * 2, expansionTime)
      } else {
        console.warn(
          "Stats estimation reached timeout, or didn't get enough features",
        )
        return { featureDensity: Number.POSITIVE_INFINITY }
      }
    }

    return statsFromInterval(1000, 0)
  }
}

export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}

export abstract class BaseSequenceAdapter
  extends BaseFeatureDataAdapter
  implements RegionsAdapter
{
  async estimateRegionsStats() {
    return { featureDensity: 0 }
  }

  abstract getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}

export function isSequenceAdapter(
  thing: AnyDataAdapter,
): thing is BaseSequenceAdapter {
  return 'getRegions' in thing && 'getFeatures' in thing
}

export function isRegionsAdapter(
  thing: AnyDataAdapter,
): thing is RegionsAdapter {
  return 'getRegions' in thing
}

export function isFeatureAdapter(
  thing: AnyDataAdapter,
): thing is BaseFeatureDataAdapter {
  return 'getFeatures' in thing
}

export interface Alias {
  refName: string
  aliases: string[]
}
export interface BaseRefNameAliasAdapter extends BaseAdapter {
  getRefNameAliases(opts: BaseOptions): Promise<Alias[]>
}
export function isRefNameAliasAdapter(
  thing: object,
): thing is BaseRefNameAliasAdapter {
  return 'getRefNameAliases' in thing
}
export interface BaseTextSearchAdapter extends BaseAdapter {
  searchIndex(args: BaseArgs): Promise<BaseResult[]>
}
export function isTextSearchAdapter(
  thing: AnyDataAdapter,
): thing is BaseTextSearchAdapter {
  return 'searchIndex' in thing
}
