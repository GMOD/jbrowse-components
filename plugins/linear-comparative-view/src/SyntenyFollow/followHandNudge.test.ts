import {
  followWindowSignature,
  handNudged,
  handNudgeMessage,
} from './followHandNudge.ts'

const windows = (...refNames: string[]) =>
  refNames.map(refName => ({ refName, start: 0, end: 1000 }))

test('a signature is the coordinates, not the objects carrying them', () => {
  expect(followWindowSignature(windows('chr1'))).toBe(
    followWindowSignature(windows('chr1')),
  )
  expect(followWindowSignature(windows('chr1', 'chr2'))).not.toBe(
    followWindowSignature(windows('chr1')),
  )
})

const at = (inputRow: string, followedRow: string) => ({
  inputRow,
  followedRow,
})

describe('who moved the row', () => {
  test('the row moved and its input did not', () => {
    expect(
      handNudged({
        now: at('chr1:0-1000', 'chr5:0-9000'),
        previous: at('chr1:0-1000', 'chr5:0-1000'),
        movedByFollow: false,
      }),
    ).toBe(true)
  })

  test('the input moved, so the row moving is the follow doing its job', () => {
    expect(
      handNudged({
        now: at('chr1:500-1500', 'chr5:500-1500'),
        previous: at('chr1:0-1000', 'chr5:0-1000'),
        movedByFollow: false,
      }),
    ).toBe(false)
  })

  test('nothing moved', () => {
    expect(
      handNudged({
        now: at('chr1:0-1000', 'chr5:0-1000'),
        previous: at('chr1:0-1000', 'chr5:0-1000'),
        movedByFollow: false,
      }),
    ).toBe(false)
  })

  test('the follow placed the row, which is why it is somewhere new', () => {
    expect(
      handNudged({
        now: at('chr1:0-1000', 'chr5:0-9000'),
        previous: at('chr1:0-1000', 'chr5:0-1000'),
        movedByFollow: true,
      }),
    ).toBe(false)
  })

  test('the first pass over a level accuses nobody', () => {
    expect(
      handNudged({
        now: at('chr1:0-1000', 'chr5:0-9000'),
        previous: undefined,
        movedByFollow: false,
      }),
    ).toBe(false)
  })
})

test('the message names both rows', () => {
  expect(handNudgeMessage('mm39 (row 3)', 'hg38')).toBe(
    'mm39 (row 3) is following hg38, so it moved back to the matching region',
  )
})
