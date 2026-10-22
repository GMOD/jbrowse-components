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

// the sample columns already hold each genotype as the file wrote it, and
// nothing reads the record's parsed copy, which grows with every sample
function withoutSamples<T extends { samples?: unknown }>({
  samples: _samples,
  ...rest
}: T) {
  return rest
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
      splitInfo(INFO).map(e => {
        const eq = e.indexOf('=')
        const key = eq === -1 ? e : e.slice(0, eq)
        const val = eq === -1 ? 'true' : e.slice(eq + 1)
        const k = `INFO.${key.trim()}`
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
      feature: withoutSamples(
        new VcfFeature({
          parser: vcfParser,
          variant: vcfParser.parseLine(line),
          id: `vcf-${i}`,
        }).toJSON(),
      ),
    })
  }
  // SVTYPE right after ID, ahead of an SV's multi-kb REF/ALT
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
      ...(hasFormat ? ['FORMAT'] : []),
      ...vcfParser.samples,
    ].map(c => ({ name: c })),
    rowSet: {
      rows,
    },
  }
}
