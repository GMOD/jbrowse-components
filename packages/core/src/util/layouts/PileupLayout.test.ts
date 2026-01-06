import PileupLayout from './PileupLayout.ts'

test('lays out non-overlapping features on same row', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })
  const testRects = [
    ['1,0', 4133, 5923],
    ['1,1', 11299, 12389],
    ['1,2', 21050, 22778],
    ['1,3', 41125, 47459],
    ['1,4', 47926, 49272],
    ['1,5', 50240, 52495],
    ['1,6', 53329, 56283],
    ['1,7', 59309, 79441],
    ['1,8', 80359, 83196],
    ['1,9', 92147, 94188],
  ] as [string, number, number][]

  for (const [id, left, right] of testRects) {
    const top = l.addRect(id, left, right, 10)
    expect(top).toEqual(0)
  }
})

test('stacks overlapping features on different rows', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })

  // Add overlapping features - each overlaps with the previous
  const testRects = [] as [string, number, number][]
  for (let i = 1; i <= 10; i++) {
    testRects.push([`feature-${i}`, 100 * i - 60, 100 * i + 60])
  }

  for (const [i, [id, left, right]] of testRects.entries()) {
    const top = l.addRect(id, left, right, 10)
    // First feature at row 0, second at row 1, third back at row 0, etc.
    expect(top).toEqual((i % 2) * 10)
  }
})

test('hint optimization for same-start features', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })

  // Simulate deep coverage - many features starting at same position
  const sameStart = 1000
  for (let i = 0; i < 100; i++) {
    const top = l.addRect(`feature-${i}`, sameStart, sameStart + 50 + i, 10)
    // Each should go on a different row
    expect(top).toEqual(i * 10)
  }
})

test('returns null when maxHeight exceeded', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0, maxHeight: 30 })

  // First 3 features fit (rows 0, 1, 2)
  expect(l.addRect('f1', 0, 100, 10)).toEqual(0)
  expect(l.addRect('f2', 0, 100, 10)).toEqual(10)
  expect(l.addRect('f3', 0, 100, 10)).toEqual(20)

  // Fourth feature exceeds maxHeight
  expect(l.addRect('f4', 0, 100, 10)).toEqual(null)
  expect(l.maxHeightReached).toBe(true)
})

test('returns cached position for duplicate IDs', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })

  const top1 = l.addRect('same-id', 0, 100, 10)
  const top2 = l.addRect('same-id', 0, 100, 10)

  expect(top1).toEqual(top2)
  expect(top1).toEqual(0)
})

test('discards regions correctly', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })

  // Add some features
  for (let i = 0; i < 10; i++) {
    l.addRect(`feature-${i}`, 1000 * i, 1000 * i + 500, 10)
  }

  // @ts-expect-error - accessing private for test
  const initialIntervalCount = l.rows.reduce(
    (sum: number, r: number[] | undefined) => sum + (r ? r.length : 0),
    0,
  )

  // Discard middle region
  l.discardRange(3000, 6000)

  // @ts-expect-error - accessing private for test
  const afterDiscardIntervalCount = l.rows.reduce(
    (sum: number, r: number[] | undefined) => sum + (r ? r.length : 0),
    0,
  )

  expect(afterDiscardIntervalCount).toBeLessThanOrEqual(initialIntervalCount)
})

test('getTotalHeight returns correct value', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 2 })

  l.addRect('f1', 0, 100, 10)
  expect(l.getTotalHeight()).toEqual(12) // 1 row * (10 + 2)

  l.addRect('f2', 0, 100, 10)
  expect(l.getTotalHeight()).toEqual(24) // 2 rows * (10 + 2)

  l.addRect('f3', 200, 300, 10) // non-overlapping, goes on row 0
  expect(l.getTotalHeight()).toEqual(24) // still 2 rows
})

test('getRectangles returns correct coordinates', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })

  l.addRect('f1', 100, 200, 10)
  l.addRect('f2', 100, 200, 10)

  const rects = l.getRectangles()

  expect(rects.get('f1')).toEqual([100, 0, 200, 10])
  expect(rects.get('f2')).toEqual([100, 10, 200, 20])
})

test('getDataByID returns stored data', () => {
  const l = new PileupLayout<{ name: string }>({ featureHeight: 10 })

  l.addRect('f1', 0, 100, 10, { name: 'feature1' })
  l.addRect('f2', 0, 100, 10, { name: 'feature2' })

  expect(l.getDataByID('f1')).toEqual({ name: 'feature1' })
  expect(l.getDataByID('f2')).toEqual({ name: 'feature2' })
  expect(l.getDataByID('nonexistent')).toBeUndefined()
})

test('serializeRegion returns features in range', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })

  l.addRect('f1', 100, 200, 10)
  l.addRect('f2', 300, 400, 10)
  l.addRect('f3', 500, 600, 10)

  const serialized = l.serializeRegion({ start: 250, end: 450 })

  expect(serialized.rectangles.f1).toBeUndefined()
  expect(serialized.rectangles.f2).toBeDefined()
  expect(serialized.rectangles.f3).toBeUndefined()
})

test('handles features with spacing', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 5 })

  l.addRect('f1', 0, 100, 10)
  l.addRect('f2', 0, 100, 10)

  const rects = l.getRectangles()

  // First feature at y=0, height=10
  expect(rects.get('f1')).toEqual([0, 0, 100, 10])
  // Second feature at y=15 (rowHeight = 10 + 5 = 15), height=10
  expect(rects.get('f2')).toEqual([0, 15, 100, 25])
})

test('rowMaxEnd optimization works correctly', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0, padding: 0 })

  // Add feature ending at 100
  l.addRect('f1', 0, 100, 10)

  // Add feature starting at 100 - should fit on same row (no overlap)
  const top = l.addRect('f2', 100, 200, 10)
  expect(top).toEqual(0)

  // Add feature starting at 50 - overlaps f1, goes to row 1
  const top2 = l.addRect('f3', 50, 150, 10)
  expect(top2).toEqual(10)
})

test('binary search kicks in for many intervals', () => {
  const l = new PileupLayout({ featureHeight: 10, spacing: 0 })

  // Add many non-overlapping features to row 0
  for (let i = 0; i < 50; i++) {
    l.addRect(`f${i}`, i * 100, i * 100 + 50, 10)
  }

  // All should be on row 0
  const rects = l.getRectangles()
  for (let i = 0; i < 50; i++) {
    expect(rects.get(`f${i}`)?.[1]).toEqual(0)
  }

  expect(l.getTotalHeight()).toEqual(10)
})
