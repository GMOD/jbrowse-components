import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
// locals
import { paf_delta2paf } from './util'
import PAFAdapter from '../PAFAdapter/PAFAdapter'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class DeltaAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const loc = openLocation(this.getConf('deltaLocation'), this.pluginManager)
    const buf = await fetchAndMaybeUnzip(loc, opts)
    return paf_delta2paf(buf)
  }
}
