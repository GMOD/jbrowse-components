import type { Feature } from '@jbrowse/core/util'

// One row of BED, kept as data until the whole set is known: BED is
// column-count-uniform, so whether any feature needs the block columns decides
// the width of every row.
interface BedRow {
  refName: string
  start: number
  end: number
  name: string
  score: number
  strand: number
  thickStart: number
  thickEnd: number
  blocks: { start: number; end: number }[]
}

// column 6 is +/-/., and features carry strand as 1/-1/0
function formatStrand(strand: number) {
  return strand === 1 ? '+' : strand === -1 ? '-' : '.'
}

// name is the only free-text column, and a space or tab in it shifts every
// column after it
function formatName(name: unknown) {
  const str = name === undefined || name === null ? '' : `${name}`.trim()
  return str ? str.replaceAll(/\s+/g, '_') : '.'
}

function extent(feats: Feature[]) {
  return {
    start: Math.min(...feats.map(f => f.get('start'))),
    end: Math.max(...feats.map(f => f.get('end'))),
  }
}

// A gene arrives as gene -> mRNA -> exon/CDS, and BED has one line per
// transcript rather than a nesting: descend to the level that owns exons (or
// bare CDS), and emit that. A feature with no such children is its own single
// block, which is what a flat BED/bigBed feature already was.
function collectRows(feature: Feature): BedRow[] {
  const subfeatures = feature.get('subfeatures') ?? []
  const exons = subfeatures.filter(f => f.get('type') === 'exon')
  const cds = subfeatures.filter(f => f.get('type') === 'CDS')

  if (exons.length === 0 && cds.length === 0 && subfeatures.length > 0) {
    return subfeatures.flatMap(f => collectRows(f))
  }

  const segments = exons.length > 0 ? exons : cds
  const blocks = (segments.length > 0 ? segments : [feature])
    .map(f => ({ start: f.get('start'), end: f.get('end') }))
    .sort((a, b) => a.start - b.start)

  // the row spans its blocks, not the parent's own bounds: blockStarts are
  // relative to chromStart and the last block has to end at chromEnd
  const start = blocks[0]!.start
  const end = Math.max(...blocks.map(b => b.end))

  // the CDS extent is the thick part; a non-coding row marks that with an empty
  // thick range at chromStart, per the spec
  const cdsExtent = cds.length > 0 ? extent(cds) : undefined
  const thick = cdsExtent
    ? {
        start: Math.max(start, cdsExtent.start),
        end: Math.min(end, cdsExtent.end),
      }
    : { start, end: start }

  return [
    {
      refName: feature.get('refName'),
      start,
      end,
      name: formatName(feature.get('name') ?? feature.get('id')),
      // BED score is numeric (0-1000); the bedGraph writer makes the same
      // choice for a feature with no score
      score: feature.get('score') ?? 0,
      strand: feature.get('strand') ?? 0,
      thickStart: thick.start,
      thickEnd: thick.end,
      blocks,
    },
  ]
}

function formatRow(row: BedRow, bed12: boolean) {
  const { refName, start, end, name, score, strand, blocks } = row
  const cols: (string | number)[] = [
    refName,
    start,
    end,
    name,
    score,
    formatStrand(strand),
  ]
  if (bed12) {
    cols.push(
      row.thickStart,
      row.thickEnd,
      '0',
      blocks.length,
      `${blocks.map(b => b.end - b.start).join(',')},`,
      `${blocks.map(b => b.start - start).join(',')},`,
    )
  }
  return cols.join('\t')
}

export function stringifyBED({ features }: { features: Feature[] }) {
  if (features.length === 0) {
    return ''
  }
  const rows = features.flatMap(f => collectRows(f))
  const bed12 = rows.some(
    row => row.blocks.length > 1 || row.thickStart !== row.thickEnd,
  )
  return rows.map(row => formatRow(row, bed12)).join('\n')
}
