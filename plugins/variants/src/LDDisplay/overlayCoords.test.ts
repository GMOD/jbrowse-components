import { createTestEnvironment } from './testEnv.ts'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'

// A worker result for n evenly spaced SNPs, laid out the way the worker does:
// uniform columns of `uniformW` in the un-rotated frame, with the boundaries
// array the renderers and the hit test walk.
function ldData(
  n: number,
  width: number,
  overrides?: Partial<LDDataResult>,
): LDDataResult {
  const uniformW = width / (n * Math.SQRT2)
  const snps = Array.from({ length: n }, (_, i) => ({
    id: `rs${i}`,
    refName: 'ctgA',
    start: i * 1000,
    end: i * 1000 + 1,
  }))
  return {
    snps,
    ldValues: Float32Array.from(
      { length: (n * (n - 1)) / 2 },
      (_, i) => i / 10,
    ),
    boundaries: Float32Array.from({ length: n + 1 }, (_, i) => i * uniformW),
    numCells: (n * (n - 1)) / 2,
    uniformW,
    genomicMode: false,
    metric: 'r2',
    hasDprime: true,
    method: 'phased',
    signedLD: false,
    ...overrides,
  }
}

function loadedDisplay({ scrollTo = 0, data = {} } = {}) {
  const { display, view } = createTestEnvironment().createDisplay()
  view.zoomTo(10)
  view.scrollTo(scrollTo)
  const width = view.dynamicBlocks.totalWidthPxWithoutBorders
  display.setRpcData(ldData(4, width, data))
  display.commitDrawnViewport(display.captureViewport())
  return { display, view, width }
}

// The worker drops back to uniform cells when the viewport holds more than one
// region, so the slot alone doesn't say what is on screen. Everything that
// branches on the layout has to follow the data or it describes a matrix that
// isn't there.
describe('effectiveUseGenomicPositions follows the loaded matrix', () => {
  it('falls back to the slot before anything has loaded', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.effectiveUseGenomicPositions).toBe(false)
    display.setUseGenomicPositions(true)
    expect(display.effectiveUseGenomicPositions).toBe(true)
  })

  it('reads the loaded layout, not the request', () => {
    const { display } = loadedDisplay()
    display.setUseGenomicPositions(true)

    // the request stands — it is what the next fetch sends
    expect(display.useGenomicPositions).toBe(true)
    expect(display.rpcProps().useGenomicPositions).toBe(true)
    // but the matrix in hand is uniform, so the zone still holds connectors
    expect(display.effectiveUseGenomicPositions).toBe(false)
    expect(display.effectiveLineZoneHeight).toBe(display.lineZoneHeight)
  })
})

// The hover crosshair's ticks, the view's vertical guides and the connector
// lines all point at the same two loci. Measuring the ticks off the first
// content block instead left them short by the left gap while the guides beside
// them carried it.
test('locusViewportX is the frame the connector lines land in', () => {
  const { display } = loadedDisplay({ scrollTo: -100 })
  const coords = display.connectorLineCoords

  expect(display.renderTransform.viewOffsetX).toBe(100)
  for (const [i, snp] of display.snps.entries()) {
    expect(display.locusViewportX(snp.refName, snp.start)).toBe(coords[i]!.gx)
  }
  // the first SNP sits at bp 0, which is the gap's width right of the edge
  expect(display.locusViewportX('ctgA', 0)).toBe(100)
})

// The hit test walks `boundaries` for both layouts — uniform mode's are just
// `i * uniformW`. This is the genomic case, whose columns are unevenly spaced,
// so it can only be answered by the boundary walk and not by a division.
test('one search serves the genomic layout too', () => {
  const { display } = loadedDisplay({
    data: {
      genomicMode: true,
      boundaries: Float32Array.from([0, 10, 100, 120, 130]),
    },
  })
  const hitAt = (x: number, y: number) => {
    const screen = display.cellToScreen(x, y)
    const hit = display.hitTest(screen.x, screen.y)
    return [hit?.i, hit?.j]
  }

  // the narrow first column (0..10) against the third (100..120)
  expect(hitAt(5, 110)).toEqual([2, 0])
  // and a point inside the wide second column (10..100), which a uniform
  // division by any single cell width would place elsewhere
  expect(hitAt(55, 125)).toEqual([3, 1])
})

// hitTest inverts what cellToScreen does, and both overlays place themselves
// with the forward half, so a cell center round-trips back to its own cell.
//
// **Assert the coordinates, not just the cell they land in, and run squashed as
// well as natural.** `yScalar` is 1 in every other test here, and a cell-identity
// round trip is too coarse to catch a term this size: with `yScalar` deleted from
// the inverse the hit is off by a fraction of a cell, stays inside the same one,
// and all 45 LD tests passed — verified before this was split out. The exact
// round trip through `screenToCell` does catch it, and fit-to-height is precisely
// when a dropped `yScalar` would make the tooltip name the wrong pair of SNPs.
describe('cellToScreen and screenToCell are inverses', () => {
  test.each([
    ['natural height', false],
    ['fit-to-height squash', true],
  ])('%s', (_label, squash) => {
    const { display } = loadedDisplay({ scrollTo: -100 })
    display.setSquashToHeight(squash)
    expect(squash ? display.yScalar !== 1 : display.yScalar === 1).toBe(true)

    const { boundaries } = display.rpcData!
    const center = (k: number) => (boundaries[k]! + boundaries[k + 1]!) / 2

    for (const [u, v] of [
      [center(1), center(2)],
      [center(0), center(3)],
      [0, boundaries.at(-1)!],
    ]) {
      const screen = display.cellToScreen(u!, v!)
      const back = display.screenToCell(screen.x, screen.y)
      expect(back.x).toBeCloseTo(u!, 6)
      expect(back.y).toBeCloseTo(v!, 6)
    }

    // and the cell the pair resolves to, which is what the overlays consume
    const { x, y } = display.cellToScreen(center(1), center(2))
    const hit = display.hitTest(x, y)
    expect(hit).toBeDefined()
    expect([hit!.i, hit!.j]).toEqual([2, 1])
    expect(hit!.snp1.id).toBe('rs2')
    expect(hit!.snp2.id).toBe('rs1')
  })
})

// `columnX` is the x half of `cellToScreen` written a second time — the point on
// the diagonal at a fractional column index. It stays a separate expression on
// purpose: routing it through `cellToScreen` would make every connector line
// track `yScalar` and `effectiveLineZoneHeight`, which they genuinely do not
// depend on. What that costs is a way for the two to drift, and
// `columnX`'s own comment names the symptom — everything anchored through it
// slides off the triangle. So the agreement is asserted instead.
test('columnX agrees with the x half of cellToScreen', () => {
  const { display } = loadedDisplay({ scrollTo: -100 })
  const { cellWidth } = display
  for (const column of [0, 0.5, 1, 2.5, 4]) {
    const u = column * cellWidth
    expect(display.columnX(column)).toBeCloseTo(display.cellToScreen(u, u).x, 9)
  }
})
