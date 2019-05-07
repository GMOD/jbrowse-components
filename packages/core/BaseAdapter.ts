import { Observer, Observable } from 'rxjs'
import { IRegion as Region } from './mst-types'
import { ObservableCreate } from './util/rxjs'
import { checkAbortSignal } from './util'
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
  public abstract async getRefNames(): Promise<string[]>

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
    return ObservableCreate(async (observer: Observer<any>) => {
      const hasData = await this.hasDataForRefName(region.refName)
      checkAbortSignal(opts.signal)
      if (!hasData) {
        observer.complete()
      } else {
        this.getFeatures(region, opts).subscribe(observer)
      }
    })
  }

  /**
   * Check if the store has data for the given reference name. Also checks the
   * assembly name if one was specified in the initial adapter config.
   * @param {string} refName Name of the reference sequence
   * @returns {Promise<boolean>} Whether data source has data for the given
   * reference name
   */
  public async hasDataForRefName(refName: string): Promise<boolean> {
    const refNames = await this.getRefNames()
    if (refNames.includes(refName)) return true
    return false
  }
}
