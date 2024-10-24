import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { unzip } from '@gmod/bgzf-filehandle'
import { isGzip } from '@jbrowse/core/util'
import type { Buffer } from 'buffer'
// locals
import PAFAdapter from '../PAFAdapter/PAFAdapter'
import { paf_delta2paf } from './util'

export default class DeltaAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const loc = openLocation(this.getConf('deltaLocation'), this.pluginManager)
    const buffer = (await loc.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    return paf_delta2paf(buf)
  }
}
