import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

import { parseChromSizes, refSizesToRegions } from '../chromSizesUtils.ts'

import type { RegionsAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class ChromSizesAdapter
  extends BaseAdapter
  implements RegionsAdapter
{
  // the map of refSeq to length
  protected setupP?: Promise<Record<string, number>>

  async setupPre() {
    const pm = this.pluginManager
    const file = openLocation(this.getConf('chromSizesLocation'), pm)
    const data = await file.readFile('utf8')
    return parseChromSizes(data)
  }

  async setup() {
    this.setupP ??= this.setupPre().catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  public async getRegions() {
    return refSizesToRegions(await this.setup())
  }

  public getHeader() {
    return {}
  }
}
