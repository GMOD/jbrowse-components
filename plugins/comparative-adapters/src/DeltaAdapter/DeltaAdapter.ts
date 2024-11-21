import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
// locals
import PAFAdapter from '../PAFAdapter/PAFAdapter'
import { paf_delta2paf } from './util'

export default class DeltaAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const loc = openLocation(this.getConf('deltaLocation'), this.pluginManager)
    const buf = await fetchAndMaybeUnzip(loc, opts)
    return paf_delta2paf(buf)
  }
}
