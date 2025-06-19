// note that these are currently put into the style section instead of being
// defined in classes to aid copy and paste to an external document e.g. word
export const intronColor = undefined
export const utrColor = 'rgb(200,240,240)'
export const proteinColor = 'rgb(220,160,220)'
export const cdsColor = 'rgb(220,220,180)'
export const updownstreamColor = 'rgba(250,200,200)'
export const genomeColor = 'rgb(200,280,200)'

/**
 * Splits a string into chunks for display with optional coordinate spacing.
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
  const numChunks = Math.ceil(str.length / charactersPerRow)
  const segments = new Array(numChunks)
  // Initialize position counter for coordinate spacing
  let positionCounter = currRemainder % spacingInterval

  let chunkIndex = 0
  let stringOffset = 0

  // Process the string in chunks
  for (; chunkIndex < numChunks + 1; ++chunkIndex) {
    // For the first chunk, adjust for remainder from previous section
    const chunkSize =
      chunkIndex === 0 ? charactersPerRow - currRemainder : charactersPerRow

    const currentChunk = str.slice(stringOffset, stringOffset + chunkSize)

    // Break if no more content
    if (!currentChunk) {
      break
    }

    if (showCoordinates) {
      segments[chunkIndex] = formatWithCoordinateSpacing(
        currentChunk,
        positionCounter,
        spacingInterval,
      )
    } else {
      segments[chunkIndex] = currentChunk
    }

    // Reset position counter after each row
    positionCounter = 0
    stringOffset += chunkSize
  }

  // Calculate remainder for the next section
  return {
    segments,
    remainder: calculateRemainder(
      segments,
      chunkIndex,
      currRemainder,
      charactersPerRow,
    ),
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
): string {
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

/**
 * Calculates the remainder count for continuing to the next section.
 */
function calculateRemainder(
  segments: string[],
  chunkIndex: number,
  currRemainder: number,
  charactersPerRow: number,
): number {
  // Get the length of the last segment without spaces
  const lastSegmentLength = segments.at(-1)?.replaceAll(' ', '').length || 0

  // If we're on the first chunk, include the previous remainder
  const additionalRemainder = chunkIndex < 2 ? currRemainder : 0

  // Calculate the new remainder
  return (lastSegmentLength + additionalRemainder) % charactersPerRow
}
