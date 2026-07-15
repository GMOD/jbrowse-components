import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  insertionBarWidth,
  textWidthForNumber,
} from './constants.ts'

// Replicates insertion.slang's rectW calculation exactly (the small branch is
// a hard 1.0 there, not min(pxPerBp, 1)). If the shader logic changes, this
// must be updated in lockstep, and any mismatch with insertionBarWidth fails.
function shaderRectWidthPx(
  length: number,
  pxPerBp: number,
  featureHeight: number,
) {
  const isLongInsertion = length >= LONG_INSERTION_MIN_LENGTH
  const insertionWidthPx = length * pxPerBp
  const canShowText = insertionWidthPx >= LONG_INSERTION_TEXT_THRESHOLD_PX
  // SYNC(insertion.slang): the wide count box is also gated on the row being
  // tall enough to draw the count.
  const tallEnoughForText = featureHeight >= MIN_HEIGHT_FOR_TEXT
  const isLargeInsertion = isLongInsertion && canShowText && tallEnoughForText

  if (isLargeInsertion) {
    return textWidthForNumber(length)
  }
  if (isLongInsertion) {
    return Math.min(5, insertionWidthPx / 3)
  }
  return 1
}

const lengths = [1, 5, 9, 10, 15, 50, 100, 500, 10000]
const pxPerBps = [0.01, 0.1, 0.5, 1, 2, 5, 6.5, 7, 10, 20, 50]
// A tall (normal/compact preset) and a super-compact row: the latter is below
// MIN_HEIGHT_FOR_TEXT, so large insertions must shrink to the narrow bar.
const featureHeights = [10, 1]

describe('insertion width: shader vs CPU parity', () => {
  for (const length of lengths) {
    for (const pxPerBp of pxPerBps) {
      for (const featureHeight of featureHeights) {
        test(`length=${length} pxPerBp=${pxPerBp} featureHeight=${featureHeight}`, () => {
          expect(insertionBarWidth(length, pxPerBp, featureHeight)).toBeCloseTo(
            shaderRectWidthPx(length, pxPerBp, featureHeight),
            4,
          )
        })
      }
    }
  }
})
