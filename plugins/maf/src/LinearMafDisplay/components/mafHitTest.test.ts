import { mafPointerAt, resolveMafRowHover, rowSpanAtY } from './mafHitTest.ts'

import type { MafHover } from '../util.ts'
import type { MafHitTestModel } from './mafHitTest.ts'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'

// One displayed region [1000, 2000) starting at screen x 0, at 1 bp/px. A
// reversed region counts bp down from `end`, which is the whole reason
// `gposFrac` can't just be `start + offset`.
function pxToBp(reversed: boolean) {
  return (px: number): PxToBpResult => ({
    start: 1000,
    end: 2000,
    refName: 'chr1',
    assemblyName: 'hg38',
    reversed,
    offset: px,
    index: 3,
    oob: px < 0 || px > 1000,
    coord: reversed ? 2000 - Math.floor(px) : 1000 + Math.floor(px) + 1,
    coord0: reversed ? 2000 - Math.floor(px) - 1 : 1000 + Math.floor(px),
  })
}

const CELL_HOVER: MafHover = {
  kind: 'cell',
  base: 'G',
  sampleLabel: 'mouse',
}

function makeModel(overrides?: Partial<MafHitTestModel>): MafHitTestModel {
  return {
    lgv: { pxToBp: pxToBp(false), bpPerPx: 1 },
    scrollTop: 0,
    rowsTopOffset: 45,
    effectiveRowHeight: 10,
    rowHoverInfo: () => CELL_HOVER,
    ...overrides,
  }
}

describe('mafPointerAt', () => {
  test('projects x to an orientation-aware absolute genomic coordinate', () => {
    expect(mafPointerAt(makeModel(), 25.5, 100).gposFrac).toBe(1025.5)
  })

  test('a reversed region counts down from the region end', () => {
    const model = makeModel({
      lgv: { pxToBp: pxToBp(true), bpPerPx: 1 },
    })
    expect(mafPointerAt(model, 25.5, 100).gposFrac).toBe(1974.5)
  })

  test('baseBp is the base painted at the pixel, which reversed is not a floor', () => {
    expect(mafPointerAt(makeModel(), 25.5, 100).baseBp).toBe(1025)
    const reversed = makeModel({
      lgv: { pxToBp: pxToBp(true), bpPerPx: 1 },
    })
    // mid-cell the two agree...
    expect(mafPointerAt(reversed, 25.5, 100).baseBp).toBe(1974)
    // ...and on a cell boundary they don't: bp runs leftward, so base b covers
    // offsets (b, b+1] and the floor names the base to its right. At offset 0
    // that is `end` itself, outside the region — which is what used to make the
    // leftmost pixel column of a flipped region resolve no hover at all.
    expect(mafPointerAt(reversed, 0, 100).gposFrac).toBe(2000)
    expect(mafPointerAt(reversed, 0, 100).baseBp).toBe(1999)
  })

  test('row index is measured from the bottom of the stacked bands', () => {
    // rowsTopOffset 45, rowHeight 10: y=45 is row 0, y=54 still row 0, y=55 is row 1
    const model = makeModel()
    expect(mafPointerAt(model, 0, 45).rowIndex).toBe(0)
    expect(mafPointerAt(model, 0, 54).rowIndex).toBe(0)
    expect(mafPointerAt(model, 0, 55).rowIndex).toBe(1)
  })

  // sub-pixel rows are where the half-pixel matters: pixel 45 shows whichever
  // row covers 45.5, and measuring from 45.0 named the row above it
  test('a sub-pixel row height resolves the row the pixel was painted from', () => {
    const model = makeModel({ effectiveRowHeight: 0.1 })
    expect(mafPointerAt(model, 0, 45).rowIndex).toBe(5)
    expect(mafPointerAt(model, 0, 46).rowIndex).toBe(15)
  })

  test('scrollTop shifts the rows under the cursor', () => {
    const model = makeModel({ scrollTop: 20 })
    expect(mafPointerAt(model, 0, 45).rowIndex).toBe(2)
  })

  test('inBands is set over the stacked bands and clear over the rows', () => {
    const model = makeModel()
    expect(mafPointerAt(model, 0, 44).inBands).toBe(true)
    expect(mafPointerAt(model, 0, 45).inBands).toBe(false)
  })
})

describe('resolveMafRowHover', () => {
  test('resolves a hover over the rows area', () => {
    expect(resolveMafRowHover(makeModel(), 25, 100)).toBe(CELL_HOVER)
  })

  test('reports nothing over the bands', () => {
    // Guards the pointer-cursor feedback and the insertion click, which have no
    // band gate of their own: with the rows scrolled, the band area maps to a
    // non-negative row index, so without `inBands` a coverage-band hover would
    // resolve to a row and show a clickable cursor over the wrong band.
    const model = makeModel({ scrollTop: 50 })
    expect(mafPointerAt(model, 25, 10).rowIndex).toBe(1)
    expect(resolveMafRowHover(model, 25, 10)).toBeUndefined()
  })

  test('reports nothing out of bounds', () => {
    expect(resolveMafRowHover(makeModel(), -5, 100)).toBeUndefined()
  })

  test('passes the region index and bp the tooltip would show', () => {
    const calls: unknown[][] = []
    const model = makeModel({
      rowHoverInfo: (...args) => {
        calls.push(args)
        return undefined
      },
    })
    resolveMafRowHover(model, 25.5, 65)
    expect(calls).toEqual([[3, { gposFrac: 1025.5, baseBp: 1025 }, 2, 1]])
  })
})

// The span runs between the rows the two ends are *over*, the same question
// mafPointerAt answers for the bp — sampleNavigationItems asks both, and they
// used to answer on different conventions.
describe('rowSpanAtY', () => {
  test('covers the row under each end of the drag', () => {
    // rows are 10px from y=45, so y=74 is over row 2
    expect(rowSpanAtY(makeModel(), 45, 74)).toEqual({ startRow: 0, endRow: 3 })
  })

  test('is orientation-independent (drag upward)', () => {
    expect(rowSpanAtY(makeModel(), 74, 45)).toEqual({ startRow: 0, endRow: 3 })
  })

  test('a drag starting in the band area clamps to row 0', () => {
    expect(rowSpanAtY(makeModel(), 0, 58)).toEqual({ startRow: 0, endRow: 2 })
  })

  test('includes the row the cursor released on at an exact boundary', () => {
    // y=55 is the row 0 / row 1 seam: pixel 55 is drawn in row 1 and that is
    // what the reader is pointing at. Ceiling the same coordinate instead
    // collapsed a horizontal drag here to an empty span.
    expect(rowSpanAtY(makeModel(), 45, 55)).toEqual({ startRow: 0, endRow: 2 })
    expect(rowSpanAtY(makeModel(), 55, 55)).toEqual({ startRow: 1, endRow: 2 })
  })

  test('a zero-height drag still selects the row it lands on', () => {
    expect(rowSpanAtY(makeModel(), 52, 52)).toEqual({ startRow: 0, endRow: 1 })
  })
})
