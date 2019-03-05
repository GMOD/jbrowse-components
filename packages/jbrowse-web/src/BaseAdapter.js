import { ObservableCreate } from './util/rxjs'

/**
 * Base class for adapters to extend. Defines some methods that subclasses must
 * implement.
 */
export default class BaseAdapter {
  constructor() {
    if (new.target === BaseAdapter) {
      throw new TypeError(
        'Cannot create BaseAdapter instances directly, use a subclass',
      )
    }
  }

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @returns {string[]} Observable of Feature objects in the region
   */
  async loadData() {
    throw new Error('loadData should be overridden by the subclass')
    // Subclass method should look something like this:
    // this.metadata = await this.store.getMetadata()
    // const { refNames } = this.metadata
    // return refNames
  }

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @param {Region} region
   * @param {string} region.refName Name of the reference sequence (e.g. chr1)
   * @param {int} region.start Start of the region
   * @param {int} region.end End of the region
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  // eslint-disable-next-line no-unused-vars
  getFeatures({ refName, start, end }) {
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
  freeResources(region) {
    throw new Error('freeResources should be overridden by the subclass')
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   * @param {Region} region see getFeatures()
   */
  getFeaturesInRegion(region) {
    return ObservableCreate(async observer => {
      if (!(await this.hasDataForRefName(region.refName))) {
        observer.complete()
      } else {
        this.getFeatures(region).subscribe(observer)
      }
    })
  }

  /**
   * Check if the store has data for the given reference name. Also checks the
   * assembly name if one was specified in the initial adapter config.
   * @param {Region} region A sequence region
   * @param {string} region.refName Name of the reference sequence
   */
  async hasDataForRefName(refName) {
    const refNames = await this.loadData()
    if (refNames.includes(refName)) return true
    return false
  }
}
