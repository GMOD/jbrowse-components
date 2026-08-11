import VCF from '@gmod/vcf'
import { VcfFeature } from '@jbrowse/plugin-variants'

import { isNumber } from './isNumber.ts'
import { bufferToLines } from './util.ts'

function splitInfo(info: string | undefined) {
  return info === undefined || info === '.'
    ? []
    : info
        .split(';')
        .map(f => f.trim())
        .filter(f => f !== '')
}

export function parseVcfBuffer(buffer: Uint8Array) {
  const lines = bufferToLines(buffer)
  const header = lines.filter(l => l.startsWith('#')).join('\n')
  const body = lines.filter(l => !l.startsWith('#'))
  const vcfParser = new VCF({ header })
  const keys = new Set<string>()
  const rows = []
  let hasFormat = false
  for (const [i, line] of body.entries()) {
    const [CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO, FORMAT, ...rest] =
      line.split('\t')
    hasFormat ||= !!FORMAT
    const ret = Object.fromEntries(
      // `.` is how VCF spells an absent INFO, and a trailing `;` leaves an
      // empty field. Splitting either one gives a nameless key, which used to
      // become an `INFO.` / `INFO..` flag column that every row in a
      // sites-only VCF carried and no file ever declared
      splitInfo(INFO).map(e => {
        const [key, val = 'true'] = e.split('=')
        const k = `INFO.${key!.trim()}`
        keys.add(k)
        const v = val.trim()
        return [k, isNumber(v) ? +v : v]
      }),
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
      // a sites-only VCF has no ninth column at all, so listing FORMAT
      // unconditionally gave every such file a column that is empty in every
      // row and cannot be anything else
      ...(hasFormat ? ['FORMAT'] : []),
      ...vcfParser.samples,
    ].map(c => ({ name: c })),
    rowSet: {
      rows,
    },
  }
}
