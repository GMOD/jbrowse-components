import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/mst-types'
import { GenericFilehandle } from 'generic-filehandle'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

interface RowToGeneNames {
  [key: number]: {
    name1: string
    name2: string
    score: number
  }
}

interface GeneNameToRow {
  [key: string]: number
}

export default class extends BaseAdapter {
  private initialized = false

  private mcscanAnchors: any

  private mcscanAnchorsLocation: GenericFilehandle

  private geneNameToRow: GeneNameToRow

  private rowToGeneName: RowToGeneNames

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: { mcscanAnchorsLocation: IFileLocation }) {
    super()
    const { mcscanAnchorsLocation } = config
    this.mcscanAnchorsLocation = openLocation(mcscanAnchorsLocation)
    this.geneNameToRow = {}
    this.rowToGeneName = []
  }

  async setup(opts?: BaseOptions) {
    if (!this.initialized) {
      const text = (await this.mcscanAnchorsLocation.readFile('utf8')) as string
      text.split('\n').forEach((line: string, index: number) => {
        if (line.length) {
          if (line !== '###') {
            const [name1, name2, score] = line.split('\t')
            this.geneNameToRow[name1] = index
            this.geneNameToRow[name2] = index
            this.rowToGeneName[index] = { name1, name2, score: +score }
          }
        }
      })
      this.initialized = true
    }
  }

  async getRefNames(opts?: BaseOptions) {
    return []
  }

  /**
   * Fetch features for a certain region. Use getFeaturesInRegion() if you also
   * want to verify that the store has features for the given reference sequence
   * before fetching.
   * @param {IRegion} param
   * @param {AbortSignal} [signal] optional signalling object for aborting the fetch
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  getFeatures(region: IRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { refName, start, end } = region
      await this.setup(opts)

      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  freeResources(/* { region } */): void {}
}
