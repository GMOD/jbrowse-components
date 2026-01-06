import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import PAFAdapter from '../PAFAdapter/PAFAdapter.ts'
import { addSyriTypes, getWeightedMeans } from '../PAFAdapter/util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class MashMapAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const lines = [] as ReturnType<typeof parseMashMapLine>[]
    parseLineByLine(
      await fetchAndMaybeUnzip(
        openLocation(this.getConf('outLocation'), this.pluginManager),
        opts,
      ),
      line => {
        lines.push(parseMashMapLine(line))
        return true
      },
      opts?.statusCallback,
    )
    return addSyriTypes(getWeightedMeans(lines))
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
