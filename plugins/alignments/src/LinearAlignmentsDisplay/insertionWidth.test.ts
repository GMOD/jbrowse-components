import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from './constants.ts'
import { getInsertionRectWidthPx, textWidthForNumber } from './model.ts'

// Replicates the shader's rectWidthPx calculation exactly.
// If the shader logic changes, this must be updated in lockstep,
// and any mismatch with getInsertionRectWidthPx will fail the test.
function shaderRectWidthPx(length: number, pxPerBp: number) {
  const isLongInsertion = length >= LONG_INSERTION_MIN_LENGTH
  const insertionWidthPx = length * pxPerBp
  const canShowText =
    insertionWidthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX && pxPerBp >= 6.5
  const isLargeInsertion = isLongInsertion && canShowText

  if (isLargeInsertion) {
    return textWidthForNumber(length)
  }
  if (isLongInsertion) {
    return Math.min(5, insertionWidthPx / 3)
  }
  return Math.min(pxPerBp, 1)
}

const lengths = [1, 5, 9, 10, 15, 50, 100, 500, 10000]
const pxPerBps = [0.01, 0.1, 0.5, 1, 2, 5, 6.5, 7, 10, 20, 50]

describe('insertion width: shader vs CPU parity', () => {
  for (const length of lengths) {
    for (const pxPerBp of pxPerBps) {
      test(`length=${length} pxPerBp=${pxPerBp}`, () => {
        expect(getInsertionRectWidthPx(length, pxPerBp)).toBeCloseTo(
          shaderRectWidthPx(length, pxPerBp),
          4,
        )
      })
    }
  }
})
