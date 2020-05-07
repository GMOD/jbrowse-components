import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { FileLocation, NoAssemblyRegion } from '@gmod/jbrowse-core/util/types'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { GenericFilehandle } from 'generic-filehandle'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { Instance } from 'mobx-state-tree'
import MyConfigSchema from './configSchema'

export default class extends BaseFeatureDataAdapter {
  // the map of refSeq to length
  protected refSeqs: Promise<Record<string, number>>

  protected source: string

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
    const chromSizesLocation = readConfObject(config, 'chromSizesLocation')
    if (!chromSizesLocation) {
      throw new Error('must provide chromSizesLocation')
    }
    const file = openLocation(chromSizesLocation as FileLocation)
    this.source = file.toString()
    this.refSeqs = this.init(file)
  }

  async init(file: GenericFilehandle) {
    const data = (await file.readFile('utf8')) as string
    const refSeqs: { [key: string]: number } = {}
    if (!data.length) {
      throw new Error(`Could not read file ${file.toString()}`)
    }
    data.split('\n').forEach((line: string) => {
      if (line.length) {
        const [name, length] = line.split('\t')
        refSeqs[name] = +length
      }
    })
    return refSeqs
  }

  public async getRefNames() {
    return Object.keys(await this.refSeqs)
  }

  public async getRegions() {
    const refSeqs = await this.refSeqs
    return Object.keys(refSeqs).map(refName => ({
      refName,
      start: 0,
      end: refSeqs[refName],
    }))
  }

  /**
   * Fetch features for a certain region
   * @param {Region} param
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public getFeatures({ refName, start, end }: NoAssemblyRegion) {
    return ObservableCreate<Feature>(observer => {
      // provides no sequence
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  public freeResources(/* { region } */): void {}
}
