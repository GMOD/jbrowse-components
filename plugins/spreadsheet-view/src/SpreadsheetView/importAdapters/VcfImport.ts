import VCF from '@gmod/vcf'
import { VcfFeature } from '@jbrowse/plugin-variants'

import { isNumber } from './isNumber.ts'
import { bufferToLines } from './util.ts'

export function parseVcfBuffer(buffer: Uint8Array) {
  const lines = bufferToLines(buffer)
  const header = lines.filter(l => l.startsWith('#')).join('\n')
  const body = lines.filter(l => !l.startsWith('#'))
  const vcfParser = new VCF({ header })
  const keys = new Set<string>()
  const rows = []
  for (const [i, line] of body.entries()) {
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
        }) ?? [],
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
      feature: new VcfFeature({
        parser: vcfParser,
        variant: vcfParser.parseLine(line),
        id: `vcf-${i}`,
      }).toJSON(),
    })
  }
  // SVTYPE is the field that distinguishes deletions/duplications/inversions/
  // breakends, so for structural-variant VCFs surface it right after ID. This
  // keeps it visible ahead of the REF/ALT columns, which for SVs hold multi-kb
  // insertion/deletion sequences that otherwise widen those columns enough to
  // push SVTYPE (and the rest of the INFO fields) off-screen.
  const svType = 'INFO.SVTYPE'
  const hasSvType = keys.has(svType)
  const infoColumns = [...keys].filter(k => k !== svType)
  return {
    columns: [
      'CHROM',
      'POS',
      'ID',
      ...(hasSvType ? [svType] : []),
      'REF',
      'ALT',
      'QUAL',
      'FILTER',
      ...infoColumns,
      'FORMAT',
      ...vcfParser.samples,
    ].map(c => ({ name: c })),
    rowSet: {
      rows,
    },
  }
}
