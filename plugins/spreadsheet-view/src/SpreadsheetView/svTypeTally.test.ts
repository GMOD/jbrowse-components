import { tallySvTypes } from './svTypeTally.ts'

import type { GridRow } from './SpreadsheetModel.tsx'

function row(id: number, alt: string, svtype?: string): GridRow {
  return {
    id,
    feature: {
      uniqueId: `f${id}`,
      refName: 'chr1',
      start: 0,
      end: 1,
      ALT: [alt],
    },
    ...(svtype ? { 'INFO.SVTYPE': svtype } : {}),
  }
}

const FIELD = 'INFO.SVTYPE'

test('counts by class', () => {
  expect(
    tallySvTypes(
      [row(0, '<DEL>', 'DEL'), row(1, '<DEL>', 'DEL'), row(2, '<DUP>', 'DUP')],
      FIELD,
    ),
  ).toEqual([
    { type: 'DEL', label: 'Deletion', count: 2 },
    { type: 'DUP', label: 'Duplication', count: 1 },
  ])
})

// The whole reason this exists. The dropdown listed the raw column values while
// the legend bucketed by ALT, so a sniffles callset offered `TRA` in one control
// and counted `Breakend` in the other, inches apart on screen.
test('a class folds its spellings together', () => {
  expect(
    tallySvTypes(
      [
        row(0, '<TRA>', 'TRA'),
        row(1, 'C]chr5:100]', 'BND'),
        row(2, '<TRA>', 'TRA'),
      ],
      FIELD,
    ),
  ).toEqual([{ type: 'BND', label: 'Breakend', count: 3 }])
})

test('classes come back in canonical order, not arrival order', () => {
  expect(
    tallySvTypes(
      [row(0, '<INS>', 'INS'), row(1, '<DEL>', 'DEL'), row(2, '<DUP>', 'DUP')],
      FIELD,
    ).map(t => t.type),
  ).toEqual(['DEL', 'DUP', 'INS'])
})

test('a sheet with no SVTYPE column is classed from the ALT', () => {
  expect(tallySvTypes([row(0, '<DEL>')], undefined)).toEqual([
    { type: 'DEL', label: 'Deletion', count: 1 },
  ])
})

// an older session can restore rows whose parsed feature did not survive; the
// declared token still says what class they are
test('a row with no parsed feature is classed from its token', () => {
  const rows = [{ id: 0, 'INFO.SVTYPE': 'TRA' }] as unknown as GridRow[]
  expect(tallySvTypes(rows, FIELD)).toEqual([
    { type: 'BND', label: 'Breakend', count: 1 },
  ])
})

test('records that are not structural variants are left out', () => {
  expect(tallySvTypes([row(0, 'G')], FIELD)).toEqual([])
  expect(tallySvTypes(undefined, FIELD)).toEqual([])
})
