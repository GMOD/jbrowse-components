/* eslint-disable @typescript-eslint/no-explicit-any,import/no-extraneous-dependencies */
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import { IFileLocation, IRegion } from '@gmod/jbrowse-core/mst-types'
import { GenericFilehandle } from 'generic-filehandle'
import { tap } from 'rxjs/operators'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { AdapterClass as NCListAdapter } from '@gmod/jbrowse-plugin-jbrowse1/src/NCListAdapter'

type RowToGeneNames = {
  s1n1: string
  s1n2: string
  s2n1: string
  s2n2: string
  score: number
}[]

interface GeneNameToRows {
  [key: string]: number[]
}

export default class extends BaseAdapter {
  private initialized = false

  private geneNameToRows: GeneNameToRows = {}

  private rowToGeneName: RowToGeneNames = []

  private subadapters: BaseAdapter[]

  private assemblyNames: string[]

  private mcscanSimpleAnchorsLocation: GenericFilehandle

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    mcscanSimpleAnchorsLocation: IFileLocation
    subadapters: BaseAdapter[] | any // todo remove any
    assemblyNames: string[]
  }) {
    super(config)
    const { mcscanSimpleAnchorsLocation, subadapters, assemblyNames } = config
    this.mcscanSimpleAnchorsLocation = openLocation(mcscanSimpleAnchorsLocation)

    // TODO remove this logic once subadapter is updated by Rob
    this.subadapters = !subadapters[0].getFeatures
      ? subadapters.map((s: any) => new NCListAdapter(s))
      : subadapters

    this.assemblyNames = assemblyNames
  }

  async setup(opts?: BaseOptions) {
    if (!this.initialized) {
      const text = (await this.mcscanSimpleAnchorsLocation.readFile(
        'utf8',
      )) as string
      text.split('\n').forEach((line: string, index: number) => {
        if (line.length && line !== '###') {
          const [s1n1, s1n2, s2n1, s2n2, score] = line.split('\t')
          if (this.geneNameToRows[s1n1] === undefined) {
            this.geneNameToRows[s1n1] = []
          }
          if (this.geneNameToRows[s1n2] === undefined) {
            this.geneNameToRows[s1n2] = []
          }
          if (this.geneNameToRows[s2n1] === undefined) {
            this.geneNameToRows[s2n1] = []
          }
          if (this.geneNameToRows[s2n2] === undefined) {
            this.geneNameToRows[s2n2] = []
          }
          this.geneNameToRows[s1n1].push(index)
          this.geneNameToRows[s1n2].push(index)
          this.geneNameToRows[s2n1].push(index)
          this.geneNameToRows[s2n2].push(index)
          this.rowToGeneName[index] = {
            s1n1,
            s1n2,
            s2n1,
            s2n2,
            score: +score,
          }
        }
      })
      this.initialized = true
    }
  }

  async hasDataForRefName() {
    // determining this properly is basically a call to getFeatures
    // so is not really that important, and has to be true or else
    // getFeatures is never called (BaseAdapter filters it out)
    return true
  }

  async getRefNames(opts?: BaseOptions) {
    // we cannot determine this accurately
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
      await this.setup(opts)

      // The index of the assembly name in the region list corresponds to
      // the adapter in the subadapters list
      const index = this.assemblyNames.indexOf(region.assemblyName)
      if (index !== -1) {
        const features = this.subadapters[index].getFeatures(region)
        const featuresUnderConstruction = [] as (
          | { f1?: Feature; f2?: Feature }
          | undefined
        )[]
        await features
          .pipe(
            tap(feature => {
              // We first fetch from the NCList and connect each result
              // with the anchor file via geneNameToRows. Note that each
              // gene name can correspond to multiple rows
              const name = feature.get('name')
              ;(this.geneNameToRows[name] || []).forEach(row => {
                const record = this.rowToGeneName[row]
                const current = featuresUnderConstruction[row] || {}
                featuresUnderConstruction[row] = current
                if (record.s1n1 === name) {
                  current.f1 = feature
                } else if (record.s1n2 === name) {
                  current.f2 = feature
                } else if (record.s2n1 === name) {
                  current.f1 = feature
                } else if (record.s2n2 === name) {
                  current.f2 = feature
                }

                if (current.f1 && current.f2) {
                  observer.next(
                    new SimpleFeature({
                      data: {
                        uniqueId: row + 1,
                        start: current.f1.get('start'),
                        end: current.f2.get('end'),
                        refName: current.f1.get('refName'),
                        syntenyId: row,
                      },
                    }),
                  )
                  featuresUnderConstruction[row] = undefined
                }
              })
            }),
          )
          .toPromise()
      }

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
