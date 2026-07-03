import { createDotplotColorFunction } from './dotplotColors.ts'

import type { DotplotRpcData } from './types.ts'

function fakeRpcData(overrides: Partial<DotplotRpcData> = {}): DotplotRpcData {
  const f64 = new Float64Array(1)
  return {
    p11: f64,
    p12: f64,
    p21: f64,
    p22: f64,
    strands: new Int8Array([1]),
    starts: new Uint32Array([0]),
    ends: new Uint32Array([100]),
    parsedCigars: [[]],
    identities: new Float32Array([0.5]),
    meanScores: new Float32Array([0.5]),
    meanIdentities: new Float32Array([0.5]),
    mappingQuals: new Float32Array([30]),
    refNames: ['chr1'],
    mateRefNames: ['chr2'],
    totalFeatureCount: 1,
    skippedFeatureCount: 0,
    ...overrides,
  }
}

function unpack(packed: number) {
  return {
    r: packed & 0xff,
    g: (packed >>> 8) & 0xff,
    b: (packed >>> 16) & 0xff,
    a: (packed >>> 24) & 0xff,
  }
}

describe('createDotplotColorFunction', () => {
  test('strand picks two colors for +/-', () => {
    const data = fakeRpcData({ strands: new Int8Array([1, -1]) })
    const fn = createDotplotColorFunction('strand', 1, data)
    expect(fn(data, 0)).not.toBe(fn(data, 1))
  })

  test('default returns black', () => {
    const data = fakeRpcData()
    const fn = createDotplotColorFunction('default', 1, data)
    expect(unpack(fn(data, 0))).toEqual({ r: 0, g: 0, b: 0, a: 255 })
  })

  // Identity uses the perceptually-uniform viridis ramp: dark purple at low
  // identity, bright yellow at high. Lock in the endpoints and that luminance
  // increases monotonically (the property colorblind-safe ramps must have).
  test('identity ramp is viridis (dark purple → yellow, monotonic luminance)', () => {
    const data = fakeRpcData({
      identities: new Float32Array([0, 0.25, 0.5, 0.75, 1]),
    })
    const fn = createDotplotColorFunction('identity', 1, data)
    const lum = (i: number) => {
      const { r, g, b } = unpack(fn(data, i))
      return 0.299 * r + 0.587 * g + 0.114 * b
    }
    expect(unpack(fn(data, 0))).toMatchObject({ r: 68, g: 1, b: 84 })
    expect(unpack(fn(data, 4))).toMatchObject({ r: 253, g: 231, b: 37 })
    for (let i = 1; i < 5; i++) {
      expect(lum(i)).toBeGreaterThan(lum(i - 1))
    }
  })

  test('missing-value sentinel (-1) returns red', () => {
    const data = fakeRpcData({ identities: new Float32Array([-1]) })
    const fn = createDotplotColorFunction('identity', 1, data)
    expect(unpack(fn(data, 0))).toMatchObject({ r: 255, g: 0, b: 0 })
  })

  test('query caches color by refName', () => {
    const data = fakeRpcData({ refNames: ['chrX', 'chrX', 'chrY'] })
    const fn = createDotplotColorFunction('query', 1, data)
    // Same name → same color; different name → may differ.
    expect(fn(data, 0)).toBe(fn(data, 1))
  })
})
