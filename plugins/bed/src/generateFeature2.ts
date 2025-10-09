import { generateFeature } from './generateFeature'

import type BED from '@gmod/bed'

export function generateFeature2({
  line,
  colRef,
  colStart,
  colEnd,
  scoreColumn,
  parser,
  uniqueId,
  names,
}: {
  line: string
  colRef: number
  colStart: number
  colEnd: number
  scoreColumn: string
  parser: BED
  uniqueId: string
  names?: string[]
}) {
  const splitLine = line.split('\t')
  const refName = splitLine[colRef]!
  const start = Number.parseInt(splitLine[colStart]!, 10)
  const end =
    Number.parseInt(splitLine[colEnd]!, 10) + (colStart === colEnd ? 1 : 0)

  return generateFeature({
    splitLine,
    refName,
    start,
    end,
    parser,
    uniqueId,
    scoreColumn,
    names,
  })
}
