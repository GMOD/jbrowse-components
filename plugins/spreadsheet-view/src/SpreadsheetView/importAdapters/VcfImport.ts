import VCF from '@gmod/vcf'
import { VcfFeature } from '@jbrowse/plugin-variants'

function getRows(lines: string[], vcfParser: VCF) {
  const keys = new Set<string>()
  const rows = lines.map((l, id) => {
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT, ...rest] =
      l.split('\t')
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
      cellData: {
        CHROM,
        POS,
        ID,
        REF,
        ALT,
        QUAL,
        FILTER,
        FORMAT,
        ...ret,
        ...Object.fromEntries(
          vcfParser.samples.map((s, idx) => [s, rest[idx]]),
        ),
      },
      feature: new VcfFeature({
        parser: vcfParser,
        variant: vcfParser.parseLine(l),
        id: `vcf-${id}`,
      }).toJSON(),
    }
  })
  return { keys, rows }
}

export function parseVcfBuffer(buffer: Uint8Array) {
  const text = new TextDecoder('utf8').decode(buffer)
  const lines = text
    .split(/\n|\r\n|\r/)
    .map(f => f.trim())
    .filter(f => !!f)

  const header = lines.filter(l => l.startsWith('#')).join('\n')
  const body = lines.filter(l => !l.startsWith('#'))
  const vcfParser = new VCF({ header })

  const { keys, rows } = getRows(body, vcfParser)
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
