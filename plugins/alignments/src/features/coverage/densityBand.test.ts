import { densityCoverageFields } from './densityBand.ts'

// `packCoverageBinsForGpu`'s record, from coverageBar.slang's layout: a u32
// position then an f32 relDepth, 8 bytes apiece. Decoded here rather than drawn
// because the buffer is what both backends read.
function decode(buffer: ArrayBuffer) {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  return Array.from({ length: buffer.byteLength / 8 }, (_, i) => ({
    position: u32[i * 2]!,
    relDepth: f32[i * 2 + 1]!,
  }))
}

function density(intervals: [start: number, end: number, score: number][]) {
  return {
    starts: Uint32Array.from(intervals.map(i => i[0])),
    ends: Uint32Array.from(intervals.map(i => i[1])),
    scores: Float32Array.from(intervals.map(i => i[2])),
  }
}

test('a flat source packs one record per bin at the bin width', () => {
  const fields = densityCoverageFields(density([[0, 100, 50]]), 10)
  expect(fields.coverageBinSize).toBe(10)
  expect(fields.coverageMaxDepth).toBe(50)
  expect(decode(fields.coveragePackedBuffer)).toEqual([
    { position: 0, relDepth: 1 },
    { position: 10, relDepth: 1 },
    { position: 20, relDepth: 1 },
    { position: 30, relDepth: 1 },
    { position: 40, relDepth: 1 },
    { position: 50, relDepth: 1 },
    { position: 60, relDepth: 1 },
    { position: 70, relDepth: 1 },
    { position: 80, relDepth: 1 },
    { position: 90, relDepth: 1 },
  ])
})

// The peak travels beside the buffer because the buffer holds depth/peak — the
// same un-baking the read-depth band does, so the display's autoscale can move
// without a repack.
test('relDepth is the bin against the region peak, and the peak travels with it', () => {
  const fields = densityCoverageFields(
    density([
      [0, 10, 4],
      [10, 20, 20],
    ]),
    10,
  )
  expect(fields.coverageMaxDepth).toBe(20)
  const records = decode(fields.coveragePackedBuffer)
  expect(records.map(r => r.position)).toEqual([0, 10])
  expect(records[0]!.relDepth).toBeCloseTo(0.2, 6)
  expect(records[1]!.relDepth).toBe(1)
})

// Absolute genomic coordinates, and the span is the source's own answer rather
// than the region it was asked about — see `binsExtent`.
test('positions are absolute, from the first bin the source answered', () => {
  const fields = densityCoverageFields(density([[1000, 1100, 10]]), 50)
  expect(decode(fields.coveragePackedBuffer).map(r => r.position)).toEqual([
    1000, 1050,
  ])
})

test('a source with nothing in it packs no records', () => {
  const fields = densityCoverageFields(density([]), 10)
  expect(fields.coverageMaxDepth).toBe(0)
  expect(fields.coveragePackedBuffer.byteLength).toBe(0)
})
