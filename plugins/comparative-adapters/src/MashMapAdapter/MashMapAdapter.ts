import { openLocation } from '@jbrowse/core/util/io'

import PAFAdapter from '../PAFAdapter/PAFAdapter.ts'
import { loadPafRecords } from '../PAFAdapter/util.ts'
import { collectLines, parsePAFLine } from '../util.ts'

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

// MashMap 3 writes real PAF, so a tab-delimited line is one. MashMap 1/2 write
// their own space-delimited PAF-like line:
//
//   qname qlen qstart qend strand tname tlen tstart tend identity
//
// The last column is the estimated nucleotide identity, NOT a mapping quality —
// reading it as one both saturated the MAPQ ramp (98.7 against a 60-max scale)
// and left every alignment at identity 0, the darkest end of the identity ramp,
// for a file that states its identity on every row. It is carried as `de`
// (gap-compressed divergence, 1 - identity), the tag pafIdentity prefers and the
// one `jbrowse make-pif` writes for the same purpose — rather than odgi's `id`,
// which would also become the feature's `id` field and surface as its name.
export function parseMashMapLine(line: string) {
  if (line.includes('\t')) {
    return parsePAFLine(line)
  }
  const fields = line.split(' ')
  const [qname, , qstart, qend, strand, tname, , tstart, tend, identity] =
    fields
  if (identity === undefined) {
    // xref https://github.com/marbl/MashMap/issues/38
    throw new Error(`improperly formatted line: ${line}`)
  }
  // versions differ on whether the column is a percentage (98.75) or a fraction
  const pct = +identity
  return {
    tname: tname!,
    tstart: +tstart!,
    tend: +tend!,
    qname: qname!,
    qstart: +qstart!,
    qend: +qend!,
    strand: strand === '-' ? -1 : 1,
    extra: {
      de: 1 - (pct > 1 ? pct / 100 : pct),
    },
  }
}
