import { insertionMark, textWidthForNumber } from '@jbrowse/alignments-core'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import { emptyMafCoverage } from '../../LinearMafDisplay/components/coverageTestFixture.ts'
import { mafInsertionParams } from '../mafMarks.ts'
import { mafInsertionChannels } from './insertions.ts'

import type {
  MafGPURenderState,
  MafRegionData,
} from '../mafRenderingBackendTypes.ts'

const enc = new TextEncoder()
const PURPLE = 0xff800080

function region(refSeq: string, rows: string[]): MafRegionData {
  return {
    blocks: [
      {
        startBp: 100,
        endBp: 100 + refSeq.replaceAll('-', '').length,
        refSeqBytes: enc.encode(refSeq),
        rows: rows.map((alignment, rowIndex) => ({
          rowIndex,
          alignmentBytes: enc.encode(alignment),
        })),
        empties: [],
      },
    ],
    coverage: emptyMafCoverage(100),
  }
}

// 100bp over 1000px, 10 px/bp
const block = {
  displayedRegionIndex: 0,
  start: 100,
  end: 200,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

function state(rowHeight: number) {
  return {
    canvasWidth: 1000,
    canvasHeight: 200,
    rowsTop: 0,
    rowsHeight: 200,
    rowHeight,
    rowProportion: 1,
    scrollTop: 0,
  } as MafGPURenderState
}

test('each insertion is interbase at the reference base after its run, on its row', () => {
  const c = mafInsertionChannels(
    region('A--AC-A', ['AGGACTA', 'A--AC-A', 'AG-AC-A']),
    PURPLE,
    1,
  )
  expect({
    x: [...c.x],
    x2: [...c.x2],
    row: [...c.row],
    length: [...c.length],
    color: [...c.color],
  }).toEqual({
    x: [101, 103, 101],
    x2: [101, 103, 101],
    row: [0, 0, 2],
    length: [2, 1, 1],
    color: [PURPLE, PURPLE, PURPLE],
  })
})

test('a re-encode in another color walks the region once', () => {
  const data = region('A--A', ['AGGA'])
  const a = mafInsertionChannels(data, PURPLE, 1)
  const b = mafInsertionChannels(data, 0xff00ff00, 1)
  expect(b.x).toBe(a.x)
  expect([...b.color]).toEqual([0xff00ff00])
})

test('a region with no reference gap has no insertions', () => {
  expect(mafInsertionChannels(region('ACGT', ['ACGT']), PURPLE, 1).count).toBe(
    0,
  )
})

function paintedWidths(refSeq: string, rows: string[], rowHeight: number) {
  const { ctx, calls } = recordingContext()
  const s = state(rowHeight)
  insertionMark.paintBlock(
    ctx,
    mafInsertionChannels(region(refSeq, rows), PURPLE, 1),
    block,
    s,
    mafInsertionParams(s),
  )
  return calls.map(c => c.w)
}

test('a large insertion is a count box in a tall row and the narrow bar in a short one', () => {
  const ref = `A${'-'.repeat(10)}A`
  const row = `A${'G'.repeat(10)}A`
  expect(paintedWidths(ref, [row], 12)).toEqual([textWidthForNumber(10)])
  expect(paintedWidths(ref, [row], 3)).toEqual([5])
})

test('a small insertion is a 1px bar under its serif caps', () => {
  expect(paintedWidths('A--A', ['AGGA'], 12)).toEqual([1, 4, 4])
})

test("zoomed out, each row keeps the longest of a bin's insertions", () => {
  const data = region('A-A-A--A', ['AGAGAGGA', 'A-AGA--A'])
  const merged = (binBp: number) => {
    const c = mafInsertionChannels(data, PURPLE, binBp)
    return { x: [...c.x], row: [...c.row], length: [...c.length] }
  }
  expect(merged(1)).toEqual({
    x: [101, 102, 103, 102],
    row: [0, 0, 0, 1],
    length: [1, 1, 2, 1],
  })
  expect(merged(2)).toEqual({
    x: [101, 103, 102],
    row: [0, 0, 1],
    length: [1, 2, 1],
  })
  expect(merged(4)).toEqual({ x: [103, 102], row: [0, 1], length: [2, 1] })
})
