import type { Feature } from '@jbrowse/core/util'

function generateINFO(feature: Feature) {
  const info = feature.get('INFO')
  if (!info) {
    return '.'
  }
  const parts = Object.entries(info)
    .map(([key, value]) => {
      if (value === true) {
        return key
      }
      if (Array.isArray(value)) {
        return `${key}=${value.join(',')}`
      }
      return `${key}=${value}`
    })
    .filter(Boolean)
  return parts.length ? parts.join(';') : '.'
}

export function stringifyVCF({ features }: { features: Feature[] }) {
  // VCF POS is 1-based; JBrowse stores start as 0-based
  return features
    .map(feature => {
      const chrom = feature.get('refName') || '.'
      const pos = feature.get('start') + 1
      const id = feature.get('name') || '.'
      const ref = feature.get('REF') || '.'
      const alt = feature.get('ALT')?.join(',') || '.'
      const qual = feature.get('QUAL') || '.'
      const filter = feature.get('FILTER') || '.'
      return `${chrom}\t${pos}\t${id}\t${ref}\t${alt}\t${qual}\t${filter}\t${generateINFO(feature)}`
    })
    .join('\n')
}
