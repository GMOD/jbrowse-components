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

  let formattedChunk = ''

  for (let i = 0, j = startPosition; i < chunk.length; i++, j++) {
    // Add space at interval boundaries
    if (j % spacingInterval === 0) {
      formattedChunk += ' '
      j = 0 // Reset counter after adding space
    }
    formattedChunk += chunk[i]
  }

  return formattedChunk
}

