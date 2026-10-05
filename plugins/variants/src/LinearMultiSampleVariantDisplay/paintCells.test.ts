import { ALT_HUE, cellFill } from '../shared/cellFill.ts'
import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import {
  paintCellColors,
  paintFeatureColors,
  paintedColorKeys,
} from './paintCells.ts'

import type { CellHue } from '../shared/cellHue.ts'
import type { PaintableCells } from './paintCells.ts'

const REF = 0x11111111
const NO_CALL = 0x22222222
const WORKER_ALT = 0x33333333

// feature 0 reads value 'a', feature 1 reads 'b', feature 2 reads nothing; each
// has a ref cell, a het cell and a no-call cell
function cells(): PaintableCells {
  return {
    cellColors: Uint32Array.from([
      REF,
      REF,
      REF,
      WORKER_ALT,
      NO_CALL,
      WORKER_ALT,
      NO_CALL,
      WORKER_ALT,
      NO_CALL,
    ]),
    cellAltDosage: Uint8Array.from([0, 0, 0, 128, 0, 128, 0, 128, 0]),
    cellFeatureIndices: Uint32Array.from([0, 1, 2, 0, 0, 1, 1, 2, 2]),
    numCells: 9,
    refCellCount: 3,
    featureColorValues: Uint32Array.from([1, 2, 0]),
    colorValues: ['a', 'b'],
    paintedColorValues: [],
  }
}

const none: CellHue = { read: undefined }
const byValue: CellHue = {
  read: undefined,
  hueOf: v => (v === 'a' ? '#aa0000' : '#0000aa'),
  keyOf: v => v.toUpperCase(),
}
const alleleCount = { phased: false, shade: true, valuesRead: true }
const phased = { phased: true, shade: true, valuesRead: true }
const het = (hue: string) => getCachedABGR(cellFill(hue, 128, true))

function paintCells(
  data: PaintableCells,
  hue: CellHue,
  options: { phased: boolean; shade: boolean; valuesRead: boolean },
) {
  return {
    cellColors: paintCellColors(data, hue, options),
    featureColors: paintFeatureColors(data, hue, options.valuesRead),
  }
}

test('the default hands back the worker colours untouched', () => {
  const data = cells()
  expect(paintCells(data, none, alleleCount).cellColors).toBe(data.cellColors)
  expect(paintCells(data, none, phased).cellColors).toBe(data.cellColors)
})

test('allele-count alt cells take their value hue, shaded by dosage', () => {
  const { cellColors } = paintCells(cells(), byValue, alleleCount)
  expect([...cellColors]).toEqual([
    REF,
    REF,
    REF,
    het('#aa0000'),
    NO_CALL,
    het('#0000aa'),
    NO_CALL,
    het(ALT_HUE),
    NO_CALL,
  ])
})

test('shading off paints the bare hue, the default one included', () => {
  const { cellColors } = paintCells(cells(), byValue, {
    ...alleleCount,
    shade: false,
  })
  expect(cellColors[3]).toBe(getCachedABGR('#aa0000'))
  expect(cellColors[7]).toBe(getCachedABGR(ALT_HUE))
  expect(
    paintCells(cells(), none, { ...alleleCount, shade: false }).cellColors[3],
  ).toBe(getCachedABGR(ALT_HUE))
})

test('phased alt cells a hue paints take it; the rest keep their allele colour', () => {
  const { cellColors } = paintCells(cells(), byValue, phased)
  expect(cellColors[3]).toBe(getCachedABGR('#aa0000'))
  expect(cellColors[5]).toBe(getCachedABGR('#0000aa'))
  expect(cellColors[7]).toBe(WORKER_ALT)
  expect(cellColors[4]).toBe(NO_CALL)
})

test('a constant paints every alt cell, with or without values', () => {
  const constant = { read: undefined, constant: '#00aa00' }
  const { cellColors, featureColors } = paintCells(cells(), constant, phased)
  expect([cellColors[3], cellColors[5], cellColors[7]]).toEqual(
    new Array(3).fill(getCachedABGR('#00aa00')),
  )
  expect([...featureColors]).toEqual(
    new Array(3).fill(getCachedABGR('#00aa00')),
  )
})

test('values read for another colour paint as though none were read', () => {
  const data = cells()
  const stale = { ...alleleCount, valuesRead: false }
  expect(paintCells(data, byValue, stale).cellColors).toBe(data.cellColors)
  const { cellColors } = paintCells(
    data,
    { ...byValue, constant: '#00aa00' },
    stale,
  )
  expect(cellColors[3]).toBe(het('#00aa00'))
  expect(cellColors[5]).toBe(het('#00aa00'))
})

test("the lane takes each variant's full-dose hue", () => {
  const { featureColors } = paintCells(cells(), byValue, alleleCount)
  expect([...featureColors]).toEqual([
    getCachedABGR('#aa0000'),
    getCachedABGR('#0000aa'),
    getCachedABGR(ALT_HUE),
  ])
})

test('the key lists the values a variant with an alt cell carried', () => {
  const regions = [
    { colorValues: ['a', 'b'], paintedColorValues: [1] },
    { colorValues: ['b', 'c'], paintedColorValues: [0, 1] },
  ]
  expect(paintedColorKeys(regions, byValue)).toEqual(['B', 'C'])
  expect(paintedColorKeys(regions, { read: undefined, hueOf: v => v })).toEqual(
    [],
  )
})
