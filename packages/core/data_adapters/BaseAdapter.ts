import { Observable, merge } from 'rxjs'
import { filter, takeUntil, toArray } from 'rxjs/operators'
import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'
import { ObservableCreate } from '../util/rxjs'
import { checkAbortSignal, observeAbortSignal } from '../util'
import { getConf } from '../configuration'
import { Feature } from '../util/simpleFeature'
import {
  AnyConfigurationModel,
  ConfigurationSchema,
} from '../configuration/configurationSchema'
import { getSubAdapterType } from './dataAdapterCache'
import { Region, NoAssemblyRegion } from '../util/types'
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
  | SequenceAdapter

export abstract class BaseAdapter {
  public id: string

  static capabilities = [] as string[]

  config: AnyConfigurationModel

  getSubAdapter?: getSubAdapterType

  pluginManager: PluginManager | undefined

  constructor(
    config: AnyConfigurationModel = ConfigurationSchema('empty', {}).create(),
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    this.config = config
    this.getSubAdapter = getSubAdapter
    this.pluginManager = pluginManager
    // note: we use switch on jest here for more simple feature IDs
    // in test environment
    if (typeof jest === 'undefined') {
      const data = isStateTreeNode(config) ? getSnapshot(config) : config
      this.id = `${idMaker(data)}`
    } else {
      this.id = 'test'
    }
  }

  /**
   * Called to provide a hint that data tied to a certain region will not be
   * needed for the forseeable future and can be purged from caches, etc
   * @param region - Region
   */
  public abstract freeResources(region: Region): void
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

  /**
   * Get features from the data source that overlap a region
   * @param region - Region
   * @param options - Feature adapter options
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
        // console.warn(`no data for ${region.refName}`)
        observer.complete()
      } else {
        this.getFeatures(region, opts)
          .pipe(takeUntil(observeAbortSignal(opts.signal)))
          .subscribe(observer)
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
   * @param regions - Regions
   * @param opts - Feature adapter options
   * @returns Observable of Feature objects in the regions
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    const obs = merge(
      ...regions.map(region => {
        return ObservableCreate<Feature>(async observer => {
          const hasData = await this.hasDataForRefName(region.refName, opts)
          checkAbortSignal(opts.signal)
          if (!hasData) {
            // console.warn(`no data for ${region.refName}`)
            observer.complete()
          } else {
            this.getFeatures(region, opts).subscribe(observer)
          }
        })
      }),
    )

    if (opts.signal) {
      return obs.pipe(takeUntil(observeAbortSignal(opts.signal)))
    }
    return obs
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

    const scoreMax = feats
      .map(s => s.scoreMax)
      .reduce((acc, curr) => Math.max(acc, curr))
    const scoreMin = feats
      .map(s => s.scoreMin)
      .reduce((acc, curr) => Math.min(acc, curr))
    const scoreSum = feats.map(s => s.scoreSum).reduce((a, b) => a + b, 0)
    const scoreSumSquares = feats
      .map(s => s.scoreSumSquares)
      .reduce((a, b) => a + b, 0)
    const featureCount = feats
      .map(s => s.featureCount)
      .reduce((a, b) => a + b, 0)
    const basesCovered = feats
      .map(s => s.basesCovered)
      .reduce((a, b) => a + b, 0)

    return rectifyStats({
      scoreMin,
      scoreMax,
      featureCount,
      basesCovered,
      scoreSumSquares,
      scoreSum,
    })
  }

  public async estimateGlobalStats(region: Region, opts?: BaseOptions) {
    // look at jb1 code
    // _estimateGlobalStats: function( refseq ) {
    //   var deferred = new Deferred();
    //   refseq = refseq || this.refSeq;
    //   var timeout = this.storeTimeout || 3000; // put in config
    //   if (this.storeTimeout == 0) {
    //       deferred.resolve( { featureDensity: 0, error: 'global stats estimation timed out' } )
    //       return
    //   }

    return new Promise((resolve, reject) => {
      const timeout = 3000 // or get from config
      const startTime = Date.now()

      // @ts-ignore remove this ignore when adding timeout to config
      if (timeout === 0) {
        reject('Error: global stats estimation timed out')
      }

      const statsFromInterval = async (length: number) => {
        const sampleCenter = region.start * 0.75 + region.end * 0.25
        const start = Math.max(0, Math.round(sampleCenter - length / 2))
        const end = Math.min(Math.round(sampleCenter + length / 2), region.end)

        const feats = this.getFeatures(region, opts)
        const features = await feats
          .pipe(
            filter(
              (f: Feature) => f.get('start') >= start && f.get('end') <= end,
            ),
            toArray(),
          )
          .toPromise()

        const correctionFactor =
          (getConf('topLevelFeaturesPercent') || 100) / 100
        const featureDensity = (features.length / length) * correctionFactor
        return maybeRecordStats(length, {
          featureDensity: featureDensity,
          correctionFactor: correctionFactor,
          statsSamplefeatures: features.length,
          statsSampleInternval: region,
        })
      }
      //   var startTime = new Date();
      //   var statsFromInterval = function( length, callback ) {
      //       var thisB = this;
      //       var sampleCenter = refseq.start*0.75 + refseq.end*0.25;
      //       var start = Math.max( 0, Math.round( sampleCenter - length/2 ) );
      //       var end = Math.min( Math.round( sampleCenter + length/2 ), refseq.end );
      //       var features = [];
      //       //console.log(`${this.source} stats fetching ${refseq.name}:${start}..${end}`)
      //       this._getFeatures({ ref: refseq.name, start: start, end: end},
      //                         function( f ) { features.push(f); },
      //                         function( error ) {
      //                             features = array.filter( features, function(f) { return f.get('start') >= start && f.get('end') <= end; } );
      //                             const correctionFactor = (thisB.getConf('topLevelFeaturesPercent') || 100) / 100
      //                             callback.call( thisB, length,
      //                                            {
      //                                                featureDensity: features.length / length * correctionFactor,
      //                                                _correctionFactor: correctionFactor,
      //                                                _statsSampleFeatures: features.length,
      //                                                _statsSampleInterval: { ref: refseq.name, start: start, end: end, length: length }
      //                                            });
      //                         },
      //                         function( error ) {
      //                                 callback.call( thisB, length,  null, error );
      //                         });
      //   };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybeRecordStats = (interval: number, stats: any) => {
        const refLen = region.end - region.start
        if (stats.statsSampleFeatures >= 300 || interval * 2 > refLen) {
          resolve(stats)
        } else if (Date.now() - startTime < timeout) {
          statsFromInterval(interval * 2)
        } else {
          console.error('Stats estimation reached timeout')
          resolve({ featureDensity: 0 })
        }
      }
    })
    //   var maybeRecordStats = function( interval, stats, error ) {
    //       if( error ) {
    //           if( error.isInstanceOf && error.isInstanceOf(Errors.DataOverflow) ) {
    //                console.log( 'Store statistics found chunkSizeLimit error, using empty: '+(this.source||this.name) );
    //                deferred.resolve( { featureDensity: 0, error: 'global stats estimation found chunkSizeError' } );
    //           }
    //           else {
    //               deferred.reject( error );
    //           }
    //       } else {
    //            var refLen = refseq.end - refseq.start;
    //            if( stats._statsSampleFeatures >= 300 || interval * 2 > refLen || error ) {
    //                console.log( 'Store statistics: '+(this.source||this.name), stats );
    //                deferred.resolve( stats );
    //            } else if( ((new Date()) - startTime) < timeout ) {
    //                statsFromInterval.call( this, interval * 2, maybeRecordStats );
    //            } else {
    //                console.log( 'Store statistics timed out: '+(this.source||this.name) );
    //                deferred.resolve( { featureDensity: 0, error: 'global stats estimation timed out' } );
    //            }
    //       }
    //   };
    //   statsFromInterval.call( this, 100, maybeRecordStats ); // inside the promise
    //   return deferred; // outside the promise,
  }
}

export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}

export interface SequenceAdapter
  extends BaseFeatureDataAdapter,
    RegionsAdapter {}

export function isSequenceAdapter(
  thing: AnyDataAdapter,
): thing is SequenceAdapter {
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
