import { Observer, Observable } from 'rxjs'
import { ObservableCreate } from './util/rxjs'
// @ts-ignore
import { checkAbortSignal } from './util'

export interface Region {
  refName: string
  start: number
  end: number
}
interface BaseOptions {
  signal: AbortSignal
}
/**
 * Base class for adapters to extend. Defines some methods that subclasses must
 * implement.
 */
export default class BaseAdapter {
  // List of all possible capabilities. Don't un-comment them here.
  static capabilities = [
    // 'getFeatures',
    // 'getRefNames',
    // 'getRegions',
    // 'getRefNameAliases',
  ]

  constructor(config: any) {
    if (new.target === BaseAdapter) {
      throw new TypeError(
        'Cannot create BaseAdapter instances directly, use a subclass',
      )
    }
  }

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @returns {Promise<string[]>} Array of reference sequence names used by the
   * source being adapted.
   */
  async getRefNames():Promise<string[]> {
    throw new Error('getRefNames should be overridden by the subclass')
    // Subclass method should look something like this:
    // await this.setup()
    // const { refNames } = this.metadata
    // return refNames
  }

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @param {Region} region
   * @param {BaseOptions} options
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  // eslint-disable-next-line no-unused-vars
  getFeatures({ refName, start, end }: Region, opts: BaseOptions):Observable<any> {
    throw new Error('getFeatures should be overridden by the subclass')
    // Subclass method should look something like this:
    // return ObservableCreate(observer => {
    //   const records = getRecords(assembly, refName, start, end)
    //   records.forEach(record => {
    //     observer.next(this.recordToFeature(record))
    //   })
    //   observer.complete()
    // })
  }

  /**
   * Subclasses should override this method. Method signature here for reference.
   *
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   * @param {Region} region
   */
  // eslint-disable-next-line no-unused-vars
  freeResources(region: Region) {
    throw new Error('freeResources should be overridden by the subclass')
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   * @param {Region} region see getFeatures()
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} see getFeatures()
   */
  getFeaturesInRegion(region: Region, opts: BaseOptions):Observable<any> {
    return ObservableCreate(async (observer:Observer<any>) => {
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
  async hasDataForRefName(refName:string):Promise<boolean> {
    const refNames = await this.getRefNames()
    if (refNames.includes(refName)) return true
    return false
  }
}
