import {
  BaseAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'
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
  // the map of refSeq to length. No `label`: `fetchAndMaybeUnzipText` narrates
  // the download from the inside, and phases nest.
  setup = cachedSetup({ setup: opts => this.setupPre(opts) })

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

  public async getRegions(opts?: BaseOptions) {
    return refSizesToRegions(await this.setup(opts))
  }

  public getHeader() {
    return {}
  }
}
