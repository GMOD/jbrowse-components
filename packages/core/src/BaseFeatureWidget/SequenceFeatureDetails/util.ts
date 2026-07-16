import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { Feat } from '../util.tsx'

/**
 * Splits a string into chunks for display with optional coordinate spacing.
 * The first chunk may be short to complete a row partially filled by a prior
 * call (tracked via `currRemainder`).
 */
export function splitString({
  str,
  charactersPerRow,
  showCoordinates,
  currRemainder = 0,
  spacingInterval = 10,
}: {
  str: string
  charactersPerRow: number
  showCoordinates: boolean
  currRemainder?: number
  spacingInterval?: number
}) {
  const segments: string[] = []
  // the column the first chunk starts at, not an offset within a spacing group:
  // a segment continuing a row at a multiple of spacingInterval still needs the
  // separator space before its first character
  let positionCounter = currRemainder
  let stringOffset = 0
  let isFirstChunk = true

  while (stringOffset < str.length) {
    const chunkSize = isFirstChunk
      ? charactersPerRow - currRemainder
      : charactersPerRow
    const currentChunk = str.slice(stringOffset, stringOffset + chunkSize)
    segments.push(
      showCoordinates
        ? formatWithCoordinateSpacing(
            currentChunk,
            positionCounter,
            spacingInterval,
          )
        : currentChunk,
    )
    positionCounter = 0
    stringOffset += chunkSize
    isFirstChunk = false
  }

  const lastSegmentLength = segments.at(-1)?.replaceAll(' ', '').length ?? 0
  const carryRemainder = segments.length <= 1 ? currRemainder : 0
  return {
    segments,
    remainder: (lastSegmentLength + carryRemainder) % charactersPerRow,
  }
}

/**
 * Width to pad every coordinate label in a panel to, so all rows start their
 * sequence at the same column. Row labels step by charactersPerRow from
 * firstCoord, so the longest is at one end of the panel or the other. Floors at
 * 4 to keep the historical look of short (feature-relative) labels.
 */
export function coordLabelWidth({
  firstCoord,
  totalLength,
  charactersPerRow,
  strand,
}: {
  firstCoord: number
  totalLength: number
  charactersPerRow: number
  strand: number
}) {
  const rows = Math.max(1, Math.ceil(totalLength / charactersPerRow))
  const lastCoord = firstCoord + (rows - 1) * charactersPerRow * strand
  return Math.max(4, `${firstCoord}`.length, `${lastCoord}`.length)
}

/**
 * Computes the coordinate multiplier and genomic coordinate start for a sequence
 * display. Both GenomicSequence and CDNASequence use this to initialize their
 * coordinate-tracking state.
 */
export function computeCoordProps(
  feature: SimpleFeatureSerialized,
  useGenomicCoords: boolean,
  upstream: string | undefined,
) {
  const strand = feature.strand === -1 ? -1 : 1
  const mult = useGenomicCoords ? strand : 1
  const coordStart = useGenomicCoords
    ? strand > 0
      ? feature.start + 1 - (upstream?.length ?? 0)
      : feature.end + (upstream?.length ?? 0)
    : 0
  return { mult, coordStart }
}

/**
 * The exonic blocks making up a transcript, feature-relative. Without exon
 * subfeatures the CDS blocks stand in for them, the first and last stretched to
 * the feature bounds so the untranslated flanks are still rendered.
 */
export function transcriptRegions({
  cds,
  exons,
  featureLength,
}: {
  cds: Feat[]
  exons: Feat[]
  featureLength: number
}): Feat[] {
  return exons.length
    ? exons
    : cds.map((sub, idx) => ({
        start: idx === 0 ? 0 : sub.start,
        end: idx === cds.length - 1 ? featureLength : sub.end,
      }))
}

/**
 * Splits an exonic region into its coding and untranslated stretches. `cds` must
 * be sorted by start. A region no CDS overlaps comes back wholly untranslated,
 * so a CDS annotated outside the exons degrades to an uncolored transcript
 * rather than dropping sequence or throwing.
 */
export function splitRegionByCds(region: Feat, cds: Feat[]) {
  const parts: { start: number; end: number; isCds: boolean }[] = []
  let pos = region.start
  for (const sub of cds) {
    const start = Math.max(sub.start, region.start)
    const end = Math.min(sub.end, region.end)
    if (start < end) {
      if (start > pos) {
        parts.push({ start: pos, end: start, isCds: false })
      }
      parts.push({ start, end, isCds: true })
      pos = end
    }
  }
  if (pos < region.end) {
    parts.push({ start: pos, end: region.end, isCds: false })
  }
  return parts
}

/**
 * Returns the display string for an intron. Collapses long introns to
 * "NNN...NNN" when collapseIntron is true and the intron exceeds 2*intronBp.
 */
export function getIntronDisplayStr(
  intron: string,
  intronBp: number,
  collapseIntron: boolean,
) {
  return collapseIntron && intron.length > intronBp * 2
    ? `${intron.slice(0, intronBp)}...${intron.slice(-intronBp)}`
    : intron
}

/**
 * Formats a string chunk with spaces at regular intervals to help with
 * coordinate visualization.
 */
function formatWithCoordinateSpacing(
  chunk: string,
  startPosition: number,
  spacingInterval: number,
) {
  if (!chunk) {
    return ''
  }
  let result = ''
  for (let i = 0; i < chunk.length; i++) {
    const pos = startPosition + i
    if (pos > 0 && pos % spacingInterval === 0) {
      result += ' '
    }
    result += chunk[i]
  }
  return result
}

/**
 * Text content of the sequence panel for plaintext/FASTA copy+download, with
 * `[data-no-plaintext]` elements (e.g. the legend) stripped so they don't
 * corrupt the sequence output.
 */
export function getSequencePlaintext(el: HTMLElement) {
  const clone = el.cloneNode(true) as HTMLElement
  for (const node of clone.querySelectorAll('[data-no-plaintext]')) {
    node.remove()
  }
  return clone.textContent || ''
}
