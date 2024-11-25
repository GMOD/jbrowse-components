import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import PAFAdapter from '../PAFAdapter/PAFAdapter'
import { parseLineByLine } from '../util'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class MashMapAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const outLoc = openLocation(this.getConf('outLocation'), this.pluginManager)
    const buf = await fetchAndMaybeUnzip(outLoc, opts)
    return parseLineByLine(buf, parseMashMapLine)
  }
}

function parseMashMapLine(line: string) {
  const fields = line.split(' ')
  if (fields.length < 9) {
    // xref https://github.com/marbl/MashMap/issues/38
    throw new Error(`improperly formatted line: ${line}`)
  }
  const [qname, , qstart, qend, strand, tname, , tstart, tend, mq] = fields

  return {
    tname: tname!,
    tstart: +tstart!,
    tend: +tend!,
    qname: qname!,
    qstart: +qstart!,
    qend: +qend!,
    strand: strand === '-' ? -1 : 1,
    extra: {
      mappingQual: +mq!,
    },
  }
}
