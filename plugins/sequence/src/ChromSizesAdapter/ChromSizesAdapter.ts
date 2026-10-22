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
  // No `label`: `fetchAndMaybeUnzipText` narrates the download itself.
  setup = cachedSetup({ setup: opts => this.setupPre(opts) })

  async setupPre(opts?: BaseOptions) {
    const pm = this.pluginManager
    const file = openLocation(this.getConf('chromSizesLocation'), pm)
    // not readFile('utf8'), which reports no byte progress and won't gunzip
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
