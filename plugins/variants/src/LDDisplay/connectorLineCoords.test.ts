import { createTestEnvironment } from './testEnv.ts'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'

// n SNPs evenly spread over the fetched span, laid out as the worker does:
// uniformW is the cell width in the un-rotated frame, so a column's own apex
// sits at (i + 0.5) * uniformW * SQRT2 in canvas pixels.
function ldData(n: number, width: number): LDDataResult {
  return {
    snps: Array.from({ length: n }, (_, i) => ({
      id: `rs${i}`,
      refName: 'ctgA',
      start: i * 1000,
      end: i * 1000 + 1,
    })),
    ldValues: new Float32Array((n * (n - 1)) / 2),
    boundaries: new Float32Array(n + 1),
    numCells: (n * (n - 1)) / 2,
    uniformW: width / (n * Math.SQRT2),
    genomicMode: false,
    metric: 'r2',
    hasDprime: true,
    method: 'phased',
    signedLD: false,
  }
}

// A display holding a 4-SNP result fetched for the current viewport, i.e. what
// the model looks like the instant after setRpcData/commitDrawnViewport.
function loadedDisplay({ scrollToEnd = false } = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.zoomTo(10)
  // the 10Mbp region spans 1,000,000px at bpPerPx 10, so parking 700px short of
  // its end leaves 100px of the 800px viewport empty — and puts the region's
  // right edge off-center, so a zoom changes how much content the viewport holds
  view.scrollTo(scrollToEnd ? 1_000_000 - 700 : 0)
  const width = view.dynamicBlocks.totalWidthPxWithoutBorders
  display.setRpcData(ldData(4, width))
  display.commitDrawnViewport(display.captureViewport())
  return { display, view, width }
}

test('column centers land on the triangle apexes the shader draws', () => {
  const { display, width } = loadedDisplay()
  const coords = display.connectorLineCoords
  const pitch = width / 4

  expect(coords.length).toBe(4)
  // toBeCloseTo: the pitch round-trips through the worker's uniformW as
  // width/(n*SQRT2), so it lands within float error of width/n
  for (const [i, coord] of coords.entries()) {
    expect(coord.mx).toBeCloseTo((i + 0.5) * pitch, 6)
  }
  // gx is the SNP's own genomic x, and the labels ride along for the tooltip
  expect(coords[0]!.gx).toBe(0)
  expect(coords.map(c => c.label)).toEqual(['rs0', 'rs1', 'rs2', 'rs3'])
})

// The regression this guards: mx used to be derived from the *live* block width
// while still being multiplied by renderTransform.scale, so whenever the two
// disagreed a zoom applied the scale twice and the lines slid off the apexes for
// the whole debounce+RPC window. They disagree exactly when the content doesn't
// fill the viewport (here it stops 100px short), because zooming then changes
// how much content the viewport holds. Deriving the pitch from the fetch-time
// cellWidth tracks the same rescale the stale pixels get.
test('zooming before the refetch lands keeps the lines on the stale triangle', () => {
  const { display, view } = loadedDisplay({ scrollToEnd: true })
  const fetchWidth = view.dynamicBlocks.totalWidthPxWithoutBorders
  const before = display.connectorLineCoords.map(c => c.mx)
  expect(fetchWidth).toBeLessThan(view.width)

  view.zoomTo(view.bpPerPx / 2)
  const { scale, viewOffsetX } = display.renderTransform
  expect(scale).toBe(2)
  // the live block width grew as the zoom pulled more content into view; the
  // column pitch must not follow it, only the transform
  expect(view.dynamicBlocks.totalWidthPxWithoutBorders).toBeGreaterThan(
    fetchWidth,
  )
  expect(display.connectorLineCoords.map(c => c.mx)).toEqual(
    before.map(mx => mx * scale + viewOffsetX),
  )
})

test('panning left of genome start keeps lines and ruler in one frame', () => {
  const { display, view } = loadedDisplay()
  view.scrollTo(-100)

  const { viewOffsetX } = display.renderTransform
  const coords = display.connectorLineCoords
  // the gap is carried once, by the frame: the first SNP sits at bp 0, which is
  // now 100px right of the viewport edge, and the first column with it
  expect(coords[0]!.gx).toBe(100)
  expect(viewOffsetX).toBe(100)
  expect(coords[0]!.mx).toBeGreaterThan(100)
})

test('a SNP off the displayed regions is dropped, not pinned to the left edge', () => {
  const { display, view } = loadedDisplay()
  const data = ldData(4, view.dynamicBlocks.totalWidthPxWithoutBorders)
  display.setRpcData({
    ...data,
    snps: data.snps.map((snp, i) =>
      i === 2 ? { ...snp, refName: 'ctgB' } : snp,
    ),
  })

  expect(display.connectorLineCoords.map(c => c.label)).toEqual([
    'rs0',
    'rs1',
    'rs3',
  ])
})
