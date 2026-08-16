import type { FileTypeExporter } from '@jbrowse/core/pluggableElementTypes/models'
import type { Feature } from '@jbrowse/core/util'

/**
 * The "Save track data" formats for a track that draws a wiggle. Shared rather
 * than repeated per track type so the four columns, and the score-missing
 * fallback below, have one definition.
 */
export const bedGraphFormatOptions: Record<string, FileTypeExporter> = {
  bedGraph: {
    name: 'BedGraph',
    extension: 'bedgraph',
    callback: stringifyBedGraph,
  },
}

export function stringifyBedGraph({ features }: { features: Feature[] }) {
  return features
    .map(feature => {
      const chrom = feature.get('refName')
      const start = feature.get('start')
      const end = feature.get('end')
      const score = feature.get('score') ?? 0
      return `${chrom}\t${start}\t${end}\t${score}`
    })
    .join('\n')
}
