import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import { parseChromSizes, refSizesToRegions } from '../chromSizesUtils.ts'

import type {
  BaseOptions,
  RegionsAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

export default class ChromSizesAdapter
  extends BaseAdapter
  implements RegionsAdapter
{
  // the map of refSeq to length
  protected setupP?: Promise<Record<string, number>>

  async setupPre(opts?: BaseOptions) {
    const pm = this.pluginManager
    const file = openLocation(this.getConf('chromSizesLocation'), pm)
    // fetchAndMaybeUnzipText rather than readFile('utf8') so the read reports
    // byte progress (readFile's utf8 path takes res.text(), which can't) and so
    // a gzipped chrom.sizes works
    const data = await fetchAndMaybeUnzipText(
      file,
      opts,
      'Downloading chromosome sizes',
    )
    return parseChromSizes(data)
  }

  async setup(opts?: BaseOptions) {
    this.setupP ??= this.setupPre(opts).catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  public async getRegions(opts?: BaseOptions) {
    return refSizesToRegions(await this.setup(opts))
  }

  public getHeader() {
    return {}
  }
}
