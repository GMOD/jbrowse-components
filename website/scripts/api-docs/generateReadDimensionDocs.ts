import { MAPQ_BINS } from '../../../packages/core/src/util/colorScale.ts'
import {
  DIMENSION_LEVELS,
  MAPQ_UNAVAILABLE_LEVEL,
  READ_DIMENSIONS,
  READ_LEVEL_LABELS,
} from '../../../plugins/alignments/src/shared/readFieldLevels.ts'
import { rewriteMarkerBlock } from '../markerDocs.ts'
import { markdownTable, tableCell } from './markdown.ts'

const DATA_NAMED = 'one section per value the reads carry'

const labelled: Readonly<Record<string, Readonly<Record<string, string>>>> =
  READ_LEVEL_LABELS

function section(level: string, label?: string) {
  return label && label.toLowerCase() !== level.toLowerCase()
    ? `\`${level}\`: ${label}`
    : `\`${level}\``
}

function sectionsOf(dimension: string) {
  const levels =
    dimension === 'mapq'
      ? [
          ...MAPQ_BINS.map(b => section(b.key, b.label)),
          section(MAPQ_UNAVAILABLE_LEVEL, 'unavailable'),
        ]
      : (DIMENSION_LEVELS[dimension] ?? []).map(level =>
          section(level, labelled[dimension]?.[level]),
        )
  return levels.length ? levels.join('<br />') : DATA_NAMED
}

export function writeReadDimensionDocs() {
  return rewriteMarkerBlock(
    'READ_DIMENSIONS',
    markdownTable(
      ['dimension', 'sections, in stacking order'],
      READ_DIMENSIONS.map(d => `| \`${d}\` | ${tableCell(sectionsOf(d))} |`),
    ),
  )
}
