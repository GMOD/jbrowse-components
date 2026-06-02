import { computeSNPCoverage } from './coverageDownsampling.ts'

// coverage with a flat depth of 10 starting at genomic position 100.
function coverageAt100(depth = 10) {
  const depths = new Float32Array(5).fill(depth)
  return { depths, maxDepth: depth, startPos: 100 }
}

function segmentsByColorType(result: ReturnType<typeof computeSNPCoverage>) {
  const out: Record<number, number> = {}
  for (let i = 0; i < result.count; i++) {
    out[result.colorTypes[i]!] = result.heights[i]!
  }
  return out
}

describe('computeSNPCoverage', () => {
  test('stacks A/C/G/T segments as fractions of the position depth', () => {
    const mismatches = [
      { position: 100, base: 65, strand: 1 }, // A
      { position: 100, base: 65, strand: 1 }, // A
      { position: 100, base: 84, strand: 1 }, // T
    ]
    const result = computeSNPCoverage(mismatches, 100, coverageAt100(10))
    const byType = segmentsByColorType(result)
    expect(byType[1]).toBeCloseTo(0.2) // A: 2/10
    expect(byType[4]).toBeCloseTo(0.1) // T: 1/10
  })

  test('N and other non-ACGT bases become a grey colorType-5 segment', () => {
    const mismatches = [
      { position: 100, base: 65, strand: 1 }, // A
      { position: 100, base: 78, strand: 1 }, // N
      { position: 100, base: 82, strand: 1 }, // R (IUPAC ambiguity)
    ]
    const result = computeSNPCoverage(mismatches, 100, coverageAt100(10))
    const byType = segmentsByColorType(result)
    expect(byType[1]).toBeCloseTo(0.1) // A: 1/10
    expect(byType[5]).toBeCloseTo(0.2) // N + R: 2/10
  })

  test('a position with only N is not dropped', () => {
    const mismatches = [
      { position: 100, base: 78, strand: 1 },
      { position: 100, base: 78, strand: 1 },
    ]
    const result = computeSNPCoverage(mismatches, 100, coverageAt100(10))
    const byType = segmentsByColorType(result)
    expect(byType[5]).toBeCloseTo(0.2)
  })
})
