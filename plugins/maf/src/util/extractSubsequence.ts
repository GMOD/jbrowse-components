export function extractSubsequence(
  sequence: string,
  relativeStart: number,
  relativeEnd: number,
): { extractedSequence: string; actualStart: number } {
  if (!/[^-]/.test(sequence)) {
    return {
      extractedSequence: sequence,
      actualStart: 0,
    }
  }

  const nonGapToActualMap: number[] = []

  let nonGapCount = 0
  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i] !== '-') {
      nonGapToActualMap[nonGapCount] = i
      nonGapCount++
    }
  }

  if (nonGapCount <= relativeStart) {
    return {
      extractedSequence: sequence,
      actualStart: 0,
    }
  }

  const startIndex = nonGapToActualMap[relativeStart] ?? 0
  let endIndex = sequence.length

  if (
    relativeEnd < nonGapCount &&
    nonGapToActualMap[relativeEnd] !== undefined
  ) {
    endIndex = nonGapToActualMap[relativeEnd]!
  }

  return {
    extractedSequence: sequence.slice(startIndex, endIndex),
    actualStart: startIndex,
  }
}
