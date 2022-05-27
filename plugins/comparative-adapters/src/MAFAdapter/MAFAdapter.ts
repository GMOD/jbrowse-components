import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { unzip } from '@gmod/bgzf-filehandle'
import PAFAdapter from '../PAFAdapter/PAFAdapter'

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

function maf2paf(lines: string[]) {
  const entries = []
  let curr = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('a')) {
      if (curr.length > 1) {
        const [, tname_p, tstart, tsize, tstrand, , tseq] = curr[0].split('\t')
        const tname = tname_p.replace('elegans.', '')
        const tend = +tstart + +tsize
        for (let i = 1; i < curr.length; i++) {
          const [, qname_p, qstart, qsize, qstrand, , qseq] =
            curr[i].split('\t')
          if (!qname_p.includes('elegans_vc2010')) {
            continue
          }
          const qend = +qstart + +qsize

          const qname =
            'chr' + qname_p.replace('elegans_vc2010.', '') + '_pilon'

          let numMatches = 0
          for (let i = 0; i < tseq.length; i++) {
            if (tseq[i] !== '-') {
              numMatches++
            }
          }

          entries.push({
            tname,
            tstart: +tstart,
            tend: +tend,
            qname,
            qstart: +qstart,
            qend: +qend,
            strand: qstrand === '-' ? -1 : 1,
            extra: {
              numMatches,
              blockLen: tseq.length,
            },
          })
        }
        curr = []
      }
      continue
    } else if (line.startsWith('s')) {
      curr.push(line)
    }
  }

  if (curr.length) {
    const [, tname, tstart, tsize, tstrand, , tseq] = curr[0].split('\t')
    const [, qname, qstart, qsize, qstrand, , qseq] = curr[1].split('\t')
    let numMatches = 0
    for (let i = 0; i < tseq.length; i++) {
      if (tseq[i] !== '-') {
        numMatches++
      }
    }

    entries.push({
      tname,
      tstart,
      tend: tstart + tsize,
      qname,
      qstart,
      qend: qstart + qsize,
      strand: tstrand,
      extra: {
        numMatches,
        blockLen: tseq.length,
      },
    })
  }

  return entries
}
export default class MAFAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const loc = openLocation(this.getConf('mafLocation'), this.pluginManager)
    const buffer = (await loc.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)
    return maf2paf(text.split('\n').filter(line => !!line))
  }
}
