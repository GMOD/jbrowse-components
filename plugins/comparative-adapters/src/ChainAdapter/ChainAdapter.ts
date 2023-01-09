import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { unzip } from '@gmod/bgzf-filehandle'
import PAFAdapter from '../PAFAdapter/PAFAdapter'
import { paf_chain2paf } from './util'

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class ChainAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const loc = openLocation(this.getConf('chainLocation'), this.pluginManager)
    const buffer = (await loc.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)
    return paf_chain2paf(text.split(/\n|\r\n|\r/).filter(line => !!line))
  }
}
