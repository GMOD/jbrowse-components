import { Observer, Observable, merge } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { IRegion as Region } from './mst-types'
import { ObservableCreate } from './util/rxjs'
import { checkAbortSignal, observeAbortSignal } from './util'
import { Feature } from './util/simpleFeature'

export interface BaseOptions {
  signal?: AbortSignal
  bpPerPx?: number
}
/**
 * Base class for adapters to extend. Defines some methods that subclasses must
 * implement.
 */
export default abstract class BaseAdapter {
  // List of all possible capabilities. Don't un-comment them here.
  // Example:
  // const capabilities = [
  // 'getFeatures',
  // 'getRefNames',
  // 'getRegions',
  // 'getRefNameAliases',
  // ]
  public static capabilities: string[]

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @returns {Promise<string[]>} Array of reference sequence names used by the
   * source being adapted.
   *
   * Subclass method should look something like this:
   * await this.setup()
   * const { refNames } = this.metadata
   *
   * NOTE: if an adapter is unable to get it's own list of ref names, return empty
   *
   */
  public abstract async getRefNames(opts?: BaseOptions): Promise<string[]>

  /**
   * Subclasses should override this method. Method signature here for reference.
   *
   * Subclass method should look something like this:
   *    return ObservableCreate(observer => {
   *      const records = getRecords(assembly, refName, start, end)
   *      records.forEach(record => {
   *        observer.next(this.recordToFeature(record))
   *      })
   *      observer.complete()
   *    })
   * @param {Region} region
   * @param {BaseOptions} options
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public abstract getFeatures(
    region: Region,
    opts: BaseOptions,
  ): Observable<Feature>

  /**
   * Subclasses should override this method. Method signature here for reference.
   *
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   * @param {Region} region
   */
  public abstract freeResources(region: Region): void

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   * @param {Region} region see getFeatures()
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} see getFeatures()
   */
  public getFeaturesInRegion(
    region: Region,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    return ObservableCreate(async (observer: Observer<Feature>) => {
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
   * @param {[Region]} regions see getFeatures()
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} see getFeatures()
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ): Observable<Feature> {
    const obs = merge(
      ...regions.map(region => this.getFeaturesInRegion(region, opts)),
    )

    if (opts.signal) return obs.pipe(takeUntil(observeAbortSignal(opts.signal)))
    return obs
  }

  /**
   * Check if the store has data for the given reference name. Also checks the
   * assembly name if one was specified in the initial adapter config.
   * @param {string} refName Name of the reference sequence
   * @returns {Promise<boolean>} Whether data source has data for the given
   * reference name
   */
  public async hasDataForRefName(
    refName: string,
    opts: BaseOptions = {},
  ): Promise<boolean> {
    const refNames = await this.getRefNames(opts)
    if (refNames.includes(refName)) return true
    return false
  }
}

export interface Alias {
  refName: string
  aliases: string[]
}
export abstract class BaseRefNameAliasAdapter {
  public static capabilities: string[]

  public abstract async getRefNameAliases(): Promise<Alias[]>

  public abstract async freeResources(): Promise<void>
}
