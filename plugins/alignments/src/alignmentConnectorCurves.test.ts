import { bezierConnectorPath } from '@jbrowse/core/util'

import { connectorArrowPx } from './features/linkedReads/connectorFeed.ts'
import { alignmentConnectorCurves } from './tables.ts'

const featureHeight = 7
const featureSpacing = 1
const pitch = featureHeight + featureSpacing

type Kind = 'straight' | 'curve' | 'loop'

function one({
  start,
  end,
  row = 2,
  endRow = row,
  kind = 'curve',
  dip = 0,
  strand = 1,
  endStrand = 1,
  leading = false,
  arrow = false,
  pxPerBp = 0.5,
  reversed = false,
}: {
  start: number
  end: number
  row?: number
  endRow?: number
  kind?: Kind
  dip?: number
  strand?: number
  endStrand?: number
  leading?: boolean
  arrow?: boolean
  pxPerBp?: number
  reversed?: boolean
}) {
  const curves = alignmentConnectorCurves({
    pxPerBp,
    reversed,
    featureHeight,
    featureSpacing,
    connectors: {
      start: [start],
      end: [end],
      row: [row],
      endRow: [endRow],
      kind: [kind],
      dip: [dip],
      strand: [strand],
      endStrand: [endStrand],
      leading: [leading],
      arrow: [arrow],
    },
  })
  return {
    handle: curves.handle[0]!,
    handleRow: curves.handleRow[0]!,
    endHandle: curves.endHandle[0]!,
    endHandleRow: curves.endHandleRow[0]!,
    arrow: curves.arrow[0]!,
    arrowBack: curves.arrowBack[0]!,
    arrowRows: curves.arrowRows,
  }
}

// The split view's SVG path through the same geometry, its control points
// read back into bp and rows.
function splitViewCurve({
  start,
  end,
  row = 2,
  endRow = row,
  dip,
  strand = 1,
  endStrand = 1,
  leading = false,
  pxPerBp = 0.5,
  reversed = false,
}: {
  start: number
  end: number
  row?: number
  endRow?: number
  dip?: number
  strand?: number
  endStrand?: number
  leading?: boolean
  pxPerBp?: number
  reversed?: boolean
}) {
  const signed = reversed ? -pxPerBp : pxPerBp
  const d = bezierConnectorPath({
    x1: start * signed,
    y1: row * pitch,
    x2: end * signed,
    y2: endRow * pitch,
    s1: strand,
    s2: endStrand,
    leadingEnd2: leading,
    reversed1: reversed,
    reversed2: reversed,
    dipPx: dip,
  })
  const [, , c1x, c1y, c2x, c2y] = d
    .replaceAll(/[MC]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(Number)
  return {
    handle: c1x! / signed,
    handleRow: c1y! / pitch,
    endHandle: c2x! / signed,
    endHandleRow: c2y! / pitch,
  }
}

function expectSameCurve(
  got: ReturnType<typeof one>,
  want: ReturnType<typeof splitViewCurve>,
) {
  expect(got.handle).toBeCloseTo(want.handle, 6)
  expect(got.handleRow).toBeCloseTo(want.handleRow, 6)
  expect(got.endHandle).toBeCloseTo(want.endHandle, 6)
  expect(got.endHandleRow).toBeCloseTo(want.endHandleRow, 6)
}

test('a straight connector’s handles sit on its two ends', () => {
  const c = one({ start: 1000, end: 1400, row: 3, endRow: 5, kind: 'straight' })
  expect(c).toMatchObject({
    handle: 1000,
    handleRow: 3,
    endHandle: 1400,
    endHandleRow: 5,
  })
})

test('a dipping curve is the split view’s curve, below its rows', () => {
  const cases = [
    { start: 1000, end: 1600, dip: 30 },
    { start: 1000, end: 1600, dip: 30, strand: -1 },
    { start: 1000, end: 1600, dip: 30, leading: true },
    { start: 1600, end: 1000, dip: 12, endStrand: -1, leading: true },
    { start: 1000, end: 1600, dip: 30, reversed: true },
    { start: 1000, end: 1600, row: 1, endRow: 6, dip: 20 },
  ]
  for (const c of cases) {
    const got = one({ ...c, kind: 'curve' })
    expectSameCurve(got, splitViewCurve(c))
    expect(got.handleRow).toBeGreaterThan(c.row ?? 2)
  }
})

test('a curve with no dip bows up over its rows as the split view’s does', () => {
  const got = one({ start: 1000, end: 1600, kind: 'curve', dip: 0 })
  expectSameCurve(got, splitViewCurve({ start: 1000, end: 1600 }))
  expect(got.handleRow).toBeLessThan(2)
})

test('each handle leaves its end the way its strand reads, in bp on a reversed region too', () => {
  const forward = one({ start: 1000, end: 1600, dip: 30 })
  const minus = one({ start: 1000, end: 1600, dip: 30, strand: -1 })
  const reversed = one({ start: 1000, end: 1600, dip: 30, reversed: true })
  expect(forward.handle).toBeGreaterThan(1000)
  expect(minus.handle).toBeLessThan(1000)
  expect(reversed.handle).toBeCloseTo(forward.handle, 6)
})

test('a loop’s arrowhead draws where it fits, its arms reaching back off the row', () => {
  const arrowPx = connectorArrowPx(featureHeight)
  expect(arrowPx).toBeGreaterThan(0)
  const wide = one({
    start: 1000,
    end: 1600,
    kind: 'loop',
    dip: 28,
    arrow: true,
  })
  expect(wide.arrow).toBe(true)
  expect(wide.arrowRows).toBeCloseTo(arrowPx / pitch, 6)
  expect(wide.arrowBack).toBeCloseTo(1600 - arrowPx / 0.5, 6)
  const narrow = one({
    start: 1000,
    end: 1001,
    kind: 'loop',
    dip: 28,
    arrow: true,
  })
  expect(narrow.arrow).toBe(false)
})

test('a dip flattens as the figure zooms out, to a quarter of its ends’ spread', () => {
  const zoomedIn = one({ start: 1000, end: 1600, dip: 100, pxPerBp: 1 })
  const zoomedOut = one({ start: 1000, end: 1600, dip: 100, pxPerBp: 0.01 })
  const depth = (c: ReturnType<typeof one>) => (c.handleRow - 2) * pitch
  expect(depth(zoomedOut)).toBeLessThan(depth(zoomedIn))
  expect(depth(zoomedOut) * 0.75).toBeLessThanOrEqual(600 * 0.01 * 0.25 + 1e-6)
})

test('pxPerBp must be a finite positive number', () => {
  expect(() => one({ start: 1, end: 2, pxPerBp: 0 })).toThrow('pxPerBp is 0')
})
