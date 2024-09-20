import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { isGzip } from '@jbrowse/core/util'
import { unzip } from '@gmod/bgzf-filehandle'
import type { Buffer } from 'buffer'

// locals
import PAFAdapter from '../PAFAdapter/PAFAdapter'
import { paf_chain2paf } from './util'

export default class ChainAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const loc = openLocation(this.getConf('chainLocation'), this.pluginManager)
    const buffer = (await loc.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    return paf_chain2paf(buf)
  }
}
