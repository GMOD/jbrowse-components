import type { Feature } from '@jbrowse/core/util'

// The two lines that make the output a VCF rather than eight tab-separated
// columns. `##fileformat` is the one header line the spec requires first, and
// without it `bcftools view`, `tabix -p vcf` and IGV all refuse the file —
// which is the whole point of an export offered as "VCF" and saved as `.vcf`.
//
// Only the fixed eight columns: this path builds records out of rendered
// features, which carry no genotypes, so there is no FORMAT column and no
// sample columns to name. INFO keys are deliberately not declared — their
// Number/Type aren't recoverable from a feature, and readers accept undefined
// INFO with a warning where they reject a missing fileformat outright.
//
// Reached only when the adapter cannot export raw lines: all three VCF adapters
// declare `exportData` and round-trip their own header through `getExportData`
// (see core's fetchTrackData). So this is the path for a VariantTrack on some
// other adapter — precisely the case with no original header to fall back on.
const VCF_HEADER = [
  '##fileformat=VCFv4.3',
  '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
]

function generateINFO(feature: Feature) {
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  if (!info) {
    return '.'
  }
  const parts = Object.entries(info).map(([key, value]) => {
    if (value === true) {
      return key
    }
    if (Array.isArray(value)) {
      return `${key}=${value.join(',')}`
    }
    return `${key}=${value}`
  })
  return parts.length ? parts.join(';') : '.'
}

// FILTER is semicolon-delimited in VCF, and @gmod/vcf parses a multi-filter
// record ("q10;s50") into an array. Letting that stringify itself joined it
// with a comma, so a reader took the pair back as one filter literally named
// "q10,s50". ALT and the INFO arrays above are the ones that really are
// comma-delimited.
function generateFILTER(feature: Feature) {
  const filter = feature.get('FILTER') as string | string[] | undefined
  if (Array.isArray(filter)) {
    return filter.length ? filter.join(';') : '.'
  }
  return filter || '.'
}

export function stringifyVCF({ features }: { features: Feature[] }) {
  // VCF POS is 1-based; JBrowse stores start as 0-based
  return [
    ...VCF_HEADER,
    ...features.map(feature => {
      const chrom = feature.get('refName') || '.'
      const pos = feature.get('start') + 1
      const id = feature.get('name') || '.'
      const ref = (feature.get('REF') as string | undefined) || '.'
      const alt = (feature.get('ALT') as string[] | undefined)?.join(',') || '.'
      const qual = (feature.get('QUAL') as number | undefined) ?? '.'
      return `${chrom}\t${pos}\t${id}\t${ref}\t${alt}\t${qual}\t${generateFILTER(feature)}\t${generateINFO(feature)}`
    }),
  ].join('\n')
}
