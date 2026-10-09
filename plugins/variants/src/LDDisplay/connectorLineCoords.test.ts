import { createTestEnvironment } from './testEnv.ts'

import type { LDDataResult } from '../RenderLDDataRPC/types.ts'

// n SNPs evenly spread over the fetched span, laid out as the worker does:
// uniformW is the cell span in the un-rotated frame (bp units), so a column's
// own apex sits at (i + 0.5) * uniformW * SQRT2 * viewScale canvas pixels
// right of the origin.
function ldData(n: number, widthBp: number, originBp: number): LDDataResult {
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
    band: 1_000_000,
    uniformW: widthBp / (n * Math.SQRT2),
    originBp,
    genomicMode: false,
    metric: 'r2',
    hasR2: true,
    hasDprime: true,
  }
}

// A display holding a 4-SNP result fetched for the current viewport, i.e. what
// the model looks like the instant after a commit.
function loadedDisplay({ zoomedOut = false } = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  // zoomed out the 10Mbp region is narrower than the 800px viewport, so it sits
  // centered with empty viewport on both sides, and a zoom changes how much
  // content the viewport holds
  view.zoomTo(zoomedOut ? view.maxBpPerPx : 10)
  view.scrollTo(zoomedOut ? view.minOffset : 0)
  const width = view.dynamicBlocks.totalWidthPxWithoutBorders
  const block = view.dynamicBlocks.contentBlocks[0]!
  display.setRpcData(ldData(4, width * view.bpPerPx, block.start))
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
// while still being multiplied by the view transform's scale, so whenever the two
// disagreed a zoom applied the scale twice and the lines slid off the apexes for
// the whole debounce+RPC window. They disagree exactly when the content doesn't
// fill the viewport (here it stops short of both edges), because zooming then changes
// how much content the viewport holds. Deriving the pitch from the fetch-time
// cellWidth tracks the same rescale the stale pixels get.
test('zooming before the refetch lands keeps the lines on the stale triangle', () => {
  const { display, view } = loadedDisplay({ zoomedOut: true })
  const fetchWidth = view.dynamicBlocks.totalWidthPxWithoutBorders
  const t1 = display.viewTransform
  const before = display.connectorLineCoords.map(c => c.mx)
  expect(fetchWidth).toBeLessThan(view.width)

  view.zoomTo(view.bpPerPx / 2)
  const t2 = display.viewTransform
  expect(t2.viewScale / t1.viewScale).toBe(2)
  // the live block width grew as the zoom pulled more content into view; the
  // column pitch must not follow it, only the transform
  expect(view.dynamicBlocks.totalWidthPxWithoutBorders).toBeGreaterThan(
    fetchWidth,
  )
  const after = display.connectorLineCoords.map(c => c.mx)
  for (const [i, mx] of before.entries()) {
    expect(after[i]).toBeCloseTo(
      (mx - t1.viewOffsetX) * (t2.viewScale / t1.viewScale) + t2.viewOffsetX,
      9,
    )
  }
})

test('a view with room left of genome start keeps lines and ruler in one frame', () => {
  const { display, view } = loadedDisplay({ zoomedOut: true })

  const { viewOffsetX } = display.viewTransform
  const coords = display.connectorLineCoords
  const gap = -view.offsetPx
  // the gap is carried once, by the frame: the first SNP sits at bp 0, which is
  // `gap` px right of the viewport edge, and the first column with it
  expect(gap).toBeGreaterThan(0)
  expect(coords[0]!.gx).toBe(gap)
  expect(viewOffsetX).toBe(gap)
  expect(coords[0]!.mx).toBeGreaterThan(gap)
})

test('a SNP off the displayed regions is dropped, not pinned to the left edge', () => {
  const { display, view } = loadedDisplay()
  const data = ldData(
    4,
    view.dynamicBlocks.totalWidthPxWithoutBorders * view.bpPerPx,
    0,
  )
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
