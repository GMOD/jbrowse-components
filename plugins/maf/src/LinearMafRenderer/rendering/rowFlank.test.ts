import { rowFlankOf } from './rowFlank.ts'

import type { MafBlock } from '../mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

// One block from `startBp`, spanning its reference length, with `rows` given as
// [rowIndex, alignment] pairs.
function block(
  startBp: number,
  ref: string,
  rows: [number, string][],
): MafBlock {
  return {
    startBp,
    endBp: startBp + ref.replaceAll('-', '').length,
    refSeqBytes: enc.encode(ref),
    rows: rows.map(([rowIndex, seq]) => ({
      rowIndex,
      alignmentBytes: enc.encode(seq),
    })),
    empties: [],
  }
}

test('an abutting neighbour that resumes at the seam closes the run', () => {
  const blocks = [
    block(100, 'AAAA', [[0, 'aa--']]),
    block(104, 'AAAA', [[0, 'aaaa']]),
  ]
  const flank = rowFlankOf(blocks)
  expect(flank(0, 0)).toEqual({ boundedLeft: false, boundedRight: true })
  // not symmetric: block 1 ENDS with a gap, so it closes nothing for block 2
  expect(flank(1, 0)).toEqual({ boundedLeft: false, boundedRight: false })
})

test('the seam is read from the neighbour facing it', () => {
  const blocks = [
    block(100, 'AAAA', [[0, 'aaaa']]),
    block(104, 'AAAA', [[0, '--aa']]),
  ]
  expect(rowFlankOf(blocks)(1, 0).boundedLeft).toBe(true)
})

test('a neighbour that also starts with a gap leaves the run open', () => {
  const blocks = [
    block(100, 'AAAA', [[0, 'aa--']]),
    block(104, 'AAAA', [[0, '--aa']]),
  ]
  const flank = rowFlankOf(blocks)
  expect(flank(0, 0).boundedRight).toBe(false)
  expect(flank(1, 0).boundedLeft).toBe(false)
})

test('blocks separated by a reference gap say nothing about each other', () => {
  const blocks = [
    block(100, 'AAAA', [[0, 'aa--']]),
    block(200, 'AAAA', [[0, 'aaaa']]),
  ]
  expect(rowFlankOf(blocks)(0, 0).boundedRight).toBe(false)
})

test('a neighbour missing this row entirely leaves the run open', () => {
  const blocks = [
    block(100, 'AAAA', [[0, 'aa--']]),
    block(104, 'AAAA', [[1, 'aaaa']]),
  ]
  expect(rowFlankOf(blocks)(0, 0).boundedRight).toBe(false)
})

// The edge index is sized to the block's own highest row index, not the
// display's row count (which it has no way to know), so a query for a row above
// that reads past the end. It must answer "not bounded" — that row is not in the
// neighbour at all — rather than throwing or reading a stale entry.
test('a row index above the neighbour block s own highest is unbounded', () => {
  const blocks = [
    block(100, 'AAAA', [[9, 'aa--']]),
    block(104, 'AAAA', [[0, 'aaaa']]),
  ]
  const flank = rowFlankOf(blocks)
  expect(flank(0, 9).boundedRight).toBe(false)
  expect(flank(1, 9).boundedLeft).toBe(false)
  // and the row that IS present in both still resolves
  expect(flank(1, 0).boundedLeft).toBe(false)
})

test('the outermost blocks of a region have no neighbour to consult', () => {
  const blocks = [block(100, 'AAAA', [[0, '-aa-']])]
  expect(rowFlankOf(blocks)(0, 0)).toEqual({
    boundedLeft: false,
    boundedRight: false,
  })
})

test('rows are matched by rowIndex, not by position in the array', () => {
  const blocks = [
    block(100, 'AAAA', [
      [3, 'aa--'],
      [0, '--aa'],
    ]),
    block(104, 'AAAA', [
      [0, '--aa'],
      [3, 'aaaa'],
    ]),
  ]
  const flank = rowFlankOf(blocks)
  expect(flank(0, 3).boundedRight).toBe(true)
  expect(flank(0, 0).boundedRight).toBe(false)
})

test('the seam is the neighbour s reference column, not an insertion column', () => {
  const blocks = [
    block(100, 'ACG-', [
      [0, 'ACG-'],
      [1, 'ACGA'],
    ]),
    block(103, 'TTTC', [[0, '--TC']]),
    block(107, '-AAA', [[0, '-AAA']]),
  ]
  const flank = rowFlankOf(blocks)
  expect(flank(1, 0)).toEqual({ boundedLeft: true, boundedRight: true })
})
