import type { PerBaseColumns } from '../alignedBaseWalk.ts'

export function buildPerBaseLetterArrays(columns: PerBaseColumns) {
  const { positions, values, readIndices } = columns.finish()
  return {
    perBaseLetterPositions: positions,
    perBaseLetterBases: values,
    perBaseLetterReadIndices: readIndices,
  }
}
