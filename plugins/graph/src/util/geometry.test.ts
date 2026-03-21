import { projectLine, computeEdgeCurves } from './geometry.ts'

describe('projectLine', () => {
  test('projects along positive x direction', () => {
    const [x, y] = projectLine(0, 0, 10, 0, 5)
    expect(x).toBeCloseTo(15)
    expect(y).toBeCloseTo(0)
  })

  test('projects along positive y direction', () => {
    const [x, y] = projectLine(0, 0, 0, 10, 5)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(15)
  })

  test('projects along diagonal', () => {
    const [x, y] = projectLine(0, 0, 3, 4, 5)
    expect(x).toBeCloseTo(6)
    expect(y).toBeCloseTo(8)
  })

  test('handles zero-length segment', () => {
    const [x, y] = projectLine(5, 5, 5, 5, 10)
    expect(x).toBe(5)
    expect(y).toBe(5)
  })
})

describe('computeEdgeCurves', () => {
  test('returns single curve for normal edge', () => {
    const from = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const to = [{ x: 20, y: 0 }, { x: 30, y: 0 }]
    const curves = computeEdgeCurves(from, to, false, 0, 0)

    expect(curves).toHaveLength(1)
    expect(curves[0]!.x0).toBeCloseTo(10)
    expect(curves[0]!.y0).toBeCloseTo(0)
    expect(curves[0]!.x1).toBeCloseTo(20)
    expect(curves[0]!.y1).toBeCloseTo(0)
  })

  test('returns two curves for self-loop', () => {
    const segments = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const curves = computeEdgeCurves(segments, segments, true, 0, 0)

    expect(curves).toHaveLength(2)
    expect(curves[0]!.x1).toBeCloseTo(curves[1]!.x0)
    expect(curves[0]!.y1).toBeCloseTo(curves[1]!.y0)
  })

  test('applies offset to curve endpoints', () => {
    const from = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const to = [{ x: 20, y: 0 }, { x: 30, y: 0 }]
    const curves = computeEdgeCurves(from, to, false, 0, 5)

    expect(curves[0]!.y0).toBeCloseTo(5)
    expect(curves[0]!.y1).toBeCloseTo(5)
  })
})
