import {
  distanceToCubicBezier,
  distanceToSegment,
  findHoveredEdge,
  findHoveredNode,
} from './hitDetection.ts'

import type { Graph } from '../types.ts'

describe('distanceToSegment', () => {
  test('point on the segment', () => {
    expect(distanceToSegment(5, 0, 0, 0, 10, 0)).toBeCloseTo(0)
  })

  test('point perpendicular to segment midpoint', () => {
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3)
  })

  test('point closest to segment start', () => {
    expect(distanceToSegment(-1, 0, 0, 0, 10, 0)).toBeCloseTo(1)
  })

  test('point closest to segment end', () => {
    expect(distanceToSegment(11, 0, 0, 0, 10, 0)).toBeCloseTo(1)
  })

  test('zero-length segment (point)', () => {
    expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5)
  })
})

describe('distanceToCubicBezier', () => {
  test('straight-line bezier at midpoint', () => {
    // control points on the line = straight bezier
    const dist = distanceToCubicBezier(5, 1, 0, 0, 3.3, 0, 6.6, 0, 10, 0)
    expect(dist).toBeLessThan(1.5)
  })

  test('point far from bezier', () => {
    const dist = distanceToCubicBezier(100, 100, 0, 0, 3, 0, 7, 0, 10, 0)
    expect(dist).toBeGreaterThan(100)
  })
})

describe('findHoveredNode', () => {
  const nodePositions = {
    'A+': [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    'B+': [
      { x: 20, y: 20 },
      { x: 30, y: 20 },
    ],
  }

  test('finds node when cursor is on segment', () => {
    expect(findHoveredNode(nodePositions, 5, 0, 1)).toBe('A+')
  })

  test('finds node when cursor is near segment', () => {
    expect(findHoveredNode(nodePositions, 5, 3, 1)).toBe('A+')
  })

  test('returns null when cursor is far from nodes', () => {
    expect(findHoveredNode(nodePositions, 50, 50, 1)).toBeNull()
  })

  test('respects scale for threshold', () => {
    // At scale 10, threshold is 5/10 = 0.5, so a point 3 units away should miss
    expect(findHoveredNode(nodePositions, 5, 3, 10)).toBeNull()
  })
})

describe('findHoveredEdge', () => {
  // Horizontal A→B edge so the path-offset perpendicular is purely vertical;
  // each of 3 paths occupies a lane at y ≈ -3, 0, +3 (offsetDist = 3).
  const nodePositions = {
    'A+': [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ],
    'B+': [
      { x: 150, y: 0 },
      { x: 200, y: 0 },
    ],
  }
  const graph: Graph = {
    name: 't',
    nodes: [
      { id: 'A+', name: 'A', length: 50, depth: 1 },
      { id: 'B+', name: 'B', length: 50, depth: 1 },
    ],
    edges: [{ from: 'A+', to: 'B+', overlap: 0, pathIds: ['p1', 'p2', 'p3'] }],
  }

  test('hits edge on center lane', () => {
    expect(findHoveredEdge(nodePositions, graph, 100, 0, 1, true)).toBe(0)
  })

  test('hits edge on offset path lane', () => {
    // Outer lane sits ~3 units off center; 10/scale threshold easily covers it.
    expect(findHoveredEdge(nodePositions, graph, 100, 3, 1, true)).toBe(0)
  })

  test('misses when far from all lanes', () => {
    expect(findHoveredEdge(nodePositions, graph, 100, 200, 1, true)).toBeNull()
  })

  test('drawPaths=false still hits on centerline', () => {
    expect(findHoveredEdge(nodePositions, graph, 100, 0, 1, false)).toBe(0)
  })
})
