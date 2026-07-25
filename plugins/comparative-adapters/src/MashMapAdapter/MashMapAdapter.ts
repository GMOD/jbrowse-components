import { openLocation } from '@jbrowse/core/util/io'

import PAFAdapter from '../PAFAdapter/PAFAdapter.ts'
import { loadPafRecords } from '../PAFAdapter/util.ts'
import { collectLines } from '../util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class MashMapAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    return loadPafRecords({
      file: openLocation(this.getConf('outLocation'), this.pluginManager),
      parse: (buffer, parseOpts) =>
        collectLines({
          buffer,
          label: 'Parsing MashMap output',
          parseLine: parseMashMapLine,
          opts: parseOpts,
        }),
      opts,
    })
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
