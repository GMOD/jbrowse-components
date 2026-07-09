import type { SimpleFeatureSerialized } from '../../util/index.ts'

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
  let positionCounter = currRemainder % spacingInterval
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
