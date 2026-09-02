import {
  densityBinSize,
  densityToUniformBins,
  packDensityRegion,
} from './densityBins.ts'

function density(rows: [number, number, number][]) {
  return {
    starts: new Uint32Array(rows.map(r => r[0])),
    ends: new Uint32Array(rows.map(r => r[1])),
    scores: new Float32Array(rows.map(r => r[2])),
  }
}

test('a source bin wider than the screen bin is read as its level', () => {
  const bins = densityToUniformBins(
    density([[0, 1000, 100]]),
    { start: 0, end: 1000 },
    250,
  )
  expect([...bins.depths]).toEqual([100, 100, 100, 100])
  expect(bins.maxDepth).toBe(100)
  expect(bins.binCount).toBe(4)
})

test('source bins narrower than the screen bin average into it, gaps as 0', () => {
  const bins = densityToUniformBins(
    density([
      [0, 100, 3],
      [100, 200, 5],
      [200, 300, 1],
    ]),
    { start: 0, end: 400 },
    200,
  )
  expect([...bins.depths]).toEqual([4, 0.5])
})

test('a partial overlap contributes its share of the bin', () => {
  const bins = densityToUniformBins(
    density([[150, 350, 20]]),
    { start: 100, end: 500 },
    100,
  )
  expect([...bins.depths]).toEqual([10, 20, 10, 0])
  expect(bins.startOffset).toBe(100)
})

test('a short last bin is averaged over its own width', () => {
  const bins = densityToUniformBins(
    density([[0, 150, 10]]),
    { start: 0, end: 150 },
    100,
  )
  expect([...bins.depths]).toEqual([10, 10])
})

test('intervals outside the region and empty scores are ignored', () => {
  const bins = densityToUniformBins(
    density([
      [5000, 6000, 40],
      [0, 100, 0],
      [0, 100, Number.NaN],
    ]),
    { start: 0, end: 200 },
    100,
  )
  expect([...bins.depths]).toEqual([0, 0])
  expect(bins.maxDepth).toBe(0)
})

test('one bin per pixel, floored at a base', () => {
  expect(densityBinSize(0.2)).toBe(1)
  expect(densityBinSize(1234.4)).toBe(1234)
})

// The packed layout `drawCoverageBins` reads, un-packed: absolute bp and the
// fraction of the region peak. Two u32-sized fields per record.
function unpack(buffer: ArrayBuffer) {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  return Array.from({ length: u32.length / 2 }, (_, i) => ({
    position: u32[i * 2]!,
    relDepth: f32[i * 2 + 1]!,
  }))
}

describe('packDensityRegion', () => {
  it('bins the source intervals over their own extent at the bin size', () => {
    const region = packDensityRegion(
      density([
        [100, 110, 5],
        [110, 120, 15],
      ]),
      10,
    )!
    expect(region.binSize).toBe(10)
    expect(region.maxDepth).toBe(15)
    const bins = unpack(region.buffer)
    expect(bins.map(b => b.position)).toEqual([100, 110])
    expect(bins[0]!.relDepth).toBeCloseTo(5 / 15)
    expect(bins[1]!.relDepth).toBe(1)
  })

  // The whole reason the extent comes off the source rather than off the
  // visible region: at wide zoom the bins are pixels, so the record count
  // tracks the screen and not the span.
  it('follows the bin size rather than the span', () => {
    const source = density([[0, 4000, 40]])
    expect(unpack(packDensityRegion(source, 1000)!.buffer)).toHaveLength(4)
    expect(unpack(packDensityRegion(source, 4000)!.buffer)).toHaveLength(1)
  })

  it('has nothing to draw for an empty or all-zero source', () => {
    expect(packDensityRegion(density([]), 10)).toBeUndefined()
    expect(packDensityRegion(density([[0, 100, 0]]), 10)).toBeUndefined()
  })
})
