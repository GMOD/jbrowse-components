import { computeEdgeCurves, projectLine, translateCurves } from './geometry.ts'

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
    const from = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    const to = [
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ]
    const curves = computeEdgeCurves(from, to, false, 0, 0)

    expect(curves).toHaveLength(1)
    expect(curves[0]!.x0).toBeCloseTo(10)
    expect(curves[0]!.y0).toBeCloseTo(0)
    expect(curves[0]!.x1).toBeCloseTo(20)
    expect(curves[0]!.y1).toBeCloseTo(0)
  })

  test('returns two curves for self-loop', () => {
    const segments = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    const curves = computeEdgeCurves(segments, segments, true, 0, 0)

    expect(curves).toHaveLength(2)
    expect(curves[0]!.x1).toBeCloseTo(curves[1]!.x0)
    expect(curves[0]!.y1).toBeCloseTo(curves[1]!.y0)
  })

  test('applies offset to curve endpoints', () => {
    const from = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    const to = [
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ]
    const curves = computeEdgeCurves(from, to, false, 0, 5)

    expect(curves[0]!.y0).toBeCloseTo(5)
    expect(curves[0]!.y1).toBeCloseTo(5)
  })
})

describe('translateCurves matches computeEdgeCurves offset', () => {
  // Hit detection caches base curves (offset 0) and applies path offsets via
  // translateCurves; this must stay numerically equivalent to calling
  // computeEdgeCurves with offsets directly.
  const cases: [
    string,
    { x: number; y: number }[],
    { x: number; y: number }[],
    boolean,
  ][] = [
    [
      'straight edge',
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
      false,
    ],
    [
      'diagonal edge',
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ],
      [
        { x: 25, y: 18 },
        { x: 40, y: 30 },
      ],
      false,
    ],
    [
      'self-loop',
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      true,
    ],
  ]

  const offsets = [
    [3, 0],
    [0, -7],
    [2.5, 2.5],
  ]

  test.each(cases)(
    '%s: translation equals offset compute',
    (_name, from, to, selfLoop) => {
      const base = computeEdgeCurves(from, to, selfLoop, 0, 0)
      for (const [dx, dy] of offsets) {
        const translated = translateCurves(base, dx!, dy!)
        const direct = computeEdgeCurves(from, to, selfLoop, dx!, dy!)
        expect(translated).toHaveLength(direct.length)
        for (let i = 0; i < direct.length; i++) {
          const t = translated[i]!
          const d = direct[i]!
          expect(t.x0).toBeCloseTo(d.x0)
          expect(t.y0).toBeCloseTo(d.y0)
          expect(t.cx0).toBeCloseTo(d.cx0)
          expect(t.cy0).toBeCloseTo(d.cy0)
          expect(t.cx1).toBeCloseTo(d.cx1)
          expect(t.cy1).toBeCloseTo(d.cy1)
          expect(t.x1).toBeCloseTo(d.x1)
          expect(t.y1).toBeCloseTo(d.y1)
        }
      }
    },
  )
})
