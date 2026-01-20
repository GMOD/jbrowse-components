import {
  CLOUD_HEIGHT_PADDING,
  calculateCloudTicks,
  calculateCloudYOffsetsUtil,
  createCloudScale,
} from './drawFeatsCloud.ts'

import type { ComputedChain } from './drawFeatsCommon.ts'

// Helper to create mock computed chains
function createMockChain(
  id: string,
  distance: number,
  overrides?: Partial<ComputedChain>,
): ComputedChain {
  return {
    id,
    distance,
    minX: 0,
    maxX: 100,
    chain: [],
    isPairedEnd: true,
    nonSupplementary: [],
    ...overrides,
  }
}

describe('createCloudScale', () => {
  test('creates a log scale with correct domain and range', () => {
    const scale = createCloudScale(1000, 500)

    // Scale should map 1 (min) to 0
    expect(scale(1)).toBe(0)

    // Scale should map maxDistance to height - padding
    expect(scale(1000)).toBe(500 - CLOUD_HEIGHT_PADDING)

    // Values in between should be mapped logarithmically
    const midValue = scale(100)
    expect(midValue).toBeGreaterThan(0)
    expect(midValue).toBeLessThan(500 - CLOUD_HEIGHT_PADDING)
  })

  test('clamps values outside domain', () => {
    const scale = createCloudScale(1000, 500)

    // Values below min should clamp to 0
    expect(scale(0.1)).toBe(0)

    // Values above max should clamp to max range
    expect(scale(10000)).toBe(500 - CLOUD_HEIGHT_PADDING)
  })

  test('handles small maxDistance correctly', () => {
    // createCloudScale uses Math.max(2, maxDistance) for domain upper bound
    const scale = createCloudScale(1, 500)

    // Should still work without errors
    expect(scale(1)).toBeDefined()
    expect(scale(2)).toBeDefined()
  })
})

describe('calculateCloudTicks', () => {
  test('generates ticks for a typical maxDistance', () => {
    const result = calculateCloudTicks(10000, 500)

    expect(result.height).toBe(500)
    expect(result.maxDistance).toBe(10000)
    expect(result.ticks.length).toBeGreaterThan(0)

    // Each tick should have a value and y position
    for (const tick of result.ticks) {
      expect(tick.value).toBeGreaterThan(0)
      expect(tick.y).toBeGreaterThanOrEqual(0)
      expect(tick.y).toBeLessThanOrEqual(500 - CLOUD_HEIGHT_PADDING)
    }
  })

  test('tick y values increase with tick values', () => {
    const result = calculateCloudTicks(10000, 500)

    // Ticks should be in increasing order of both value and y
    for (let i = 1; i < result.ticks.length; i++) {
      const prev = result.ticks[i - 1]!
      const curr = result.ticks[i]!
      expect(curr.value).toBeGreaterThan(prev.value)
      expect(curr.y).toBeGreaterThan(prev.y)
    }
  })

  test('handles small maxDistance', () => {
    const result = calculateCloudTicks(100, 300)

    expect(result.ticks.length).toBeGreaterThan(0)
    expect(result.maxDistance).toBe(100)
  })

  test('handles large maxDistance', () => {
    const result = calculateCloudTicks(1000000, 800)

    expect(result.ticks.length).toBeGreaterThan(0)
    expect(result.maxDistance).toBe(1000000)
  })
})

describe('calculateCloudYOffsetsUtil', () => {
  test('computes Y offsets from chain distances', () => {
    const chains = [
      createMockChain('chain1', 100),
      createMockChain('chain2', 500),
      createMockChain('chain3', 1000),
    ]

    const result = calculateCloudYOffsetsUtil(chains, 500)

    expect(result.chainYOffsets.size).toBe(3)
    expect(result.cloudMaxDistance).toBe(1000)

    // Y offsets should increase with distance
    const y1 = result.chainYOffsets.get('chain1')!
    const y2 = result.chainYOffsets.get('chain2')!
    const y3 = result.chainYOffsets.get('chain3')!

    expect(y1).toBeLessThan(y2)
    expect(y2).toBeLessThan(y3)
  })

  test('chains with distance 0 are placed at y=0', () => {
    const chains = [
      createMockChain('chain1', 0),
      createMockChain('chain2', 500),
    ]

    const result = calculateCloudYOffsetsUtil(chains, 500)

    expect(result.chainYOffsets.get('chain1')).toBe(0)
    expect(result.chainYOffsets.get('chain2')).toBeGreaterThan(0)
  })

  test('uses default max distance when all chains are singletons (distance 0)', () => {
    const chains = [
      createMockChain('chain1', 0),
      createMockChain('chain2', 0),
      createMockChain('chain3', 0),
    ]

    const result = calculateCloudYOffsetsUtil(chains, 500)

    // Default max distance is 1000
    expect(result.cloudMaxDistance).toBe(1000)

    // All chains should be at y=0
    expect(result.chainYOffsets.get('chain1')).toBe(0)
    expect(result.chainYOffsets.get('chain2')).toBe(0)
    expect(result.chainYOffsets.get('chain3')).toBe(0)
  })

  test('computes maxDistance from the largest distance in visible data', () => {
    const chains = [
      createMockChain('chain1', 100),
      createMockChain('chain2', 5000),
      createMockChain('chain3', 200),
    ]

    const result = calculateCloudYOffsetsUtil(chains, 500)

    // Should find the max distance from the data
    expect(result.cloudMaxDistance).toBe(5000)
  })

  test('handles empty chains array', () => {
    const result = calculateCloudYOffsetsUtil([], 500)

    expect(result.chainYOffsets.size).toBe(0)
    // Uses default max distance when no positive distances found
    expect(result.cloudMaxDistance).toBe(1000)
  })

  test('scale adapts when scrolling to region with larger insert sizes', () => {
    // First region with smaller insert sizes
    const smallInsertChains = [
      createMockChain('chain1', 200),
      createMockChain('chain2', 300),
      createMockChain('chain3', 400),
    ]

    const result1 = calculateCloudYOffsetsUtil(smallInsertChains, 500)
    expect(result1.cloudMaxDistance).toBe(400)

    // Second region with larger insert sizes (simulating scroll)
    const largeInsertChains = [
      createMockChain('chain4', 1000),
      createMockChain('chain5', 5000),
      createMockChain('chain6', 10000),
    ]

    const result2 = calculateCloudYOffsetsUtil(largeInsertChains, 500)
    expect(result2.cloudMaxDistance).toBe(10000)

    // The max distance should be different, showing the scale adapts
    expect(result2.cloudMaxDistance).toBeGreaterThan(result1.cloudMaxDistance)
  })

  test('Y offsets are bounded by height minus padding', () => {
    const chains = [
      createMockChain('chain1', 100),
      createMockChain('chain2', 1000),
      createMockChain('chain3', 10000),
    ]

    const height = 500
    const result = calculateCloudYOffsetsUtil(chains, height)

    for (const [, yOffset] of result.chainYOffsets) {
      expect(yOffset).toBeGreaterThanOrEqual(0)
      expect(yOffset).toBeLessThanOrEqual(height - CLOUD_HEIGHT_PADDING)
    }
  })

  test('consistent scale for same data', () => {
    const chains = [
      createMockChain('chain1', 100),
      createMockChain('chain2', 500),
      createMockChain('chain3', 1000),
    ]

    const result1 = calculateCloudYOffsetsUtil(chains, 500)
    const result2 = calculateCloudYOffsetsUtil(chains, 500)

    // Same input should produce same output
    expect(result1.cloudMaxDistance).toBe(result2.cloudMaxDistance)
    expect(result1.chainYOffsets.get('chain1')).toBe(
      result2.chainYOffsets.get('chain1'),
    )
    expect(result1.chainYOffsets.get('chain2')).toBe(
      result2.chainYOffsets.get('chain2'),
    )
    expect(result1.chainYOffsets.get('chain3')).toBe(
      result2.chainYOffsets.get('chain3'),
    )
  })
})
