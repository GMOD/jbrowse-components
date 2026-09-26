import type { FileTypeExporter } from '@jbrowse/core/pluggableElementTypes/models'
import type { Feature } from '@jbrowse/core/util'

/**
 * The "Save track data" formats for a track that draws a wiggle. Shared rather
 * than repeated per track type so the columns, and the score-missing
 * fallback below, have one definition.
 */
export const bedGraphFormatOptions: Record<string, FileTypeExporter> = {
  bedGraph: {
    name: 'BedGraph',
    extension: 'bedgraph',
    callback: stringifyBedGraph,
  },
}

// A BigWig score is a float32, whose double expansion prints 0.3 as
// 0.30000001192092896; the shortest decimal naming the same float32 is what the
// file held.
export function scoreText(score: number) {
  if (Math.fround(score) === score) {
    for (let digits = 1; digits < 9; digits++) {
      const shortest = +score.toPrecision(digits)
      if (Math.fround(shortest) === score) {
        return `${shortest}`
      }
    }
  }
  return `${score}`
}

function sourceOf(feature: Feature) {
  const source = feature.get('source')
  return source ? source.replaceAll(/[\t\r\n]/g, ' ') : ''
}

// Sorted by position within each contig, contigs in the order they arrive, so
// the file is ready for bgzip and tabix.
function byPosition(features: Feature[]) {
  const contigs = new Map<string, number>()
  for (const f of features) {
    const refName = f.get('refName')
    if (!contigs.has(refName)) {
      contigs.set(refName, contigs.size)
    }
  }
  return features.toSorted(
    (a, b) =>
      contigs.get(a.get('refName'))! - contigs.get(b.get('refName'))! ||
      a.get('start') - b.get('start'),
  )
}

/**
 * One row per interval, and for a track of several subtracks a header and a
 * `source` column naming each row's, which BedGraphAdapter reads back as the
 * same subtracks.
 */
export function stringifyBedGraph({ features }: { features: Feature[] }) {
  const tidy = features.some(f => sourceOf(f))
  const rows = byPosition(features).map(f => {
    const row = `${f.get('refName')}\t${f.get('start')}\t${f.get('end')}\t${scoreText(f.get('score') ?? 0)}`
    return tidy ? `${row}\t${sourceOf(f)}` : row
  })
  return (tidy ? ['#chrom\tstart\tend\tscore\tsource', ...rows] : rows).join(
    '\n',
  )
}
