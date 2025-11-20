/**
 * EXPERIMENTAL: SAM format exporter
 *
 * This module provides experimental support for exporting alignment features to SAM format.
 * The generated output includes the 11 mandatory SAM fields but does not currently output
 * optional tags. The output may not fully conform to the SAM specification and should be
 * validated before use in production workflows.
 */
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
      const start = feature.get('start')
      // The 11 mandatory SAM fields (optional tags are not currently output)
      const fields = [
        // QNAME (query name)
        feature.get('name') || feature.get('id') || '*',
        // FLAG (bitwise flags) - 0 for unmapped/unknown
        feature.get('flag') ?? '0',
        // RNAME (reference sequence name)
        feature.get('refName') || '*',
        // POS (1-based leftmost mapping position)
        String(start + 1),
        // MAPQ (mapping quality)
        feature.get('mapq') ?? '255',
        // CIGAR (CIGAR string)
        feature.get('CIGAR') || '*',
        // RNEXT (reference sequence name of next read)
        feature.get('next_ref') || '*',
        // PNEXT (position of next read)
        feature.get('next_pos') ?? '0',
        // TLEN (template length)
        feature.get('template_len') ?? '0',
        // SEQ (sequence)
        feature.get('seq') || '*',
        // QUAL (quality in PHRED ASCII format)
        qualToPhred(feature.get('qual')),
      ]
      // TODO: Add support for optional tags

      return fields.join('\t')
    })
    .join('\n')
}
