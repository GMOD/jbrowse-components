import { HIDDEN_ROW, REFERENCE_COLOR } from './constants.ts'
import {
  countFrequencyColumns,
  frequencyTooltipRows,
  paintFrequencyColumn,
} from './frequencyBand.ts'
import {
  CELL_ALT,
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_REF,
  CELL_UNPHASED,
} from './variantCellStyles.ts'
import { getCachedABGR } from './variantWebglUtils.ts'

import type { FrequencyColumns } from './frequencyBand.ts'

const HOM = 0xff000001
const HET = 0xff000002
const GREY = getCachedABGR(REFERENCE_COLOR)

interface Cell {
  column: number
  row: number
  category: number
  dosage: number
  color: number
}

// the worker's two buckets, each feature-major
function payload(ref: Cell[], nonRef: Cell[]) {
  const all = [...ref, ...nonRef]
  return {
    numCells: all.length,
    refCellCount: ref.length,
    cellRowIndices: Uint32Array.from(all, c => c.row),
    cellFeatureIndices: Uint32Array.from(all, c => c.column),
    cellColors: Uint32Array.from(all, c => c.color),
    cellAltDosage: Uint8Array.from(all, c => c.dosage),
    cellCategories: Uint8Array.from(all, c => c.category),
  }
}

function cell(category: number, dosage: number, color: number) {
  return (column: number, row: number): Cell => ({
    column,
    row,
    category,
    dosage,
    color,
  })
}
const hom = cell(CELL_ALT, 255, HOM)
const het = cell(CELL_ALT, 128, HET)
const noCall = cell(CELL_NO_CALL, 0, 0xff000004)

function segments(columns: FrequencyColumns, c: number) {
  const out = []
  for (
    let s = columns.segmentStart[c]!;
    s < columns.segmentStart[c + 1]!;
    s++
  ) {
    out.push([columns.segmentCategory[s], columns.segmentCount[s]])
  }
  return out
}

test('stacks carriers from the baseline, missing from the top, the reference remainder between', () => {
  const columns = countFrequencyColumns(
    payload([], [het(0, 0), noCall(0, 1), hom(0, 2), het(0, 3)]),
    1,
    10,
  )
  expect(segments(columns, 0)).toEqual([
    [CELL_ALT, 1],
    [CELL_ALT, 2],
    [CELL_REF, 6],
    [CELL_NO_CALL, 1],
  ])
  expect(columns.segmentColor[0]).toBe(HOM)
  expect(columns.segmentColor[2]).toBe(GREY)
})

test('counts drawn rows alone, and a column with no carrier is all reference', () => {
  const columns = countFrequencyColumns(
    payload(
      [{ column: 0, row: 0, category: CELL_REF, dosage: 0, color: GREY }],
      [hom(0, HIDDEN_ROW), hom(0, 1)],
    ),
    2,
    4,
  )
  expect(segments(columns, 0)).toEqual([
    [CELL_ALT, 1],
    [CELL_REF, 3],
  ])
  expect(segments(columns, 1)).toEqual([[CELL_REF, 4]])
})

test('a colour splits a class into segments, and the tooltip merges them under the key name', () => {
  const columns = countFrequencyColumns(
    payload(
      [],
      [
        cell(CELL_ALT, 255, 0xff0000aa)(0, 0),
        cell(CELL_ALT, 255, 0xff0000bb)(0, 1),
        cell(CELL_ALT, 255, 0xff0000bb)(0, 2),
        cell(CELL_ALT_SECONDARY, 255, 0xff000003)(0, 3),
        cell(CELL_UNPHASED, 0, 0xff000005)(0, 4),
      ],
    ),
    1,
    8,
  )
  expect(segments(columns, 0)).toEqual([
    [CELL_ALT, 2],
    [CELL_ALT, 1],
    [CELL_ALT_SECONDARY, 1],
    [CELL_REF, 3],
    [CELL_UNPHASED, 1],
  ])
  expect(frequencyTooltipRows(columns, 0, true)).toEqual([
    { label: 'Alt allele', value: '3 (37.5%)' },
    { label: 'Other alt allele', value: '1 (12.5%)' },
    { label: 'Reference', value: '3 (37.5%)' },
    { label: 'Unphased', value: '1 (12.5%)' },
  ])
})

test('allele-count rows name dosage the way the key does', () => {
  const columns = countFrequencyColumns(
    payload([], [hom(0, 0), het(0, 1), noCall(0, 2)]),
    1,
    4,
  )
  expect(frequencyTooltipRows(columns, 0, false).map(r => r.label)).toEqual([
    'Alt, full dosage (hom)',
    'Alt, half dosage (het)',
    'Homozygous reference',
    'No call',
  ])
})

function paint(columns: FrequencyColumns) {
  const rects: number[][] = []
  const ctx = {
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
    fillRect(_x: number, y: number, _w: number, h: number) {
      rects.push([y, h])
    },
  }
  paintFrequencyColumn(ctx, columns, 0, 0, 2, { top: 0, bottom: 100 })
  return rects
}

test('paints whole-pixel segments that fill the box, flooring a singleton at 1px', () => {
  const columns = countFrequencyColumns(
    payload([], [hom(0, 0), noCall(0, 1)]),
    1,
    1000,
  )
  expect(paint(columns)).toEqual([
    [99, 1],
    [0, 1],
    [1, 98],
  ])
})

test('a half-carrier column splits the box at its middle', () => {
  const columns = countFrequencyColumns(
    payload([], [hom(0, 0), het(0, 1)]),
    1,
    4,
  )
  expect(paint(columns)).toEqual([
    [75, 25],
    [50, 25],
    [0, 50],
  ])
})
