import { computeSNPCoverage } from './coverageDownsampling.ts'

// coverage with a flat depth of 10 starting at genomic position 100.
function coverageAt100(depth = 10) {
  const depths = new Float32Array(5).fill(depth)
  return { depths, maxDepth: depth, startPos: 100 }
}

// Split the {position, base}[] fixtures into the flat arrays computeSNPCoverage
// now consumes.
function toArrays(mismatches: { position: number; base: number }[]) {
  const positions = new Uint32Array(mismatches.length)
  const bases = new Uint8Array(mismatches.length)
  for (let i = 0; i < mismatches.length; i++) {
    positions[i] = mismatches[i]!.position
    bases[i] = mismatches[i]!.base
  }
  return { positions, bases }
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
    const { positions, bases } = toArrays(mismatches)
    const result = computeSNPCoverage(positions, bases, 100, coverageAt100(10))
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
    const { positions, bases } = toArrays(mismatches)
    const result = computeSNPCoverage(positions, bases, 100, coverageAt100(10))
    const byType = segmentsByColorType(result)
    expect(byType[1]).toBeCloseTo(0.1) // A: 1/10
    expect(byType[5]).toBeCloseTo(0.2) // N + R: 2/10
  })

  test('a position with only N is not dropped', () => {
    const mismatches = [
      { position: 100, base: 78, strand: 1 },
      { position: 100, base: 78, strand: 1 },
    ]
    const { positions, bases } = toArrays(mismatches)
    const result = computeSNPCoverage(positions, bases, 100, coverageAt100(10))
    const byType = segmentsByColorType(result)
    expect(byType[5]).toBeCloseTo(0.2)
  })

  test('mismatches left of regionStart are dropped', () => {
    const mismatches = [
      { position: 99, base: 65, strand: 1 }, // left of regionStart 100
      { position: 100, base: 84, strand: 1 }, // T, kept
    ]
    const { positions, bases } = toArrays(mismatches)
    const result = computeSNPCoverage(positions, bases, 100, coverageAt100(10))
    expect(result.count).toBe(1)
    expect(result.positions[0]).toBe(100)
    expect(result.colorTypes[0]).toBe(4)
  })
})
