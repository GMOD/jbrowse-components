import type { Feature } from '@jbrowse/core/util'

function qualToPhred(qual: string): string {
  if (!qual) {
    return '*'
  }

  return qual
    .split(' ')
    .map(q => String.fromCharCode(+q + 33))
    .join('')
}

export function stringifySAM({ features }: { features: Feature[] }) {
  return features
    .map(feature => {
      const fields: string[] = []

      // QNAME (query name)
      fields.push(feature.get('name') || feature.get('id') || '*')

      // FLAG (bitwise flags) - 0 for unmapped/unknown
      fields.push(feature.get('flag') ?? '0')

      // RNAME (reference sequence name)
      fields.push(feature.get('refName') || '*')

      // POS (1-based leftmost mapping position)
      const start = feature.get('start')
      fields.push(start !== undefined ? String(start + 1) : '0')

      // MAPQ (mapping quality)
      fields.push(feature.get('mapq') ?? '255')

      // CIGAR (CIGAR string)
      fields.push(feature.get('cigar') || '*')

      // RNEXT (reference sequence name of next read)
      fields.push(feature.get('next_ref') || '*')

      // PNEXT (position of next read)
      fields.push(feature.get('next_pos') ?? '0')

      // TLEN (template length)
      fields.push(feature.get('template_len') ?? '0')

      // SEQ (sequence)
      fields.push(feature.get('seq') || '*')

      // QUAL (quality in PHRED ASCII format)
      fields.push(qualToPhred(feature.get('qual')))

      return fields.join('\t')
    })
    .join('\n')
}
