import { Observable } from 'rxjs'

/**
 * Base class for adapters to extend. Provides utilities for reference sequence
 * name normalization and defines some methods that subclasses must implement.
 * @property {string} assemblyName - The name of the assembly given in the
 * config or the normalized name if it was an alias defined in the root config
 * @property {string[]} assemblyAliases - An array of other possible names for this
 * assembly
 * @property {object} seqNameAliases - An object with keys that are possible
 * sequence names for that assembly and values that are arrays of other possible
 * names for that sequence
 */
export default class BaseAdapter {
  constructor(config, rootConfig) {
    if (new.target === BaseAdapter) {
      throw new TypeError(
        'Cannot create BaseAdapter instances directly, use a subclass',
      )
    }
    const { assemblyName } = config
    this.assemblyName = assemblyName
    this.assemblyAliases = []
    this.seqNameAliases = {}
    const assemblies = rootConfig.assemblies || {}
    if (assemblies[assemblyName]) {
      this.assemblyAliases = assemblies[assemblyName].aliases || {}
      this.seqNameAliases = assemblies[assemblyName].seqNameAliases || {}
    } else
      Object.keys(assemblies).forEach(assembly => {
        if (assemblies[assembly].aliases.includes(assemblyName)) {
          this.assemblyName = assembly
          this.assemblyAliases = assemblies[assembly].aliases || {}
          this.seqNameAliases = assemblies[assembly].seqNameAliases || {}
        }
      })
  }

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @returns {string[]} Observable of Feature objects in the region
   */
  async loadData() {
    throw new Error('loadData should be overridden by the subclass')
    // Subclass method should look something like this:
    // this.metadata = await this.store.getMetadata()
    // const { seqNames } = this.metadata
    // return seqNames
  }

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @param {Region} param
   * @param {string} region.assemblyName Name of the assembly
   * @param {string} region.refName Name of the reference sequence
   * @param {int} region.start Start of the reference sequence
   * @param {int} region.end End of the reference sequence
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  // eslint-disable-next-line no-unused-vars
  async getFeaturesInRegion({ assembly, refName, start, end }) {
    throw new Error('getFeaturesInRegion should be overridden by the subclass')
    // Subclass method should look something like this:
    // return Observable.create(observer => {
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

  async regularizeAndGetFeaturesInRegion(region) {
    const { assemblyName } = region
    let { refName } = region
    const refSeqs = await this.loadData()
    this.loadRefSeqs(refSeqs)
    if (!this.hasDataForRefSeq({ assemblyName, refName })) {
      return Observable.create(observer => {
        observer.complete()
      })
    }
    refName = this.seqNameMap.get(refName) || refName
    return this.getFeaturesInRegion(Object.assign(region, { refName }))
  }

  /**
   * Generates the alias map for the provided sequence names.
   * @param {string[]} refSeqs An array of the reference sequences in the file
   */
  loadRefSeqs(refSeqs) {
    this.seqNameMap = new Map()
    refSeqs.forEach(seqName => {
      this.seqNameMap.set(seqName, seqName)
      if (this.seqNameAliases[seqName]) {
        this.seqNameAliases[seqName].forEach(seqNameAlias => {
          this.seqNameMap.set(seqNameAlias, seqName)
        })
      } else
        Object.keys(this.seqNameAliases).forEach(configSeqName => {
          if (this.seqNameAliases[configSeqName].includes(seqName)) {
            this.seqNameMap.set(configSeqName, seqName)
            this.seqNameAliases[configSeqName].forEach(seqNameAlias => {
              this.seqNameMap.set(seqNameAlias, seqName)
            })
          }
        })
    })
  }

  /**
   * Check if the store has data for the given reference name. Also checks the
   * assembly name if one was specified in the initial adapter config.
   * @param {Region} region A sequence region
   * @param {string} region.assemblyName Name of the assembly
   * @param {string} region.refName Name of the reference sequence
   */
  hasDataForRefSeq({ assemblyName, refName }) {
    if (!this.seqNameMap)
      throw new Error(
        '"loadRefSeqs" must be called before "hasDataForRefSeq" can be called',
      )
    if (
      this.assemblyName &&
      !(
        this.assemblyName === assemblyName ||
        this.assemblyAliases.includes(assemblyName)
      )
    )
      return false
    if (this.seqNameMap.get(refName)) return true
    return false
  }
}
