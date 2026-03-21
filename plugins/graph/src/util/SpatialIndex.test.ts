import { SpatialIndex } from './SpatialIndex.ts'

const positions = {
  'A+': [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  'B+': [{ x: 200, y: 200 }, { x: 300, y: 200 }],
  'C+': [{ x: 0, y: 0 }, { x: 0, y: 100 }],
}

test('finds nearby segments', () => {
  const index = new SpatialIndex(positions, 50)
  const results = index.query(50, 0, 10)
  const nodeIds = results.map(r => r.nodeId)
  expect(nodeIds).toContain('A+')
  expect(nodeIds).not.toContain('B+')
})

test('finds nothing when far from all segments', () => {
  const index = new SpatialIndex(positions, 50)
  const results = index.query(500, 500, 10)
  expect(results).toHaveLength(0)
})

test('finds segments near intersection', () => {
  const index = new SpatialIndex(positions, 50)
  const results = index.query(0, 0, 10)
  const nodeIds = new Set(results.map(r => r.nodeId))
  expect(nodeIds.has('A+')).toBe(true)
  expect(nodeIds.has('C+')).toBe(true)
})

test('larger radius finds more candidates', () => {
  const index = new SpatialIndex(positions, 50)
  const small = index.query(150, 100, 10)
  const large = index.query(150, 100, 200)
  expect(large.length).toBeGreaterThanOrEqual(small.length)
})

test('deduplicates entries across cells', () => {
  const index = new SpatialIndex(positions, 10)
  const results = index.query(50, 0, 20)
  const keys = results.map(r => `${r.nodeId}:${r.segmentIdx}`)
  const unique = new Set(keys)
  expect(keys.length).toBe(unique.size)
})
