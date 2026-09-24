import type { PerBaseColumns } from '../alignedBaseWalk.ts'

export function buildPerBaseQualityArrays(columns: PerBaseColumns) {
  const { positions, values, readIndices } = columns.finish()
  return {
    perBaseQualPositions: positions,
    perBaseQualScores: values,
    perBaseQualReadIndices: readIndices,
  }
}
