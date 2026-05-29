import {
  getBlue,
  getGreen,
  getRed,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import { createDotplotColorFunction } from './dotplotColors.ts'

import type { DotplotRpcData } from './types.ts'

function fakeRpcData(overrides: Partial<DotplotRpcData> = {}): DotplotRpcData {
  const f64 = new Float64Array(1)
  return {
    p11: f64,
    p12: f64,
    p21: f64,
    p22: f64,
    padHs: new Float32Array(1),
    padVs: new Float32Array(1),
    strands: new Int8Array([1]),
    starts: new Uint32Array([0]),
    ends: new Uint32Array([100]),
    parsedCigars: [[]],
    identities: new Float32Array([0.5]),
    meanScores: new Float32Array([0.5]),
    mappingQuals: new Float32Array([30]),
    refNames: ['chr1'],
    totalFeatureCount: 1,
    skippedFeatureCount: 0,
    swappedMatchCount: 0,
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

  // Locks in that the HSL math matches the canonical browser HSL within 1
  // channel — this is the regression test for the parseCssColor refactor.
  test('identity HSL output matches CSS hsl reference within 1', () => {
    const data = fakeRpcData({ identities: new Float32Array([0, 0.5, 1]) })
    const fn = createDotplotColorFunction('identity', 1, data)
    const checkHue = (i: number, hue: number) => {
      const ref = parseCssColor(`hsl(${hue}, 100%, 40%)`)
      const got = unpack(fn(data, i))
      expect(Math.abs(got.r - getRed(ref))).toBeLessThanOrEqual(1)
      expect(Math.abs(got.g - getGreen(ref))).toBeLessThanOrEqual(1)
      expect(Math.abs(got.b - getBlue(ref))).toBeLessThanOrEqual(1)
    }
    // hueScale=120 for identity: 0→red, 0.5→yellow-green, 1→green
    checkHue(0, 0)
    checkHue(1, 60)
    checkHue(2, 120)
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
