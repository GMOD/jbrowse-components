import { colorSchemes } from '@jbrowse/synteny-core'

import {
  computeDotplotColors,
  createDotplotColorFunction,
} from './dotplotColors.ts'
import { buildLineSegments } from './dotplotGeometry.ts'
import { fakeDotplotRpcData } from './testUtils.ts'

import type { DotplotRpcData } from './types.ts'

// The shared payload with values in every continuous channel, since what is
// under test here is what the ramps do with them.
function fakeRpcData(overrides: Partial<DotplotRpcData> = {}): DotplotRpcData {
  return fakeDotplotRpcData({
    attributes: {
      identity: new Float32Array([0.5]),
      meanIdentity: new Float32Array([0.5]),
      mappingQual: new Float32Array([30]),
      dnds: new Float32Array([-1]),
    },
    ...overrides,
  })
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
    const fn = createDotplotColorFunction('strand', data, TRACK_COLOR, {})
    expect(fn(0)).not.toBe(fn(1))
  })

  // The dotplot and synteny renderers must paint strand from the same shared
  // constants — these used to be independently hardcoded here and could drift
  // off colorSchemes without any test noticing.
  test('strand colors come from the shared colorSchemes', () => {
    const data = fakeRpcData({ strands: new Int8Array([1, -1]) })
    const fn = createDotplotColorFunction('strand', data, TRACK_COLOR, {})
    expect(unpack(fn(0))).toMatchObject(rgbOfHex(colorSchemes.strand.posColor))
    expect(unpack(fn(1))).toMatchObject(rgbOfHex(colorSchemes.strand.negColor))
  })

  test('default returns the shared point color (black)', () => {
    const data = fakeRpcData()
    const fn = createDotplotColorFunction('default', data, TRACK_COLOR, {})
    expect(unpack(fn(0))).toEqual({ r: 0, g: 0, b: 0, a: 255 })
    expect(unpack(fn(0))).toMatchObject(
      rgbOfHex(colorSchemes.default.pointColor),
    )
  })

  // Identity uses the perceptually-uniform viridis ramp: dark purple at low
  // identity, bright yellow at high. Lock in the endpoints and that luminance
  // increases monotonically (the property colorblind-safe ramps must have).
  test('identity ramp is viridis (dark purple → yellow, monotonic luminance)', () => {
    const data = fakeRpcData({
      attributes: { identity: new Float32Array([0, 0.25, 0.5, 0.75, 1]) },
    })
    const fn = createDotplotColorFunction('identity', data, TRACK_COLOR, {})
    const lum = (i: number) => {
      const { r, g, b } = unpack(fn(i))
      return 0.299 * r + 0.587 * g + 0.114 * b
    }
    expect(unpack(fn(0))).toMatchObject({ r: 68, g: 1, b: 84 })
    expect(unpack(fn(4))).toMatchObject({ r: 253, g: 231, b: 37 })
    for (let i = 1; i < 5; i++) {
      expect(lum(i)).toBeGreaterThan(lum(i - 1))
    }
  })

  test('missing-value sentinel (-1) returns red', () => {
    const data = fakeRpcData({
      attributes: { identity: new Float32Array([-1]) },
    })
    const fn = createDotplotColorFunction('identity', data, TRACK_COLOR, {})
    expect(unpack(fn(0))).toMatchObject({ r: 255, g: 0, b: 0 })
  })

  test('track paints the assigned track color', () => {
    const data = fakeRpcData({ strands: new Int8Array([1, -1]) })
    const fn = createDotplotColorFunction('track', data, TRACK_COLOR, {})
    // flat: strand, identity and refName all ignored
    expect(fn(0)).toBe(fn(1))
    expect(unpack(fn(0))).toEqual({
      ...rgbOfHex(TRACK_COLOR),
      a: 255,
    })
  })

  // The plot-wide opacity slider is a render parameter — `u.alpha` in
  // dotplot.slang, `DotplotDrawParams.alpha` on the Canvas2D/SVG side — so
  // every packed color stays opaque and a drag never invalidates this array.
  // It used to be baked in here, which made a drag recompute the colors,
  // re-pack every instance and re-upload the buffer once per frame.
  test.each(['default', 'strand', 'track', 'identity', 'query'] as const)(
    '%s packs a fully opaque color',
    colorBy => {
      const data = fakeRpcData()
      const fn = createDotplotColorFunction(colorBy, data, TRACK_COLOR, {})
      expect(unpack(fn(0)).a).toBe(255)
    },
  )

  test('query gives every feature on one chromosome the same color', () => {
    const data = fakeRpcData({
      refNameDict: ['chrX', 'chrY'],
      refNameIds: new Uint32Array([0, 0, 1]),
    })
    const fn = createDotplotColorFunction('query', data, TRACK_COLOR, {})
    expect(fn(0)).toBe(fn(1))
  })

  // The color is hashed from the NAME, not from the dictionary index. That
  // matters because the dictionary is built in feature-arrival order, so the
  // same chromosome lands on a different id from one fetch window to the next —
  // keyed on the id, a pan would repaint the whole plot in new colors.
  test('a chromosome keeps its color when the dictionary reorders', () => {
    const first = fakeRpcData({
      refNameDict: ['chrX', 'chrY'],
      refNameIds: new Uint32Array([0]),
    })
    const second = fakeRpcData({
      refNameDict: ['chrY', 'chrX'],
      refNameIds: new Uint32Array([1]),
    })
    expect(createDotplotColorFunction('query', first, TRACK_COLOR, {})(0)) //
      .toBe(createDotplotColorFunction('query', second, TRACK_COLOR, {})(0))
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
      alignmentLengths: new Uint32Array([300, 300]),
      attributes: {
        identity: new Float32Array([0.5, 0.5]),
        meanIdentity: new Float32Array([0.5, 0.5]),
        mappingQual: new Float32Array([30, 30]),
      },
      refNameDict: ['chr1', 'chr2'],
      refNameIds: new Uint32Array([0, 1]),
      mateRefNameDict: ['ctg1', 'ctg2'],
      mateRefNameIds: new Uint32Array([0, 1]),
      cigarData: new Uint32Array([M(100), M(100), M(100), M(300)]),
      cigarOffsets: new Uint32Array([0, 3, 4]),
      totalFeatureCount: 2,
      skippedFeatureCount: 0,
    })
  }

  test("every cigar segment carries its own feature's color", () => {
    const rpcData = twoFeatures()
    const instanceData = buildLineSegments(rpcData, true, 0, 0, 1, 1, 0, 0)
    const colors = computeDotplotColors({
      instanceData,
      rpcData,
      colorBy: 'strand',
      trackColor: TRACK_COLOR,
      attributeRanges: {},
    })
    // feature 0 walks 3 cigar ops, feature 1 walks 1
    expect([...instanceData.instanceFeatureIdx]).toEqual([0, 0, 0, 1])
    const fn = createDotplotColorFunction('strand', rpcData, TRACK_COLOR, {})
    expect([...colors]).toEqual([fn(0), fn(0), fn(0), fn(1)])
  })

  test('filtered-out features do not shift the color mapping', () => {
    const rpcData = fakeRpcData({
      p11: new Float64Array([0, 10_000]),
      p12: new Float64Array([50, 10_300]),
      p21: new Float64Array([0, 10_000]),
      p22: new Float64Array([50, 10_300]),
      strands: new Int8Array([1, -1]),
      alignmentLengths: new Uint32Array([50, 300]),
      attributes: {
        identity: new Float32Array([0.5, 0.5]),
        meanIdentity: new Float32Array([0.5, 0.5]),
        mappingQual: new Float32Array([30, 30]),
      },
      refNameDict: ['chr1', 'chr2'],
      refNameIds: new Uint32Array([0, 1]),
      mateRefNameDict: ['ctg1', 'ctg2'],
      mateRefNameIds: new Uint32Array([0, 1]),
      cigarOffsets: new Uint32Array([0, 0, 0]),
      totalFeatureCount: 2,
      skippedFeatureCount: 0,
    })
    // minAlignmentLength drops feature 0, so the only segment is feature 1's
    const instanceData = buildLineSegments(rpcData, false, 100, 0, 1, 1, 0, 0)
    expect([...instanceData.instanceFeatureIdx]).toEqual([1])
    const colors = computeDotplotColors({
      instanceData,
      rpcData,
      colorBy: 'strand',
      trackColor: TRACK_COLOR,
      attributeRanges: {},
    })
    expect(colors[0]).toBe(
      createDotplotColorFunction('strand', rpcData, TRACK_COLOR, {})(1),
    )
  })
})
