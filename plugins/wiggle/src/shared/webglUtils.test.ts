import { parseColor } from './webglUtils.ts'

describe('parseColor', () => {
  test('parses hex color', () => {
    const [r, g, b] = parseColor('#ff0000')
    expect(r).toBeCloseTo(1)
    expect(g).toBeCloseTo(0)
    expect(b).toBeCloseTo(0)
  })

  test('parses named color', () => {
    const [r, g, b] = parseColor('blue')
    expect(r).toBeCloseTo(0)
    expect(g).toBeCloseTo(0)
    expect(b).toBeCloseTo(1)
  })

  test('different color strings return different results', () => {
    const red = parseColor('#ff0000')
    const blue = parseColor('#0000ff')
    expect(red).not.toEqual(blue)
  })

  test('same color string returns cached result', () => {
    const a = parseColor('#abcdef')
    const b = parseColor('#abcdef')
    expect(a).toBe(b)
  })

  test('returns normalized 0-1 values', () => {
    const [r, g, b] = parseColor('#804020')
    expect(r).toBeCloseTo(128 / 255)
    expect(g).toBeCloseTo(64 / 255)
    expect(b).toBeCloseTo(32 / 255)
  })
})
