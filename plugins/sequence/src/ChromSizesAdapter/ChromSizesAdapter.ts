import {
  RegionsAdapter,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { FileLocation } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { GenericFilehandle } from 'generic-filehandle'
import { readConfObject } from '@jbrowse/core/configuration'
import { Instance } from 'mobx-state-tree'
import MyConfigSchema from './configSchema'

export default class extends BaseAdapter implements RegionsAdapter {
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

  private async init(file: GenericFilehandle) {
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

  public async getRegions() {
    const refSeqs = await this.refSeqs
    return Object.keys(refSeqs).map(refName => ({
      refName,
      start: 0,
      end: refSeqs[refName],
    }))
  }

  public freeResources(/* { region } */): void {}
}
