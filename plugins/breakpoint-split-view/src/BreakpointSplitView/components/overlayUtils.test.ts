import {
  buildBreakpointPath,
  buildSimplePath,
  strandToSign,
} from './overlayUtils'

describe('strandToSign', () => {
  test('returns 1 for positive strand', () => {
    expect(strandToSign('+')).toBe(1)
  })

  test('returns -1 for negative strand', () => {
    expect(strandToSign('-')).toBe(-1)
  })

  test('returns 0 for unknown strand', () => {
    expect(strandToSign('.')).toBe(0)
    expect(strandToSign('')).toBe(0)
    expect(strandToSign('?')).toBe(0)
  })
})

describe('buildSimplePath', () => {
  test('builds straight line when y values differ', () => {
    const path = buildSimplePath(0, 0, 100, 50)
    expect(path).toBe('M 0 0 L 100 50')
  })

  test('builds arc when y values are equal (flat line)', () => {
    const path = buildSimplePath(0, 100, 100, 100)
    expect(path).toContain('Q')
    expect(path).toContain('M 0 100')
    expect(path).toContain('100 100')
    expect(path).toContain('50 70')
  })
})

describe('buildBreakpointPath', () => {
  test('builds straight line with ticks when y values differ', () => {
    const path = buildBreakpointPath(50, 0, 150, 50, 30, 170)
    expect(path).toBe('M 30 0 L 50 0 L 150 50 L 170 50')
  })

  test('builds arc with ticks when y values are equal (flat line)', () => {
    const path = buildBreakpointPath(50, 100, 150, 100, 30, 170)
    expect(path).toContain('M 30 100 L 50 100')
    expect(path).toContain('Q')
    expect(path).toContain('L 170 100')
    expect(path).toContain('100 70')
  })

  test('arc control point is at midpoint horizontally', () => {
    const path = buildBreakpointPath(0, 100, 200, 100, -20, 220)
    expect(path).toContain('100 70')
  })
})
