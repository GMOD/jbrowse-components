import { colorSchemes } from '@jbrowse/synteny-core'

import {
  computeDotplotColors,
  createDotplotColorFunction,
} from './dotplotColors.ts'
import { buildLineSegments } from './dotplotGeometry.ts'

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
    cigarData: new Uint32Array(0),
    cigarOffsets: new Uint32Array([0, 0]),
    identities: new Float32Array([0.5]),
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

function rgbOfHex(hex: string) {
  const h = hex.length === 4 ? hex.replaceAll(/([\da-f])/gi, '$1$1') : hex
  return {
    r: Number.parseInt(h.slice(1, 3), 16),
    g: Number.parseInt(h.slice(3, 5), 16),
    b: Number.parseInt(h.slice(5, 7), 16),
  }
}

// Arbitrary; only the 'track' mode reads it, and that mode's whole contract is
// that it paints exactly this color.
const TRACK_COLOR = '#4e79a7'

describe('createDotplotColorFunction', () => {
  test('strand picks two colors for +/-', () => {
    const data = fakeRpcData({ strands: new Int8Array([1, -1]) })
    const fn = createDotplotColorFunction('strand', 1, data, TRACK_COLOR)
    expect(fn(data, 0)).not.toBe(fn(data, 1))
  })

  // The dotplot and synteny renderers must paint strand from the same shared
  // constants — these used to be independently hardcoded here and could drift
  // off colorSchemes without any test noticing.
  test('strand colors come from the shared colorSchemes', () => {
    const data = fakeRpcData({ strands: new Int8Array([1, -1]) })
    const fn = createDotplotColorFunction('strand', 1, data, TRACK_COLOR)
    expect(unpack(fn(data, 0))).toMatchObject(
      rgbOfHex(colorSchemes.strand.posColor),
    )
    expect(unpack(fn(data, 1))).toMatchObject(
      rgbOfHex(colorSchemes.strand.negColor),
    )
  })

  test('default returns the shared point color (black)', () => {
    const data = fakeRpcData()
    const fn = createDotplotColorFunction('default', 1, data, TRACK_COLOR)
    expect(unpack(fn(data, 0))).toEqual({ r: 0, g: 0, b: 0, a: 255 })
    expect(unpack(fn(data, 0))).toMatchObject(
      rgbOfHex(colorSchemes.default.pointColor),
    )
  })

  // Identity uses the perceptually-uniform viridis ramp: dark purple at low
  // identity, bright yellow at high. Lock in the endpoints and that luminance
  // increases monotonically (the property colorblind-safe ramps must have).
  test('identity ramp is viridis (dark purple → yellow, monotonic luminance)', () => {
    const data = fakeRpcData({
      identities: new Float32Array([0, 0.25, 0.5, 0.75, 1]),
    })
    const fn = createDotplotColorFunction('identity', 1, data, TRACK_COLOR)
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
    const fn = createDotplotColorFunction('identity', 1, data, TRACK_COLOR)
    expect(unpack(fn(data, 0))).toMatchObject({ r: 255, g: 0, b: 0 })
  })

  test('track paints the assigned track color at the current alpha', () => {
    const data = fakeRpcData({ strands: new Int8Array([1, -1]) })
    const fn = createDotplotColorFunction('track', 0.5, data, TRACK_COLOR)
    // flat: strand, identity and refName all ignored
    expect(fn(data, 0)).toBe(fn(data, 1))
    expect(unpack(fn(data, 0))).toEqual({
      ...rgbOfHex(TRACK_COLOR),
      a: 128,
    })
  })

  test('query caches color by refName', () => {
    const data = fakeRpcData({ refNames: ['chrX', 'chrX', 'chrY'] })
    const fn = createDotplotColorFunction('query', 1, data, TRACK_COLOR)
    // Same name → same color; different name → may differ.
    expect(fn(data, 0)).toBe(fn(data, 1))
  })
})

// The colors pass is the gpuProps half of the split: it runs against the
// segment -> feature map alone, so it has to agree segment-for-segment with
// what the (now color-free) geometry builder emitted — including across the
// CIGAR expansion, where one feature owns many segments.
describe('computeDotplotColors', () => {
  const M = (len: number) => (len << 4) | 0

  function twoFeatures(): DotplotRpcData {
    return fakeRpcData({
      p11: new Float64Array([0, 10_000]),
      p12: new Float64Array([300, 10_300]),
      p21: new Float64Array([0, 10_000]),
      p22: new Float64Array([300, 10_300]),
      strands: new Int8Array([1, -1]),
      starts: new Uint32Array([0, 0]),
      ends: new Uint32Array([300, 300]),
      identities: new Float32Array([0.5, 0.5]),
      meanIdentities: new Float32Array([0.5, 0.5]),
      mappingQuals: new Float32Array([30, 30]),
      refNames: ['chr1', 'chr2'],
      mateRefNames: ['ctg1', 'ctg2'],
      cigarData: new Uint32Array([M(100), M(100), M(100), M(300)]),
      cigarOffsets: new Uint32Array([0, 3, 4]),
      totalFeatureCount: 2,
      skippedFeatureCount: 0,
    })
  }

  test("every cigar segment carries its own feature's color", () => {
    const rpcData = twoFeatures()
    const instanceData = buildLineSegments(rpcData, true, 0, 1, 1, 0, 0)
    const colors = computeDotplotColors({
      instanceData,
      rpcData,
      colorBy: 'strand',
      alpha: 1,
      trackColor: TRACK_COLOR,
    })
    // feature 0 walks 3 cigar ops, feature 1 walks 1
    expect([...instanceData.instanceFeatureIdx]).toEqual([0, 0, 0, 1])
    const fn = createDotplotColorFunction('strand', 1, rpcData, TRACK_COLOR)
    expect([...colors]).toEqual([
      fn(rpcData, 0),
      fn(rpcData, 0),
      fn(rpcData, 0),
      fn(rpcData, 1),
    ])
  })

  test('filtered-out features do not shift the color mapping', () => {
    const rpcData = fakeRpcData({
      p11: new Float64Array([0, 10_000]),
      p12: new Float64Array([50, 10_300]),
      p21: new Float64Array([0, 10_000]),
      p22: new Float64Array([50, 10_300]),
      strands: new Int8Array([1, -1]),
      starts: new Uint32Array([0, 0]),
      ends: new Uint32Array([50, 300]),
      identities: new Float32Array([0.5, 0.5]),
      meanIdentities: new Float32Array([0.5, 0.5]),
      mappingQuals: new Float32Array([30, 30]),
      refNames: ['chr1', 'chr2'],
      mateRefNames: ['ctg1', 'ctg2'],
      cigarOffsets: new Uint32Array([0, 0, 0]),
      totalFeatureCount: 2,
      skippedFeatureCount: 0,
    })
    // minAlignmentLength drops feature 0, so the only segment is feature 1's
    const instanceData = buildLineSegments(rpcData, false, 100, 1, 1, 0, 0)
    expect([...instanceData.instanceFeatureIdx]).toEqual([1])
    const colors = computeDotplotColors({
      instanceData,
      rpcData,
      colorBy: 'strand',
      alpha: 1,
      trackColor: TRACK_COLOR,
    })
    expect(colors[0]).toBe(
      createDotplotColorFunction('strand', 1, rpcData, TRACK_COLOR)(rpcData, 1),
    )
  })
})
