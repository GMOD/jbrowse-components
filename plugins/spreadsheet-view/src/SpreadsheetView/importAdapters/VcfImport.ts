import VCF from '@gmod/vcf'
import { VcfFeature } from '@jbrowse/plugin-variants'

import type { Buffer } from 'buffer'

function getRows(lines: string[], vcfParser: VCF) {
  const keys = new Set<string>()
  const rows = lines.map((l, id) => {
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT] = l.split('\t')
    const ret = Object.fromEntries(
      INFO?.split(';')
        .map(f => f.trim())
        .map(e => {
          const [key, val = 'true'] = e.split('=')
          const k = `INFO.${key!.trim()}`
          keys.add(k)
          return [k, val.trim()]
        }) || [],
    )
    return {
      CHROM,
      POS,
      ID,
      REF,
      ALT,
      QUAL,
      FILTER,
      FORMAT,
      id,
      feature: new VcfFeature({
        parser: vcfParser,
        variant: vcfParser.parseLine(l),
        id: `${id}`,
      }),
      ___lineData: l,
      ...ret,
    }
  })
  return { keys, rows }
}

export function parseVcfBuffer(buffer: Buffer) {
  const str = new TextDecoder('utf8').decode(buffer)
  const lines = str
    .split(/\n|\r\n/)
    .map(f => f.trim())
    .filter(f => !!f)
  const headerLines = []
  let i = 0
  for (; i < lines.length && lines[i]!.startsWith('#'); i++) {
    headerLines.push(lines[i])
  }
  const header = headerLines.join('\n')
  const vcfParser = new VCF({ header })
  const { keys, rows } = getRows(lines.slice(i), vcfParser)

  return {
    vcfParser,
    rows,
    columns: [
      'CHROM',
      'POS',
      'ID',
      'REF',
      'ALT',
      'QUAL',
      'FILTER',
      'FORMAT',
      ...keys,
    ],
  }
}
