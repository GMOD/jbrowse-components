import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { unzip } from '@gmod/bgzf-filehandle'
import PAFAdapter from '../PAFAdapter/PAFAdapter'
import { parseLineByLine } from '../util'

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class MashMapAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const outLoc = openLocation(this.getConf('outLocation'), this.pluginManager)
    const buffer = (await outLoc.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    return parseLineByLine(buf, parseMashMapLine)
  }
}

function parseMashMapLine(line: string) {
  const fields = line.split(' ')
  if (fields.length < 9) {
    // xref https://github.com/marbl/MashMap/issues/38
    throw new Error('improperly formatted line: ' + line)
  }
  const [qname, , qstart, qend, strand, tname, , tstart, tend, mq] = fields

  return {
    tname,
    tstart: +tstart,
    tend: +tend,
    qname,
    qstart: +qstart,
    qend: +qend,
    strand: strand === '-' ? -1 : 1,
    extra: {
      mappingQual: +mq,
    },
  }
}
