import { Observable, merge } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import objectHash from 'object-hash'
import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'
import { ObservableCreate } from '../util/rxjs'
import { checkAbortSignal, observeAbortSignal } from '../util'
import { Feature } from '../util/simpleFeature'
import { AnyConfigurationModel } from '../configuration/configurationSchema'
import { getSubAdapterType } from './dataAdapterCache'
import { Region, NoAssemblyRegion } from '../util/types'

export interface BaseOptions {
  signal?: AbortSignal
  bpPerPx?: number
  headers?: Record<string, string>
  [key: string]: unknown
}

export interface AdapterConstructor {
  new (
    config: AnyConfigurationModel,
    getSubAdapter: getSubAdapterType,
  ): AnyDataAdapter
}

export type AnyDataAdapter = BaseFeatureDataAdapter | BaseRefNameAliasAdapter

/**
 * Base class for feature adapters to extend. Defines some methods that
 * subclasses must implement.
 */
export abstract class BaseFeatureDataAdapter {
  public id: string

  constructor(args: unknown = {}) {
    // note: we use switch on jest here for more simple feature IDs
    // in test environment
    if (typeof jest === 'undefined') {
      const data = isStateTreeNode(args) ? getSnapshot(args) : args
      this.id = objectHash(data, { ignoreUnknown: true }).slice(0, 5)
    } else {
      this.id = 'test'
    }
  }

  /**
   * Get all reference sequence names used in the data source
   *
   * NOTE: If an adapter is unable to determine the reference sequence names,
   * the array will be empty
   * @param opts - Feature adapter options
   */
  public abstract async getRefNames(opts?: BaseOptions): Promise<string[]>
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
   * Called to provide a hint that data tied to a certain region will not be
   * needed for the forseeable future and can be purged from caches, etc
   * @param region - Region
   */
  public abstract freeResources(region: Region): void

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
}

export interface RegionsAdapter extends BaseFeatureDataAdapter {
  getRegions(opts: { signal?: AbortSignal }): Promise<NoAssemblyRegion[]>
}

export function isRegionsAdapter(
  thing: BaseFeatureDataAdapter,
): thing is RegionsAdapter {
  return 'getRegions' in thing
}

export interface Alias {
  refName: string
  aliases: string[]
}
export interface BaseRefNameAliasAdapter {
  getRefNameAliases(opts: BaseOptions): Promise<Alias[]>

  freeResources(): Promise<void>
}
export function isRefNameAliasAdapter(
  thing: object,
): thing is BaseRefNameAliasAdapter {
  return 'getRefNameAliases' in thing
}
