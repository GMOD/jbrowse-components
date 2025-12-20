import VCF from '@gmod/vcf'
import { VcfFeature } from '@jbrowse/plugin-variants'

import { isNumber } from './isNumber'
import { bufferToLines } from './util'

export function parseVcfBuffer(buffer: Uint8Array) {
  const lines = bufferToLines(buffer)
  const header = lines.filter(l => l.startsWith('#')).join('\n')
  const body = lines.filter(l => !l.startsWith('#'))
  const vcfParser = new VCF({ header })
  const keys = new Set<string>()
  const rows = []
  let i = 0
  for (const line of body) {
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT, ...rest] =
      line.split('\t')
    const ret = Object.fromEntries(
      INFO?.split(';')
        .map(f => f.trim())
        .map(e => {
          const [key, val = 'true'] = e.split('=')
          const k = `INFO.${key!.trim()}`
          keys.add(k)
          const v = val.trim()
          return [k, isNumber(v) ? +v : v]
        }) || [],
    )
    rows.push({
      // what is displayed
      cellData: {
        CHROM,
        POS: +POS!,
        ID,
        REF,
        ALT,
        QUAL: isNumber(QUAL) ? +QUAL : QUAL,
        FILTER,
        FORMAT,
        ...ret,
        ...Object.fromEntries(
          vcfParser.samples.map((s, idx) => [s, rest[idx]]),
        ),
      },
      // a simplefeatureserializd
      feature: new VcfFeature({
        parser: vcfParser,
        variant: vcfParser.parseLine(line),
        id: `vcf-${i}`,
      }).toJSON(),
    })
    i++
  }
  return {
    columns: [
      'CHROM',
      'POS',
      'ID',
      'REF',
      'ALT',
      'QUAL',
      'FILTER',
      ...keys,
      'FORMAT',
      ...vcfParser.samples,
    ].map(c => ({ name: c })),
    rowSet: {
      rows,
    },
  }
}
