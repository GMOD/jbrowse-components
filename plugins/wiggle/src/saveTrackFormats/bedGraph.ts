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

function bedGraphRow(feature: Feature) {
  const chrom = feature.get('refName')
  const start = feature.get('start')
  const end = feature.get('end')
  const score = scoreText(feature.get('score') ?? 0)
  return `${chrom}\t${start}\t${end}\t${score}`
}

/**
 * A multi-wiggle track's subtracks are read concurrently, so its features
 * arrive interleaved, each stamped with the `source` it came from. Four columns
 * have no field for the source, so every subtrack would collapse into one set
 * of overlapping intervals that no reader could separate again. bedGraph allows
 * a `track` line per block, and this writer puts each source in its own block.
 *
 * A single-file track stamps no source (BigWig's `source` slot defaults to
 * empty) and still writes the bare four columns.
 */
export function stringifyBedGraph({ features }: { features: Feature[] }) {
  const bySource = new Map<string, string[]>()
  for (const feature of features) {
    const source = String(feature.get('source') ?? '')
    const rows = bySource.get(source) ?? []
    rows.push(bedGraphRow(feature))
    bySource.set(source, rows)
  }
  return [...bySource]
    .flatMap(([source, rows]) =>
      source
        ? [`track type=bedGraph name="${source.replaceAll('"', "'")}"`, ...rows]
        : rows,
    )
    .join('\n')
}
