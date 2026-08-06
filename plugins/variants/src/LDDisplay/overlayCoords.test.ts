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
    recombination: {
      values: new Float32Array(n - 1).fill(0.5),
      positions: snps
        .slice(0, -1)
        .map((s, i) => (s.start + snps[i + 1]!.start) / 2),
    },
    ...overrides,
  }
}

function loadedDisplay({ scrollTo = 0, data = {} } = {}) {
  const { display, view } = createTestEnvironment().createDisplay()
  view.zoomTo(10)
  view.scrollTo(scrollTo)
  const width = view.dynamicBlocks.totalWidthPxWithoutBorders
  display.setRpcData(ldData(4, width, data))
  display.setLastDrawnViewport(view.offsetPx, view.bpPerPx)
  return { display, view, width }
}

// The recombination curve labels the boundary between two columns, so every
// point belongs exactly halfway between the two connector lines it sits over.
// Laying it out across the live viewport width instead — what the plot
// component used to do — put it there only while the content happened to fill
// the viewport at the zoom the data was fetched at.
describe('recombinationCoords rides the matrix frame', () => {
  it('lands each point between the two columns it measures', () => {
    const { display } = loadedDisplay()
    const mx = display.connectorLineCoords.map(c => c.mx)
    const xs = display.recombinationCoords.map(c => c.x)

    expect(xs.length).toBe(3)
    for (const [k, x] of xs.entries()) {
      expect(x).toBeCloseTo((mx[k]! + mx[k + 1]!) / 2, 6)
    }
  })

  it('carries the left gap when the view is scrolled past genome start', () => {
    const { display } = loadedDisplay({ scrollTo: -100 })
    const { viewOffsetX } = display.renderTransform
    const mx = display.connectorLineCoords.map(c => c.mx)

    expect(viewOffsetX).toBe(100)
    expect(display.recombinationCoords[0]!.x).toBeCloseTo(
      (mx[0]! + mx[1]!) / 2,
      6,
    )
    // and that is right of the viewport edge by the gap, not pinned to it
    expect(display.recombinationCoords[0]!.x).toBeGreaterThan(100)
  })

  it('rescales with the triangle while a zoom refetch is in flight', () => {
    const { display, view } = loadedDisplay()
    const before = display.recombinationCoords.map(c => c.x)

    view.zoomTo(view.bpPerPx / 2)
    const { scale, viewOffsetX } = display.renderTransform
    expect(scale).toBe(2)
    expect(display.recombinationCoords.map(c => c.x)).toEqual(
      before.map(x => x * scale + viewOffsetX),
    )
  })

  it('reports one max for the curve and its scale bar, ignoring unmeasured pairs', () => {
    const { display } = loadedDisplay({
      data: {
        recombination: {
          values: Float32Array.from([0.25, Number.NaN, 0.75]),
          positions: [500, 1500, 2500],
        },
      },
    })
    expect(display.recombinationMax).toBe(0.75)
    expect(display.recombinationCoords.map(c => c.value)).toEqual([
      0.25,
      Number.NaN,
      0.75,
    ])
  })
})

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
test('cellToScreen and hitTest are inverses', () => {
  const { display } = loadedDisplay({ scrollTo: -100 })
  const { boundaries } = display.rpcData!
  const center = (k: number) => (boundaries[k]! + boundaries[k + 1]!) / 2

  const { x, y } = display.cellToScreen(center(1), center(2))
  const hit = display.hitTest(x, y)

  expect(hit).toBeDefined()
  expect([hit!.i, hit!.j]).toEqual([2, 1])
  expect(hit!.snp1.id).toBe('rs2')
  expect(hit!.snp2.id).toBe('rs1')
})
