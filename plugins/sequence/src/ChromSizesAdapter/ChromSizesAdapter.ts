import {
  RegionsAdapter,
  BaseAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

export default class extends BaseAdapter implements RegionsAdapter {
  // the map of refSeq to length
  protected setupP?: Promise<{ [key: string]: number }>

  async setupPre() {
    const pm = this.pluginManager
    const file = openLocation(this.getConf('chromSizesLocation'), pm)
    const data = await file.readFile('utf8')
    return Object.fromEntries(
      data
        .split(/\n|\r\n|\r/)
        .map(f => f.trim())
        .filter(f => !!f)
        .map((line: string) => {
          const [name, length] = line.split('\t')
          return [name, +length]
        }),
    )
  }

  async setup() {
    if (!this.setupP) {
      this.setupP = this.setupPre().catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  public async getRegions() {
    const refSeqs = await this.setup()
    return Object.keys(refSeqs).map(refName => ({
      refName,
      start: 0,
      end: refSeqs[refName],
    }))
  }

  public getHeader() {
    return {}
  }

  public freeResources(/* { region } */): void {}
}
