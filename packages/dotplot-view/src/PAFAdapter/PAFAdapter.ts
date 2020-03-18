/* eslint-disable @typescript-eslint/no-explicit-any,import/no-extraneous-dependencies */
import BaseAdapter, { BaseOptions } from '@gmod/jbrowse-core/BaseAdapter'
import {
  IFileLocation,
  INoAssemblyRegion,
  IRegion,
} from '@gmod/jbrowse-core/mst-types'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { GenericFilehandle } from 'generic-filehandle'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

type PafRecord = [INoAssemblyRegion, INoAssemblyRegion]

export default class extends BaseAdapter {
  private initialized = false

  private pafRecords: PafRecord[] = []

  private assemblyNames: string[]

  private pafLocation: GenericFilehandle

  public static capabilities = ['getFeatures', 'getRefNames']

  public constructor(config: {
    pafLocation: IFileLocation
    assemblyNames: string[]
  }) {
    super()
    const { pafLocation, assemblyNames } = config
    this.pafLocation = openLocation(pafLocation)
    this.assemblyNames = assemblyNames
  }

  async setup(opts?: BaseOptions) {
    if (!this.initialized) {
      const text = (await this.pafLocation.readFile('utf8')) as string
      text.split('\n').forEach((line: string, index: number) => {
        if (line.length) {
          const [
            chr1,
            ,
            start1,
            end1,
            strand1,
            chr2,
            ,
            start2,
            end2,
          ] = line.split('\t')
          this.pafRecords[index] = [
            { refName: chr1, start: +start1, end: +end1 },
            { refName: chr2, start: +start2, end: +end2 },
          ]
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
        for (let i = 0; i < this.pafRecords.length; i++) {
          const record = this.pafRecords[i]
          if (record[index].refName === region.refName) {
            if (
              doesIntersect2(
                region.start,
                region.end,
                record[index].start,
                record[index].end,
              )
            ) {
              observer.next(
                new SimpleFeature({
                  data: {
                    uniqueId: `row_${i}`,
                    syntenyId: i,
                    start: record[index].start,
                    end: record[index].end,
                    refName: record[index].refName,
                  },
                }),
              )
            }
          }
        }
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
